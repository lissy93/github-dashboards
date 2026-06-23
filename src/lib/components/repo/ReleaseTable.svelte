<script lang="ts">
	import { ExternalLink, ChevronDown } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { Button } from '$lib/components/ui/button';
	import { relativeTime, formatDateTime, formatNumber } from '$lib/format';
	import type { ReleaseRow } from '$lib/server/github/releases';

	const INITIAL = 20;
	const STEP = 20;

	let { releases }: { releases: ReleaseRow[] } = $props();

	let shown = $state(INITIAL);
	const rows = $derived(releases.slice(0, shown));
	const remaining = $derived(releases.length - shown);
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm tabular-nums">
		<thead class="text-muted-foreground text-xs">
			<tr class="border-b">
				<th class="px-2 py-2 text-left font-medium first:pl-0">Release</th>
				<th class="px-2 py-2 text-left font-medium max-sm:hidden">Tag</th>
				<th class="px-2 py-2 text-left font-medium max-md:hidden">Type</th>
				<th class="px-2 py-2 text-right font-medium max-sm:hidden">Downloads</th>
				<th class="px-2 py-2 text-right font-medium last:pr-0">Published</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as release (release.url)}
				<tr class="border-b last:border-0">
					<td class="max-w-[14rem] px-2 py-2 font-medium first:pl-0 sm:max-w-[18rem]">
						<div class="truncate">
							<a
								href={release.url}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 hover:underline"
							>
								{release.name}
								<Icon icon={ExternalLink} size={12} class="text-muted-foreground" />
							</a>
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
						<Hint text={formatDateTime(release.publishedAt)}>
							{relativeTime(release.publishedAt)}
						</Hint>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if remaining > 0}
	<div class="mt-3 flex justify-center">
		<Button variant="outline" size="sm" onclick={() => (shown += STEP)}>
			<Icon icon={ChevronDown} size={14} />Load more ({remaining})
		</Button>
	</div>
{/if}
