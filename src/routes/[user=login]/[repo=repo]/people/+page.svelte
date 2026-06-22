<script lang="ts">
	import { Users } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import ContributorTable from '$lib/components/repo/ContributorTable.svelte';
	import AudiencePanels from '$lib/components/repo/AudiencePanels.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>People · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<div class="grid items-start gap-5 lg:grid-cols-3">
	<div class="lg:col-span-2">
		<AsyncPanel
			title="Contributors"
			icon={Users}
			result={data.people}
			count={(people) => people.total}
			capped={(people) => people.sampled}
			empty={(people) => people.contributors.length === 0}
			emptyText="No contributors yet"
		>
			{#snippet children(people)}
				<ContributorTable contributors={people.contributors} />
			{/snippet}
		</AsyncPanel>
	</div>

	{#await data.audience}
		<div class="grid gap-5">
			<Panel title="Stargazers" loading />
			<Panel title="Forks" loading />
			<Panel title="Watchers" loading />
		</div>
	{:then result}
		{#if result.ok}
			<AudiencePanels people={result.data} />
		{:else}
			<div class="grid gap-5">
				<Panel title="Stargazers" error={result.error} />
			</div>
		{/if}
	{/await}
</div>
