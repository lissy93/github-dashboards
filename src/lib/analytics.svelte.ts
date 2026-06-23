import { createLogger } from '$lib/logger';
import type { DisplayError } from '$lib/errors';
import type { UserAnalytics } from '$lib/types';

const log = createLogger('analytics');

// Load analytics for the owner, refetching when the viewed user changes. getUser
// is a getter so the effect re-runs on route reuse, never serving stale data. Pass
// getRepo to scope it to a single repo, hitting the repo analytics endpoint instead
export function createAnalytics(getUser: () => string, getRepo?: () => string | undefined) {
	let data = $state<UserAnalytics>();
	let error = $state<DisplayError>();
	let loading = $state(true);

	$effect(() => {
		const login = getUser();
		const repo = getRepo?.();
		let active = true;
		const controller = new AbortController();
		loading = true;
		error = undefined;
		data = undefined;

		fetch(repo ? `/api/${login}/${repo}/analytics` : `/api/${login}/analytics`, {
			signal: controller.signal
		})
			.then(async (response) => {
				if (!active) return;
				const body = await response.json();
				if (response.ok) data = body as UserAnalytics;
				else error = body as DisplayError;
			})
			.catch((caught) => {
				if (!active || controller.signal.aborted) return;
				log.warn('failed to load analytics', caught);
				error = { title: 'unavailable', message: 'Could not load analytics' };
			})
			.finally(() => {
				if (active) loading = false;
			});

		return () => {
			active = false;
			controller.abort();
		};
	});

	return {
		get data() {
			return data;
		},
		get error() {
			return error;
		},
		get loading() {
			return loading;
		}
	};
}
