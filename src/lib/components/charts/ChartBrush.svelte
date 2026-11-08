<script lang="ts">
	import { ZoomOut } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { PANEL_ACTION_CLASS } from '$lib/components/common/Panel.svelte';
	import { cn } from '$lib/utils';
	import type { chartBrush } from './brush.svelte';

	// Plain HTML so one overlay serves both the SVG and the flex charts, on a relative plot
	type Props = { brush: ReturnType<typeof chartBrush>; class?: string };
	let { brush, class: className }: Props = $props();
</script>

{#if brush.band}
	<div
		class="pointer-events-none absolute inset-y-0 border-x border-foreground/25 bg-foreground/10"
		style="left: {brush.band.x}px; width: {brush.band.width}px"
	></div>
{/if}
{#if brush.zoomed}
	<button
		type="button"
		onclick={brush.reset}
		onpointerdown={(event) => event.stopPropagation()}
		class={cn(
			PANEL_ACTION_CLASS,
			'absolute -top-3 right-0 z-10 bg-card/85 backdrop-blur-xs',
			className
		)}
	>
		<Icon icon={ZoomOut} size={13} />
		Reset
	</button>
{/if}
