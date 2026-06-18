<script lang="ts">
	import { REACTION_EMOJI } from '$lib/components/activity/reactions';
	import type { Reactions } from '$lib/types';

	let { reactions }: { reactions: Reactions } = $props();
</script>

<div class="text-muted-foreground flex flex-wrap items-center justify-end gap-1 text-xs">
	{#each Object.entries(reactions) as [key, count] (key)}
		<span class="bg-muted inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 tabular-nums">
			<span aria-hidden="true">{REACTION_EMOJI[key]}</span>
			{count}
		</span>
	{/each}
</div>
