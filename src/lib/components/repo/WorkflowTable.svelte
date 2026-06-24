<script lang="ts">
	import {
		CircleCheck,
		CircleX,
		CircleDashed,
		ExternalLink,
		ChevronUp,
		ChevronDown,
		Activity
	} from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { Button } from '$lib/components/ui/button';
	import { runState, formatDuration } from '$lib/views/repo';
	import { relativeTime, formatDateTime } from '$lib/format';
	import { cn } from '$lib/utils';
	import type { WorkflowSummary } from '$lib/server/github/workflows';

	const INITIAL = 20;
	const STEP = 20;

	// Compact mode progressively hides detail as its container narrows
	let { workflows, compact = false }: { workflows: WorkflowSummary[]; compact?: boolean } =
		$props();

	let shown = $state(INITIAL);

	const STATE_ICON = {
		success: { icon: CircleCheck, color: 'text-success' },
		danger: { icon: CircleX, color: 'text-danger' },
		warning: { icon: CircleDashed, color: 'text-warning' },
		muted: { icon: CircleDashed, color: 'text-muted-foreground' }
	};
	// Failing first when sorting by status, so the rows needing attention surface
	const STATE_RANK = { danger: 0, warning: 1, success: 2, muted: 3 };

	type SortKey = 'name' | 'status' | 'passRate' | 'runs' | 'avgRuntime' | 'lastRun';
	// hide drops a column as the container narrows in compact mode, vhide does the same by
	// viewport when the table fills the page, so both layouts shed detail gracefully
	const COLUMNS: {
		key: SortKey;
		label: string;
		align: string;
		hide?: string;
		vhide?: string;
		bigOnly?: boolean;
	}[] = [
		{ key: 'name', label: 'Workflow', align: 'text-left' },
		{ key: 'status', label: 'Status', align: 'text-left' },
		{
			key: 'passRate',
			label: 'Pass rate',
			align: 'text-right',
			hide: '@max-sm:hidden',
			vhide: 'max-sm:hidden'
		},
		{ key: 'runs', label: 'Runs', align: 'text-right', bigOnly: true, vhide: 'max-md:hidden' },
		{
			key: 'avgRuntime',
			label: 'Avg runtime',
			align: 'text-right',
			hide: '@max-lg:hidden',
			vhide: 'max-lg:hidden'
		},
		{
			key: 'lastRun',
			label: 'Last run',
			align: 'text-right',
			hide: '@max-md:hidden',
			vhide: 'max-md:hidden'
		}
	];

	const pct = (rate: number | null) => (rate == null ? '-' : `${Math.round(rate * 100)}%`);

	let sortKey = $state<SortKey>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = key === 'name' || key === 'status' ? 'asc' : 'desc';
		}
	}

	function sortValue(row: Row, key: SortKey): string | number | null {
		switch (key) {
			case 'name':
				return row.workflow.name.toLowerCase();
			case 'status':
				return STATE_RANK[row.state.token];
			case 'passRate':
				return row.workflow.passRate;
			case 'runs':
				return row.workflow.runsSampled;
			case 'avgRuntime':
				return row.workflow.avgRuntimeSec;
			case 'lastRun':
				return row.workflow.latest?.createdAt ? Date.parse(row.workflow.latest.createdAt) : null;
		}
	}

	// Missing values sort to the end whichever direction is active
	function compare(a: Row, b: Row): number {
		const left = sortValue(a, sortKey);
		const right = sortValue(b, sortKey);
		if (left == null && right == null) return 0;
		if (left == null) return 1;
		if (right == null) return -1;
		const cmp =
			typeof left === 'string' ? left.localeCompare(right as string) : left - (right as number);
		return sortDir === 'asc' ? cmp : -cmp;
	}

	type Row = {
		workflow: WorkflowSummary;
		state: ReturnType<typeof runState>;
		glyph: (typeof STATE_ICON)[keyof typeof STATE_ICON];
	};

	const sorted = $derived(
		workflows
			.map((workflow) => {
				const state = runState(
					workflow.latest?.status ?? null,
					workflow.latest?.conclusion ?? null
				);
				return { workflow, state, glyph: STATE_ICON[state.token] };
			})
			.sort(compare)
	);
	const rows = $derived(compact ? sorted : sorted.slice(0, shown));
	const remaining = $derived(compact ? 0 : sorted.length - shown);

	const headerColumns = $derived(COLUMNS.filter((col) => !(compact && col.bigOnly)));
	const cellClass = (col: (typeof COLUMNS)[number]) =>
		cn(col.align, compact ? col.hide : col.vhide);
	const sortIcon = (key: SortKey) =>
		sortKey === key && sortDir === 'asc' ? ChevronUp : ChevronDown;
