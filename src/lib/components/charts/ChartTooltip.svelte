<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { TipData } from '$lib/views/stats';

	let { data, x, y }: { data: TipData | null; x: number; y: number } = $props();

	let size = $state({ w: 0, h: 0 });

	// Move the tip to <body> so this fixed node lives outside the chart's panel and can never
	// add to or shift that panel's layout, whatever positioning context an ancestor sets up
	const portal: Attachment = (node) => {
		document.body.appendChild(node);
		return () => node.remove();
	};

	// Re-measure on each content change so the viewport clamp below stays accurate
	const measure: Attachment = (node) => {
		void data;
		size = { w: (node as HTMLElement).offsetWidth, h: (node as HTMLElement).offsetHeight };
	};

	const MARGIN = 8;
	// Clamp the cursor-anchored tip inside the viewport so it never spills past an edge and
	// spawns a scrollbar (which would itself shift the page)
	const left = $derived.by(() => {
		const half = size.w / 2;
		const viewport = typeof window === 'undefined' ? Infinity : window.innerWidth;
		return Math.min(Math.max(x, MARGIN + half), Math.max(MARGIN + half, viewport - MARGIN - half));
	});
	const top = $derived(Math.max(y - 10, MARGIN + size.h));
</script>

<!-- Cursor-anchored tooltip, sits above the pointer and never intercepts it -->
{#if data}
	<div
		{@attach portal}
		{@attach measure}
		class="bg-popover pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border px-2.5 py-1.5 text-xs shadow-md"
		style="left: {left}px; top: {top}px"
		role="tooltip"
	>
		<div class="flex items-center gap-1.5 font-medium">
			{#if data.color}
				<span class="size-2 shrink-0 rounded-sm" style="background-color: {data.color}"></span>
			{/if}
			{data.title}
		</div>
		{#if data.note}
			<p class="text-muted-foreground mt-0.5 max-w-44 text-[0.7rem] leading-snug">{data.note}</p>
		{/if}
		{#each data.rows as row (row.label)}
			<div class="flex justify-between gap-4 tabular-nums">
				<span class="text-muted-foreground flex items-center gap-1.5">
					{#if row.color}
						<span class="size-2 shrink-0 rounded-sm" style="background-color: {row.color}"></span>
					{/if}
					{row.label}
				</span>
				<span class="text-foreground">{row.value}</span>
			</div>
		{/each}
	</div>
{/if}
