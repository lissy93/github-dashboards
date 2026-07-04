import { json } from '@sveltejs/kit';
import { getReactionUsers } from '$lib/server/github/reactions';
import { requireRepo } from '$lib/server/github/repo';
import { REACTION_KEYS } from '$lib/config/reactions';
import { apiError } from '$lib/server/response';
import { AppError } from '$lib/utils/errors';
import type { RequestHandler } from './$types';

const REPO = /^[\w.-]+\/[\w.-]+$/;

// Users who left a reaction on an issue or PR, loaded lazily when a pill is hovered
export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const repo = url.searchParams.get('repo') ?? '';
		const number = Number(url.searchParams.get('number'));
		const content = url.searchParams.get('content') ?? '';
		if (
			!REPO.test(repo) ||
			!Number.isInteger(number) ||
			number <= 0 ||
			!REACTION_KEYS.includes(content)
		)
			throw new AppError('bad_input', 'Invalid reaction request');

		// Gate private repos so reactions stay visible only to the owner
		const [owner, name] = repo.split('/');
		await requireRepo(owner, name, locals.user?.login);

		return json(await getReactionUsers(repo, number, content), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('reactions-endpoint', caught);
	}
};
