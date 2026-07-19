import { describe, it, expect } from 'vitest';
import { paletteSections, parseGithubInput, quickLinks } from './github-input';

describe('parseGithubInput', () => {
	it('takes bare logins in any casing', () => {
		expect(parseGithubInput('torvalds')).toEqual({
			kind: 'user',
			href: '/torvalds',
			label: 'torvalds',
			owner: 'torvalds'
		});
		expect(parseGithubInput('MiXedCase')?.href).toBe('/MiXedCase');
	});

	it('strips @ prefix and surrounding whitespace', () => {
		expect(parseGithubInput('@torvalds')?.href).toBe('/torvalds');
		expect(parseGithubInput('  torvalds  ')?.href).toBe('/torvalds');
	});

	it('takes owner/repo slugs', () => {
		expect(parseGithubInput('sveltejs/svelte')).toEqual({
			kind: 'repo',
			href: '/sveltejs/svelte',
			label: 'sveltejs/svelte',
			owner: 'sveltejs',
			repo: 'svelte'
		});
		expect(parseGithubInput('sveltejs/svelte.git')?.href).toBe('/sveltejs/svelte');
		expect(parseGithubInput('sveltejs/svelte/')?.href).toBe('/sveltejs/svelte');
	});

	it('takes full github URLs', () => {
		expect(parseGithubInput('https://github.com/sveltejs')?.href).toBe('/sveltejs');
		expect(parseGithubInput('http://www.github.com/sveltejs/svelte/')?.href).toBe(
			'/sveltejs/svelte'
		);
		expect(parseGithubInput('github.com/sveltejs/svelte?tab=readme#readme')?.href).toBe(
			'/sveltejs/svelte'
		);
	});

	it('reads the login out of orgs and users URLs', () => {
		expect(parseGithubInput('github.com/orgs/sveltejs/repositories')?.href).toBe('/sveltejs');
		expect(parseGithubInput('https://github.com/users/torvalds/projects')?.href).toBe('/torvalds');
	});

	it('maps known repo sub-paths to our pages', () => {
		expect(parseGithubInput('github.com/sveltejs/svelte/issues')?.href).toBe(
			'/sveltejs/svelte/tasks/issues'
		);
		expect(parseGithubInput('github.com/sveltejs/svelte/pulls')?.href).toBe(
			'/sveltejs/svelte/tasks/prs'
		);
		expect(parseGithubInput('github.com/sveltejs/svelte/pull/123')?.href).toBe(
			'/sveltejs/svelte/tasks/prs'
		);
		expect(parseGithubInput('github.com/sveltejs/svelte/actions/runs/1')?.href).toBe(
			'/sveltejs/svelte/ops/workflows'
		);
		expect(parseGithubInput('github.com/sveltejs/svelte/releases/tag/v1')?.href).toBe(
			'/sveltejs/svelte/ops/releases'
		);
		expect(parseGithubInput('github.com/sveltejs/svelte/graphs/traffic')?.href).toBe(
			'/sveltejs/svelte/info/traffic'
		);
		expect(parseGithubInput('github.com/sveltejs/svelte/network/dependencies')?.href).toBe(
			'/sveltejs/svelte/code/supply-chain'
		);
		expect(parseGithubInput('github.com/sveltejs/svelte/tree/main/src')?.href).toBe(
			'/sveltejs/svelte/code/files'
		);
	});

	it('labels mapped pages with the page name', () => {
		expect(parseGithubInput('github.com/sveltejs/svelte/issues')).toEqual({
			kind: 'repo-page',
			href: '/sveltejs/svelte/tasks/issues',
			label: 'sveltejs/svelte · Issues',
			owner: 'sveltejs',
			repo: 'svelte'
		});
	});

	it('falls back to the repo overview on unknown sub-paths', () => {
		expect(parseGithubInput('github.com/sveltejs/svelte/wiki')).toEqual({
			kind: 'repo',
			href: '/sveltejs/svelte',
			label: 'sveltejs/svelte',
			owner: 'sveltejs',
			repo: 'svelte'
		});
	});

	it('takes git remotes', () => {
		expect(parseGithubInput('git@github.com:sveltejs/svelte.git')?.href).toBe('/sveltejs/svelte');
		expect(parseGithubInput('ssh://git@github.com/sveltejs/svelte')?.href).toBe('/sveltejs/svelte');
	});

	it('rejects anything it cannot place', () => {
		expect(parseGithubInput('')).toBeNull();
		expect(parseGithubInput('   ')).toBeNull();
		expect(parseGithubInput('two words')).toBeNull();
		expect(parseGithubInput('-bad')).toBeNull();
		expect(parseGithubInput('a'.repeat(40))).toBeNull();
		expect(parseGithubInput('a/..')).toBeNull();
		expect(parseGithubInput('https://gitlab.com/x/y')).toBeNull();
		expect(parseGithubInput('github.com')).toBeNull();
	});
});

