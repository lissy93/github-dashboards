import { loadJson } from '$lib/owned-maps';
import type { RecentStar } from '$lib/types';

// Lazily load a user's most recent stargazers after the page renders, reloading
// when the viewed user changes without a remount
export function latestStargazers(user: () => string) {
	let data = $state<RecentStar[]>();

	$effect(() => {
		const login = user();
		let active = true;
		data = undefined;
		loadJson<RecentStar[]>(login, 'stargazers').then((value) => {
			if (active) data = value ?? [];
		});
		return () => (active = false);
	});

	return {
		get data() {
			return data;
		},
		get loaded() {
			return data !== undefined;
		}
	};
}
