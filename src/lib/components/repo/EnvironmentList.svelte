<script lang="ts">
	import { ExternalLink, GitCommitHorizontal, ShieldCheck } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { STATUS_GLYPH } from '$lib/components/repo/status-glyph';
	import { deployState } from '$lib/views/repo-deployments';
	import { compactNumber, relativeTime, formatDateTime } from '$lib/format';
	import type { EnvironmentSummary } from '$lib/server/github/deployments';

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
		<div class="bg-card/40 space-y-2 rounded-lg border p-3">
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
						<Hint text="Protected by deployment rules" class="text-muted-foreground shrink-0">
							<Icon icon={ShieldCheck} size={13} />
						</Hint>
					{/if}
				</span>
				<span class="text-muted-foreground shrink-0 text-xs tabular-nums">
					{compactNumber(env.count)}
					{env.count === 1 ? 'deploy' : 'deploys'}
				</span>
			</div>
			{#if head}
				<div class="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
					<a
						href={`${repoUrl}/commit/${head.commitOid}`}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 font-mono hover:underline"
					>
						<Icon icon={GitCommitHorizontal} size={13} />{head.commitOid.slice(0, 7)}
					</a>
					{#if head.ref}<span class="truncate">{head.ref}</span>{/if}
					<Hint text={formatDateTime(head.createdAt)}>{relativeTime(head.createdAt)}</Hint>
					{#if head.url}
						<a
							href={head.url}
							target="_blank"
							rel="noopener noreferrer"
							class="ml-auto inline-flex items-center gap-1 hover:underline"
						>
							Visit<Icon icon={ExternalLink} size={12} />
						</a>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>
