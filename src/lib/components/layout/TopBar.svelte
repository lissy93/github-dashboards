<script lang="ts">
	import { LayoutDashboard, Search } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { Input } from '$lib/components/ui/input';
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
		<form class="relative ml-auto w-full max-w-xs" onsubmit={submit}>
			<Icon
				icon={Search}
				size={15}
				class="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2"
			/>
			<Input bind:value={query} placeholder="Go to user or org" class="h-9 pl-8" />
		</form>
		<ThemeToggle />
		<AuthMenu {user} {loginEnabled} />
	</div>
</header>
