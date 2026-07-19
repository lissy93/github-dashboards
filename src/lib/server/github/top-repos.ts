import { graphql } from '$lib/server/github/client';
import { cached } from '$lib/server/cache';
import type { TopRepo } from '$lib/types';

const LIMIT = 6;
const TTL = 6 * 3600;

type Result = {
	repositoryOwner: {
		repositories: { nodes: { name: string; stargazerCount: number }[] };
	} | null;
};

const QUERY = `
	query TopRepos($login: String!) {
		repositoryOwner(login: $login) {
			repositories(first: ${LIMIT}, privacy: PUBLIC, ownerAffiliations: OWNER,
				orderBy: { field: STARGAZERS, direction: DESC }) {
				nodes { name stargazerCount }
			}
		}
	}
`;

// The owner's most starred public repos, a tiny query cached for palette suggestions
export function getTopRepos(login: string): Promise<TopRepo[]> {
	return cached(
		`user:top-repos:v1:${login.toLowerCase()}`,
		async () => {
			const data = await graphql<Result>(QUERY, { login }, 'app');
			const nodes = data.repositoryOwner?.repositories.nodes ?? [];
			return nodes.map((node) => ({ name: node.name, stars: node.stargazerCount }));
		},
		TTL
	);
}
