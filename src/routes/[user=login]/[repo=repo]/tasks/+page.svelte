<script lang="ts">
	import { CircleDot, GitPullRequest } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import ItemRow from '$lib/components/tasks/ItemRow.svelte';
	import type { TaskList } from '$lib/types';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Open issues & PRs · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

{#snippet list(title: string, icon: typeof CircleDot, value: TaskList, emptyText: string)}
	<Panel
		{title}
		{icon}
		count={value.total}
		capped={value.capped}
		empty={value.items.length === 0}
		{emptyText}
	>
		<ul class="-m-4 divide-y">
			{#each value.items as item (item.id)}
				<li><ItemRow {item} /></li>
			{/each}
		</ul>
	</Panel>
{/snippet}

{#await data.tasks}
	<div class="grid items-start gap-5 lg:grid-cols-2">
		<Panel title="Open issues" icon={CircleDot} loading />
		<Panel title="Open PRs" icon={GitPullRequest} loading />
	</div>
{:then result}
	{#if result.ok}
		<div class="grid items-start gap-5 lg:grid-cols-2">
			{@render list('Open issues', CircleDot, result.data.issues, 'No open issues')}
			{@render list('Open PRs', GitPullRequest, result.data.prs, 'No open pull requests')}
		</div>
	{:else}
		<ErrorState error={result.error} />
	{/if}
{/await}
