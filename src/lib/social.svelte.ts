import { loadJson } from '$lib/owned-maps';
import type { UserSocial } from '$lib/types';

const EMPTY: UserSocial = {
	topFollowers: [],
	newestFollowers: [],
	followersTotal: 0,
	followersSampled: 0,
	sponsorsTotal: 0,
	sponsors: []
};

// Lazily load a user's notable followers and sponsors after the page renders,
// reloading when the viewed user changes without a remount
export function userSocial(user: () => string) {
	let data = $state<UserSocial>();

	$effect(() => {
		const login = user();
		let active = true;
		data = undefined;
		loadJson<UserSocial>(login, 'social').then((value) => {
			if (active) data = value ?? EMPTY;
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
