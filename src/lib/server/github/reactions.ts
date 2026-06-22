import { rest } from '$lib/server/github/client';

// Cap on users we list in a tooltip, the count badge already shows the true total
const PAGE = 20;

type RestReaction = { user: { login: string } | null };

// Logins of users who left a given reaction on an issue or PR, capped for the tooltip.
// PRs share the issues reactions endpoint, so one path covers both
export async function getReactionUsers(
	repo: string,
	number: number,
	content: string
): Promise<string[]> {
	const query = new URLSearchParams({ content, per_page: String(PAGE) });
	const path = `/repos/${repo}/issues/${number}/reactions?${query}`;
	const rows = (await rest<RestReaction[]>(path)) ?? [];
	return rows.map((row) => row.user?.login).filter((login): login is string => login != null);
}
