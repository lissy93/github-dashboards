<script lang="ts">
	import { LayoutDashboard } from '@lucide/svelte';
	import SearchInput from '$lib/components/common/SearchInput.svelte';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/common/Icon.svelte';
	import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte';
	import AuthMenu from '$lib/components/layout/AuthMenu.svelte';
	import { APP_NAME, paths } from '$lib/config';
	import type { SessionUser } from '$lib/types';

	let { user, loginEnabled }: { user: SessionUser | null; loginEnabled: boolean } = $props();

	let query = $state('');

	// Jump to a user or org board on submit
	function submit(event: SubmitEvent) {
		event.preventDefault();
		const login = query.trim().replace(/^@/, '');
		if (login) goto(paths.user(login));
	}
</script>

<header class="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
	<div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
		<a href="/" class="flex items-center gap-2 font-semibold">
			<Icon icon={LayoutDashboard} class="text-primary" size={18} />
			{APP_NAME}
		</a>
		<form class="ml-auto w-full max-w-xs" onsubmit={submit}>
			<SearchInput bind:value={query} placeholder="Go to user or org" />
		</form>
		<ThemeToggle />
		<AuthMenu {user} {loginEnabled} />
	</div>
</header>
