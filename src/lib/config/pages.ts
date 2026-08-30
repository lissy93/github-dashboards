import { TASK_BUCKET_INFO } from '$lib/config/tasks';
import type { TaskBucket } from '$lib/types';

// One entry per page, every nav surface derives from these trees
export type PageDef = {
	slug: string; // route segment, '' for the scope root
	label: string;
	description: string; // reused by index cards, drawer and PageMeta
	gate?: 'owner'; // owner-only, other viewers see it locked
	hideForOrg?: boolean; // dropped entirely on org boards
	children?: PageDef[];
};

// Order the task lists share across the nav and the task overview
const TASK_ORDER: TaskBucket[] = ['reviewPrs', 'reviewIssues', 'myPrs', 'myIssues'];

// Short blurb per bucket, keyed the same as the shared bucket info
const TASK_DESCRIPTIONS: Record<TaskBucket, string> = {
	reviewPrs: 'Open pull requests waiting on your review',
	reviewIssues: 'Open issues assigned for your attention',
	myPrs: 'Pull requests you have opened',
	myIssues: 'Issues you have opened'
};

// Task list pages reuse bucket titles, authored lists drop off org boards
const TASK_PAGES: PageDef[] = TASK_ORDER.map((bucket) => ({
	slug: TASK_BUCKET_INFO[bucket].section,
	label: TASK_BUCKET_INFO[bucket].title,
	description: TASK_DESCRIPTIONS[bucket],
	hideForOrg: bucket === 'myPrs' || bucket === 'myIssues'
}));

export const USER_PAGES: PageDef[] = [
	{ slug: '', label: 'Overview', description: 'Profile summary, top repos and recent activity' },
	{ slug: 'stats', label: 'Stats', description: 'Contribution, language and repo stat dashboards' },
	{ slug: 'repos', label: 'Repos', description: 'All repositories with sorting and filters' },
	{
		slug: 'activity',
		label: 'Activity',
		hideForOrg: true,
		description: 'Feed of recent public activity'
	},
	{
		slug: 'contributions',
		label: 'Contributions',
		hideForOrg: true,
		description: 'Repositories you have contributed to, by year'
	},
	{
		slug: 'tasks',
		label: 'Tasks',
		description: 'Open PRs and issues needing attention',
		children: TASK_PAGES
	},
	{
		slug: 'analytics',
		label: 'Analytics',
		gate: 'owner',
		description: 'Combined traffic and clones across repos'
	}
];

export const REPO_PAGES: PageDef[] = [
	{ slug: '', label: 'Overview', description: 'Repo health and stats at a glance' },
	{
		slug: 'tasks',
		label: 'Tasks',
		description: 'Issue and PR totals over time plus the open lists',
		children: [
			{ slug: 'issues', label: 'Issues', description: 'Open issues with labels and state' },
			{ slug: 'prs', label: 'Pull requests', description: 'Open PRs with checks and review status' }
		]
	},
	{
		slug: 'code',
		label: 'Code',
		description: 'Activity, files, history and dependencies',
		children: [
			{
				slug: 'activity',
				label: 'Activity',
				description: 'Commits, pushes and contributor activity over time'
			},
			{ slug: 'files', label: 'Files', description: "Browse the repository's file tree and sizes" },
			{
				slug: 'git-tree',
				label: 'History',
				description: 'Interactive commit and branch history graph'
			},
			{
				slug: 'supply-chain',
				label: 'Supply chain',
				description: 'Dependencies, licences and supply-chain risk'
			}
		]
	},
	{
		slug: 'ops',
		label: 'CI/CD',
		description: 'Workflows, deployments, pages and releases',
		children: [
			{
				slug: 'workflows',
				label: 'Workflows',
				description: 'Actions workflows, statuses and pass rates'
			},
			{
				slug: 'deployments',
				label: 'Deployments',
				description: 'Environments, live status and deploy frequency'
			},
			{ slug: 'pages', label: 'Pages', description: 'GitHub Pages status and build history' },
			{ slug: 'releases', label: 'Releases', description: 'Releases, cadence and downloads' }
		]
	},
	{
		slug: 'info',
		label: 'Info',
		description: 'Stats, traffic, people and security',
		children: [
			{ slug: 'stats', label: 'Stats', description: 'Stars, history, churn, labels and languages' },
			{
				slug: 'traffic',
				label: 'Traffic',
				gate: 'owner',
				description: 'Current and historical traffic and clones'
			},
			{ slug: 'people', label: 'People', description: 'Contributors, stargazers and forks' },
			{
				slug: 'security',
				label: 'Security',
				description: 'Security policy, checks and advisories'
			}
		]
	}
];

// Join a scope base with page slugs, skipping empty root slugs
export const pageHref = (base: string, ...slugs: string[]): string =>
	[base, ...slugs.filter(Boolean)].join('/');

// Find a section, and optionally one of its children, by slug
export function findPage(pages: PageDef[], slug: string, child?: string): PageDef | undefined {
	const section = pages.find((page) => page.slug === slug);
	if (!section || child === undefined) return section;
	return section.children?.find((entry) => entry.slug === child);
}
