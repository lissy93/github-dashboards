import { loadJson } from '$lib/owned-maps';
import type { DisplayError } from '$lib/errors';
import type { UserSocial } from '$lib/types';

// Load followers and sponsors without holding up the page
export function userSocial(user: () => string) {
	let data = $state<UserSocial>();
	let error = $state<DisplayError>();
	let loaded = $state(false);

	$effect(() => {
		const login = user();
		let active = true;
		data = undefined;
		error = undefined;
		loaded = false;
		loadJson<UserSocial>(login, 'social').then((result) => {
			if (!active) return;
			loaded = true;
			if (result.ok) data = result.data;
			else error = result.error;
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
		get loaded() {
			return loaded;
		}
	};
}
