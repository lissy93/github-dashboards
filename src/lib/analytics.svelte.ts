import { createLogger } from '$lib/logger';
import type { DisplayError } from '$lib/errors';
import type { UserAnalytics } from '$lib/types';

const log = createLogger('analytics');

// Load combined analytics for the owner, refetching when the viewed user changes.
// getUser is a getter so the effect re-runs on route reuse, never serving stale data
export function createAnalytics(getUser: () => string) {
	let data = $state<UserAnalytics>();
	let error = $state<DisplayError>();
	let loading = $state(true);

	$effect(() => {
		const login = getUser();
		let active = true;
		loading = true;
		error = undefined;
		data = undefined;

		fetch(`/api/${login}/analytics`)
			.then(async (response) => {
				if (!active) return;
				const body = await response.json();
				if (response.ok) data = body as UserAnalytics;
				else error = body as DisplayError;
			})
			.catch((caught) => {
				if (!active) return;
				log.warn('failed to load analytics', caught);
				error = { title: 'unavailable', message: 'Could not load analytics' };
			})
			.finally(() => {
				if (active) loading = false;
			});

		return () => (active = false);
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