</script>

<div class={cn('overflow-x-auto', compact && '@container')}>
	<table class="w-full text-sm tabular-nums">
		<thead class="text-muted-foreground text-xs">
			<tr class="border-b">
				{#each headerColumns as col (col.key)}
					<th
						class={cn(
							'px-2 py-2 font-medium whitespace-nowrap first:pl-0 last:pr-0',
							cellClass(col)
						)}
						aria-sort={sortKey === col.key
							? sortDir === 'asc'
								? 'ascending'
								: 'descending'
							: 'none'}
					>
						<button
							type="button"
							onclick={() => toggleSort(col.key)}
							class={cn(
								'hover:text-foreground inline-flex cursor-pointer items-center gap-1 select-none',
								col.align === 'text-right' && 'flex-row-reverse'
							)}
						>
							{#if compact && col.key === 'status'}
								<Hint text="Status"><Icon icon={Activity} size={14} /></Hint>
							{:else}{col.label}{/if}
							<Icon
								icon={sortIcon(col.key)}
								size={12}
								class={sortKey === col.key ? '' : 'opacity-0'}
							/>
						</button>
					</th>
				{/each}
				{#if compact}<th class="w-full"></th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each rows as { workflow, state, glyph } (workflow.id)}
				<tr class="border-b last:border-0">
					<td
						class={cn(
							'px-2 py-2 font-medium first:pl-0 last:pr-0',
							compact ? 'max-w-[12rem]' : 'max-w-[14rem]',
							cellClass(COLUMNS[0])
						)}
					>
						<div class="truncate">
							{#if workflow.latest?.runUrl}
								<a
									href={workflow.latest.runUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1 hover:underline"
								>
									{workflow.name}<Icon
										icon={ExternalLink}
										size={12}
										class="text-muted-foreground"
									/>
								</a>
							{:else}{workflow.name}{/if}
							{#if workflow.state.startsWith('disabled')}
								<Hint text="Workflow disabled" class="text-muted-foreground ml-1.5 align-middle">
									<span class="text-[0.65rem] tracking-wide uppercase">disabled</span>
								</Hint>
							{/if}
						</div>
					</td>
					<td class={cn('px-2 py-2 whitespace-nowrap first:pl-0 last:pr-0', cellClass(COLUMNS[1]))}>
						{#if compact}
							<Hint text={state.label} class={glyph.color}>
								<Icon icon={glyph.icon} size={14} />
							</Hint>
						{:else}
							<Hint text={state.label} class="{glyph.color} flex items-center gap-1.5">
								<Icon icon={glyph.icon} size={14} /><span class="max-sm:hidden">{state.label}</span>
							</Hint>
						{/if}
					</td>
					<td
						class={cn(
							'px-2 py-2 text-right whitespace-nowrap first:pl-0 last:pr-0',
							cellClass(COLUMNS[2])
						)}
					>
						{pct(workflow.passRate)}
					</td>
					{#if !compact}
						<td
							class={cn(
								'px-2 py-2 text-right whitespace-nowrap first:pl-0 last:pr-0',
								cellClass(COLUMNS[3])
							)}
						>
							<Hint text="Recent runs sampled for these stats">
								{workflow.runsSampled || '-'}
							</Hint>
						</td>
					{/if}
					<td
						class={cn(
							'px-2 py-2 text-right whitespace-nowrap first:pl-0 last:pr-0',
							cellClass(COLUMNS[4])
						)}
					>
						{formatDuration(workflow.avgRuntimeSec)}
					</td>
					<td
						class={cn(
							'text-muted-foreground px-2 py-2 text-right whitespace-nowrap first:pl-0 last:pr-0',
							cellClass(COLUMNS[5])
						)}
					>
						{#if workflow.latest?.createdAt}
							<Hint text={formatDateTime(workflow.latest.createdAt)}>
								{relativeTime(workflow.latest.createdAt)}
							</Hint>
						{:else}-{/if}
					</td>
					{#if compact}<td class="w-full"></td>{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if remaining > 0}
	<div class="mt-3 flex justify-center">
		<Button variant="outline" size="sm" onclick={() => (shown += STEP)}>
			<Icon icon={ChevronDown} size={14} />Load more ({remaining})
		</Button>
	</div>
{/if}
