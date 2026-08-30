import { describe, it, expect } from 'vitest';
import { userNav, repoNav, sectionPills, navViewer, type NavItem } from './nav';

const OWNER = navViewer('octocat', 'octocat');
const VISITOR = navViewer('octocat', 'someone');
const SIGNED_OUT = navViewer('octocat', null);

const byLabel = (items: NavItem[], label: string) => items.find((item) => item.label === label);

describe('userNav', () => {
	it('gives the owner real hrefs for analytics and tasks', () => {
		const items = userNav('octocat', false, OWNER);
		expect(byLabel(items, 'Analytics')?.href).toBe('/octocat/analytics');
		expect(byLabel(items, 'Issues & PRs')?.href).toBe('/octocat/tasks');
		expect(byLabel(items, 'Issues & PRs')?.disabled).toBeUndefined();
	});

	it('locks analytics for a visitor with a sign-in tooltip, leaving tasks open', () => {
		const items = userNav('octocat', false, SIGNED_OUT);
		const analytics = byLabel(items, 'Analytics');
		expect(analytics?.disabled).toBe(true);
		expect(analytics?.href).toBeUndefined();
		expect(analytics?.tooltip).toMatch(/sign in/i);
		expect(byLabel(items, 'Issues & PRs')?.href).toBe('/octocat/tasks');
	});

	it('tells a signed-in non-owner only the owner can view them', () => {
		const items = userNav('octocat', false, VISITOR);
		expect(byLabel(items, 'Analytics')?.tooltip).toMatch(/only octocat/i);
	});

	it('drops activity and the authored task lists on org boards', () => {
		const items = userNav('octocat', true, OWNER);
		expect(byLabel(items, 'Activity')).toBeUndefined();
		const taskChildren =
			byLabel(items, 'Issues & PRs')?.children?.map((child) => child.label) ?? [];
		expect(taskChildren).toEqual(['PRs to review', 'Issues to review']);
	});
});

describe('repoNav', () => {
	it('locks traffic for a non-owner but keeps every other info page', () => {
		const info = byLabel(repoNav('octocat', 'hello', VISITOR), 'Info');
		const traffic = byLabel(info?.children ?? [], 'Traffic');
		expect(traffic?.disabled).toBe(true);
		expect(byLabel(info?.children ?? [], 'People')?.href).toBe('/octocat/hello/info/people');
	});

	it('gives the owner a real traffic href', () => {
		const info = byLabel(repoNav('octocat', 'hello', OWNER), 'Info');
		expect(byLabel(info?.children ?? [], 'Traffic')?.href).toBe('/octocat/hello/info/traffic');
	});
});

describe('sectionPills', () => {
	it('puts an Overview pill first, linking to the section root', () => {
		const pills = sectionPills('repo', 'code', '/octocat/hello', 'octocat', OWNER, false);
		expect(pills[0]).toMatchObject({ label: 'Overview', href: '/octocat/hello/code' });
		expect(pills.map((pill) => pill.label)).toEqual([
			'Overview',
			'Activity',
			'Files',
			'History',
			'Supply chain'
		]);
	});

	it('applies the owner gate to child pages', () => {
		const pills = sectionPills('repo', 'info', '/octocat/hello', 'octocat', VISITOR, false);
		expect(byLabel(pills, 'Traffic')?.disabled).toBe(true);
	});
});
