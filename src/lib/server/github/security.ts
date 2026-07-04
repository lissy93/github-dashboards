import type {
	BranchRules,
	CheckStatus,
	GradeLetter,
	RepoSecurity,
	SecurityAdvisory,
	SecurityAlerts,
	SecurityCheck,
	SecurityGrade,
	Vulnerability,
	VulnSeverity
} from '$lib/types';
import { graphql, rest, restResponse, type AuthMode } from '$lib/server/github/client';
import { cached, isCached } from '$lib/server/cache';
import { formatDateTime, plural } from '$lib/utils/format';
import { fetchVulns, severityOf } from '$lib/server/github/supply-chain';
import { AppError, logError } from '$lib/utils/errors';

// Security posture moves slowly, refresh on visit like the rest of the board
const TTL = 900;
// A repo counts as maintained if it had a push within this many days
const MAINTAINED_DAYS = 90;
const DAY_MS = 86400000;

// Help links so a failing check tells the owner how to fix it
const DOCS = {
	license: 'https://docs.github.com/articles/licensing-a-repository',
	security:
		'https://docs.github.com/code-security/getting-started/adding-a-security-policy-to-your-repository',
	branch:
		'https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches',
	dependabot:
		'https://docs.github.com/code-security/dependabot/dependabot-version-updates/configuring-dependabot-version-updates',
	codeScanning:
		'https://docs.github.com/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning',
	actions: 'https://docs.github.com/actions',
	conduct:
		'https://docs.github.com/communities/setting-up-your-project-for-healthy-contributions/adding-a-code-of-conduct-to-your-project',
	contributing:
		'https://docs.github.com/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors',
	templates:
		'https://docs.github.com/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates',
	reporting:
		'https://docs.github.com/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository',
	signing:
		'https://docs.github.com/authentication/managing-commit-signature-verification/about-commit-signature-verification',
	secrets:
		'https://docs.github.com/code-security/secret-scanning/introduction/about-secret-scanning',
	alerts:
		'https://docs.github.com/code-security/dependabot/dependabot-alerts/about-dependabot-alerts'
};

// Public security signals, all readable without admin so one query never partial-errors
const SIGNED_SAMPLE = 30;
const QUERY = `
	query RepoSecurity($owner: String!, $name: String!) {
		repository(owner: $owner, name: $name) {
			url
			isPrivate
			isArchived
			pushedAt
			licenseInfo { spdxId }
			isSecurityPolicyEnabled
			securityPolicyUrl
			codeOfConduct { name }
			defaultBranchRef {
				name
				target {
					... on Commit {
						history(first: ${SIGNED_SAMPLE}) { nodes { signature { isValid } } }
					}
				}
			}
			workflows: object(expression: "HEAD:.github/workflows") { __typename }
			dependabot: object(expression: "HEAD:.github/dependabot.yml") { __typename }
			dependabotYaml: object(expression: "HEAD:.github/dependabot.yaml") { __typename }
			issueTemplates: object(expression: "HEAD:.github/ISSUE_TEMPLATE") { __typename }
		}
	}
`;

type RawSecurity = {
	url: string;
	isPrivate: boolean;
	isArchived: boolean;
	pushedAt: string;
	licenseInfo: { spdxId: string | null } | null;
	isSecurityPolicyEnabled: boolean;
	securityPolicyUrl: string | null;
	codeOfConduct: { name: string } | null;
	defaultBranchRef: {
		name: string;
		target: { history?: { nodes: { signature: { isValid: boolean } | null }[] } } | null;
	} | null;
	workflows: { __typename: string } | null;
	dependabot: { __typename: string } | null;
	dependabotYaml: { __typename: string } | null;
	issueTemplates: { __typename: string } | null;
};

