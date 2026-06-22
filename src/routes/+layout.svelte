<script lang="ts">
	import './layout.css';
	import { TriangleAlert } from '@lucide/svelte';
	import favicon from '$lib/assets/favicon.svg';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Icon from '$lib/components/common/Icon.svelte';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<TopBar user={data.user} loginEnabled={data.loginEnabled} />
{#if data.storageDegraded}
	<div
		role="status"
		class="bg-warning/10 text-warning flex items-center justify-center gap-2 border-b px-4 py-1.5 text-xs"
	>
		<Icon icon={TriangleAlert} size={14} />
		Storage unavailable, showing live data without cache
	</div>
{/if}
<main class="mx-auto max-w-7xl px-4 py-6">
	{@render children()}
</main>
