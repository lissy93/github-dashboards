import { describe, it, expect } from 'vitest';
import { buildPackages, licenseRisk, manifestEcosystem } from '$lib/server/github/supply-chain';
import { depthHistogram, ecosystemStats, topLicenseBars } from '$lib/views/supply-chain';

const purl = (eco: string, name: string) => ({
	externalRefs: [{ referenceType: 'purl', referenceLocator: `pkg:${eco}/${name}` }]
});

// A small graph: root -> a, a -> b, c is depended on by both a and b
const sbom = {
	packages: [
		{ name: 'root', SPDXID: 'ROOT' },
		{ name: 'a', SPDXID: 'A', versionInfo: '1.0.0', licenseConcluded: 'MIT', ...purl('npm', 'a') },
		{
			name: 'b',
			SPDXID: 'B',
			versionInfo: '2.0.0',
			licenseConcluded: 'GPL-3.0',
			...purl('npm', 'b')
		},
		{
			name: 'c',
			SPDXID: 'C',
			versionInfo: '3.0.0',
			licenseConcluded: 'NOASSERTION',
			...purl('pypi', 'c')
		}
	],
	relationships: [
		{
			spdxElementId: 'SPDXRef-DOCUMENT',
			relatedSpdxElement: 'ROOT',
			relationshipType: 'DESCRIBES'
		},
		{ spdxElementId: 'ROOT', relatedSpdxElement: 'A', relationshipType: 'DEPENDS_ON' },
		{ spdxElementId: 'A', relatedSpdxElement: 'B', relationshipType: 'DEPENDS_ON' },
		{ spdxElementId: 'A', relatedSpdxElement: 'C', relationshipType: 'DEPENDS_ON' },
		{ spdxElementId: 'B', relatedSpdxElement: 'C', relationshipType: 'DEPENDS_ON' }
	]
};

describe('buildPackages', () => {
	const built = buildPackages(sbom);
	const byName = (name: string) => built.find((pkg) => pkg.name === name)!;

	it('drops the document root and keeps the real packages', () => {
		expect(built.map((pkg) => pkg.name).sort()).toEqual(['a', 'b', 'c']);
	});

	it('marks only root dependencies as direct', () => {
		expect(byName('a').direct).toBe(true);
		expect(byName('b').direct).toBe(false);
	});

	it('assigns shortest depth from the root', () => {
		expect(byName('a').depth).toBe(1);
		expect(byName('b').depth).toBe(2);
		expect(byName('c').depth).toBe(2);
	});

	it('counts fan-in across all dependents', () => {
		expect(byName('c').fanIn).toBe(2);
		expect(byName('b').fanIn).toBe(1);
	});

	it('reads ecosystem from the purl and resolves a registry url', () => {
		expect(byName('a').ecosystem).toBe('npm');
		expect(byName('a').url).toBe('https://www.npmjs.com/package/a');
		expect(byName('c').ecosystem).toBe('pip');
	});

	it('treats NOASSERTION as an unresolved licence', () => {
		expect(byName('c').license).toBeNull();
		expect(byName('c').licenseRisk).toBe('unknown');
	});
});

describe('depthHistogram', () => {
	// a is direct (1), b and c both sit at depth 2
	const bars = depthHistogram(buildPackages(sbom));

	it('emits one bar per level up to the deepest package', () => {
		expect(bars.map((bar) => bar.label)).toEqual(['1', '2']);
	});

	it('counts packages at each depth', () => {
		expect(bars.map((bar) => bar.value)).toEqual([1, 2]);
	});
});

describe('ecosystemStats', () => {
	// npm holds a (direct) and b (transitive); pip holds c (transitive, unlicensed)
	const stats = ecosystemStats(buildPackages(sbom));
	const npm = stats.find((stat) => stat.name === 'npm')!;
	const pip = stats.find((stat) => stat.name === 'pip')!;

	it('orders ecosystems by package count', () => {
		expect(stats.map((stat) => stat.name)).toEqual(['npm', 'pip']);
	});

	it('splits direct vs transitive within each ecosystem', () => {
		expect([npm.total, npm.direct, npm.transitive]).toEqual([2, 1, 1]);
		expect([pip.total, pip.direct, pip.transitive]).toEqual([1, 0, 1]);
	});

	it('rolls up unlicensed packages per ecosystem', () => {
		expect(npm.unlicensed).toBe(0);
		expect(pip.unlicensed).toBe(1);
	});
});

describe('topLicenseBars', () => {
	// a is MIT, b is GPL-3.0, c has no resolvable licence
	const bars = topLicenseBars(buildPackages(sbom));
	const bar = (label: string) => bars.find((slice) => slice.label === label)!;

	it('groups unresolved licences under Unlicensed', () => {
		expect(bar('Unlicensed').value).toBe(1);
	});

	it('tints each licence by its risk bucket', () => {
		expect(bar('MIT').color).toBe('var(--success)');
		expect(bar('GPL-3.0').color).toBe('var(--danger)');
		expect(bar('Unlicensed').color).toBe('var(--muted-foreground)');
	});
});

describe('licenseRisk', () => {
	it('classifies copyleft strength', () => {
		expect(licenseRisk('MIT')).toBe('permissive');
		expect(licenseRisk('Apache-2.0')).toBe('permissive');
		expect(licenseRisk('LGPL-3.0')).toBe('weak-copyleft');
		expect(licenseRisk('MPL-2.0')).toBe('weak-copyleft');
		expect(licenseRisk('GPL-3.0')).toBe('strong-copyleft');
		expect(licenseRisk('AGPL-3.0')).toBe('strong-copyleft');
		expect(licenseRisk(null)).toBe('unknown');
	});
});

describe('manifestEcosystem', () => {
	it('maps manifest filenames to ecosystems', () => {
		expect(manifestEcosystem('package.json')).toBe('npm');
		expect(manifestEcosystem('yarn.lock')).toBe('npm');
		expect(manifestEcosystem('.github/workflows/ci.yml')).toBe('actions');
		expect(manifestEcosystem('requirements.txt')).toBe('pip');
		expect(manifestEcosystem('go.mod')).toBe('go');
		expect(manifestEcosystem('Gemfile')).toBe('gem');
		expect(manifestEcosystem('mystery.cfg')).toBe('other');
	});
});
