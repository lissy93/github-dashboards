import { graphql, rest } from '$lib/server/github/client';
import { cached, isCached } from '$lib/server/cache';
import { createLogger } from '$lib/logger';

const log = createLogger('supply-chain');
// Dependencies move slowly, so cache for a while and refresh on visit
const TTL = 21600;

export type LicenseRisk = 'permissive' | 'weak-copyleft' | 'strong-copyleft' | 'unknown';
export type VulnSeverity = 'critical' | 'high' | 'moderate' | 'low';

// One resolved dependency in the repo's graph, flattened from the SPDX SBOM
export type Dependency = {
	name: string;
	version: string | null;
	ecosystem: string;
	license: string | null;
	licenseRisk: LicenseRisk;
	direct: boolean;
	depth: number | null;
	fanIn: number;
	url: string | null;
	vuln: VulnSeverity | null;
};

// One open advisory affecting a dependency, from the GraphQL vulnerability alerts
export type Vulnerability = {
	name: string;
	ecosystem: string;
	severity: VulnSeverity;
	summary: string;
	identifier: string;
	url: string;
	vulnerableRange: string;
	patchedVersion: string | null;
};

export type ManifestFile = { path: string; ecosystem: string; count: number };

export type SupplyChainSummary = {
	total: number;
	direct: number;
	transitive: number;
	ecosystems: number;
	licenses: number;
	unlicensed: number;
	vulnerabilities: number;
	manifests: number;
};

export type SupplyChain = {
	packages: Dependency[];
	vulnerabilities: Vulnerability[];
	manifests: ManifestFile[];
	summary: SupplyChainSummary;
};

// SPDX shapes, only the fields we read
type SpdxRef = { referenceType: string; referenceLocator: string };
type SpdxPackage = {
	name: string;
	SPDXID: string;
	versionInfo?: string;
	licenseConcluded?: string;
	licenseDeclared?: string;
	externalRefs?: SpdxRef[];
};
type SpdxRel = { spdxElementId: string; relatedSpdxElement: string; relationshipType: string };
type Sbom = {
	sbom: { packages: SpdxPackage[]; relationships: SpdxRel[] };
};

// Map a purl ecosystem to how we label it and where the package lives
const ECOSYSTEMS: Record<string, { label: string; url?: (name: string) => string }> = {
	npm: { label: 'npm', url: (name) => `https://www.npmjs.com/package/${name}` },
	pypi: { label: 'pip', url: (name) => `https://pypi.org/project/${name}` },
	gem: { label: 'gem', url: (name) => `https://rubygems.org/gems/${name}` },
	cargo: { label: 'cargo', url: (name) => `https://crates.io/crates/${name}` },
	nuget: { label: 'nuget', url: (name) => `https://www.nuget.org/packages/${name}` },
	composer: { label: 'composer', url: (name) => `https://packagist.org/packages/${name}` },
	golang: { label: 'go', url: (name) => `https://pkg.go.dev/${name}` },
	maven: { label: 'maven', url: (name) => `https://central.sonatype.com/artifact/${name}` },
	githubactions: { label: 'actions', url: (name) => `https://github.com/${name}` },
	actions: { label: 'actions', url: (name) => `https://github.com/${name}` }
};

