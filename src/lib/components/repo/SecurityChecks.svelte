<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { GRADE_COLOR } from '$lib/views/security';
	import type { RepoSecurity, CheckStatus } from '$lib/types';

	let { security, detailed = false }: { security: RepoSecurity; detailed?: boolean } = $props();

	const STATUS: Record<CheckStatus, { color: string; label: string }> = {
		pass: { color: 'text-success', label: 'pass' },
		warn: { color: 'text-warning', label: 'warn' },
		fail: { color: 'text-danger', label: 'fail' },
		na: { color: 'text-muted-foreground', label: 'n/a' }
	};
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
					<Hint
						text={check.hint}
						class="text-muted-foreground self-start pl-4 text-xs {check.hint ? 'cursor-help' : ''}"
					>
						{check.detail}
					</Hint>
				{/if}
			</li>
		{/each}
	</ul>

	<div class="text-muted-foreground flex items-center justify-between gap-3 text-xs">
		<span class="tabular-nums">{security.passed}/{security.applicable} checks passed</span>
		<span>
			Grade
			<span class="font-medium {GRADE_COLOR[security.grade.letter]}">
				{security.grade.letter}
			</span>
		</span>
	</div>
</div>
