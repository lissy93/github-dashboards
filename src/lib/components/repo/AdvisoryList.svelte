<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import SeverityBadge from '$lib/components/common/SeverityBadge.svelte';
	import { formatDate } from '$lib/format';
	import type { SecurityAdvisory } from '$lib/server/github/security';

	let { advisories }: { advisories: SecurityAdvisory[] } = $props();
</script>

<ul class="divide-y">
	{#each advisories as advisory (advisory.id)}
		<li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
			<SeverityBadge severity={advisory.severity} />
			<p class="min-w-0 grow truncate text-sm font-medium">{advisory.summary}</p>
			<div class="text-muted-foreground shrink-0 text-right text-xs tabular-nums">
				{#if advisory.publishedAt}<p>{formatDate(advisory.publishedAt)}</p>{/if}
				<a
					href={advisory.url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 hover:underline"
				>
					{advisory.id}
					<Icon icon={ExternalLink} size={11} />
				</a>
			</div>
		</li>
	{/each}
</ul>
