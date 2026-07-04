<script lang="ts">
	import { Tag, Download, Clock, Package } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import ReleaseTable from '$lib/components/repo/ReleaseTable.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import {
		releaseDownloadBars,
		hasReleaseDownloads,
		releaseCadence,
		cadenceLabel
	} from '$lib/views/repo-stats';
	import type { RepoReleases } from '$lib/types';
	import { compactNumber, relativeTime, formatDateTime, plural } from '$lib/utils/format';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();

	function tiles(r: RepoReleases): Tile[] {
		const totalDownloads = r.releases.reduce((sum, rel) => sum + rel.downloads, 0);
		const latest = r.releases.at(-1);
		return [
			{ label: 'Releases', value: compactNumber(r.total), icon: Tag },
			{
				label: 'Downloads',
				value: compactNumber(totalDownloads),
				icon: Download,
				hint: 'Total asset downloads across all releases'
			},
			{
				label: 'Latest',
				value: latest?.tag ?? '-',
				icon: Package,
				hint: latest ? `${latest.name} published ${formatDateTime(latest.publishedAt)}` : undefined
			},
			{
				label: 'Last published',
				value: latest?.publishedAt ? relativeTime(latest.publishedAt) : '-',
				icon: Clock,
				hint: latest?.publishedAt ? formatDateTime(latest.publishedAt) : undefined
			}
		];
	}
</script>

<PageMeta
	title={`Releases · ${data.repo.nameWithOwner}`}
	description={`Releases, cadence and downloads for ${data.repo.nameWithOwner}`}
/>

<div class="space-y-5">
	{#await data.releases}
		<Panel title="Releases" icon={Tag} loading />
	{:then res}
		{#if !res.ok}
			<Panel title="Releases" icon={Tag} error={res.error} />
		{:else if res.data.releases.length === 0}
			<Panel title="Releases" icon={Tag} empty emptyText="No published releases" />
		{:else}
			{@const r = res.data}
			{@const sorted = [...r.releases].reverse()}
			<StatTileGrid tiles={tiles(r)} class="sm:grid-cols-2 lg:grid-cols-4" />

			<Panel title="Release cadence" icon={Clock}>
				<p class="text-sm">
					<span class="text-foreground font-medium">
						{cadenceLabel(releaseCadence(r.releases).medianGapDays)}
					</span>
					<span class="text-muted-foreground ml-1">
						across {compactNumber(r.total)}
						{plural(r.total, 'release')}
						{#if r.sampled}(sampled){/if}
					</span>
				</p>
			</Panel>

			<Panel title="Releases" icon={Tag} count={r.total} capped={r.sampled}>
				<ReleaseTable releases={sorted} />
			</Panel>

			{#if hasReleaseDownloads(r.releases)}
				<Panel title="Downloads by release" icon={Download}>
					<BarChart
						data={releaseDownloadBars(r.releases)}
						color="var(--chart-4)"
						valueLabel="Downloads"
					/>
				</Panel>
			{/if}
		{/if}
	{/await}
</div>