// Pull the ecosystem and registry url out of a package's purl reference
function fromPurl(pkg: SpdxPackage): { ecosystem: string; url: string | null } {
	const purl = pkg.externalRefs?.find((ref) => ref.referenceType === 'purl')?.referenceLocator;
	const raw = purl?.match(/^pkg:([^/]+)\//)?.[1]?.toLowerCase() ?? 'unknown';
	const entry = ECOSYSTEMS[raw];
	if (!entry) return { ecosystem: raw, url: null };
	// maven purls separate group and artifact with a slash, the registry wants the same
	const path = raw === 'maven' ? pkg.name.replace(':', '/') : pkg.name;
	return { ecosystem: entry.label, url: entry.url ? entry.url(path) : null };
}

const STRONG = /\bA?GPL\b/i;
const WEAK = /\b(LGPL|MPL|EPL|CDDL|MS-RL)\b/i;

// Bucket an SPDX licence id by how restrictive it is for downstream use
export function licenseRisk(license: string | null): LicenseRisk {
	if (!license) return 'unknown';
	if (license.startsWith('LGPL')) return 'weak-copyleft';
	if (STRONG.test(license)) return 'strong-copyleft';
	if (WEAK.test(license)) return 'weak-copyleft';
	return 'permissive';
}

// A concluded NOASSERTION or NONE means GitHub could not resolve a licence
function cleanLicense(pkg: SpdxPackage): string | null {
	const value = pkg.licenseConcluded ?? pkg.licenseDeclared ?? '';
	return value && value !== 'NOASSERTION' && value !== 'NONE' ? value : null;
}

// Direct deps, per-package depth and fan-in, walked from the document root
function walkGraph(packages: SpdxPackage[], rels: SpdxRel[]) {
	const root = rels.find((rel) => rel.relationshipType === 'DESCRIBES')?.relatedSpdxElement;
	const edges = new Map<string, string[]>();
	const fanIn = new Map<string, number>();
	for (const rel of rels) {
		if (rel.relationshipType !== 'DEPENDS_ON') continue;
		const list = edges.get(rel.spdxElementId);
		if (list) list.push(rel.relatedSpdxElement);
		else edges.set(rel.spdxElementId, [rel.relatedSpdxElement]);
		fanIn.set(rel.relatedSpdxElement, (fanIn.get(rel.relatedSpdxElement) ?? 0) + 1);
	}

	// Breadth-first from the root so each package gets its shortest dependency depth
	const depth = new Map<string, number>();
	let frontier = root ? (edges.get(root) ?? []) : [];
	let level = 1;
	while (frontier.length) {
		const next: string[] = [];
		for (const id of frontier) {
			if (depth.has(id)) continue;
			depth.set(id, level);
			next.push(...(edges.get(id) ?? []));
		}
		frontier = next;
		level += 1;
	}
	return { depth, fanIn };
}

export function buildPackages(sbom: Sbom['sbom']): Dependency[] {
	const { depth, fanIn } = walkGraph(sbom.packages, sbom.relationships);
	const rootId = sbom.relationships.find(
		(rel) => rel.relationshipType === 'DESCRIBES'
	)?.relatedSpdxElement;

	return sbom.packages
		.filter((pkg) => pkg.SPDXID !== rootId)
		.map((pkg) => {
			const license = cleanLicense(pkg);
			const { ecosystem, url } = fromPurl(pkg);
			const at = depth.get(pkg.SPDXID) ?? null;
			return {
				name: pkg.name,
				version: pkg.versionInfo ?? null,
				ecosystem,
				license,
				licenseRisk: licenseRisk(license),
				direct: at === 1,
				depth: at,
				fanIn: fanIn.get(pkg.SPDXID) ?? 0,
				url,
				vuln: null as VulnSeverity | null
			};
		})
		.sort((first, second) => second.fanIn - first.fanIn || first.name.localeCompare(second.name));
}

// Vulnerability alerts, readable without admin and empty when not visible
const VULN_QUERY = `
	query SupplyChainVulns($owner: String!, $name: String!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			vulnerabilityAlerts(first: 100, states: OPEN, after: $cursor) {
				pageInfo { hasNextPage endCursor }
				nodes {
					securityVulnerability {
						severity
						vulnerableVersionRange
						firstPatchedVersion { identifier }
						package { name ecosystem }
						advisory {
							summary
							permalink
							identifiers { type value }
						}
					}
				}
			}
		}
	}
`;

type RawVuln = {
	securityVulnerability: {
		severity: string;
		vulnerableVersionRange: string;
		firstPatchedVersion: { identifier: string } | null;
		package: { name: string; ecosystem: string };
		advisory: {
			summary: string;
			permalink: string;
			identifiers: { type: string; value: string }[];
		};
	} | null;
};
type VulnPage = {
	repository: {
		vulnerabilityAlerts: {
			pageInfo: { hasNextPage: boolean; endCursor: string | null };
			nodes: RawVuln[];
		};
	} | null;
};

const severityOf = (value: string): VulnSeverity => {
	const lower = value.toLowerCase();
	return lower === 'critical' || lower === 'high' || lower === 'moderate' || lower === 'low'
		? lower
		: 'moderate';
};

async function fetchVulns(owner: string, name: string): Promise<Vulnerability[]> {
	const out: Vulnerability[] = [];
	let cursor: string | null = null;
	do {
		const data: VulnPage = await graphql<VulnPage>(VULN_QUERY, { owner, name, cursor });
		const page = data.repository?.vulnerabilityAlerts;
		if (!page) break;
		for (const node of page.nodes) {
			const vuln = node.securityVulnerability;
			if (!vuln) continue;
			const ghsa = vuln.advisory.identifiers.find((id) => id.type === 'GHSA');
			const cve = vuln.advisory.identifiers.find((id) => id.type === 'CVE');
			out.push({
				name: vuln.package.name,
				ecosystem: vuln.package.ecosystem.toLowerCase(),
				severity: severityOf(vuln.severity),
				summary: vuln.advisory.summary,
				identifier: cve?.value ?? ghsa?.value ?? 'advisory',
				url: vuln.advisory.permalink,
				vulnerableRange: vuln.vulnerableVersionRange,
				patchedVersion: vuln.firstPatchedVersion?.identifier ?? null
			});
		}
		cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
	} while (cursor);
	return out;
}

// dependenciesCount only populates when the dependencies connection is co-requested
const MANIFEST_QUERY = `
	query SupplyChainManifests($owner: String!, $name: String!) {
		repository(owner: $owner, name: $name) {
			dependencyGraphManifests(first: 100) {
				nodes { filename dependencies { totalCount } }
			}
		}
	}
`;

// Infer the ecosystem behind a manifest file from its name
export function manifestEcosystem(path: string): string {
	const file = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
	if (path.includes('.github/workflows/')) return 'actions';
	if (/package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml/.test(file)) return 'npm';
	if (/requirements.*\.txt|pipfile|pyproject\.toml|setup\.py|poetry\.lock/.test(file)) return 'pip';
	if (/gemfile/.test(file)) return 'gem';
	if (/go\.(mod|sum)/.test(file)) return 'go';
	if (/cargo\.(toml|lock)/.test(file)) return 'cargo';
	if (/composer\.(json|lock)/.test(file)) return 'composer';
	if (/pom\.xml|build\.gradle/.test(file)) return 'maven';
	if (/\.csproj|packages\.config/.test(file)) return 'nuget';
	if (/dockerfile/.test(file)) return 'docker';
	return 'other';
}

type RawManifest = { filename: string; dependencies: { totalCount: number } };
type RawManifests = {
	repository: { dependencyGraphManifests: { nodes: RawManifest[] } } | null;
};

async function fetchManifests(owner: string, name: string): Promise<ManifestFile[]> {
	const { repository } = await graphql<RawManifests>(MANIFEST_QUERY, { owner, name });
	const nodes = repository?.dependencyGraphManifests.nodes ?? [];
	// Busiest manifests first so the ones defining the most dependencies lead
	return nodes
		.map((node) => ({
			path: node.filename,
			ecosystem: manifestEcosystem(node.filename),
			count: node.dependencies.totalCount
		}))
		.sort((first, second) => second.count - first.count || first.path.localeCompare(second.path));
}

const empty: SupplyChain = {
	packages: [],
	vulnerabilities: [],
	manifests: [],
	summary: {
		total: 0,
		direct: 0,
		transitive: 0,
		ecosystems: 0,
		licenses: 0,
		unlicensed: 0,
		vulnerabilities: 0,
		manifests: 0
	}
};

// Worst severity wins when a package has more than one advisory
const SEVERITY_RANK: Record<VulnSeverity, number> = { critical: 4, high: 3, moderate: 2, low: 1 };

function summarise(
	packages: Dependency[],
	vulnerabilities: Vulnerability[],
	manifests: ManifestFile[]
): SupplyChainSummary {
	const direct = packages.filter((pkg) => pkg.direct).length;
	return {
		total: packages.length,
		direct,
		transitive: packages.length - direct,
		ecosystems: new Set(packages.map((pkg) => pkg.ecosystem)).size,
		licenses: new Set(packages.map((pkg) => pkg.license).filter(Boolean)).size,
		unlicensed: packages.filter((pkg) => !pkg.license).length,
		vulnerabilities: vulnerabilities.length,
		manifests: manifests.length
	};
}

async function fetchSupplyChain(owner: string, name: string): Promise<SupplyChain> {
	const [sbom, manifests, vulnerabilities] = await Promise.all([
		rest<Sbom>(`/repos/${owner}/${name}/dependency-graph/sbom`),
		// Manifests and alerts are best-effort, a gap there must not blank the inventory
		fetchManifests(owner, name).catch((error) => {
			log.warn(`manifests unavailable for ${owner}/${name}`, { error });
			return [] as ManifestFile[];
		}),
		fetchVulns(owner, name).catch((error) => {
			log.warn(`vulnerability alerts unavailable for ${owner}/${name}`, { error });
			return [] as Vulnerability[];
		})
	]);
	if (!sbom) return empty;

	const packages = buildPackages(sbom.sbom);

	// Stamp the worst known severity onto each affected package for the table badge
	const worst = new Map<string, VulnSeverity>();
	for (const vuln of vulnerabilities) {
		const key = `${vuln.ecosystem}:${vuln.name}`.toLowerCase();
		const current = worst.get(key);
		if (!current || SEVERITY_RANK[vuln.severity] > SEVERITY_RANK[current])
			worst.set(key, vuln.severity);
	}
	for (const pkg of packages)
		pkg.vuln = worst.get(`${pkg.ecosystem}:${pkg.name}`.toLowerCase()) ?? null;

	return {
		packages,
		vulnerabilities,
		manifests,
		summary: summarise(packages, vulnerabilities, manifests)
	};
}

const key = (owner: string, name: string) => `repo:supply-chain:v2:${owner}/${name}`.toLowerCase();

export const isSupplyChainCached = (owner: string, name: string) => isCached(key(owner, name));

// Dependency inventory, licences and open advisories for a repo, cached with SWR
export function getSupplyChain(owner: string, name: string): Promise<SupplyChain> {
	return cached(key(owner, name), () => fetchSupplyChain(owner, name), TTL);
}