// Normalised facts the checks are built from, so the builder stays pure and testable
export type SecuritySignals = {
	repoUrl: string;
	isArchived: boolean;
	pushedAt: string;
	license: string | null;
	hasSecurityPolicy: boolean;
	securityPolicyUrl: string | null;
	codeOfConduct: string | null;
	hasWorkflows: boolean;
	hasDependabot: boolean;
	hasContributing: boolean | null;
	hasIssueTemplates: boolean | null;
	branchProtection: CheckStatus;
	branchRules: BranchRules | null;
	signedCommits: { signed: number; sampled: number } | null;
	codeScanning: CheckStatus;
	secretScanning: CheckStatus;
	dependabotAlerts: CheckStatus;
	privateVulnReporting: CheckStatus;
};

// Wording for the probed checks, na means we could not tell either way
const PROTECTION = {
	pass: 'Default branch protected',
	warn: 'Default branch unprotected',
	fail: 'Default branch unprotected',
	na: 'Protection status unknown'
} as const;
const SCANNING = {
	pass: 'Code scanning active',
	warn: 'No code scanning set up',
	fail: 'No code scanning set up',
	na: 'Needs security access to check'
} as const;
const REPORTING = {
	pass: 'Private reporting enabled',
	warn: 'Private reporting disabled',
	fail: 'Private reporting disabled',
	na: 'Not readable for this repo'
} as const;
const SECRETS = {
	pass: 'Secret scanning enabled',
	warn: 'Secret scanning disabled',
	fail: 'Secret scanning disabled',
	na: 'Needs admin access to check'
} as const;
const ALERTS = {
	pass: 'Vulnerability alerts enabled',
	warn: 'Vulnerability alerts disabled',
	fail: 'Vulnerability alerts disabled',
	na: 'Needs admin access to check'
} as const;

// Map a nullable boolean signal to a status, null meaning we could not read it
const triState = (value: boolean | null): CheckStatus =>
	value === null ? 'na' : value ? 'pass' : 'warn';

// Detail and tooltip for branch protection, listing the visible rules when there are any
function protectionInfo(signals: SecuritySignals): { detail: string; hint?: string } {
	const rules = signals.branchRules;
	if (signals.branchProtection !== 'pass' || !rules?.labels.length)
		return {
			detail: PROTECTION[signals.branchProtection],
			hint:
				signals.branchProtection === 'pass'
					? 'Classic protection, rule details are admin only'
					: undefined
		};
	const { approvals } = rules;
	return {
		detail: `Protected: ${rules.labels.join(', ')}`,
		hint:
			approvals === null
				? undefined
				: `${approvals} approving ${plural(approvals, 'review')} required`
	};
}

