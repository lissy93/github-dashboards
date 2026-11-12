import { error } from '@sveltejs/kit';
import { resolveOgTarget } from '$lib/server/og/target';
import { loadOgView } from '$lib/server/og/view';
import { pageCard } from '$lib/server/og/card';
import { renderOg } from '$lib/server/og/render';
import type { RequestHandler } from './$types';

// Cards with stats keep for an hour, bare ones retry soon in case the cache has warmed
const CACHE_FULL = 'public, max-age=3600, s-maxage=3600';
const CACHE_BARE = 'public, max-age=300, s-maxage=300';

// Share card for any dashboard page, at /_og/<page path>.png
export const GET: RequestHandler = async ({ params }) => {
	const target = params.path.endsWith('.png') ? resolveOgTarget(params.path.slice(0, -4)) : null;
	if (!target) error(404, 'No share card for that page');
	const { view, cached } = await loadOgView(target);
	return renderOg(pageCard(view), cached ? CACHE_FULL : CACHE_BARE);
};
