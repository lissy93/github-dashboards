import { canViewRepo, peekRepo } from '$lib/server/github/repo';
import { peekUserProfile } from '$lib/server/github/user';
import { githubAvatar } from '$lib/config';
import { compactNumber } from '$lib/utils/format';
import { rootReason } from '$lib/utils/errors';
import { createLogger } from '$lib/utils/logger';
import { cleanText, type OgStat, type OgView } from './card';
import type { OgTarget } from './target';

const log = createLogger('og');
const AVATAR_PX = 400;
const AVATAR_TIMEOUT_MS = 3000;
const AVATAR_TYPES = new Set(['image/png', 'image/jpeg']);

// Avatar inlined as a data uri, null when GitHub is slow or sends something satori can't draw
async function avatarData(login: string): Promise<string | null> {
	try {
		const response = await fetch(githubAvatar(login, AVATAR_PX), {
			signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS)
		});
		const type = response.headers.get('content-type') ?? '';
		if (!response.ok || !AVATAR_TYPES.has(type)) return null;
		return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
	} catch (error) {
		log.warn(`avatar fetch failed for ${login}`, { reason: rootReason(error) });
		return null;
	}
}

// A cache miss or storage blip just means a card without stats
function peek<T>(what: string, read: Promise<T | null>): Promise<T | null> {
	return read.catch((error) => {
		log.warn(`${what} cache read failed`, { reason: rootReason(error) });
		return null;
	});
}

// Card data from the cache only, seen as an anonymous viewer so private repos never leak
export async function loadOgView(target: OgTarget): Promise<{ view: OgView; cached: boolean }> {
	const { user, repo: repoName, trail } = target;
	const page = trail.at(-1)!;
	const isRoot = page.slug === '';
	const base = { trail: trail.map((entry) => entry.label), description: page.description };

	if (repoName) {
		const [peeked, avatar] = await Promise.all([
			peek(`repo ${user}/${repoName}`, peekRepo(user, repoName)),
			avatarData(user)
		]);
		const repo = peeked && canViewRepo(peeked, null) ? peeked : null;
		const stats: OgStat[] = repo
			? [
					{ label: 'Stars', value: compactNumber(repo.stars) },
					{ label: 'Forks', value: compactNumber(repo.forks) },
					{ label: 'Issues', value: compactNumber(repo.openIssues) },
					...(repo.language
						? [{ label: 'Language', value: repo.language.name, color: repo.language.color }]
						: [])
				]
			: [];
		const description = (isRoot && cleanText(repo?.description)) || base.description;
		const view = { ...base, owner: user, name: repo?.name ?? repoName, description, avatar, stats };
		return { view, cached: !!repo };
	}

	const [profile, avatar] = await Promise.all([
		peek(`profile ${user}`, peekUserProfile(user)),
		avatarData(user)
	]);
	const stats: OgStat[] = profile
		? [
				...(profile.isOrg ? [] : [{ label: 'Followers', value: compactNumber(profile.followers) }]),
				{ label: 'Repos', value: compactNumber(profile.repoCount) },
				{ label: 'Stars', value: compactNumber(profile.totalStars) }
			]
		: [];
	const description = (isRoot && cleanText(profile?.bio)) || base.description;
	const subtitle = cleanText(profile?.name) || null;
	const view = { ...base, name: profile?.login ?? user, subtitle, description, avatar, stats };
	return { view, cached: !!profile };
}
