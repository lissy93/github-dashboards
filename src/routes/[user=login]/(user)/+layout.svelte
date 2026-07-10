<script lang="ts">
	import MainNav from '$lib/components/layout/MainNav.svelte';
	import { userNav, navViewer } from '$lib/components/layout/nav';
	import { useNavTree } from '$lib/state/nav-tree.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
	const viewer = $derived(navViewer(data.user, data.viewerLogin));
	const items = $derived(userNav(data.user, data.isOrg, viewer));

	// Feed the mobile drawer this scope's tree, clearing it when we leave
	const navTree = useNavTree();
	$effect(() => {
		navTree?.set({ label: data.user, items });
		return () => navTree?.clear();
	});
</script>

<div class="space-y-5">
	<MainNav {items} label="{data.user} sections" />
	{@render children()}
</div>
