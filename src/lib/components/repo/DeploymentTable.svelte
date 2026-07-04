<script lang="ts">
	import { GitCommitHorizontal } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import ExtLink from '$lib/components/common/ExtLink.svelte';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';
	import LoadMore from '$lib/components/common/LoadMore.svelte';
	import { STATUS_GLYPH } from '$lib/components/repo/status-glyph';
	import { deployState } from '$lib/views/repo-deployments';
	import type { DeployRecord } from '$lib/types';

	const STEP = 10;

	// repoUrl is the repo's GitHub page, used to link a deploy back to its commit
	let { deployments, repoUrl }: { deployments: DeployRecord[]; repoUrl: string } = $props();

	let shown = $state(STEP);
	const rows = $derived(
		deployments.slice(0, shown).map((record) => ({ record, status: deployState(record.state) }))
	);
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm">
		<thead class="text-muted-foreground text-xs">
			<tr class="border-b">
				<th class="px-2 py-2 text-left font-medium first:pl-0">Environment</th>
				<th class="px-2 py-2 text-left font-medium">Status</th>
				<th class="px-2 py-2 text-left font-medium max-sm:hidden">Ref</th>
				<th class="px-2 py-2 text-left font-medium max-md:hidden">Commit</th>
				<th class="px-2 py-2 text-left font-medium max-lg:hidden">By</th>
				<th class="px-2 py-2 text-right font-medium last:pr-0">Deployed</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as { record, status }, index (index)}
				{@const glyph = STATUS_GLYPH[status.token]}
				<tr class="border-b last:border-0">
					<td class="max-w-[9rem] px-2 py-2 font-medium first:pl-0 sm:max-w-[12rem]">
						<div class="truncate">
							{#if record.url}
								<ExtLink href={record.url}>{record.environment}</ExtLink>
							{:else}{record.environment}{/if}
						</div>
					</td>
					<td class="px-2 py-2 whitespace-nowrap">
						<Hint
							text={record.description || `Deployment status: ${status.label}`}
							class="{glyph.color} flex items-center gap-1.5"
						>
							<Icon icon={glyph.icon} size={14} />
							{#if record.logUrl}
								<a
									href={record.logUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="max-sm:hidden hover:underline">{status.label}</a
								>
							{:else}
								<span class="max-sm:hidden">{status.label}</span>
							{/if}
						</Hint>
					</td>
					<td class="text-muted-foreground max-w-[10rem] px-2 py-2 max-sm:hidden">
						<div class="truncate">{record.ref ?? '-'}</div>
					</td>
					<td class="px-2 py-2 whitespace-nowrap max-md:hidden">
						<a
							href="{repoUrl}/commit/{record.commitOid}"
							target="_blank"
							rel="noopener noreferrer"
							class="text-muted-foreground inline-flex items-center gap-1 font-mono text-xs hover:underline"
						>
							<Icon icon={GitCommitHorizontal} size={13} />{record.commitOid.slice(0, 7)}
						</a>
					</td>
					<td class="text-muted-foreground px-2 py-2 whitespace-nowrap max-lg:hidden">
						{record.creator ?? '-'}
					</td>
					<td class="text-muted-foreground px-2 py-2 text-right whitespace-nowrap last:pr-0">
						<TimeAgo date={record.createdAt} />
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<LoadMore total={deployments.length} step={STEP} bind:shown resetKey={deployments} />
