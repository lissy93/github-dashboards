<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import TopBar from '$lib/components/layout/TopBar.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<TopBar />
<main class="mx-auto max-w-7xl px-4 py-6">
	{@render children()}
</main>
