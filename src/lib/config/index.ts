export const APP_NAME = 'github-dashboards';
export const APP_DESCRIPTION = 'A fast GitHub status board for users and repos';
export const GITHUB_WEB = 'https://github.com';

// A login's avatar straight from GitHub, no id needed, redirects to the sized image.
// Larger sizes stay crisp when the avatar is drawn big, e.g. inside a bubble
export const githubAvatar = (login: string, size = 48) => `${GITHUB_WEB}/${login}.png?size=${size}`;

// Day windows offered for the new-stars delta, with the default selection
export const STAR_WINDOWS = [1, 7, 30, 90] as const;
export const STAR_WINDOW_DEFAULT = 7;

// Internal route builders, keep all path construction in one place
export const paths = {
	user: (user: string) => `/${user}`,
	userRepos: (user: string) => `/${user}/repos`,
	userStats: (user: string) => `/${user}/stats`,
	userActivity: (user: string) => `/${user}/activity`,
	userContributions: (user: string) => `/${user}/contributions`,
	userAnalytics: (user: string) => `/${user}/analytics`,
	userTasks: (user: string) => `/${user}/tasks`,
	userTaskList: (user: string, list: string) => `/${user}/tasks/${list}`,
	repo: (user: string, repo: string) => `/${user}/${repo}`,
	repoSection: (user: string, repo: string, section: string) => `/${user}/${repo}/${section}`,
	repoTasksSection: (user: string, repo: string, section: string) =>
		`/${user}/${repo}/tasks/${section}`,
	repoCode: (user: string, repo: string) => `/${user}/${repo}/code`,
	repoCodeSection: (user: string, repo: string, section: string) =>
		`/${user}/${repo}/code/${section}`,
	repoOps: (user: string, repo: string) => `/${user}/${repo}/ops`,
	repoOpsSection: (user: string, repo: string, section: string) =>
		`/${user}/${repo}/ops/${section}`,
	repoInfo: (user: string, repo: string) => `/${user}/${repo}/info`,
	repoInfoSection: (user: string, repo: string, section: string) =>
		`/${user}/${repo}/info/${section}`
};
