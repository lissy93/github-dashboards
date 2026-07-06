import { batchedGraphql, graphql, rest, paginate } from '$lib/server/github/client';
import { cached } from '$lib/server/cache';
import { toAppError } from '$lib/utils/errors';
import { createLogger } from '$lib/utils/logger';
import type { NotableFollower, Org, UserSocial } from '$lib/types';

const log = createLogger('social');

const PER_PAGE = 100;
// The followers connection has no influence order, so we sample a few pages and rank
const MAX_FOLLOWER_PAGES = 3;
const TOP_FOLLOWERS = 12;
const SPONSORS = 24;
const TTL = 6 * 3600;

type RawFollower = {
	login: string;
	name: string | null;
	avatarUrl: string;
	followers: { totalCount: number };
};
type RawFollowerConn = {
	totalCount: number;
	nodes: RawFollower[];
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
};
type FollowersResult = { user: { followers: RawFollowerConn } | null };
type SponsorsResult = { user: { sponsors: { totalCount: number; nodes: (Org | null)[] } } | null };

const FOLLOWERS_QUERY = `
	query Followers($login: String!, $cursor: String) {
		user(login: $login) {
			followers(first: ${PER_PAGE}, after: $cursor) {
				totalCount
				nodes { login name avatarUrl followers { totalCount } }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const SPONSORS_QUERY = `
	query Sponsors($login: String!) {
		user(login: $login) {
			sponsors(first: ${SPONSORS}) {
				totalCount
				nodes {
					... on User { login name avatarUrl }
					... on Organization { login name avatarUrl }
				}
			}
		}
	}
`;

// Rank sampled followers by their own follower count, keeping the most notable
export function rankFollowers(nodes: RawFollower[], limit = TOP_FOLLOWERS): NotableFollower[] {
	return nodes
		.map((node) => ({
			login: node.login,
			name: node.name,
			avatarUrl: node.avatarUrl,
			followers: node.followers.totalCount
		}))
		.sort((first, second) => second.followers - first.followers)
		.slice(0, limit);
}

// Walk a few follower pages, returning the sample and the connection total
async function fetchFollowers(login: string): Promise<{ all: RawFollower[]; total: number }> {
	let total = 0;
	const { nodes } = await paginate<RawFollower, FollowersResult>(
		FOLLOWERS_QUERY,
		{ login },
		(data) => {
			const conn = data.user?.followers;
			if (conn) total = conn.totalCount;
			return conn;
		},
		{ maxPages: MAX_FOLLOWER_PAGES },
		'app'
	);
	return { all: nodes, total };
}

type RestFollower = { login: string; avatar_url: string };

// Jump to the oldest-first feed's last page for the newest followers
async function fetchNewestFollowers(login: string, total: number): Promise<NotableFollower[]> {
	if (total === 0) return [];
	const lastPage = Math.ceil(total / PER_PAGE);
	// GitHub 500s on very deep follower pages
	const page =
		(await rest<RestFollower[]>(
			`/users/${login}/followers?per_page=${PER_PAGE}&page=${lastPage}`,
			undefined,
			'app'
		).catch((caught) => {
			log.warn(`newest followers failed for ${login}`, { code: toAppError(caught).code });
			return null;
		})) ?? [];
	const recent = page
		.slice(-TOP_FOLLOWERS)
		.reverse()
		.map((follower) => ({ login: follower.login, name: null, avatarUrl: follower.avatar_url }));
	const counts = await followerCounts(recent.map((follower) => follower.login));
	return recent.map((follower) => ({
		...follower,
		followers: counts.get(follower.login.toLowerCase()) ?? 0
	}));
}

// One aliased query fetches every login's own follower count in a single round trip
async function followerCounts(logins: string[]): Promise<Map<string, number>> {
	type CountNode = { login: string; followers: { totalCount: number } } | null;
	const data = await batchedGraphql<string, CountNode>(
		'FollowerCounts',
		logins,
		(index) => `$l${index}: String!`,
		(index) => `u${index}: user(login: $l${index}) { login followers { totalCount } }`,
		(login, index) => ({ [`l${index}`]: login }),
		'app'
	);
	const counts = new Map<string, number>();
	for (const node of Object.values(data))
		if (node) counts.set(node.login.toLowerCase(), node.followers.totalCount);
	return counts;
}

// Visible sponsors and the true total, which can be higher when some stay private
async function fetchSponsors(login: string): Promise<{ sponsorsTotal: number; sponsors: Org[] }> {
	const data = await graphql<SponsorsResult>(SPONSORS_QUERY, { login }, 'app');
	const conn = data.user?.sponsors;
	if (!conn) return { sponsorsTotal: 0, sponsors: [] };
	const sponsors = conn.nodes.filter((node): node is Org => !!node?.login);
	return { sponsorsTotal: conn.totalCount, sponsors };
}

// Notable followers and sponsors for a user, cached and loaded lazily on the page
export function getUserSocial(login: string): Promise<UserSocial> {
	return cached(
		`user:social:v2:${login.toLowerCase()}`,
		async () => {
			const [followers, sponsorData] = await Promise.all([
				fetchFollowers(login),
				fetchSponsors(login)
			]);
			const newestFollowers = await fetchNewestFollowers(login, followers.total);
			return {
				topFollowers: rankFollowers(followers.all),
				newestFollowers,
				followersTotal: followers.total,
				followersSampled: followers.all.length,
				...sponsorData
			};
		},
		TTL
	);
}
