import { describe, it, expect } from 'vitest';
import { parseGithubInput, quickLinks } from './github-input';

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
