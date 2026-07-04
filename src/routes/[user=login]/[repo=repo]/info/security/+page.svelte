<script lang="ts">
	import { Megaphone, ShieldAlert, ShieldCheck } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import AdvisoryList from '$lib/components/repo/AdvisoryList.svelte';
	import SecurityChecks from '$lib/components/repo/SecurityChecks.svelte';
	import SecurityStrip from '$lib/components/repo/SecurityStrip.svelte';
	import VulnerabilityList from '$lib/components/supply/VulnerabilityList.svelte';
	import { paths } from '$lib/config';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();

	const supplyChain = $derived(paths.repoCodeSection(data.user, data.repo.name, 'supply-chain'));
</script>

<PageMeta
	title={`Security · ${data.repo.nameWithOwner}`}
	description={`Security checks, alerts and advisories for ${data.repo.nameWithOwner}`}
/>

<div class="space-y-5">
	{#await data.security then res}
		{#if res.ok}
			<SecurityStrip security={res.data} />
		{/if}
	{/await}

	<AsyncPanel title="Security checks" icon={ShieldCheck} result={data.security}>
		{#snippet children(security)}
			<SecurityChecks {security} detailed />
		{/snippet}
	</AsyncPanel>

	{#await data.security then res}
		{#if res.ok && res.data.alerts?.total}
			<Panel
				title="Open vulnerability alerts"
				icon={ShieldAlert}
				href={supplyChain}
				linkLabel="Supply chain"
				count={res.data.alerts.total}
			>
				<VulnerabilityList vulnerabilities={res.data.alerts.top} />
			</Panel>
		{/if}
		{#if res.ok && res.data.advisories.length}
			<Panel title="Published advisories" icon={Megaphone}>
				<AdvisoryList advisories={res.data.advisories} />
			</Panel>
		{/if}
	{/await}
</div>
