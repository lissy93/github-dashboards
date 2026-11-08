<script lang="ts">
	import { GitCommitHorizontal, ShieldCheck } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import ExtLink from '$lib/components/common/ExtLink.svelte';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';
	import { STATUS_GLYPH } from '$lib/components/repo/status-glyph';
	import { deployState } from '$lib/views/repo-deployments';
	import { compactNumber } from '$lib/utils/format';
	import type { EnvironmentSummary } from '$lib/types';

	// repoUrl is the repo's GitHub page, used to link an environment's current commit
	let { environments, repoUrl }: { environments: EnvironmentSummary[]; repoUrl: string } = $props();

	// Only environments that have actually been deployed to, busiest first
	const deployed = $derived(environments.filter((env) => env.count > 0));
</script>

<div class="grid gap-3 sm:grid-cols-2">
	{#each deployed as env (env.name)}
		{@const head = env.live ?? env.last}
		{@const status = head ? deployState(head.state) : null}
		{@const glyph = status ? STATUS_GLYPH[status.token] : null}
		<div class="space-y-2 rounded-lg border bg-card/40 p-3">
			<div class="flex items-center justify-between gap-2">
				<span class="flex items-center gap-1.5 truncate font-medium">
					{#if status && glyph}
						<Hint
							text="{env.live ? 'Live' : 'Latest'} deployment is {status.label.toLowerCase()}"
							class={glyph.color}
						>
							<Icon icon={glyph.icon} size={15} />
						</Hint>
					{/if}
					<span class="truncate">{env.name}</span>
					{#if env.protected}
						<Hint text="Protected by deployment rules" class="shrink-0 text-muted-foreground">
							<Icon icon={ShieldCheck} size={13} />
						</Hint>
					{/if}
				</span>
				<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
					{compactNumber(env.count)}
					{env.count === 1 ? 'deploy' : 'deploys'}
				</span>
			</div>
			{#if head}
				<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
					<a
						href={`${repoUrl}/commit/${head.commitOid}`}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 font-mono hover:underline"
					>
						<Icon icon={GitCommitHorizontal} size={13} />{head.commitOid.slice(0, 7)}
					</a>
					{#if head.ref}<span class="truncate">{head.ref}</span>{/if}
					<TimeAgo date={head.createdAt} />
					{#if head.url}
						<ExtLink href={head.url} class="ml-auto">Visit</ExtLink>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>
