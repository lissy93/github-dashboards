import { json } from '@sveltejs/kit';
import {
	advanceUserTimeline,
	getUserIssuePrTimeline,
	refreshUserTimeline
} from '$lib/server/github/user-timeline';
import {
	advanceAuthoredTimeline,
	getAuthoredTimeline,
	refreshAuthoredTimeline
} from '$lib/server/github/authored-timeline';
import { apiError } from '$lib/server/response';
import type { RepoTimeline } from '$lib/types';
import type { RequestHandler } from './$types';

type Mode = 'read' | 'advance' | 'refresh';
type Loader = (login: string) => Promise<RepoTimeline>;

// scope=mine is the user's own authored crawl, otherwise the on-repos review aggregate
const LOADERS: Record<'mine' | 'repos', Record<Mode, Loader>> = {
	mine: {
		read: getAuthoredTimeline,
		advance: advanceAuthoredTimeline,
		refresh: refreshAuthoredTimeline
	},
	repos: {
		read: getUserIssuePrTimeline,
		advance: advanceUserTimeline,
		refresh: refreshUserTimeline
	}
};

// only a signed-in viewer drives the crawls, anonymous stays on the cached bound
function pickMode(url: URL, signedIn: boolean): Mode {
	if (!signedIn) return 'read';
	if (url.searchParams.has('refresh')) return 'refresh';
	return url.searchParams.has('advance') ? 'advance' : 'read';
}

// advance=1 deepens older history, refresh=1 catches the caches up now
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	try {
		const scope = url.searchParams.get('scope') === 'mine' ? 'mine' : 'repos';
		setHeaders({ 'cache-control': 'private, no-store' });
		return json(await LOADERS[scope][pickMode(url, !!locals.user)](params.user));
	} catch (caught) {
		return apiError('user-timeline-endpoint', caught);
	}
};
