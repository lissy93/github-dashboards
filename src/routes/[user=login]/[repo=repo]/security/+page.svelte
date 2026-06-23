<script lang="ts">
	import { ShieldCheck } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import SecurityChecks from '$lib/components/repo/SecurityChecks.svelte';
	import ScorecardPanel from '$lib/components/repo/ScorecardPanel.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Security · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<div class="space-y-5">
	<AsyncPanel title="Security checks" icon={ShieldCheck} result={data.security}>
		{#snippet children(security)}
			<SecurityChecks {security} slug={data.repo.nameWithOwner} detailed />
		{/snippet}
	</AsyncPanel>

	{#await data.security then res}
		{#if res.ok && res.data.scorecard.available}
			<Panel title="OpenSSF Scorecard" icon={ShieldCheck}>
				<ScorecardPanel scorecard={res.data.scorecard} detailed />
			</Panel>
		{/if}
	{/await}
</div>
