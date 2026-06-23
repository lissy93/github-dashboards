<script lang="ts">
	import { ShieldCheck, ExternalLink } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { formatDate } from '$lib/format';
	import type { RepoScorecard } from '$lib/server/scorecard';

	let { scorecard, detailed = false }: { scorecard: RepoScorecard; detailed?: boolean } = $props();

	// Score out of 10 maps to a pass, warn or fail colour, -1 means not applicable
	function token(score: number): 'success' | 'warning' | 'danger' | 'muted' {
		if (score < 0) return 'muted';
		if (score >= 8) return 'success';
		if (score >= 5) return 'warning';
		return 'danger';
	}
	const COLOR = {
		success: 'text-success',
		warning: 'text-warning',
		danger: 'text-danger',
		muted: 'text-muted-foreground'
	};

	const checks = $derived(
		[...scorecard.checks].sort((first, second) => first.score - second.score)
	);
</script>

{#if !scorecard.available}
	<EmptyState
		icon={ShieldCheck}
		text="No OpenSSF scorecard"
		hint="Public repos are scanned weekly by OpenSSF. This one has no published score yet"
	/>
{:else}
	<div class="space-y-4">
		<div class="flex items-center justify-between gap-3">
			<div class="flex items-baseline gap-2">
				<span class="text-3xl font-semibold tabular-nums {COLOR[token(scorecard.score ?? -1)]}">
					{scorecard.score?.toFixed(1) ?? '-'}
				</span>
				<span class="text-muted-foreground text-sm">/ 10 overall</span>
			</div>
			{#if scorecard.generatedAt}
				<span class="text-muted-foreground text-xs"
					>Scanned {formatDate(scorecard.generatedAt)}</span
				>
			{/if}
		</div>

		<ul class="divide-y text-sm">
			{#each checks as check (check.name)}
				<li class="flex flex-col gap-1 py-2">
					<div class="flex items-center gap-2">
						<span class="size-2 shrink-0 rounded-full bg-current {COLOR[token(check.score)]}"
						></span>
						<span class="min-w-0 grow truncate font-medium">{check.name}</span>
						{#if check.documentation}
							<a
								href={check.documentation.url}
								target="_blank"
								rel="noopener noreferrer"
								aria-label="{check.name} docs"
								class="text-muted-foreground hover:text-foreground"
							>
								<Icon icon={ExternalLink} size={13} />
							</a>
						{/if}
						<span class="w-12 shrink-0 text-right tabular-nums {COLOR[token(check.score)]}">
							{check.score < 0 ? 'n/a' : `${check.score}/10`}
						</span>
					</div>
					{#if check.reason}
						<p class="text-muted-foreground {detailed ? '' : 'line-clamp-2'} pl-4 text-xs">
							{check.reason}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}
