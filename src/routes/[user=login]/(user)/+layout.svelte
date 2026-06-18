<script lang="ts">
	import NavTabs from '$lib/components/layout/NavTabs.svelte';
	import { USER_NAV } from '$lib/config';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
	const tabs = $derived(
		USER_NAV.filter((item) => !(data.isOrg && item.userOnly)).map((item) => ({
			label: item.label,
			href: item.to(data.user)
		}))
	);
</script>

<div class="space-y-5">
	<NavTabs {tabs} />
	{@render children()}
</div>
