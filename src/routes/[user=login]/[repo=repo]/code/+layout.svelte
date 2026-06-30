<script lang="ts">
	import { page } from '$app/state';
	import SubNav from '$lib/components/layout/SubNav.svelte';
	import { CODE_NAV, paths } from '$lib/config';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const basePath = $derived(paths.repoCode(data.user, data.repo.name));
	const isIndex = $derived(page.url.pathname === basePath);
	const items = $derived(
		CODE_NAV.map(({ label, section }) => ({
			label,
			href: paths.repoCodeSection(data.user, data.repo.name, section)
		}))
	);
</script>

<div class="space-y-5">
	{#if !isIndex}<SubNav {items} />{/if}
	{@render children()}
</div>
