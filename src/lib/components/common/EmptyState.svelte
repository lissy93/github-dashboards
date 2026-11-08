<script lang="ts">
	import type { Component } from 'svelte';
	import { Inbox } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';

	// Friendly placeholder for panels with no data yet, the icon echoes the panel subject
	let {
		icon = Inbox,
		text = 'Nothing here yet',
		hint
	}: {
		icon?: Component<{ size?: number | string; class?: string }>;
		text?: string;
		hint?: string;
	} = $props();
</script>

<div class="flex flex-col items-center gap-2 px-4 py-8 text-center">
	<div
		class="flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground"
	>
		<Icon {icon} size={18} />
	</div>
	<p class="text-sm text-muted-foreground">{text}</p>
	{#if hint}
		<p class="max-w-[24ch] text-xs text-muted-foreground/70">{hint}</p>
	{/if}
</div>
