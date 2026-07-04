import { graphql } from '$lib/server/github/client';
import { REPO_FIELDS, mapRepo, type RawRepo } from '$lib/server/github/user';
import { cached } from '$lib/server/cache';
import { AppError } from '$lib/utils/errors';
import type { Repo } from '$lib/types';

// Header data is cheap and slow moving, but counts should not go too stale
const TTL = 900;

const QUERY = `
	${REPO_FIELDS}
	query Repo($owner: String!, $name: String!) {
		repository(owner: $owner, name: $name) { ...repoFields }
	}
`;

const repoKey = (owner: string, name: string) => `repo:meta:1:${owner}/${name}`.toLowerCase();

// Private repos are visible only on their owner's signed-in board
export function canViewRepo(repo: Repo, viewerLogin: string | null | undefined): boolean {
	return (
		!repo.isPrivate || (!!viewerLogin && viewerLogin.toLowerCase() === repo.owner.toLowerCase())
	);
}

// One repo's header data. Null when it does not exist or the viewer cannot see it,
// so the route turns that into a 404 rather than leaking the difference. The miss is
// wrapped in an object since the cache column holds jsonb and cannot store a bare null
export async function getRepo(owner: string, name: string): Promise<Repo | null> {
	const { repo } = await cached(
		repoKey(owner, name),
		async (): Promise<{ repo: Repo | null }> => {
			try {
				const { repository } = await graphql<{ repository: RawRepo | null }>(QUERY, {
					owner,
					name
				});
				return { repo: repository ? mapRepo(repository) : null };
			} catch (error) {
				if (error instanceof AppError && error.code === 'not_found') return { repo: null };
				throw error;
			}
		},
		TTL
	);
	return repo;
}

// Resolve a repo without exposing private repos to other or anonymous viewers
export async function requireRepo(
	owner: string,
	name: string,
	viewerLogin: string | null | undefined
): Promise<Repo> {
	const repo = await getRepo(owner, name);
	if (!repo || !canViewRepo(repo, viewerLogin)) {
		throw new AppError('not_found', `No repo named ${owner}/${name}`);
	}
	return repo;
}
