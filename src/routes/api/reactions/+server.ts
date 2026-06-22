import { json } from '@sveltejs/kit';
import { getReactionUsers } from '$lib/server/github/reactions';
import { REACTION_KEYS } from '$lib/reactions';
import { apiError } from '$lib/server/response';
import { AppError } from '$lib/errors';
import type { RequestHandler } from './$types';

const REPO = /^[\w.-]+\/[\w.-]+$/;

// Users who left a reaction on an issue or PR, loaded lazily when a pill is hovered
export const GET: RequestHandler = async ({ url }) => {
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

		return json(await getReactionUsers(repo, number, content), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('reactions-endpoint', caught);
	}
};
