import { seriesColor } from '$lib/components/charts/chart';
import type { Slice } from '$lib/views/stats';
import type { SortFilterConfig } from '$lib/components/filter/sort-filter';
import type { Dependency, LicenseRisk, VulnSeverity } from '$lib/server/github/supply-chain';

// Token per licence risk bucket, reused by the donut and the table tags
export const RISK_COLOR: Record<LicenseRisk, string> = {
	permissive: 'var(--success)',
	'weak-copyleft': 'var(--warning)',
	'strong-copyleft': 'var(--danger)',
	unknown: 'var(--muted-foreground)'
};
export const RISK_LABEL: Record<LicenseRisk, string> = {
	permissive: 'Permissive',
	'weak-copyleft': 'Weak copyleft',
	'strong-copyleft': 'Strong copyleft',
	unknown: 'Unknown'
};
const RISK_ORDER: LicenseRisk[] = ['permissive', 'weak-copyleft', 'strong-copyleft', 'unknown'];

// Token per advisory severity, danger for the two that need acting on now
export const SEVERITY_COLOR: Record<VulnSeverity, string> = {
	critical: 'var(--danger)',
	high: 'var(--danger)',
	moderate: 'var(--warning)',
	low: 'var(--info)'
};

// Advisory counts per severity, worst first, for compact chip rows
export function severitySlices(vulnerabilities: { severity: VulnSeverity }[]): Slice[] {
	const order: VulnSeverity[] = ['critical', 'high', 'moderate', 'low'];
	return order
		.map((severity) => ({
			label: severity,
			value: vulnerabilities.filter((vuln) => vuln.severity === severity).length,
			color: SEVERITY_COLOR[severity]
		}))
		.filter((slice) => slice.value > 0);
}

// Tally packages into labelled buckets, dropping empties and sorting big first
function tally(packages: Dependency[], pick: (pkg: Dependency) => string): Map<string, number> {
	const counts = new Map<string, number>();
	for (const pkg of packages) counts.set(pick(pkg), (counts.get(pick(pkg)) ?? 0) + 1);
	return counts;
}

// Per-ecosystem rollup of weight and risk, more useful than a lopsided count donut
export type EcosystemStat = {
	name: string;
	color: string;
	total: number;
	direct: number;
	transitive: number;
	vulnerable: number;
	unlicensed: number;
};
export function ecosystemStats(packages: Dependency[]): EcosystemStat[] {
	const stats = new Map<string, EcosystemStat>();
	for (const pkg of packages) {
		let stat = stats.get(pkg.ecosystem);
		if (!stat) {
			stat = {
				name: pkg.ecosystem,
				color: '',
				total: 0,
				direct: 0,
				transitive: 0,
				vulnerable: 0,
				unlicensed: 0
			};
			stats.set(pkg.ecosystem, stat);
		}
		stat.total += 1;
		if (pkg.direct) stat.direct += 1;
		else stat.transitive += 1;
		if (pkg.vuln) stat.vulnerable += 1;
		if (!pkg.license) stat.unlicensed += 1;
	}
	return [...stats.values()]
		.sort((first, second) => second.total - first.total)
		.map((stat, index) => ({ ...stat, color: seriesColor(index) }));
}

// Licence risk split for the compliance donut
export function licenseRiskSlices(packages: Dependency[]): Slice[] {
	const counts = tally(packages, (pkg) => pkg.licenseRisk);
	return RISK_ORDER.map((risk) => ({
		label: RISK_LABEL[risk],
		value: counts.get(risk) ?? 0,
		color: RISK_COLOR[risk]
	})).filter((slice) => slice.value > 0);
}

// Most common individual licences tinted by risk bucket, unresolved ones grouped as Unlicensed
export function topLicenseBars(packages: Dependency[], limit = 24): Slice[] {
	const counts = new Map<string, { value: number; risk: LicenseRisk }>();
	for (const pkg of packages) {
		const label = pkg.license ?? 'Unlicensed';
		const entry = counts.get(label);
		if (entry) entry.value += 1;
		else counts.set(label, { value: 1, risk: pkg.licenseRisk });
	}
	return [...counts]
		.sort((a, b) => b[1].value - a[1].value)
		.slice(0, limit)
		.map(([label, { value, risk }]) => ({
			label,
			value,
			color: RISK_COLOR[risk],
			rows: [
				{ label: 'Packages', value: String(value) },
				{ label: 'Category', value: RISK_LABEL[risk] }
			]
		}));
}

