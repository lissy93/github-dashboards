import { describe, it, expect } from 'vitest';
import {
	buildChecks,
	grade,
	summariseAlerts,
	tally,
	type SecurityAlerts,
	type SecuritySignals
} from '$lib/server/github/security';

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
	hasContributing: true,
	hasIssueTemplates: true,
	branchProtection: 'pass',
	branchRules: null,
	signedCommits: { signed: 30, sampled: 30 },
	codeScanning: 'pass',
	secretScanning: 'pass',
	dependabotAlerts: 'pass',
	privateVulnReporting: 'pass'
};

const alertsOf = (counts: SecurityAlerts['counts']): SecurityAlerts => ({
	counts,
	total: Object.values(counts).reduce((sum, count) => sum + count, 0),
	top: []
});

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
		expect(status({ ...base, hasDependabot: false }, 'Dependabot updates')).toBe('warn');
	});

	it('shows the visible ruleset rules in the protection detail and tooltip', () => {
		const rules = { labels: ['PRs required', 'no force pushes'], approvals: 2 };
		const check = buildChecks({ ...base, branchRules: rules }, NOW).find(
			(entry) => entry.name === 'Branch protection'
		);
		expect(check?.detail).toBe('Protected: PRs required, no force pushes');
		expect(check?.hint).toBe('2 approving reviews required');
	});

	it('grades signed commits against the sampled history', () => {
		expect(status({ ...base, signedCommits: { signed: 25, sampled: 30 } }, 'Signed commits')).toBe(
			'warn'
		);
		expect(status({ ...base, signedCommits: null }, 'Signed commits')).toBe('na');
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
		expect(status({ ...base, privateVulnReporting: 'na' }, 'Private vulnerability reporting')).toBe(
			'na'
		);
	});

	it('marks the community profile checks na when the profile was unreadable', () => {
		expect(status({ ...base, hasContributing: null }, 'Contributing guide')).toBe('na');
		expect(status({ ...base, hasIssueTemplates: false }, 'Issue templates')).toBe('warn');
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
		// Fourteen checks, one na drops out, the failing license is applicable but unpassed
		expect(applicable).toBe(13);
		expect(passed).toBe(12);
	});
});

describe('grade', () => {
	it('gives a fully passing repo with no alerts a clean A', () => {
		expect(grade(buildChecks(base, NOW), null)).toEqual({ score: 100, letter: 'A' });
	});

	it('loses points in proportion to the failed check weight', () => {
		const checks = buildChecks({ ...base, branchProtection: 'warn' }, NOW);
		// Branch protection is the heaviest check, 3 of the 24 weighted points
		expect(grade(checks, null)).toEqual({ score: 88, letter: 'B' });
	});

	it('keeps na checks out of the denominator entirely', () => {
		const checks = buildChecks({ ...base, branchProtection: 'na' }, NOW);
		expect(grade(checks, null).score).toBe(100);
	});

	it('penalises open alerts by severity and floors the score at zero', () => {
		const checks = buildChecks(base, NOW);
		const mixed = alertsOf({ critical: 1, high: 1, moderate: 2, low: 0 });
		expect(grade(checks, mixed)).toEqual({ score: 50, letter: 'D' });
		const swamped = alertsOf({ critical: 5, high: 0, moderate: 0, low: 0 });
		expect(grade(checks, swamped)).toEqual({ score: 0, letter: 'F' });
	});
});

describe('summariseAlerts', () => {
	it('counts by severity and keeps the worst alerts first', () => {
		const vuln = (severity: 'critical' | 'high' | 'moderate' | 'low', name: string) => ({
			name,
			ecosystem: 'npm',
			severity,
			summary: 'test',
			identifier: name,
			url: 'https://example.com',
			vulnerableRange: '<1.0.0',
			patchedVersion: null
		});
		const alerts = summariseAlerts([vuln('low', 'a'), vuln('critical', 'b'), vuln('high', 'c')]);
		expect(alerts.total).toBe(3);
		expect(alerts.counts).toEqual({ critical: 1, high: 1, moderate: 0, low: 1 });
		expect(alerts.top.map((entry) => entry.severity)).toEqual(['critical', 'high', 'low']);
	});
});
