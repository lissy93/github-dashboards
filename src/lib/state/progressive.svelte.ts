import { fetchApi } from '$lib/state/api';
import { createLogger } from '$lib/utils/logger';
import type { AuthoredContributions, LoadResult, RepoTimeline, StatusCause } from '$lib/types';

const log = createLogger('progressive');
// Safety ceiling on advances, huge repos finish over later background syncs
const MAX_ADVANCES = 100;
// Each advance walks several GitHub pages server-side, so give it a longer window
const ADVANCE_TIMEOUT_MS = 60000;

type MaybeResult<T> = Promise<LoadResult<T>> | LoadResult<T>;

type Options<T> = {
	url: () => string;
	initial: () => MaybeResult<T>;
	enabled: () => boolean;
	incomplete: (data: T) => boolean;
};

// Progressively deepen a checkpointed dataset for a signed-in viewer: start from the
// SSR result, then poll the advance endpoint until the crawl completes, so panels fill
// in live and the deeper state is cached for later viewers
export function progressiveResult<T>(options: Options<T>) {
	let deeper = $state<LoadResult<T>>();
	// True once no more advances will happen this visit, so partial data warns
	let exhausted = $state(false);
	const result = $derived(deeper ?? options.initial());

	$effect(() => {
		const url = options.url();
		const enabled = options.enabled();
		const initial = options.initial();
		deeper = undefined;
		exhausted = !enabled;
		if (!enabled) return;
		let active = true;

		(async () => {
			const settled = await initial;
			if (!active) return;
			// A pending initial means the server is still crawling, so poll on for the data
			const worthAdvancing = settled.ok
				? options.incomplete(settled.data)
				: !!settled.error.pending;
			if (!worthAdvancing) {
				exhausted = true;
				return;
			}
			try {
				// A repeated payload means the crawl stalled upstream, stop hammering
				let last = settled.ok ? JSON.stringify(settled.data) : '';
				for (let step = 0; active && step < MAX_ADVANCES; step++) {
					const data = await fetchApi<T>(url, ADVANCE_TIMEOUT_MS, true);
					if (!active) return;
					deeper = { ok: true, data };
					if (!options.incomplete(data)) return;
					const snapshot = JSON.stringify(data);
					if (snapshot === last) return;
					last = snapshot;
				}
			} catch (error) {
				log.warn(`failed to advance ${url}`, error);
			} finally {
				if (active) exhausted = true;
			}
		})();

		return () => (active = false);
	});

	// Panel status for the loaded data: blue while more is inbound, partial once stopped
	const cause = (data: T): StatusCause | undefined => {
		if (!options.incomplete(data)) return undefined;
		return exhausted ? 'partial' : 'loading';
	};
	const detail = (data: T): string | undefined => {
		if (!options.incomplete(data)) return undefined;
		if (!options.enabled()) return 'Sign in with GitHub to load the full history';
		return exhausted
			? 'More history loads in over later visits'
			: 'Loading the full history in the background';
	};

	return {
		get result() {
			return result;
		},
		cause,
		detail
	};
}

type TimelinePageData = {
	user: string;
	repo: { name: string };
	timeline: MaybeResult<RepoTimeline>;
	viewerLogin: string | null;
};

// The repo timeline deepened progressively, shared by the overview and tasks views
export function progressiveTimeline(data: () => TimelinePageData) {
	return progressiveResult({
		url: () => `/api/${data().user}/${data().repo.name}/timeline?advance=1`,
		initial: () => data().timeline,
		enabled: () => !!data().viewerLogin,
		incomplete: (tl) => tl.sampled
	});
}

type UserTimelinePageData = {
	user: string;
	timeline: MaybeResult<RepoTimeline>;
	viewerLogin: string | null;
	// The authored ("your") lists deepen the contributions crawl, the review lists the aggregate
	mine?: boolean;
};

// The user's all-time issue/PR timeline, deepened progressively. scope=mine follows the
// authored contributions crawl, otherwise the on-repos aggregate deepened one repo per advance
export function progressiveUserTimeline(data: () => UserTimelinePageData) {
	return progressiveResult({
		url: () => `/api/${data().user}/timeline?advance=1${data().mine ? '&scope=mine' : ''}`,
		initial: () => data().timeline,
		enabled: () => !!data().viewerLogin,
		incomplete: (tl) => tl.sampled
	});
}

type AuthoredPageData = {
	user: string;
	contributions: MaybeResult<AuthoredContributions>;
	viewerLogin: string | null;
};

// The user's authored contributions per repo and year, deepened as the crawl resumes older
// history for a signed-in viewer
export function progressiveAuthored(data: () => AuthoredPageData) {
	return progressiveResult({
		url: () => `/api/${data().user}/authored?advance=1`,
		initial: () => data().contributions,
		enabled: () => !!data().viewerLogin,
		incomplete: (contrib) => !contrib.complete
	});
}
