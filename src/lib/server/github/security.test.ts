import { describe, it, expect } from 'vitest';
import { buildChecks, tally, type SecuritySignals } from '$lib/server/github/security';

const NOW = Date.parse('2026-06-23T00:00:00Z');

// A healthy repo, individual tests override the one signal they exercise
const base: SecuritySignals = {
	repoUrl: 'https://github.com/o/r',
	isArchived: false,
	pushedAt: '2026-06-20T00:00:00Z',
	license: 'MIT',
	hasSecurityPolicy: true,
	securityPolicyUrl: 'https://github.com/o/r/security/policy',
	codeOfConduct: 'Contributor Covenant',
	hasWorkflows: true,
	hasDependabot: true,
	branchProtection: 'pass',
	codeScanning: 'pass'
};

const status = (signals: SecuritySignals, name: string) =>
	buildChecks(signals, NOW).find((check) => check.name === name)?.status;

describe('buildChecks', () => {
	it('passes every check for a healthy repo', () => {
		expect(buildChecks(base, NOW).every((check) => check.status === 'pass')).toBe(true);
	});

	it('fails the license check when no license is present', () => {
		expect(status({ ...base, license: null }, 'License')).toBe('fail');
	});

	it('warns when no security policy or Dependabot config', () => {
		expect(status({ ...base, hasSecurityPolicy: false }, 'Security policy')).toBe('warn');
		expect(status({ ...base, hasDependabot: false }, 'Dependabot')).toBe('warn');
	});

	it('marks the repo unmaintained past the 90 day window', () => {
		expect(status({ ...base, pushedAt: '2026-01-01T00:00:00Z' }, 'Maintained')).toBe('warn');
	});

	it('fails Maintained for an archived repo even if recently pushed', () => {
		expect(status({ ...base, isArchived: true }, 'Maintained')).toBe('fail');
	});

	it('passes the admin-gated checks straight through their resolved status', () => {
		expect(status({ ...base, branchProtection: 'na' }, 'Branch protection')).toBe('na');
		expect(status({ ...base, codeScanning: 'warn' }, 'Code scanning')).toBe('warn');
	});

	it('orders failing and warning checks ahead of passing ones', () => {
		const ordered = buildChecks({ ...base, license: null, hasWorkflows: false }, NOW);
		expect(ordered[0].status).toBe('fail');
		expect(ordered.at(-1)?.status).toBe('pass');
	});
});

describe('tally', () => {
	it('counts passes over applicable checks and excludes na from the denominator', () => {
		const checks = buildChecks({ ...base, license: null, branchProtection: 'na' }, NOW);
		const { passed, applicable } = tally(checks);
		// Eight checks, one na drops out, the failing license is applicable but unpassed
		expect(applicable).toBe(7);
		expect(passed).toBe(6);
	});
});
