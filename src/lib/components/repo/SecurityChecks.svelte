<script lang="ts">
	import { ShieldCheck, ExternalLink } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import type { RepoSecurity, CheckStatus } from '$lib/server/github/security';

	let {
		security,
		slug,
		detailed = false
	}: { security: RepoSecurity; slug: string; detailed?: boolean } = $props();

	const STATUS: Record<CheckStatus, { color: string; label: string }> = {
		pass: { color: 'text-success', label: 'pass' },
		warn: { color: 'text-warning', label: 'warn' },
		fail: { color: 'text-danger', label: 'fail' },
		na: { color: 'text-muted-foreground', label: 'n/a' }
	};

	// OpenSSF returns a single 0-10 score, colour it on the same scale as our checks
	function scoreColor(score: number): string {
		if (score >= 8) return 'text-success';
		if (score >= 5) return 'text-warning';
		return 'text-danger';
	}

	const scorecard = $derived(security.scorecard);
</script>

<div class="space-y-4">
	<ul class="divide-y text-sm">
		{#each security.checks as check (check.name)}
			<li class="flex flex-col gap-1 py-2">
				<div class="flex items-center gap-2">
					<span class="size-2 shrink-0 rounded-full bg-current {STATUS[check.status].color}"></span>
					<span class="min-w-0 grow truncate font-medium">{check.name}</span>
					{#if check.url}
						<a
							href={check.url}
							target="_blank"
							rel="noopener noreferrer"
							aria-label="{check.name} docs"
							class="text-muted-foreground hover:text-foreground"
						>
							<Icon icon={ExternalLink} size={13} />
						</a>
					{/if}
					<span class="w-12 shrink-0 text-right tabular-nums {STATUS[check.status].color}">
						{STATUS[check.status].label}
					</span>
				</div>
				{#if detailed}
					<p class="text-muted-foreground pl-4 text-xs">{check.detail}</p>
				{/if}
			</li>
		{/each}
	</ul>

	<div class="text-muted-foreground flex items-center justify-between gap-3 text-xs">
		<span class="tabular-nums">{security.passed}/{security.applicable} checks passed</span>
		{#if scorecard.available && scorecard.score !== null}
			<a
				href="https://scorecard.dev/viewer/?uri=github.com/{slug}"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-foreground inline-flex items-center gap-1"
			>
				<Icon icon={ShieldCheck} size={13} />
				OpenSSF
				<span class="tabular-nums {scoreColor(scorecard.score)}"
					>{scorecard.score.toFixed(1)}/10</span
				>
			</a>
		{:else}
			<span class="inline-flex items-center gap-1">
				<Icon icon={ShieldCheck} size={13} />
				OpenSSF not published
			</span>
		{/if}
	</div>
</div>
