import { GITHUB_WEB, paths } from '$lib/config';
import { findPage, pageHref, REPO_PAGES, USER_PAGES, type PageDef } from '$lib/config/pages';

// GitHub login: 1-39 chars, alphanumeric with non-repeating, non-edge hyphens
export const LOGIN_RE = /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/;

// GitHub repo name: up to 100 chars of word chars, dot and hyphen, never . or ..
export const REPO_RE = /^(?!\.{1,2}$)[\w.-]{1,100}$/;

// Where a parsed input points, href is ready to feed goto()
export type JumpTarget = {
	kind: 'user' | 'repo' | 'repo-page';
	href: string;
	label: string;
	owner: string;
	repo?: string;
};

// One entry in the jump box dropdown, slugs point into the scope's page tree
export type QuickLink = { label: string; href: string; slugs: string[] };

const URL_START = /^https?:\/\//i;
const HOST_START = /^(?:www\.)?github\.com\//i;
const SSH_START = /^(?:ssh:\/\/)?git@github\.com[:/]/i;

// GitHub repo sub-paths mapped onto our repo section pages
const REPO_PAGE_MAP: Record<string, string> = {
	issues: 'tasks/issues',
	pulls: 'tasks/prs',
	pull: 'tasks/prs',
	actions: 'ops/workflows',
	releases: 'ops/releases',
	tags: 'ops/releases',
	deployments: 'ops/deployments',
	commits: 'code/activity',
	tree: 'code/files',
	blob: 'code/files',
	'network/dependencies': 'code/supply-chain',
	network: 'code/git-tree',
	security: 'info/security',
	pulse: 'info/stats',
	'graphs/traffic': 'info/traffic',
	graphs: 'info/stats',
	stargazers: 'info/people',
	forks: 'info/people'
};

// Extract the path of a github.com URL, null for any other site
function githubPath(input: string): string | null {
	try {
		const url = new URL(URL_START.test(input) ? input : `https://${input}`);
		return /^(?:www\.)?github\.com$/i.test(url.hostname) ? url.pathname : null;
	} catch {
		return null;
	}
}

// Target for a plain user or org login
function userTarget(login: string): JumpTarget {
	return { kind: 'user', href: paths.user(login), label: login, owner: login };
}

// Match trailing URL segments to one of our repo pages, longest key first
function repoPageSlug(rest: string[]): string | undefined {
	const [first = '', second = ''] = rest.map((part) => part.toLowerCase());
	return REPO_PAGE_MAP[`${first}/${second}`] ?? REPO_PAGE_MAP[first];
}

// Work out where a pasted login, repo slug, GitHub URL or git remote should take us
export function parseGithubInput(raw: string): JumpTarget | null {
	const input = raw.trim();
	if (!input) return null;

	let path: string;
	if (SSH_START.test(input)) {
		path = input.replace(SSH_START, '');
	} else if (URL_START.test(input) || HOST_START.test(input)) {
		const parsed = githubPath(input);
		if (parsed === null) return null;
		path = parsed;
	} else {
		path = input.replace(/^@/, '').replace(/[?#].*$/, '');
	}

	const segments = path.split('/').filter(Boolean);

	// URLs like /orgs/name/repositories just mean the login
	if (/^(?:orgs|users)$/i.test(segments[0] ?? '')) {
		const login = segments[1];
		return login && LOGIN_RE.test(login) ? userTarget(login) : null;
	}

	const [owner, repoSegment, ...rest] = segments;
	if (!owner || !LOGIN_RE.test(owner)) return null;
	if (!repoSegment) return userTarget(owner);

	const repo = repoSegment.replace(/\.git$/i, '');
	if (!REPO_RE.test(repo)) return null;

	const slug = repoPageSlug(rest);
	if (slug) {
		const [section, child] = slug.split('/');
		const page = findPage(REPO_PAGES, section, child)?.label ?? section;
		return {
			kind: 'repo-page',
			href: `${paths.repo(owner, repo)}/${slug}`,
			label: `${owner}/${repo} · ${page}`,
			owner,
			repo
		};
	}
	return { kind: 'repo', href: paths.repo(owner, repo), label: `${owner}/${repo}`, owner, repo };
}

// Slug trails behind the dropdown half of the jump button, per scope
const USER_QUICK_SLUGS = [['stats'], ['repos'], ['activity'], ['tasks']];
const REPO_QUICK_SLUGS = [
	['tasks'],
	['code', 'supply-chain'],
	['ops'],
	['info', 'security'],
	['info', 'stats']
];

// A palette entry, children carry their section label for the crumb
export type PaletteLink = QuickLink & { parent?: string; external?: boolean };

// One palette group, scope picks the icon set
export type PaletteSection = { heading: string; scope: 'user' | 'repo'; links: PaletteLink[] };

// Flatten a page tree into links, sections before children, gated pages owner-only
function scopeLinks(pages: PageDef[], base: string, isOwner: boolean): PaletteLink[] {
	const allowed = (page: PageDef) => page.gate !== 'owner' || isOwner;
	return pages.filter(allowed).flatMap((page) => [
		{ label: page.label, href: pageHref(base, page.slug), slugs: [page.slug] },
		...(page.children ?? []).filter(allowed).map((child) => ({
			label: child.label,
			parent: page.label,
			href: pageHref(base, page.slug, child.slug),
			slugs: [page.slug, child.slug]
		}))
	]);
}

// Outbound link to the matching github.com page
const githubLink = (path: string): PaletteLink => ({
	label: path,
	href: `${GITHUB_WEB}/${path}`,
	slugs: [],
	external: true
});

// Palette groups for a target: every page in its scope with the parsed page first,
// then the owner's pages for repos, then the matching github.com links
export function paletteSections(target: JumpTarget, viewer?: string | null): PaletteSection[] {
	const { owner, repo } = target;
	const isOwner = !!viewer && viewer.toLowerCase() === owner.toLowerCase();
	const ownerSection: PaletteSection = {
		heading: owner,
		scope: 'user',
		links: scopeLinks(USER_PAGES, paths.user(owner), isOwner)
	};
	if (!repo) {
		return [ownerSection, { heading: 'GitHub', scope: 'user', links: [githubLink(owner)] }];
	}
	const links = scopeLinks(REPO_PAGES, paths.repo(owner, repo), isOwner);
	const primary = links.findIndex((link) => link.href === target.href);
	if (primary > 0) links.unshift(...links.splice(primary, 1));
	return [
		{ heading: `${owner}/${repo}`, scope: 'repo', links },
		ownerSection,
		{
			heading: 'GitHub',
			scope: 'repo',
			links: [githubLink(`${owner}/${repo}`), githubLink(owner)]
		}
	];
}

// Handy pages for a parsed target, labels stay in sync with the page registry
export function quickLinks({ owner, repo }: JumpTarget): QuickLink[] {
	const trails = repo ? REPO_QUICK_SLUGS : USER_QUICK_SLUGS;
	const pages = repo ? REPO_PAGES : USER_PAGES;
	const base = repo ? paths.repo(owner, repo) : paths.user(owner);
	return trails.map((slugs) => ({
		label: findPage(pages, slugs[0], slugs[1])?.label ?? slugs[slugs.length - 1],
		href: pageHref(base, ...slugs),
		slugs
	}));
}
