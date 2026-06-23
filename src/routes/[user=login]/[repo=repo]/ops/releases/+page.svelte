<script lang="ts">
	import { Tag, Download, Clock, Package } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import ReleaseTable from '$lib/components/repo/ReleaseTable.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import { releaseDownloadBars, hasReleaseDownloads } from '$lib/views/repo-stats';
	import type { RepoReleases, ReleaseRow } from '$lib/server/github/releases';
	import { compactNumber, relativeTime, formatDateTime } from '$lib/format';
	import { APP_NAME } from '$lib/config';
	import type { LoadResult } from '$lib/views/overview';
	import type { PageData } from './$types';

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
				hint: latest
					? `${latest.name} published ${formatDateTime(latest.publishedAt)}`
					: undefined
			},
			{
				label: 'Last published',
				value: latest?.publishedAt ? relativeTime(latest.publishedAt) : '-',
				icon: Clock,
				hint: latest?.publishedAt ? formatDateTime(latest.publishedAt) : undefined
			}
		];
	}

	function cadence(releases: ReleaseRow[]): string {
		if (releases.length < 2) return '-';
		const first = Date.parse(releases[0].publishedAt);
		const last = Date.parse(releases[releases.length - 1].publishedAt);
		const days = Math.round(
			(last - first) / (releases.length - 1) / 86_400_000
		);
		if (days < 1) return 'Multiple per day';
		if (days === 1) return 'Daily';
		if (days <= 7) return `Every ${days} days`;
		if (days <= 45) return `Every ${Math.round(days / 7)} weeks`;
		return `Every ${Math.round(days / 30)} months`;
	}
</script>

<svelte:head>
	<title>Releases · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<div class="space-y-5">
	{#await data.releases}
		<Panel title="Releases" icon={Tag} loading />
	{:then result}
		{@const res = result as LoadResult<RepoReleases>}
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
					<span class="text-foreground font-medium">{cadence(r.releases)}</span>
					<span class="text-muted-foreground ml-1">
						across {compactNumber(r.total)} release{r.total === 1 ? '' : 's'}
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
