<script lang="ts">
	import { ShieldCheck } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import ScorecardPanel from '$lib/components/repo/ScorecardPanel.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Security · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<AsyncPanel title="OpenSSF Scorecard" icon={ShieldCheck} result={data.scorecard}>
	{#snippet children(scorecard)}
		<ScorecardPanel {scorecard} detailed />
	{/snippet}
</AsyncPanel>
