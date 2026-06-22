<script lang="ts">
	import MainNav from '$lib/components/layout/MainNav.svelte';
	import { userNav } from '$lib/components/layout/nav';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
	const viewer = $derived({
		loggedIn: !!data.viewerLogin,
		isOwner: !!data.viewerLogin && data.viewerLogin.toLowerCase() === data.user.toLowerCase()
	});
	const items = $derived(userNav(data.user, data.isOrg, viewer));
</script>

<div class="space-y-5">
	<MainNav {items} label="{data.user} sections" />
	{@render children()}
</div>
