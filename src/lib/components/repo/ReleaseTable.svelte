<script lang="ts">
	import Hint from '$lib/components/common/Hint.svelte';
	import ExtLink from '$lib/components/common/ExtLink.svelte';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';
	import LoadMore from '$lib/components/common/LoadMore.svelte';
	import { formatNumber } from '$lib/utils/format';
	import type { ReleaseRow } from '$lib/types';

	const STEP = 20;

	let { releases }: { releases: ReleaseRow[] } = $props();

	let shown = $state(STEP);
	const rows = $derived(releases.slice(0, shown));
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm tabular-nums">
		<thead class="text-muted-foreground text-xs">
			<tr class="border-b">
				<th class="px-2 py-2 text-left font-medium first:pl-0">Release</th>
				<th class="px-2 py-2 text-left font-medium max-sm:hidden">Tag</th>
				<th class="px-2 py-2 text-left font-medium max-md:hidden">Type</th>
				<th class="px-2 py-2 text-left font-medium max-lg:hidden">By</th>
				<th class="px-2 py-2 text-right font-medium max-sm:hidden">Downloads</th>
				<th class="px-2 py-2 text-right font-medium last:pr-0">Published</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as release (release.url)}
				<tr class="border-b last:border-0">
					<td class="max-w-[14rem] px-2 py-2 font-medium first:pl-0 sm:max-w-[18rem]">
						<div class="truncate">
							<ExtLink href={release.url}>{release.name}</ExtLink>
						</div>
					</td>
					<td class="text-muted-foreground max-w-[10rem] px-2 py-2 max-sm:hidden">
						<code class="text-xs">{release.tag}</code>
					</td>
					<td class="px-2 py-2 whitespace-nowrap max-md:hidden">
						{#if release.prerelease}
							<span class="bg-warning/10 text-warning rounded px-1.5 py-0.5 text-xs">
								Pre-release
							</span>
						{:else}
							<span class="text-muted-foreground text-xs">Stable</span>
						{/if}
					</td>
					<td class="text-muted-foreground px-2 py-2 whitespace-nowrap max-lg:hidden">
						{release.author ?? '-'}
					</td>
					<td class="px-2 py-2 text-right whitespace-nowrap max-sm:hidden">
						{#if release.hasAssets}
							<Hint text="{formatNumber(release.downloads)} total asset downloads">
								{formatNumber(release.downloads)}
							</Hint>
						{:else}
							<span class="text-muted-foreground">-</span>
						{/if}
					</td>
					<td class="text-muted-foreground px-2 py-2 text-right whitespace-nowrap last:pr-0">
						<TimeAgo date={release.publishedAt} />
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<LoadMore total={releases.length} step={STEP} bind:shown resetKey={releases} />
