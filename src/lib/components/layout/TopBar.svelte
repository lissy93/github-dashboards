<script lang="ts">
	import Logo from '$lib/components/common/Logo.svelte';
	import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte';
	import AuthMenu from '$lib/components/layout/AuthMenu.svelte';
	import CommandPalette from '$lib/components/layout/CommandPalette.svelte';
	import NavDrawer from '$lib/components/layout/NavDrawer.svelte';
	import { useNavTree } from '$lib/state/nav-tree.svelte';
	import { APP_NAME } from '$lib/config';
	import type { SessionUser } from '$lib/types';

	let { user, loginEnabled }: { user: SessionUser | null; loginEnabled: boolean } = $props();

	// The current scope's nav tree, present on user and repo pages but not the home page
	const nav = useNavTree();
</script>

<header class="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
	<div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
		{#if nav?.tree}
			<NavDrawer tree={nav.tree} />
		{/if}
		<!-- The full name crowds the bar on phones, so just the logo there -->
		<a href="/" aria-label={APP_NAME} class="flex items-center gap-2 font-semibold">
			<Logo size={22} />
			<span class="max-sm:hidden">{APP_NAME}</span>
		</a>
		<CommandPalette {user} class="ml-auto w-full max-w-xs" />
		<ThemeToggle />
		<AuthMenu {user} {loginEnabled} />
	</div>
</header>
