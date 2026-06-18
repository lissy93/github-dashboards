import type { Component } from 'svelte';
import { LayoutGrid, BookMarked, ChartColumn, Activity, ListTodo } from '@lucide/svelte';
import { paths } from '$lib/config';
import { TASK_BUCKETS } from '$lib/components/tasks/tasks-config';
import type { TaskBucket } from '$lib/types';

type IconComponent = Component<{ size?: number | string; class?: string }>;

export type NavItem = {
	label: string;
	href?: string;
	icon?: IconComponent;
	children?: NavItem[];
};

// Order the four task lists share across the nav and the task overview
const TASK_ORDER: TaskBucket[] = ['reviewPrs', 'reviewIssues', 'myPrs', 'myIssues'];

// User-level nav tree, activity is hidden for org accounts
export function userNav(user: string, isOrg: boolean): NavItem[] {
	const items: NavItem[] = [
		{ label: 'Overview', href: paths.user(user), icon: LayoutGrid },
		{ label: 'Repos', href: paths.userRepos(user), icon: BookMarked },
		{ label: 'Stats', href: paths.userStats(user), icon: ChartColumn }
	];
	if (!isOrg) {
		items.push({ label: 'Activity', href: paths.userActivity(user), icon: Activity });
	}
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

// Every leaf href in a tree, used for active-route matching
export function navHrefs(items: NavItem[]): string[] {
	return items.flatMap((item) => [
		...(item.href ? [item.href] : []),
		...(item.children ? navHrefs(item.children) : [])
	]);
}