// Packages the most other packages rely on, the single points of failure
export function topDependedOnSlices(packages: Dependency[], limit = 8): Slice[] {
	return packages
		.filter((pkg) => pkg.fanIn > 0)
		.slice(0, limit)
		.map((pkg, index) => ({
			label: pkg.name,
			value: pkg.fanIn,
			color: seriesColor(index),
			rows: [
				{ label: 'Depended on by', value: `${pkg.fanIn} packages` },
				{ label: 'Version', value: pkg.version ?? 'unknown' },
				{ label: 'Ecosystem', value: pkg.ecosystem }
			]
		}));
}

// Direct deps you declared vs transitive ones pulled in, the one actionable split in depth
export const DIRECT_COLOR = 'var(--chart-1)';
export const TRANSITIVE_COLOR = 'color-mix(in oklch, var(--chart-1) 50%, var(--muted))';

// Full depth histogram, one bar per level so the tail past direct deps stays visible
export function depthHistogram(packages: Dependency[]): Slice[] {
	const reached = packages
		.map((pkg) => pkg.depth)
		.filter((depth): depth is number => depth !== null);
	const deepest = reached.length ? Math.max(...reached) : 0;
	const counts = new Map<number, number>();
	for (const depth of reached) counts.set(depth, (counts.get(depth) ?? 0) + 1);
	return Array.from({ length: deepest }, (_, index) => {
		const depth = index + 1;
		const value = counts.get(depth) ?? 0;
		// Only the direct/transitive boundary carries meaning, so tint by that not by a risk ramp
		return {
			label: String(depth),
			value,
			color: depth === 1 ? DIRECT_COLOR : TRANSITIVE_COLOR,
			rows: [
				{ label: 'Relation', value: depth === 1 ? 'direct' : 'transitive' },
				{ label: 'Hops from root', value: String(depth) },
				{ label: 'Packages', value: String(value) }
			]
		};
	});
}

// Packages GitHub lists but never links back to the root, shown as a caption not a bar
export function unreachedCount(packages: Dependency[]): number {
	return packages.filter((pkg) => pkg.depth === null).length;
}

// Sort, filter and search config for the full dependency table
export function supplyChainConfig(packages: Dependency[]): SortFilterConfig<Dependency> {
	const ecosystems = [...new Set(packages.map((pkg) => pkg.ecosystem))].sort();
	return {
		search: (pkg) => pkg.name,
		sorts: [
			{ key: 'fanIn', label: 'Most depended on', value: (pkg) => pkg.fanIn },
			{ key: 'name', label: 'Name', value: (pkg) => pkg.name },
			{ key: 'depth', label: 'Depth', value: (pkg) => pkg.depth ?? 99 },
			{ key: 'license', label: 'Licence', value: (pkg) => pkg.license ?? 'zzz' }
		],
		filters: [
			{
				key: 'ecosystem',
				label: 'ecosystems',
				options: ecosystems.map((value) => ({ value, label: value })),
				test: (pkg, value) => pkg.ecosystem === value
			},
			{
				key: 'risk',
				label: 'licences',
				options: RISK_ORDER.map((value) => ({ value, label: RISK_LABEL[value] })),
				test: (pkg, value) => pkg.licenseRisk === value
			},
			{
				key: 'relation',
				label: 'relations',
				options: [
					{ value: 'direct', label: 'Direct' },
					{ value: 'transitive', label: 'Transitive' }
				],
				test: (pkg, value) => (value === 'direct' ? pkg.direct : !pkg.direct)
			},
			{
				key: 'flag',
				label: 'flags',
				options: [
					{ value: 'vulnerable', label: 'Vulnerable' },
					{ value: 'unlicensed', label: 'Unlicensed' }
				],
				test: (pkg, value) => (value === 'vulnerable' ? Boolean(pkg.vuln) : !pkg.license)
			}
		]
	};
}

// Dependency rows as CSV text for the export button, audit-friendly column order
export function toCsv(packages: Dependency[]): string {
	const header = [
		'name',
		'version',
		'ecosystem',
		'license',
		'relation',
		'depth',
		'depended_on_by',
		'vulnerability'
	];
	const escape = (value: string) =>
		/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
	const rows = packages.map((pkg) =>
		[
			pkg.name,
			pkg.version ?? '',
			pkg.ecosystem,
			pkg.license ?? '',
			pkg.direct ? 'direct' : 'transitive',
			pkg.depth ?? '',
			pkg.fanIn,
			pkg.vuln ?? ''
		]
			.map((cell) => escape(String(cell)))
			.join(',')
	);
	return [header.join(','), ...rows].join('\n');
}
