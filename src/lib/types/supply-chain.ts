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
