export const APP_NAME = 'goard';
export const APP_DESCRIPTION = 'A fast GitHub status board for users and repos';
export const GITHUB_WEB = 'https://github.com';

// Day windows offered for the new-stars delta, with the default selection
export const STAR_WINDOWS = [1, 7, 30, 90] as const;
export const STAR_WINDOW_DEFAULT = 7;

// Internal route builders, keep all path construction in one place
export const paths = {
	user: (user: string) => `/${user}`,
	userRepos: (user: string) => `/${user}/repos`,
	userStats: (user: string) => `/${user}/stats`,
	userActivity: (user: string) => `/${user}/activity`,
	userAnalytics: (user: string) => `/${user}/analytics`,
	userTasks: (user: string) => `/${user}/tasks`,
	userTaskList: (user: string, list: string) => `/${user}/tasks/${list}`,
	repo: (user: string, repo: string) => `/${user}/${repo}`,
	repoSection: (user: string, repo: string, section: string) => `/${user}/${repo}/${section}`,
	repoCode: (user: string, repo: string) => `/${user}/${repo}/code`,
	repoCodeSection: (user: string, repo: string, section: string) =>
		`/${user}/${repo}/code/${section}`,
	repoOps: (user: string, repo: string) => `/${user}/${repo}/ops`,
	repoOpsSection: (user: string, repo: string, section: string) => `/${user}/${repo}/ops/${section}`
};

// Tabs shown on repo pages, section is appended to the repo base path
export const REPO_NAV = [
	{ label: 'Overview', section: '' },
	{ label: 'Issues & PRs', section: 'tasks' },
	{ label: 'Code', section: 'code' },
	{ label: 'Traffic', section: 'traffic' },
	{ label: 'Stats', section: 'stats' },
	{ label: 'CI/CD', section: 'ops' },
	{ label: 'People', section: 'people' },
	{ label: 'Security', section: 'security' }
];

// Sub-sections under the Code tab
export const CODE_NAV = [
	{ label: 'Activity', section: 'activity' },
	{ label: 'Files', section: 'files' },
	{ label: 'History', section: 'git-tree' },
	{ label: 'Supply chain', section: 'supply-chain' }
];

// Sub-sections under the CI/CD (ops) tab
export const OPS_NAV = [
	{ label: 'Workflows', section: 'workflows' },
	{ label: 'Deployments', section: 'deployments' },
	{ label: 'Pages', section: 'pages' },
	{ label: 'Releases', section: 'releases' }
];
