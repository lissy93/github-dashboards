<script lang="ts">
	import SegmentedControl from '$lib/components/common/SegmentedControl.svelte';
	import { STAR_WINDOWS } from '$lib/config';

	// Picks the day range used for the new-stars delta on owned cards
	let { window = $bindable() }: { window: number } = $props();
</script>

<SegmentedControl
	label="Star window"
	size="sm"
	class="bg-muted/50"
	options={STAR_WINDOWS.map((days) => ({ value: days, label: `${days}d` }))}
	bind:value={window}
/>
