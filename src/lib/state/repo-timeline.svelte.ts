import { fetchApi } from '$lib/state/api';
import { createLogger } from '$lib/utils/logger';
import type { LoadResult, RepoTimeline } from '$lib/types';

const log = createLogger('repo-timeline');
// Safety ceiling on progressive advances, huge repos finish over later background syncs
const MAX_ADVANCES = 100;

type Timeline = LoadResult<RepoTimeline>;
type MaybeTimeline = Promise<Timeline> | Timeline;

// Progressively deepen the issue/PR timeline for a signed-in viewer: start from the SSR
// result, then poll the advance endpoint until the history is complete, so the charts fill
// in as older data arrives and the deeper state is cached for later viewers
export function progressiveTimeline(
	getUser: () => string,
	getRepo: () => string,
	getInitial: () => MaybeTimeline,
	getEnabled: () => boolean
) {
	let deeper = $state<Timeline>();
	const result = $derived(deeper ?? getInitial());

	$effect(() => {
		const user = getUser();
		const repo = getRepo();
		const enabled = getEnabled();
		const initial = getInitial();
		deeper = undefined;
		if (!enabled) return;
		let active = true;

		(async () => {
			const settled = await initial;
			// Only deepen once the first load succeeded and flagged more history to crawl
			if (!active || !settled.ok || !settled.data.sampled) return;
			for (let step = 0; active && step < MAX_ADVANCES; step++) {
				try {
					const data = await fetchApi<RepoTimeline>(`/api/${user}/${repo}/timeline?advance=1`);
					if (!active) return;
					deeper = { ok: true, data };
					if (!data.sampled) return;
				} catch (error) {
					log.warn('failed to advance timeline', error);
					return;
				}
			}
		})();

		return () => (active = false);
	});

	return {
		get result() {
			return result;
		}
	};
}
