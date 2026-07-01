<script lang="ts">
	import Donut from '$lib/components/charts/Donut.svelte';
	import ExpandableBarList from '$lib/components/charts/ExpandableBarList.svelte';
	import { licenseRiskSlices, topLicenseBars } from '$lib/views/supply-chain';
	import { compactNumber } from '$lib/format';
	import type { Dependency } from '$lib/server/github/supply-chain';

	let { packages }: { packages: Dependency[] } = $props();

	const risk = $derived(licenseRiskSlices(packages));
	const top = $derived(topLicenseBars(packages));
</script>

<div class="grid gap-6 sm:grid-cols-2 sm:items-start">
	<Donut data={risk} centerLabel="{compactNumber(packages.length)} deps" valueLabel="Packages" />
	<ExpandableBarList data={top} collapsed={6} valueLabel="Packages" colored animate align="center" />
</div>
