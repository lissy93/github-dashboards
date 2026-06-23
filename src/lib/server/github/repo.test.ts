import { describe, expect, it } from 'vitest';
import { canViewRepo } from '$lib/server/github/repo';
import type { Repo } from '$lib/types';

const repo = (isPrivate: boolean) =>
	({
		owner: 'alice',
		isPrivate
	}) as Repo;

describe('canViewRepo', () => {
	it('allows public repos for every viewer', () => {
		expect(canViewRepo(repo(false), null)).toBe(true);
		expect(canViewRepo(repo(false), 'bob')).toBe(true);
	});

	it('restricts private repos to the signed-in owner', () => {
		expect(canViewRepo(repo(true), null)).toBe(false);
		expect(canViewRepo(repo(true), 'bob')).toBe(false);
		expect(canViewRepo(repo(true), 'ALICE')).toBe(true);
	});
});