// Turn the raw signals into the ordered list of pass/warn/fail/na checks
export function buildChecks(signals: SecuritySignals, now: number = Date.now()): SecurityCheck[] {
	const days = Math.floor((now - Date.parse(signals.pushedAt)) / DAY_MS);
	const signed = signals.signedCommits;
	const checks: SecurityCheck[] = [
		{
			name: 'License',
			status: signals.license ? 'pass' : 'fail',
			detail: signals.license ? `${signals.license} license` : 'No license file',
			url: DOCS.license,
			weight: 2
		},
		{
			name: 'Security policy',
			status: signals.hasSecurityPolicy ? 'pass' : 'warn',
			detail: signals.hasSecurityPolicy ? 'SECURITY.md published' : 'No security policy',
			url: signals.securityPolicyUrl ?? DOCS.security,
			weight: 2
		},
		{
			name: 'Private vulnerability reporting',
			status: signals.privateVulnReporting,
			detail: REPORTING[signals.privateVulnReporting],
			url: DOCS.reporting,
			weight: 2
		},
		{
			name: 'Branch protection',
			status: signals.branchProtection,
			...protectionInfo(signals),
			url: DOCS.branch,
			weight: 3
		},
		{
			name: 'Dependabot alerts',
			status: signals.dependabotAlerts,
			detail: ALERTS[signals.dependabotAlerts],
			url: DOCS.alerts,
			weight: 2
		},
		{
			name: 'Dependabot updates',
			status: signals.hasDependabot ? 'pass' : 'warn',
			detail: signals.hasDependabot ? 'dependabot.yml present' : 'No update config',
			url: DOCS.dependabot,
			weight: 2
		},
		{
			name: 'Secret scanning',
			status: signals.secretScanning,
			detail: SECRETS[signals.secretScanning],
			url: DOCS.secrets,
			weight: 2
		},
		{
			name: 'Code scanning',
			status: signals.codeScanning,
			detail: SCANNING[signals.codeScanning],
			url: DOCS.codeScanning,
			weight: 2
		},
		{
			name: 'Signed commits',
			status: !signed?.sampled ? 'na' : signed.signed / signed.sampled >= 0.9 ? 'pass' : 'warn',
			detail: !signed?.sampled
				? 'No commits to sample'
				: signed.signed
					? `${signed.signed}/${signed.sampled} recent commits signed`
					: 'Recent commits unsigned',
			hint: signed?.sampled
				? `Verified signatures on the last ${signed.sampled} default branch commits`
				: undefined,
			url: DOCS.signing,
			weight: 1
		},
		{
			name: 'CI workflows',
			status: signals.hasWorkflows ? 'pass' : 'warn',
			detail: signals.hasWorkflows ? 'GitHub Actions configured' : 'No CI workflows',
			url: DOCS.actions,
			weight: 1
		},
		{
			name: 'Maintained',
			status: signals.isArchived ? 'fail' : days <= MAINTAINED_DAYS ? 'pass' : 'warn',
			detail: signals.isArchived
				? 'Repository archived'
				: days <= MAINTAINED_DAYS
					? `Pushed ${days <= 0 ? 'today' : `${days}d ago`}`
					: `No pushes in ${days} days`,
			hint: signals.isArchived ? undefined : `Last push ${formatDateTime(signals.pushedAt)}`,
			url: signals.repoUrl,
			weight: 2
		},
		{
			name: 'Code of conduct',
			status: signals.codeOfConduct ? 'pass' : 'warn',
			detail: signals.codeOfConduct ?? 'No code of conduct',
			url: DOCS.conduct,
			weight: 1
		},
		{
			name: 'Contributing guide',
			status: triState(signals.hasContributing),
			detail:
				signals.hasContributing === null
					? 'Community profile not readable'
					: signals.hasContributing
						? 'CONTRIBUTING guide published'
						: 'No contributing guide',
			url: DOCS.contributing,
			weight: 1
		},
		{
			name: 'Issue templates',
			status: triState(signals.hasIssueTemplates),
			detail:
				signals.hasIssueTemplates === null
					? 'Community profile not readable'
					: signals.hasIssueTemplates
						? 'Issue templates configured'
						: 'No issue templates',
			url: DOCS.templates,
			weight: 1
		}
	];
	const order: Record<CheckStatus, number> = { fail: 0, warn: 1, na: 2, pass: 3 };
	return checks.sort((first, second) => order[first.status] - order[second.status]);
}

// Tally how many applicable checks pass, na checks sit outside the denominator
export function tally(checks: SecurityCheck[]): { passed: number; applicable: number } {
	const applicable = checks.filter((check) => check.status !== 'na');
	return {
		passed: applicable.filter((check) => check.status === 'pass').length,
		applicable: applicable.length
	};
}

// Points lost per open alert, and the score floor each letter sits on
const ALERT_PENALTY: Record<VulnSeverity, number> = { critical: 25, high: 15, moderate: 5, low: 2 };
const BANDS: [number, GradeLetter][] = [
	[90, 'A'],
	[75, 'B'],
	[60, 'C'],
	[40, 'D'],
	[0, 'F']
];

// Weighted share of passing checks minus a penalty per open alert, floored at zero
export function grade(checks: SecurityCheck[], alerts: SecurityAlerts | null): SecurityGrade {
	const applicable = checks.filter((check) => check.status !== 'na');
	const total = applicable.reduce((sum, check) => sum + check.weight, 0);
	const earned = applicable
		.filter((check) => check.status === 'pass')
		.reduce((sum, check) => sum + check.weight, 0);
	let score = total ? Math.round((earned / total) * 100) : 0;
	if (alerts)
		for (const severity of Object.keys(ALERT_PENALTY) as VulnSeverity[])
			score -= ALERT_PENALTY[severity] * alerts.counts[severity];
	score = Math.max(0, score);
	return { score, letter: BANDS.find(([floor]) => score >= floor)![1] };
}

