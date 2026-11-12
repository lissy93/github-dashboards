import { defaultCard } from '$lib/server/og/card';
import { renderOg } from '$lib/server/og/render';
import type { RequestHandler } from './$types';

export const prerender = true;

// Site-wide share card, baked to a static file at build time
export const GET: RequestHandler = () => renderOg(defaultCard(), 'public, max-age=86400');
