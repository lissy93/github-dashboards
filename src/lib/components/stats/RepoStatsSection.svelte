<script lang="ts">
	import { Code, Trophy } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import Donut from '$lib/components/charts/Donut.svelte';
	import HBarList from '$lib/components/charts/HBarList.svelte';
	import { languageBreakdown, topRepos } from '$lib/views/stats';
	import type { LanguagesResult } from '$lib/views/overview';
	import type { Repo } from '$lib/types';

	let {
		repos,
		languages
	}: { repos: Repo[]; languages: Promise<LanguagesResult> | LanguagesResult } = $props();

	const leaders = $derived(topRepos(repos));
</script>

<div class="grid gap-5 lg:grid-cols-2">
	{#await languages}
		<Panel title="Top languages" icon={Code} loading />
	{:then result}
		{#if result.ok}
			<Panel title="Top languages" icon={Code} empty={!result.data.length}>
				<Donut data={languageBreakdown(result.data)} valueLabel="Bytes" />
			</Panel>
		{:else}
			<Panel title="Top languages" icon={Code} error={result.error} />
		{/if}
	{/await}

	<Panel title="Most starred" icon={Trophy} empty={!leaders.length}>
		<HBarList data={leaders} color="var(--chart-4)" valueLabel="Stars" />
	</Panel>
</div>
