<script lang="ts">
	import { compactNumber } from '$lib/utils/format';
	import { DIRECT_COLOR, TRANSITIVE_COLOR } from '$lib/views/supply-chain';
	import type { EcosystemStat } from '$lib/views/supply-chain';

	let { ecosystems }: { ecosystems: EcosystemStat[] } = $props();

	// Widths for the direct vs transitive split within a single ecosystem
	const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);
</script>

<ul class="space-y-4">
	{#each ecosystems as eco (eco.name)}
		<li class="space-y-1.5">
			<div class="flex items-center gap-2 text-sm">
				<span class="size-2.5 shrink-0 rounded-sm" style="background-color: {eco.color}"></span>
				<span class="font-medium">{eco.name}</span>
				<span class="text-muted-foreground ml-auto tabular-nums">{compactNumber(eco.total)}</span>
			</div>

			<!-- Direct deps you own vs transitive ones pulled in, same tint as the depth chart -->
			<div class="bg-muted/40 flex h-2 overflow-hidden rounded-full">
				<span
					style="width: {pct(eco.direct, eco.total)}%; background-color: {DIRECT_COLOR}"
					title="{eco.direct} direct {eco.name} dependencies"
				></span>
				<span
					style="width: {pct(eco.transitive, eco.total)}%; background-color: {TRANSITIVE_COLOR}"
					title="{eco.transitive} transitive {eco.name} dependencies"
				></span>
			</div>

			<div class="text-muted-foreground flex flex-wrap gap-x-3 text-xs tabular-nums">
				<span>{compactNumber(eco.direct)} direct</span>
				<span>{compactNumber(eco.transitive)} transitive</span>
				{#if eco.vulnerable}
					<span class="text-danger">{compactNumber(eco.vulnerable)} vulnerable</span>
				{/if}
				{#if eco.unlicensed}
					<span class="text-warning">{compactNumber(eco.unlicensed)} unlicensed</span>
				{/if}
			</div>
		</li>
	{/each}
</ul>
