<script lang="ts">
	import ExtLink from '$lib/components/common/ExtLink.svelte';
	import SeverityBadge from '$lib/components/common/SeverityBadge.svelte';
	import { formatDate } from '$lib/utils/format';
	import type { SecurityAdvisory } from '$lib/types';

	let { advisories }: { advisories: SecurityAdvisory[] } = $props();
</script>

<ul class="divide-y">
	{#each advisories as advisory (advisory.id)}
		<li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
			<SeverityBadge severity={advisory.severity} />
			<p class="min-w-0 grow truncate text-sm font-medium">{advisory.summary}</p>
			<div class="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
				{#if advisory.publishedAt}<p>{formatDate(advisory.publishedAt)}</p>{/if}
				<ExtLink href={advisory.url}>{advisory.id}</ExtLink>
			</div>
		</li>
	{/each}
</ul>
