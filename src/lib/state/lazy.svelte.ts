import { loadJson } from '$lib/state/api';
import type { DisplayError } from '$lib/utils/errors';

// Lazily load one user endpoint, refetching when the viewed user changes
export function lazyEndpoint<T>(user: () => string, endpoint: string) {
	let data = $state<T>();
	let error = $state<DisplayError>();
	let loaded = $state(false);

	$effect(() => {
		const login = user();
		let active = true;
		data = undefined;
		error = undefined;
		loaded = false;
		loadJson<T>(login, endpoint).then((result) => {
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
