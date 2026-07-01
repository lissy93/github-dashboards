<script lang="ts">
	import {
		Boxes,
		GitBranch,
		Network,
		Scale,
		FileWarning,
		ShieldAlert,
		FileText
	} from '@lucide/svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import { compactNumber } from '$lib/format';
	import type { SupplyChainSummary } from '$lib/server/github/supply-chain';

	let { summary }: { summary: SupplyChainSummary } = $props();

	const tiles = $derived<Tile[]>([
		{
			label: 'Dependencies',
			value: compactNumber(summary.total),
			icon: Boxes,
			hint: 'Total packages in the dependency graph'
		},
		{
			label: 'Direct',
			value: compactNumber(summary.direct),
			icon: GitBranch,
			hint: 'Declared directly by this repo'
		},
		{
			label: 'Transitive',
			value: compactNumber(summary.transitive),
			icon: Network,
			hint: 'Pulled in by other dependencies'
		},
		{
			label: 'Ecosystems',
			value: summary.ecosystems,
			icon: Boxes,
			hint: 'Package managers in use'
		},
		{ label: 'Licences', value: summary.licenses, icon: Scale, hint: 'Distinct resolved licences' },
		{
			label: 'Unlicensed',
			value: compactNumber(summary.unlicensed),
			icon: FileWarning,
			hint: 'Packages with no resolved licence'
		},
		{
			label: 'Vulnerable',
			value: compactNumber(summary.vulnerabilities),
			icon: ShieldAlert,
			hint: 'Open security advisories'
		},
		{
			label: 'Manifests',
			value: summary.manifests,
			icon: FileText,
			hint: 'Tracked dependency manifest files'
		}
	]);
</script>

<StatTileGrid {tiles} class="sm:grid-cols-4 lg:grid-cols-8" />
