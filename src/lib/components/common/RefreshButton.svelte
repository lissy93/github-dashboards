<script lang="ts">
	import { RefreshCw } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { PANEL_ACTION_CLASS } from '$lib/components/common/Panel.svelte';
	import { cn } from '$lib/utils';

	type Props = {
		onclick: () => void;
		busy?: boolean;
		failed?: boolean;
		label?: string;
		hint?: string;
	};
	let {
		onclick,
		busy = false,
		failed = false,
		label = 'Update',
		hint = 'Fetch the latest data now'
	}: Props = $props();
</script>

<Hint text={failed ? 'Update failed, try again' : hint}>
	<button
		type="button"
		{onclick}
		disabled={busy}
		aria-busy={busy}
		class={cn(PANEL_ACTION_CLASS, 'disabled:opacity-70', failed && 'text-danger')}
	>
		<Icon icon={RefreshCw} size={13} class={busy ? 'animate-spin' : undefined} />
		{busy ? 'Updating' : label}
	</button>
</Hint>