describe('quickLinks', () => {
	it('offers user pages for a login', () => {
		const links = quickLinks(parseGithubInput('torvalds')!);
		expect(links.map((link) => link.href)).toEqual([
			'/torvalds/stats',
			'/torvalds/repos',
			'/torvalds/activity',
			'/torvalds/tasks'
		]);
	});

	it('offers repo pages for a repo, deep links included', () => {
		const links = quickLinks(parseGithubInput('github.com/sveltejs/svelte/issues')!);
		expect(links.map((link) => link.href)).toEqual([
			'/sveltejs/svelte/tasks',
			'/sveltejs/svelte/code/supply-chain',
			'/sveltejs/svelte/ops',
			'/sveltejs/svelte/info/security',
			'/sveltejs/svelte/info/stats'
		]);
	});

	it('labels links from the page registry', () => {
		const labels = quickLinks(parseGithubInput('sveltejs/svelte')!).map((link) => link.label);
		expect(labels).toEqual(['Tasks', 'Supply chain', 'CI/CD', 'Security', 'Stats']);
	});
});

describe('paletteSections', () => {
	it('lists every repo page, then the owner pages, then github links', () => {
		const [repo, owner, github] = paletteSections(parseGithubInput('sveltejs/svelte')!);
		expect(repo.heading).toBe('sveltejs/svelte');
		expect(repo.links[0]).toEqual({ label: 'Overview', href: '/sveltejs/svelte', slugs: [''] });
		expect(repo.links.map((link) => link.href)).toContain('/sveltejs/svelte/code/supply-chain');
		expect(repo.links.map((link) => link.href)).toContain('/sveltejs/svelte/ops');
		expect(repo.links).toHaveLength(18);
		expect(owner.heading).toBe('sveltejs');
		expect(owner.links.map((link) => link.href)).toEqual([
			'/sveltejs',
			'/sveltejs/repos',
			'/sveltejs/stats',
			'/sveltejs/activity'
		]);
		expect(github.heading).toBe('GitHub');
		expect(github.links.map((link) => link.href)).toEqual([
			'https://github.com/sveltejs/svelte',
			'https://github.com/sveltejs'
		]);
		expect(github.links.every((link) => link.external)).toBe(true);
	});

	it('appends a github link to user targets', () => {
		const sections = paletteSections(parseGithubInput('torvalds')!);
		expect(sections.map((section) => section.heading)).toEqual(['torvalds', 'GitHub']);
		expect(sections[1].links).toEqual([
			{ label: 'torvalds', href: 'https://github.com/torvalds', slugs: [], external: true }
		]);
	});

	it('moves a parsed repo page to the front', () => {
		const [repo] = paletteSections(parseGithubInput('github.com/sveltejs/svelte/actions')!);
		expect(repo.links[0].href).toBe('/sveltejs/svelte/ops/workflows');
		expect(repo.links[1].href).toBe('/sveltejs/svelte');
	});

	it('labels children with their section for the crumb', () => {
		const [repo] = paletteSections(parseGithubInput('sveltejs/svelte')!);
		const files = repo.links.find((link) => link.href === '/sveltejs/svelte/code/files');
		expect(files).toMatchObject({ label: 'Files', parent: 'Code' });
	});

	it('hides gated pages from other viewers', () => {
		const hrefs = (viewer?: string) =>
			paletteSections(parseGithubInput('torvalds')!, viewer)[0].links.map((link) => link.href);
		expect(hrefs()).toEqual([
			'/torvalds',
			'/torvalds/repos',
			'/torvalds/stats',
			'/torvalds/activity'
		]);
		expect(hrefs('Torvalds')).toContain('/torvalds/analytics');
		expect(hrefs('Torvalds')).toContain('/torvalds/tasks/prs-review');
		expect(hrefs('someone-else')).not.toContain('/torvalds/tasks');
	});

	it('gates repo traffic to the repo owner', () => {
		const hrefs = (viewer?: string) =>
			paletteSections(parseGithubInput('lissy93/dashy')!, viewer)[0].links.map((link) => link.href);
		expect(hrefs('lissy93')).toContain('/lissy93/dashy/info/traffic');
		expect(hrefs()).not.toContain('/lissy93/dashy/info/traffic');
	});
});
