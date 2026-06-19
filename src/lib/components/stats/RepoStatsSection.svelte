<script lang="ts">
	import { Code } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import Donut from '$lib/components/charts/Donut.svelte';
	import TopReposPanel from './TopReposPanel.svelte';
	import { languageBreakdown } from '$lib/views/stats';
	import type { LanguagesResult } from '$lib/views/overview';
	import type { Repo } from '$lib/types';

	let {
		user,
		repos,
		languages
	}: {
		user: string;
		repos: Repo[];
		languages: Promise<LanguagesResult> | LanguagesResult;
	} = $props();
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

	<TopReposPanel {user} {repos} />
</div>
