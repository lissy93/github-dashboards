<script lang="ts">
	import { APP_NAME } from '$lib/config';

	// One head block for every page, so titles and descriptions never drift
	let { title, description }: { title: string; description?: string } = $props();
</script>

<svelte:head>
	<title>{title} · {APP_NAME}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
</svelte:head>
