<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$lib/components/common/Icon.svelte';

	// Reveal-more button for sliced lists, parents bind shown and slice with it
	type Props = { total: number; step?: number; shown?: number; resetKey?: unknown };
	let { total, step = 10, shown = $bindable(step), resetKey }: Props = $props();

	// Back to the initial count whenever the data changes
	$effect(() => {
		void resetKey;
		shown = step;
	});
</script>

{#if total > shown}
	<div class="mt-3 flex justify-center">
		<Button variant="outline" size="sm" onclick={() => (shown += step)}>
			<Icon icon={ChevronDown} size={14} />Load more ({total - shown})
		</Button>
	</div>
{/if}
