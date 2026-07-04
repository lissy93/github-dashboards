<script lang="ts">
	import {
		Globe,
		CircleCheck,
		CircleX,
		Lock,
		GitBranch,
		GitCommitHorizontal,
		Clock,
		Hammer
	} from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';
	import LoadMore from '$lib/components/common/LoadMore.svelte';
	import { STATUS_GLYPH } from '$lib/components/repo/status-glyph';
	import type { RepoPages } from '$lib/types';
	import { formatDateTime, formatDuration } from '$lib/utils/format';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	const STEP = 10;

	let { data }: { data: PageData } = $props();
	let shown = $state(STEP);

	function tiles(p: RepoPages): Tile[] {
		return [
			{
				label: 'Status',
				value: p.status === 'built' ? 'Live' : (p.status ?? 'Unknown'),
				icon: p.status === 'built' ? CircleCheck : CircleX
			},
			{
				label: 'HTTPS',
				value: p.https ? 'Enforced' : 'Off',
				icon: Lock,
				hint: p.certificate?.expiresAt
					? `TLS certificate expires ${formatDateTime(p.certificate.expiresAt)}`
					: undefined
			},
			{
				label: 'Source',
				value: p.buildType === 'workflow' ? 'Actions' : (p.source?.branch ?? '-'),
				icon: p.buildType === 'workflow' ? Hammer : GitBranch,
				hint: p.source ? `${p.source.branch}:${p.source.path}` : undefined
			},
			{
				label: 'Builds',
				value: String(p.builds.length),
				icon: Clock,
				hint: p.builds[0] ? `Last build ${formatDateTime(p.builds[0].createdAt)}` : undefined
			}
		];
	}

	function buildToken(status: string): 'success' | 'danger' | 'muted' {
		if (status === 'built') return 'success';
		if (status === 'errored') return 'danger';
		return 'muted';
	}
</script>

<svelte:head>
	<title>Pages · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<div class="space-y-5">
	{#await data.pages}
		<Panel title="GitHub Pages" icon={Globe} loading />
	{:then res}
		{#if !res.ok}
			<Panel title="GitHub Pages" icon={Globe} error={res.error} />
		{:else if !res.data.enabled}
			<Panel
				title="GitHub Pages"
				icon={Globe}
				empty
				emptyText="GitHub Pages not enabled"
				emptyHint="Enable Pages in the repository settings to deploy a site"
			/>
		{:else}
			{@const p = res.data}
			<StatTileGrid tiles={tiles(p)} class="sm:grid-cols-2 lg:grid-cols-4" />

			{#if p.url}
				<Panel title="Site URL" icon={Globe}>
					<a
						href={p.url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary hover:underline text-sm break-all"
					>
						{p.url}
					</a>
					{#if p.cname}
						<p class="text-muted-foreground mt-1 text-xs">
							Custom domain: {p.cname}
						</p>
					{/if}
				</Panel>
			{/if}

			<Panel
				title="Recent builds"
				icon={Hammer}
				count={p.builds.length}
				empty={p.builds.length === 0}
				emptyText="No builds recorded"
			>
				<div class="overflow-x-auto">
					<table class="w-full text-sm tabular-nums">
						<thead class="text-muted-foreground text-xs">
							<tr class="border-b">
								<th class="px-2 py-2 text-left font-medium first:pl-0">Status</th>
								<th class="px-2 py-2 text-left font-medium max-sm:hidden">Commit</th>
								<th class="px-2 py-2 text-right font-medium max-sm:hidden">Duration</th>
								<th class="px-2 py-2 text-right font-medium last:pr-0">Built</th>
							</tr>
						</thead>
						<tbody>
							{#each p.builds.slice(0, shown) as build (build.createdAt)}
								{@const token = buildToken(build.status)}
								{@const glyph = STATUS_GLYPH[token]}
								<tr class="border-b last:border-0">
									<td class="px-2 py-2 whitespace-nowrap first:pl-0">
										<Hint
											text={build.error || `Build status: ${build.status}`}
											class="{glyph.color} flex items-center gap-1.5"
										>
											<Icon icon={glyph.icon} size={14} />
											<span class="capitalize">{build.status}</span>
										</Hint>
									</td>
									<td class="px-2 py-2 whitespace-nowrap max-sm:hidden">
										{#if build.commitSha}
											<span
												class="text-muted-foreground inline-flex items-center gap-1 font-mono text-xs"
											>
												<Icon icon={GitCommitHorizontal} size={13} />
												{build.commitSha.slice(0, 7)}
											</span>
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</td>
									<td
										class="text-muted-foreground px-2 py-2 text-right whitespace-nowrap max-sm:hidden"
									>
										{build.duration ? formatDuration(build.duration) : '-'}
									</td>
									<td
										class="text-muted-foreground px-2 py-2 text-right whitespace-nowrap last:pr-0"
									>
										<TimeAgo date={build.createdAt} />
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<LoadMore total={p.builds.length} step={STEP} bind:shown resetKey={p.builds} />
			</Panel>
		{/if}
	{/await}
</div>
