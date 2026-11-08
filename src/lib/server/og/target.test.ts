import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveOgTarget } from './target';
import { BUCKET_BY_SECTION } from '$lib/config/tasks';

const labels = (path: string) => resolveOgTarget(path)?.trail.map((page) => page.label);

// Every real page route under a user, as a sample path with params filled in
function routePaths(): string[] {
	const root = 'src/routes/[user=login]';
	const files = readdirSync(root, { recursive: true, encoding: 'utf8' });
	return files
		.filter((file) => file.endsWith('+page.svelte'))
		.flatMap((file) => {
			const route = join('octocat', dirname(file))
				.replace('/(user)', '')
				.replace('[repo=repo]', 'hello-world');
			if (!route.includes('[list=taskList]')) return [route];
			return Object.keys(BUCKET_BY_SECTION).map((list) => route.replace('[list=taskList]', list));
		});
}

describe('resolveOgTarget', () => {
	it('resolves user pages, including task lists', () => {
		expect(resolveOgTarget('octocat')).toMatchObject({ user: 'octocat' });
		expect(resolveOgTarget('octocat')?.repo).toBeUndefined();
		expect(labels('octocat')).toEqual(['Overview']);
		expect(labels('octocat/stats')).toEqual(['Stats']);
		expect(labels('octocat/tasks/my-prs')).toEqual(['Issues & PRs', 'PRs submitted']);
	});

	it('resolves repo pages and their section children', () => {
		expect(resolveOgTarget('octocat/hello-world')).toMatchObject({
			user: 'octocat',
			repo: 'hello-world'
		});
		expect(labels('octocat/hello-world')).toEqual(['Overview']);
		expect(labels('octocat/hello-world/code')).toEqual(['Code']);
		expect(labels('octocat/hello-world/info/security')).toEqual(['Info', 'Security']);
	});

	it('prefers user pages, falling back to a repo named like one, like the router does', () => {
		expect(resolveOgTarget('octocat/stats')?.repo).toBeUndefined();
		expect(resolveOgTarget('octocat/stats/info/stats')).toMatchObject({ repo: 'stats' });
		expect(labels('octocat/tasks/tasks/issues')).toEqual(['Issues & PRs', 'Issues']);
		expect(resolveOgTarget('octocat/web-check.xyz')?.repo).toBe('web-check.xyz');
	});

	it('rejects bad logins, repos and unknown pages', () => {
		for (const path of [
			'',
			'-octocat',
			'octo_cat',
			'octocat/..',
			'octocat/hello-world/nope',
			'octocat/hello-world/info/nope',
			'octocat/hello-world/info/stats/extra',
			'octocat/stats/extra'
		]) {
			expect(resolveOgTarget(path), path).toBeNull();
		}
	});

	it('covers every page route so no page shares a broken card', () => {
		const paths = routePaths();
		expect(paths.length).toBeGreaterThan(20);
		for (const path of paths) expect(resolveOgTarget(path), path).not.toBeNull();
	});
});
