<script lang="ts">
	import { STAR_WINDOWS } from '$lib/config';
	import { cn } from '$lib/utils';

	let { window = $bindable() }: { window: number } = $props();
</script>

<!-- Picks the day range used for the new-stars delta on owned cards -->
<div
	class="bg-muted/50 flex items-center rounded-md p-0.5 text-xs"
	role="group"
	aria-label="Star window"
>
	{#each STAR_WINDOWS as days (days)}
		<button
			type="button"
			aria-pressed={window === days}
			onclick={() => (window = days)}
			class={cn(
				'text-muted-foreground hover:text-foreground rounded px-2 py-0.5 transition-colors',
				window === days && 'bg-background text-foreground shadow-sm'
			)}
		>
			{days}d
		</button>
	{/each}
</div>
