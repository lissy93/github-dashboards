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
	FolderGit2,
	GitGraph,
	Package,
	Code,
	Info
} from '@lucide/svelte';
import { paths } from '$lib/config';
import { USER_PAGES, REPO_PAGES, pageHref, type PageDef } from '$lib/config/pages';
import { TASK_BUCKETS } from '$lib/components/tasks/tasks-config';
import { BUCKET_BY_SECTION } from '$lib/config/tasks';

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

type Scope = 'user' | 'repo';

// Build the viewer shape once, used by every layout and sub-nav
export function navViewer(user: string, viewerLogin: string | null): NavViewer {
	return {
		loggedIn: !!viewerLogin,
		isOwner: !!viewerLogin && viewerLogin.toLowerCase() === user.toLowerCase()
	};
}

// Icon per page, keyed by its scope-joined slug trail
const PAGE_ICONS: Record<string, IconComponent> = {
	user: LayoutGrid,
	'user/repos': BookMarked,
	'user/stats': ChartColumn,
	'user/activity': Activity,
	'user/contributions': FolderGit2,
	'user/analytics': ChartArea,
	'user/tasks': ListTodo,
	repo: LayoutGrid,
	'repo/tasks': ListTodo,
	'repo/tasks/issues': CircleDot,
	'repo/tasks/prs': GitPullRequest,
	'repo/code': Code,
	'repo/code/activity': Activity,
	'repo/code/files': FolderTree,
	'repo/code/git-tree': GitGraph,
	'repo/code/supply-chain': Package,
	'repo/ops': Container,
	'repo/ops/workflows': Workflow,
	'repo/ops/deployments': Rocket,
	'repo/ops/pages': Globe,
	'repo/ops/releases': Tag,
	'repo/info': Info,
	'repo/info/stats': ChartColumn,
	'repo/info/traffic': ChartArea,
	'repo/info/people': Users,
	'repo/info/security': ShieldCheck
};

// Task list icons come from the shared bucket config, keyed by route section
const TASK_ICONS: Record<string, IconComponent> = Object.fromEntries(
	Object.entries(BUCKET_BY_SECTION).map(([section, bucket]) => [section, TASK_BUCKETS[bucket].icon])
);

// Icon for a page, falling back to the task-bucket icon for the user task lists
function pageIcon(scope: Scope, slugs: string[], slug: string): IconComponent | undefined {
	return PAGE_ICONS[[scope, ...slugs.filter(Boolean)].join('/')] ?? TASK_ICONS[slug];
}

// Public icon lookup for section index cards, mirrors the nav item icons
export function iconFor(scope: Scope, ...slugs: string[]): IconComponent | undefined {
	return pageIcon(scope, slugs, slugs[slugs.length - 1] ?? '');
}

function lockedTooltip(user: string, subject: string, viewer: NavViewer): string {
	return viewer.loggedIn ? `Only ${user} can view ${subject}` : `Sign in to view ${subject}`;
}

// Turn one page into a nav item, applying the single org/owner gate and recursing
function toNavItem(
	page: PageDef,
	scope: Scope,
	base: string,
	user: string,
	viewer: NavViewer,
	isOrg: boolean,
	trail: string[] = []
): NavItem | null {
	// Org boards drop inapplicable pages entirely
	if (page.hideForOrg && isOrg) return null;
	const slugs = [...trail, page.slug];
	const icon = pageIcon(scope, slugs, page.slug);
	// Owner-only pages stay visible but locked for everyone else
	if (page.gate === 'owner' && !viewer.isOwner) {
		return {
			label: page.label,
			icon,
			disabled: true,
			tooltip: lockedTooltip(user, page.label.toLowerCase(), viewer)
		};
	}
	const children = page.children
		?.map((child) => toNavItem(child, scope, base, user, viewer, isOrg, slugs))
		.filter((item): item is NavItem => item !== null);
	return {
		label: page.label,
		icon,
		href: pageHref(base, ...slugs),
		children: children?.length ? children : undefined
	};
}

function buildNav(
	pages: PageDef[],
	scope: Scope,
	base: string,
	user: string,
	viewer: NavViewer,
	isOrg: boolean
): NavItem[] {
	return pages
		.map((page) => toNavItem(page, scope, base, user, viewer, isOrg))
		.filter((item): item is NavItem => item !== null);
}

// User-level nav tree, activity and authored task lists drop off org boards
export function userNav(user: string, isOrg: boolean, viewer: NavViewer): NavItem[] {
	return buildNav(USER_PAGES, 'user', paths.user(user), user, viewer, isOrg);
}

// Repo-level nav tree, traffic locks for anyone but the owner
export function repoNav(user: string, repo: string, viewer: NavViewer): NavItem[] {
	return buildNav(REPO_PAGES, 'repo', paths.repo(user, repo), user, viewer, false);
}

// Pills for one section: an Overview link to the section root, then its child pages
export function sectionPills(
	scope: Scope,
	sectionSlug: string,
	base: string,
	user: string,
	viewer: NavViewer,
	isOrg: boolean
): NavItem[] {
	const pages = scope === 'user' ? USER_PAGES : REPO_PAGES;
	const section = pages.find((page) => page.slug === sectionSlug);
	if (!section?.children) return [];
	const overview: NavItem = {
		label: 'Overview',
		href: pageHref(base, section.slug),
		icon: pageIcon(scope, [section.slug], section.slug)
	};
	const children = section.children
		.map((child) => toNavItem(child, scope, base, user, viewer, isOrg, [section.slug]))
		.filter((item): item is NavItem => item !== null);
	return [overview, ...children];
}

// Every leaf href in a tree, used for active-route matching
export function navHrefs(items: NavItem[]): string[] {
	return items.flatMap((item) => [
		...(item.href ? [item.href] : []),
		...(item.children ? navHrefs(item.children) : [])
	]);
}
