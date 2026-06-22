<script lang="ts">
	import { CircleCheck, CircleX, CircleDashed, ExternalLink } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { runState, formatDuration } from '$lib/views/repo';
	import { relativeTime, formatDateTime } from '$lib/format';
	import type { WorkflowSummary } from '$lib/server/github/workflows';

	let { workflows }: { workflows: WorkflowSummary[] } = $props();

	const STATE_ICON = {
		success: { icon: CircleCheck, color: 'text-success' },
		danger: { icon: CircleX, color: 'text-danger' },
		warning: { icon: CircleDashed, color: 'text-warning' },
		muted: { icon: CircleDashed, color: 'text-muted-foreground' }
	};
	const pct = (rate: number | null) => (rate == null ? '-' : `${Math.round(rate * 100)}%`);
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm tabular-nums">
		<thead class="text-muted-foreground text-left text-xs">
			<tr class="border-b">
				<th class="py-2 pr-3 font-medium">Workflow</th>
				<th class="px-3 py-2 font-medium">Status</th>
				<th class="px-3 py-2 text-right font-medium">Pass rate</th>
				<th class="px-3 py-2 text-right font-medium">Avg runtime</th>
				<th class="py-2 pl-3 text-right font-medium">Last run</th>
			</tr>
		</thead>
		<tbody>
			{#each workflows as workflow (workflow.id)}
				{@const state = runState(
					workflow.latest?.status ?? null,
					workflow.latest?.conclusion ?? null
				)}
				{@const glyph = STATE_ICON[state.token]}
				<tr class="border-b last:border-0">
					<td class="max-w-[14rem] truncate py-2 pr-3 font-medium">
						{#if workflow.latest?.runUrl}
							<a
								href={workflow.latest.runUrl}
								target="_blank"
								rel="noreferrer"
								class="inline-flex items-center gap-1 hover:underline"
							>
								{workflow.name}<Icon icon={ExternalLink} size={12} class="text-muted-foreground" />
							</a>
						{:else}{workflow.name}{/if}
					</td>
					<td class="px-3 py-2">
						<span class="flex items-center gap-1.5 {glyph.color}">
							<Icon icon={glyph.icon} size={14} />{state.label}
						</span>
					</td>
					<td class="px-3 py-2 text-right">{pct(workflow.passRate)}</td>
					<td class="px-3 py-2 text-right">{formatDuration(workflow.avgRuntimeSec)}</td>
					<td class="text-muted-foreground py-2 pl-3 text-right">
						{#if workflow.latest?.createdAt}
							<Hint text={formatDateTime(workflow.latest.createdAt)}>
								{relativeTime(workflow.latest.createdAt)}
							</Hint>
						{:else}-{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
