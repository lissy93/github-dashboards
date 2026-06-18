export const APP_NAME = 'goard';
export const APP_DESCRIPTION = 'A fast GitHub status board for users and repos';
export const GITHUB_WEB = 'https://github.com';

// Day windows offered for the new-stars delta, with the default selection
export const STAR_WINDOWS = [1, 7, 30, 90] as const;
export const STAR_WINDOW_DEFAULT = 7;

// Internal route builders, keep all path construction in one place
export const paths = {
	user: (user: string) => `/${user}`,
	userActivity: (user: string) => `/${user}/activity`,
	userTodo: (user: string) => `/${user}/todo`,
	repo: (user: string, repo: string) => `/${user}/${repo}`,
	repoSection: (user: string, repo: string, section: string) => `/${user}/${repo}/${section}`
};

// Tabs shown on user pages. userOnly tabs are hidden for org accounts
type UserNavItem = { label: string; to: (user: string) => string; userOnly?: boolean };
export const USER_NAV: UserNavItem[] = [
	{ label: 'Overview', to: (user: string) => paths.user(user) },
	{ label: 'Activity', to: (user: string) => paths.userActivity(user), userOnly: true },
	{ label: 'Todo', to: (user: string) => paths.userTodo(user) }
];

// Tabs shown on repo pages, section is appended to the repo base path
export const REPO_NAV = [
	{ label: 'Overview', section: '' },
	{ label: 'Issues & PRs', section: 'issues-and-prs' },
	{ label: 'Todo', section: 'todo' },
	{ label: 'Activity', section: 'activity' },
	{ label: 'Traffic', section: 'traffic' },
	{ label: 'Stars', section: 'stars' },
	{ label: 'Workflows', section: 'workflows' },
	{ label: 'People', section: 'people' },
	{ label: 'Security', section: 'security' }
];
