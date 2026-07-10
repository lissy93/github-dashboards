import { describe, it, expect } from 'vitest';
import { USER_PAGES, REPO_PAGES, pageHref, findPage, type PageDef } from './pages';

// Walk every page and its children, so assertions cover the whole tree
function walk(pages: PageDef[]): PageDef[] {
	return pages.flatMap((page) => [page, ...walk(page.children ?? [])]);
}

const ALL = [...walk(USER_PAGES), ...walk(REPO_PAGES)];

describe('page registry', () => {
	it('gives every entry a non-empty label and description', () => {
		for (const page of ALL) {
			expect(page.label.trim()).not.toBe('');
			expect(page.description.trim()).not.toBe('');
		}
	});

	it('keeps slugs unique within every sibling level', () => {
		const levels = [USER_PAGES, REPO_PAGES, ...ALL.map((page) => page.children ?? [])];
		for (const level of levels) {
			const slugs = level.map((page) => page.slug);
			expect(new Set(slugs).size).toBe(slugs.length);
		}
	});

	it('opens each scope with an empty-slug Overview root', () => {
		expect(USER_PAGES[0]).toMatchObject({ slug: '', label: 'Overview' });
		expect(REPO_PAGES[0]).toMatchObject({ slug: '', label: 'Overview' });
	});

	it('gates only analytics, user tasks and repo traffic to the owner', () => {
		const gated = ALL.filter((page) => page.gate === 'owner').map((page) => page.slug);
		expect(gated.sort()).toEqual(['analytics', 'tasks', 'traffic']);
	});

	it('hides only activity and the authored task lists from org boards', () => {
		const hidden = ALL.filter((page) => page.hideForOrg).map((page) => page.slug);
		expect(hidden.sort()).toEqual(['activity', 'my-issues', 'my-prs']);
	});
});

describe('pageHref', () => {
	it('joins the base with slugs and skips empty roots', () => {
		expect(pageHref('/octocat')).toBe('/octocat');
		expect(pageHref('/octocat', '')).toBe('/octocat');
		expect(pageHref('/octocat', 'stats')).toBe('/octocat/stats');
		expect(pageHref('/octocat/repo', 'info', 'traffic')).toBe('/octocat/repo/info/traffic');
	});
});

describe('findPage', () => {
	it('finds a section, and a child when asked', () => {
		expect(findPage(REPO_PAGES, 'code')?.label).toBe('Code');
		expect(findPage(REPO_PAGES, 'code', 'files')?.label).toBe('Files');
		expect(findPage(REPO_PAGES, 'nope')).toBeUndefined();
		expect(findPage(REPO_PAGES, 'code', 'nope')).toBeUndefined();
	});
});
