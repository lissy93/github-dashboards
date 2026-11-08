<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';

	// Placeholder filter bar and row list shown while a feed streams in
	let {
		rows = 6,
		bar = true,
		framed = true
	}: { rows?: number; bar?: boolean; framed?: boolean } = $props();
</script>

<div class="space-y-3">
	{#if bar}<Skeleton class="h-9 w-full" />{/if}
	<div class="space-y-3 {framed ? 'rounded-md border bg-card p-4' : ''}">
		{#each Array.from({ length: rows }, (_, index) => index) as index (index)}
			<Skeleton class="h-10 w-full" />
		{/each}
	</div>
</div>
