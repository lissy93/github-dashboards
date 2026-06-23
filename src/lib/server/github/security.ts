import { graphql, rest } from '$lib/server/github/client';
import { cached, isCached } from '$lib/server/cache';
import { getScorecard, UNAVAILABLE, type RepoScorecard } from '$lib/server/scorecard';
import { AppError, logError } from '$lib/errors';

// Security posture moves slowly, refresh on visit like the rest of the board
const TTL = 900;
// A repo counts as maintained if it had a push within this many days
const MAINTAINED_DAYS = 90;
const DAY_MS = 86400000;

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'na';
export type SecurityCheck = {
	name: string;
	status: CheckStatus;
	detail: string;
	url: string | null;
};
export type RepoSecurity = {
	checks: SecurityCheck[];
	passed: number;
	applicable: number;
	scorecard: RepoScorecard;
};

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
		'https://docs.github.com/communities/setting-up-your-project-for-healthy-contributions/adding-a-code-of-conduct-to-your-project'
};

// Public security signals, all readable without admin so one query never partial-errors
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
			defaultBranchRef { name }
			workflows: object(expression: "HEAD:.github/workflows") { __typename }
			dependabot: object(expression: "HEAD:.github/dependabot.yml") { __typename }
			dependabotYaml: object(expression: "HEAD:.github/dependabot.yaml") { __typename }
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
	defaultBranchRef: { name: string } | null;
	workflows: { __typename: string } | null;
	dependabot: { __typename: string } | null;
	dependabotYaml: { __typename: string } | null;
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
	branchProtection: CheckStatus;
	codeScanning: CheckStatus;
};

// Wording for the admin-gated checks, na means the viewer lacks the access to tell
const PROTECTION = {
	pass: 'Default branch protected',
	warn: 'Default branch unprotected',
	fail: 'Default branch unprotected',
	na: 'Needs admin access to check'
} as const;
const SCANNING = {
	pass: 'Code scanning active',
	warn: 'No code scanning set up',
	fail: 'No code scanning set up',
	na: 'Needs security access to check'
} as const;

// Turn the raw signals into the ordered list of pass/warn/fail/na checks
export function buildChecks(signals: SecuritySignals, now: number = Date.now()): SecurityCheck[] {
	const days = Math.floor((now - Date.parse(signals.pushedAt)) / DAY_MS);
	const checks: SecurityCheck[] = [
		{
			name: 'License',
			status: signals.license ? 'pass' : 'fail',
			detail: signals.license ? `${signals.license} license` : 'No license file',
			url: DOCS.license
		},
		{
			name: 'Security policy',
			status: signals.hasSecurityPolicy ? 'pass' : 'warn',
			detail: signals.hasSecurityPolicy ? 'SECURITY.md published' : 'No security policy',
			url: signals.securityPolicyUrl ?? DOCS.security
		},
		{
			name: 'Branch protection',
			status: signals.branchProtection,
			detail: PROTECTION[signals.branchProtection],
			url: DOCS.branch
		},
		{
			name: 'Dependabot',
			status: signals.hasDependabot ? 'pass' : 'warn',
			detail: signals.hasDependabot ? 'Dependabot configured' : 'No Dependabot config',
			url: DOCS.dependabot
		},
		{
			name: 'Code scanning',
			status: signals.codeScanning,
			detail: SCANNING[signals.codeScanning],
			url: DOCS.codeScanning
		},
		{
			name: 'CI workflows',
			status: signals.hasWorkflows ? 'pass' : 'warn',
			detail: signals.hasWorkflows ? 'GitHub Actions configured' : 'No CI workflows',
			url: DOCS.actions
		},
		{
			name: 'Maintained',
			status: signals.isArchived ? 'fail' : days <= MAINTAINED_DAYS ? 'pass' : 'warn',
			detail: signals.isArchived
				? 'Repository archived'
				: days <= MAINTAINED_DAYS
					? `Pushed ${days <= 0 ? 'today' : `${days}d ago`}`
					: `No pushes in ${days} days`,
			url: signals.repoUrl
		},
		{
			name: 'Code of conduct',
			status: signals.codeOfConduct ? 'pass' : 'warn',
			detail: signals.codeOfConduct ?? 'No code of conduct',
			url: DOCS.conduct
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

// Read an admin-gated endpoint, mapping no-access to na rather than failing the panel
async function probe(path: string, evaluate: (data: unknown) => CheckStatus): Promise<CheckStatus> {
	try {
		return evaluate(await rest(path));
	} catch (error) {
		if (error instanceof AppError && (error.code === 'forbidden' || error.code === 'unauthorized'))
			return 'na';
		logError(`security-probe:${path}`, error);
		return 'na';
	}
}

// The OpenSSF score is a bonus, a private repo or a service outage must not blank our checks
async function bonusScorecard(
	owner: string,
	name: string,
	isPrivate: boolean
): Promise<RepoScorecard> {
	if (isPrivate) return UNAVAILABLE;
	try {
		return await getScorecard(owner, name);
	} catch (error) {
		logError('security-scorecard', error);
		return UNAVAILABLE;
	}
}

async function fetchSecurity(owner: string, name: string): Promise<RepoSecurity> {
	const { repository } = await graphql<{ repository: RawSecurity | null }>(QUERY, { owner, name });
	if (!repository) throw new AppError('not_found', `No repo named ${owner}/${name}`);

	const branch = repository.defaultBranchRef?.name;
	const [branchProtection, codeScanning, scorecard] = await Promise.all([
		branch
			? probe(`/repos/${owner}/${name}/branches/${branch}/protection`, (data) =>
					data ? 'pass' : 'warn'
				)
			: Promise.resolve<CheckStatus>('na'),
		probe(`/repos/${owner}/${name}/code-scanning/analyses?per_page=1`, (data) =>
			Array.isArray(data) && data.length ? 'pass' : 'warn'
		),
		bonusScorecard(owner, name, repository.isPrivate)
	]);

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
		branchProtection,
		codeScanning
	});
	return { checks, ...tally(checks), scorecard };
}

const key = (owner: string, name: string) => `repo:security:v1:${owner}/${name}`.toLowerCase();

export const isRepoSecurityCached = (owner: string, name: string) => isCached(key(owner, name));

// Scorecard-style security checks for a repo, computed from public GitHub signals
export function getRepoSecurity(owner: string, name: string): Promise<RepoSecurity> {
	return cached(key(owner, name), () => fetchSecurity(owner, name), TTL);
}
