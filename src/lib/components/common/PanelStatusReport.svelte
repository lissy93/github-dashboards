<script lang="ts">
	import type { Component } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		ChevronRight,
		CircleCheck,
		Hourglass,
		Inbox,
		ChartColumnIncreasing,
		Info,
		Lock,
		LogIn,
		Gauge,
		SearchX,
		CloudOff,
		TriangleAlert
	} from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { usePanelStatus } from '$lib/state/panel-status.svelte';
	import { STATUS_CAUSES, LEVEL_META } from '$lib/config/status';
	import type { PanelReport, StatusCause, StatusLevel } from '$lib/types';

	type IconComponent = Component<{ size?: number | string; class?: string }>;

	const CAUSE_ICONS: Record<StatusCause, IconComponent> = {
		ok: CircleCheck,
		loading: Hourglass,
		empty: Inbox,
		low_data: ChartColumnIncreasing,
		partial: Info,
		pending: Hourglass,
		forbidden: Lock,
		needs_auth: LogIn,
		rate_limited: Gauge,
		not_found: SearchX,
		unavailable: CloudOff,
		error: TriangleAlert
	};
	const LEVELS: StatusLevel[] = ['error', 'warn', 'info', 'ok'];
	const LEVEL_LABELS: Record<StatusLevel, string> = {
		error: 'errors',
		warn: 'warnings',
		info: 'notices',
		ok: 'loaded'
	};
	// Past this length a detail gets its own collapsible instead of a hover tooltip
	const DETAIL_MAX = 80;

	// Collapsible roll-up of every panel's status on the page, worst level first
	const status = usePanelStatus();
	let open = $state(false);
	const expanded = new SvelteSet<string>();

	const reports = $derived(status?.reports ?? []);
	const sorted = $derived(
		[...reports].sort(
			(a, b) =>
				LEVEL_META[STATUS_CAUSES[a.cause].level].order -
				LEVEL_META[STATUS_CAUSES[b.cause].level].order
		)
	);
	const counts = $derived.by(() => {
		const tally: Record<StatusLevel, number> = { error: 0, warn: 0, info: 0, ok: 0 };
		for (const report of reports) tally[STATUS_CAUSES[report.cause].level] += 1;
		return tally;
	});

	function toggle(id: string) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
	}
</script>

<!-- Icon, panel title, then the cause label carrying its reason in a hover tooltip -->
{#snippet labelRow(report: PanelReport, tip: string, long: boolean)}
	{@const meta = STATUS_CAUSES[report.cause]}
	{@const color = LEVEL_META[meta.level].color}
	<button  onclick={() => toggle(report.id)} class="flex gap-2 {long ? 'cursor-pointer' : ''}">
  	<Icon icon={CAUSE_ICONS[report.cause]} size={14} class="{color} shrink-0" />
  	<Hint text={tip} class="{color} shrink-0">{meta.label}</Hint>
  	<span class="text-foreground shrink-0 font-medium">{report.title}</span>
  	{#if long} <span class="text-foreground opacity-50">Click for details</span> {/if}
	</button>
{/snippet}

{#if reports.length}
	<section class="mt-8">
		<div class="flex w-full items-center gap-2 rounded-md border px-3 text-xs">
			<button
				type="button"
				onclick={() => (open = !open)}
				aria-expanded={open}
				class="text-muted-foreground hover:text-foreground flex flex-1 items-center gap-2 py-2 transition-colors"
			>
				<Icon
					icon={ChevronRight}
					size={14}
					class="transition-transform {open ? 'rotate-90' : ''}"
				/>
				<span class="font-medium">Panel status</span>
			</button>
			<span class="flex items-center gap-3 tabular-nums">
				{#each LEVELS as level (level)}
					{#if counts[level]}
						<Hint
							text="{counts[level]} {LEVEL_LABELS[level]}"
							class="{LEVEL_META[level].color} gap-1.5"
						>
							<span class="size-1.5 rounded-full bg-current"></span>{counts[level]}
						</Hint>
					{/if}
				{/each}
			</span>
		</div>
		{#if open}
			<ul class="mt-2 space-y-0.5 rounded-md border p-2 text-xs">
				{#each sorted as report (report.id)}
					{@const hint = STATUS_CAUSES[report.cause].hint}
					{@const detail = report.detail ?? hint}
					{@const long = detail.length > DETAIL_MAX}
					<li>
						<div class="flex items-center gap-2 px-1 py-1">
							{@render labelRow(report, long ? hint : detail, long)}
							{#if long}
								<button
									type="button"
									onclick={() => toggle(report.id)}
									aria-expanded={expanded.has(report.id)}
									aria-label="Toggle detail for {report.title}"
									class="text-muted-foreground hover:text-foreground ml-auto shrink-0 transition-colors"
								>
									<Icon
										icon={ChevronRight}
										size={13}
										class="transition-transform {expanded.has(report.id) ? 'rotate-90' : ''}"
									/>
								</button>
							{/if}
						</div>
						{#if long && expanded.has(report.id)}
							<p class="text-muted-foreground px-1 pb-1 pl-7 break-words">{detail}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
