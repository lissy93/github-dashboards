<script lang="ts">
	import { page } from '$app/state';
	import NavTabs from '$lib/components/layout/NavTabs.svelte';
	import { USER_NAV } from '$lib/config';

	let { children } = $props();
	const user = $derived(page.params.user ?? '');
	const tabs = $derived(USER_NAV.map((item) => ({ label: item.label, href: item.to(user) })));
</script>

<div class="space-y-5">
	<NavTabs {tabs} />
	{@render children()}
</div>
