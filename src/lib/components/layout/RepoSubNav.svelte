<script lang="ts">
	import { page } from '$app/state';
	import SubNav from '$lib/components/layout/SubNav.svelte';
	import { repoSubNavItems } from '$lib/components/layout/nav';
	import { paths } from '$lib/config';

	// Pills for a repo tab's sub-pages, hidden on the tab's own landing page
	let {
		section,
		user,
		repo,
		canSeeTraffic = false
	}: { section: string; user: string; repo: string; canSeeTraffic?: boolean } = $props();

	const isIndex = $derived(page.url.pathname === paths.repoSection(user, repo, section));
	const items = $derived(repoSubNavItems(section, user, repo, canSeeTraffic));
</script>

{#if !isIndex}<SubNav {items} />{/if}