// Fold the open alerts into severity counts plus the worst few for display
const TOP_ALERTS = 15;
const SEVERITY_RANK: Record<VulnSeverity, number> = { critical: 0, high: 1, moderate: 2, low: 3 };

export function summariseAlerts(vulns: Vulnerability[]): SecurityAlerts {
	const counts: Record<VulnSeverity, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
	for (const vuln of vulns) counts[vuln.severity] += 1;
	const top = [...vulns]
		.sort((first, second) => SEVERITY_RANK[first.severity] - SEVERITY_RANK[second.severity])
		.slice(0, TOP_ALERTS);
	return { counts, total: vulns.length, top };
}

// Resolve a status probe, mapping no-access or an error to na rather than failing the panel
async function guarded(label: string, read: () => Promise<CheckStatus>): Promise<CheckStatus> {
	try {
		return await read();
	} catch (error) {
		if (
			!(error instanceof AppError && (error.code === 'forbidden' || error.code === 'unauthorized'))
		)
			logError(`security-probe:${label}`, error);
		return 'na';
	}
}

// Admin-gated probes pass 'app' to keep the shared cache viewer-independent
const probe = (path: string, evaluate: (data: unknown) => CheckStatus, auth?: AuthMode) =>
	guarded(path, async () => evaluate(await rest(path, undefined, auth)));

// The alerts toggle answers 204 when on, 404 when off and 403 without admin access
const probeAlertsEnabled = (base: string) =>
	guarded('vulnerability-alerts', async () => {
		const res = await restResponse(`${base}/vulnerability-alerts`, undefined, 'app');
		await res?.body?.cancel();
		return res ? 'pass' : 'warn';
	});

// Human labels for ruleset rule types, unknown types fall back to the spaced type name
const RULE_LABELS: Record<string, string> = {
	pull_request: 'PRs required',
	required_status_checks: 'status checks',
	required_signatures: 'signed commits',
	required_linear_history: 'linear history',
	non_fast_forward: 'no force pushes',
	deletion: 'no deletions',
	creation: 'creation restricted',
	update: 'updates restricted',
	required_deployments: 'deployments required'
};

type RawRule = { type: string; parameters?: { required_approving_review_count?: number } };

// Active ruleset rules for a branch, public unlike the classic protection endpoint
async function fetchBranchRules(base: string, branch: string): Promise<BranchRules | null> {
	const rules = await rest<RawRule[]>(`${base}/rules/branches/${encodeURIComponent(branch)}`);
	if (!rules) return null;
	const labels = [
		...new Set(rules.map((rule) => RULE_LABELS[rule.type] ?? rule.type.replaceAll('_', ' ')))
	];
	const pr = rules.find((rule) => rule.type === 'pull_request');
	return { labels, approvals: pr?.parameters?.required_approving_review_count ?? null };
}

// Best-effort extras, a gap in one source must not blank the whole panel
async function attempt<T>(label: string, task: Promise<T>): Promise<T | null> {
	try {
		return await task;
	} catch (error) {
		logError(`security:${label}`, error);
		return null;
	}
}

type CommunityProfile = {
	files: { contributing: object | null; issue_template: object | null };
};

type RawRepoSettings = {
	security_and_analysis?: { secret_scanning?: { status: string } } | null;
};

type RawAdvisory = {
	ghsa_id: string;
	cve_id: string | null;
	summary: string;
	severity: string | null;
	published_at: string | null;
	html_url: string;
};

// Advisories the maintainers have published against this repo, newest first
async function fetchAdvisories(owner: string, name: string): Promise<SecurityAdvisory[]> {
	const rows = await rest<RawAdvisory[]>(
		`/repos/${owner}/${name}/security-advisories?state=published&per_page=100`
	);
	return (rows ?? [])
		.map((row) => ({
			id: row.cve_id ?? row.ghsa_id,
			summary: row.summary,
			severity: severityOf(row.severity ?? ''),
			publishedAt: row.published_at,
			url: row.html_url
		}))
		.sort((first, second) => (second.publishedAt ?? '').localeCompare(first.publishedAt ?? ''));
}

