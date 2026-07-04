import type { Component } from 'svelte';
import {
	LayoutGrid,
	BookMarked,
	ChartColumn,
	ChartArea,
	Activity,
	ListTodo,
	CircleDot,
	GitPullRequest,
	Workflow,
	Rocket,
	Globe,
	Tag,
	Container,
	Users,
	ShieldCheck,
	FolderTree,
	GitGraph,
	Package,
	Code,
	Info
} from '@lucide/svelte';
import { paths, REPO_NAV, TASKS_NAV, CODE_NAV, OPS_NAV, INFO_NAV } from '$lib/config';
import { TASK_BUCKETS } from '$lib/components/tasks/tasks-config';
import type { TaskBucket } from '$lib/types';

type IconComponent = Component<{ size?: number | string; class?: string }>;

export type NavItem = {
	label: string;
	href?: string;
	icon?: IconComponent;
	children?: NavItem[];
	disabled?: boolean;
	tooltip?: string;
};

// Who is viewing, so owner-only tabs can enable or explain themselves
export type NavViewer = { loggedIn: boolean; isOwner: boolean };

// Order the four task lists share across the nav and the task overview
const TASK_ORDER: TaskBucket[] = ['reviewPrs', 'reviewIssues', 'myPrs', 'myIssues'];

// Analytics surfaces private traffic, so only the signed-in owner may open it
function analyticsItem(user: string, viewer: NavViewer): NavItem {
	if (viewer.isOwner)
		return { label: 'Analytics', href: paths.userAnalytics(user), icon: ChartArea };
	return {
		label: 'Analytics',
		icon: ChartArea,
		disabled: true,
		tooltip: viewer.loggedIn ? `Only ${user} can view these analytics` : 'Sign in to view analytics'
	};
}

// User-level nav tree, activity is hidden for org accounts
export function userNav(user: string, isOrg: boolean, viewer: NavViewer): NavItem[] {
	const items: NavItem[] = [
		{ label: 'Overview', href: paths.user(user), icon: LayoutGrid },
		{ label: 'Repos', href: paths.userRepos(user), icon: BookMarked },
		{ label: 'Stats', href: paths.userStats(user), icon: ChartColumn }
	];
	if (!isOrg) {
		items.push({ label: 'Activity', href: paths.userActivity(user), icon: Activity });
	}
	items.push(analyticsItem(user, viewer));
	// Authored lists make no sense for an org, so drop them there, matching the task page
	const taskBuckets = TASK_ORDER.filter(
		(bucket) => !(isOrg && (bucket === 'myPrs' || bucket === 'myIssues'))
	);
	items.push({
		label: 'Tasks',
		href: paths.userTasks(user),
		icon: ListTodo,
		children: taskBuckets.map((bucket) => ({
			label: TASK_BUCKETS[bucket].title,
			href: paths.userTaskList(user, TASK_BUCKETS[bucket].section),
			icon: TASK_BUCKETS[bucket].icon
		}))
	});
	return items;
}

// Icon per repo section, keyed by the section slug defined in REPO_NAV
const REPO_SECTION_ICONS: Record<string, IconComponent> = {
	'': LayoutGrid,
	tasks: ListTodo,
	code: Code,
	ops: Container,
	info: Info
};

// Icons for Tasks sub-sections
const TASKS_SECTION_ICONS: Record<string, IconComponent> = {
	issues: CircleDot,
	prs: GitPullRequest
};

// Icons for Info sub-sections
const INFO_SECTION_ICONS: Record<string, IconComponent> = {
	stats: ChartColumn,
	traffic: ChartArea,
	people: Users,
	security: ShieldCheck
};

// Icons for Code sub-sections
const CODE_SECTION_ICONS: Record<string, IconComponent> = {
	activity: Activity,
	files: FolderTree,
	'git-tree': GitGraph,
	'supply-chain': Package
};

// Icons for ops sub-sections
const OPS_SECTION_ICONS: Record<string, IconComponent> = {
	workflows: Workflow,
	deployments: Rocket,
	pages: Globe,
	releases: Tag
};

// Dropdown list, icons and path builder for each repo tab with sub-sections
const REPO_SUB_NAVS: Record<
	string,
	{
		list: { label: string; section: string }[];
		icons: Record<string, IconComponent>;
		path: (user: string, repo: string, section: string) => string;
	}
> = {
	tasks: { list: TASKS_NAV, icons: TASKS_SECTION_ICONS, path: paths.repoTasksSection },
	code: { list: CODE_NAV, icons: CODE_SECTION_ICONS, path: paths.repoCodeSection },
	ops: { list: OPS_NAV, icons: OPS_SECTION_ICONS, path: paths.repoOpsSection },
	info: { list: INFO_NAV, icons: INFO_SECTION_ICONS, path: paths.repoInfoSection }
};

// Repo-level nav tree. Traffic is private, so only the owner may open it
export function repoNav(user: string, repo: string, viewer: NavViewer): NavItem[] {
	return REPO_NAV.map(({ label, section }) => {
		const sub = REPO_SUB_NAVS[section];
		return {
			label,
			href: section ? paths.repoSection(user, repo, section) : paths.repo(user, repo),
			icon: REPO_SECTION_ICONS[section],
			children: sub?.list.map(({ label: subLabel, section: subSection }) => {
				if (subSection === 'traffic' && !viewer.isOwner) {
					return {
						label: subLabel,
						icon: sub.icons[subSection],
						disabled: true,
						tooltip: viewer.loggedIn ? `Only ${user} can view traffic` : 'Sign in to view traffic'
					};
				}
				return {
					label: subLabel,
					href: sub.path(user, repo, subSection),
					icon: sub.icons[subSection]
				};
			})
		};
	});
}

// Every leaf href in a tree, used for active-route matching
export function navHrefs(items: NavItem[]): string[] {
	return items.flatMap((item) => [
		...(item.href ? [item.href] : []),
		...(item.children ? navHrefs(item.children) : [])
	]);
}
