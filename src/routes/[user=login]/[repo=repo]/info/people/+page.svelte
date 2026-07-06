<script lang="ts">
	import { Users } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import ContributorTable from '$lib/components/repo/ContributorTable.svelte';
	import AudiencePanels from '$lib/components/repo/AudiencePanels.svelte';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PageMeta
	title={`People · ${data.repo.nameWithOwner}`}
	description={`Contributors, stargazers and forks for ${data.repo.nameWithOwner}`}
/>

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
			detail={(people) =>
				people.sampled ? 'GitHub stats only cover the top 100 contributors' : undefined}
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
			<AudiencePanels people={result.data} loggedIn={!!data.viewerLogin} />
		{:else}
			<div class="grid gap-5">
				<Panel title="Stargazers" error={result.error} />
				<Panel title="Forks" error={result.error} />
				<Panel title="Watchers" error={result.error} />
			</div>
		{/if}
	{/await}
</div>