async function fetchSecurity(owner: string, name: string): Promise<RepoSecurity> {
	const { repository } = await graphql<{ repository: RawSecurity | null }>(QUERY, { owner, name });
	if (!repository) throw new AppError('not_found', `No repo named ${owner}/${name}`);

	const base = `/repos/${owner}/${name}`;
	const branch = repository.defaultBranchRef?.name;
	const none = Promise.resolve<CheckStatus>('na');
	const [
		branchProtection,
		branchRules,
		codeScanning,
		secretScanning,
		dependabotAlerts,
		privateVulnReporting,
		profile,
		vulns,
		advisories
	] = await Promise.all([
		// The branch object's protected flag covers classic protection and rulesets alike
		branch
			? probe(`${base}/branches/${encodeURIComponent(branch)}`, (data) =>
					data === null ? 'na' : (data as { protected: boolean }).protected ? 'pass' : 'warn'
				)
			: none,
		branch ? attempt('branch-rules', fetchBranchRules(base, branch)) : Promise.resolve(null),
		probe(`${base}/code-scanning/analyses?per_page=1`, (data) =>
			Array.isArray(data) && data.length ? 'pass' : 'warn'
		),
		// security_and_analysis only appears on the repo object for admins
		probe(
			base,
			(data) => {
				const scanning = (data as RawRepoSettings | null)?.security_and_analysis?.secret_scanning;
				return scanning ? (scanning.status === 'enabled' ? 'pass' : 'warn') : 'na';
			},
			'app'
		),
		probeAlertsEnabled(base),
		// A 404 here means a private repo where the feature does not exist, not disabled
		probe(`${base}/private-vulnerability-reporting`, (data) =>
			data === null ? 'na' : (data as { enabled: boolean }).enabled ? 'pass' : 'warn'
		),
		attempt('community-profile', rest<CommunityProfile>(`${base}/community/profile`)),
		attempt('alerts', fetchVulns(owner, name)),
		attempt('advisories', fetchAdvisories(owner, name))
	]);

	const alerts = vulns ? summariseAlerts(vulns) : null;
	const history = repository.defaultBranchRef?.target?.history?.nodes ?? [];
	const checks = buildChecks({
		repoUrl: repository.url,
		isArchived: repository.isArchived,
		pushedAt: repository.pushedAt,
		license: repository.licenseInfo?.spdxId ?? null,
		hasSecurityPolicy: repository.isSecurityPolicyEnabled,
		securityPolicyUrl: repository.securityPolicyUrl,
		codeOfConduct: repository.codeOfConduct?.name ?? null,
		hasWorkflows: repository.workflows?.__typename === 'Tree',
		hasDependabot: Boolean(repository.dependabot || repository.dependabotYaml),
		hasContributing: profile ? Boolean(profile.files.contributing) : null,
		// The profile flag misses directory-style templates, so trust the tree first
		hasIssueTemplates: repository.issueTemplates
			? true
			: profile
				? Boolean(profile.files.issue_template)
				: null,
		branchProtection,
		branchRules,
		signedCommits: history.length
			? {
					signed: history.filter((node) => node.signature?.isValid).length,
					sampled: history.length
				}
			: null,
		codeScanning,
		secretScanning,
		dependabotAlerts,
		privateVulnReporting
	});
	return {
		checks,
		...tally(checks),
		grade: grade(checks, alerts),
		alerts,
		advisories: advisories ?? []
	};
}

const key = (owner: string, name: string) => `repo:security:v5:${owner}/${name}`.toLowerCase();

export const isRepoSecurityCached = (owner: string, name: string) => isCached(key(owner, name));

// Security checks for a repo, computed from public GitHub signals
export function getRepoSecurity(owner: string, name: string): Promise<RepoSecurity> {
	return cached(key(owner, name), () => fetchSecurity(owner, name), TTL);
}
