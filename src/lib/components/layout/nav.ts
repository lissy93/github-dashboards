import type { Component } from 'svelte';
import {
	LayoutGrid,
	BookMarked,
	ChartColumn,
	ChartArea,
	Activity,
	ListTodo,
	GitPullRequest,
	Workflow,
	Users,
	ShieldCheck
} from '@lucide/svelte';
import { paths, REPO_NAV } from '$lib/config';
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
	tasks: GitPullRequest,
	activity: Activity,
	traffic: ChartArea,
	stats: ChartColumn,
	workflows: Workflow,
	people: Users,
	security: ShieldCheck
};

// Repo-level nav tree. Traffic is private, so only the owner may open it
export function repoNav(user: string, repo: string, viewer: NavViewer): NavItem[] {
	return REPO_NAV.map(({ label, section }) => {
		const icon = REPO_SECTION_ICONS[section];
		const href = section ? paths.repoSection(user, repo, section) : paths.repo(user, repo);
		if (section === 'traffic' && !viewer.isOwner) {
			return {
				label,
				icon,
				disabled: true,
				tooltip: viewer.loggedIn ? `Only ${user} can view traffic` : 'Sign in to view traffic'
			};
		}
		return { label, href, icon };
	});
}

// Every leaf href in a tree, used for active-route matching
export function navHrefs(items: NavItem[]): string[] {
	return items.flatMap((item) => [
		...(item.href ? [item.href] : []),
		...(item.children ? navHrefs(item.children) : [])
	]);
}
