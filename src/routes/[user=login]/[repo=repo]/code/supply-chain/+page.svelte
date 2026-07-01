<script lang="ts">
	import { Boxes, ShieldAlert, Scale, Layers, Network, FileText } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import SupplyChainStrip from '$lib/components/supply/SupplyChainStrip.svelte';
	import LicenseBreakdown from '$lib/components/supply/LicenseBreakdown.svelte';
	import DependencyInsights from '$lib/components/supply/DependencyInsights.svelte';
	import EcosystemBreakdown from '$lib/components/supply/EcosystemBreakdown.svelte';
	import VulnerabilityList from '$lib/components/supply/VulnerabilityList.svelte';
	import ManifestList from '$lib/components/supply/ManifestList.svelte';
	import DependencyTable from '$lib/components/supply/DependencyTable.svelte';
	import { ecosystemStats } from '$lib/views/supply-chain';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Supply chain · {data.repo.nameWithOwner} · {APP_NAME}</title>
	<meta
		name="description"
		content="Dependencies, licences and supply-chain risk for {data.repo.nameWithOwner}"
	/>
</svelte:head>

{#await data.supplyChain}
	<div class="space-y-5">
		<Panel title="Dependencies" icon={Boxes} loading />
		<Panel title="Licences" icon={Scale} loading />
	</div>
{:then res}
	{#if !res.ok}
		<Panel title="Supply chain" icon={Boxes} error={res.error} />
	{:else if res.data.summary.total === 0}
		<Panel
			title="Supply chain"
			icon={Boxes}
			empty
			emptyText="No dependency data for this repo"
			emptyHint="GitHub builds the dependency graph from manifest files like package.json"
		/>
	{:else}
		{@const sc = res.data}
		<div class="space-y-5">
			<SupplyChainStrip summary={sc.summary} />

			{#if sc.vulnerabilities.length}
				<Panel title="Open advisories" icon={ShieldAlert} count={sc.vulnerabilities.length}>
					<VulnerabilityList vulnerabilities={sc.vulnerabilities} />
				</Panel>
			{/if}

			<div class="grid items-start gap-5 lg:grid-cols-3">
				<Panel title="Licence risk" icon={Scale} class="lg:col-span-2">
					<LicenseBreakdown packages={sc.packages} />
				</Panel>
				<Panel title="Ecosystems" icon={Layers}>
					<EcosystemBreakdown ecosystems={ecosystemStats(sc.packages)} />
				</Panel>
			</div>

			<Panel title="Dependency insights" icon={Network}>
				<DependencyInsights packages={sc.packages} />
			</Panel>

			<Panel title="Dependencies" icon={Boxes} count={sc.summary.total}>
				<DependencyTable packages={sc.packages} repo={data.repo.name} />
			</Panel>

			{#if sc.manifests.length}
				<Panel title="Manifest files" icon={FileText} count={sc.manifests.length}>
					<ManifestList manifests={sc.manifests} repoUrl={data.repo.url} />
				</Panel>
			{/if}
		</div>
	{/if}
{/await}
