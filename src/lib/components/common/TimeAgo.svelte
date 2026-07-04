<script lang="ts">
	import Hint from '$lib/components/common/Hint.svelte';
	import { relativeTime, formatDateTime } from '$lib/utils/format';

	// Relative time with the full date on hover
	let { date, class: className }: { date: string; class?: string } = $props();
</script>

<Hint text={formatDateTime(date)} class={className}>{relativeTime(date)}</Hint>
