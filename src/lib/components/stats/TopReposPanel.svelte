<script lang="ts">
	import { onMount } from 'svelte';
	import { Trophy } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import HBarList from '$lib/components/charts/HBarList.svelte';
	import * as Select from '$lib/components/ui/select';
	import { loadOwnedMap } from '$lib/owned-maps';
	import { topRepos, REPO_METRICS } from '$lib/views/stats';
	import type { Repo, RepoStats } from '$lib/types';

	let { user, repos }: { user: string; repos: Repo[] } = $props();

	let metricKey = $state(REPO_METRICS[0].key);
	let stats = $state<Record<string, RepoStats>>();
	let contributors = $state<Record<string, number>>();

	const metric = $derived(
		REPO_METRICS.find((option) => option.key === metricKey) ?? REPO_METRICS[0]
	);
	// Lazy metrics stay disabled until both maps land, so they never rank on partial data
	const loaded = $derived(stats !== undefined && contributors !== undefined);
	const leaders = $derived(topRepos(repos, metric, { stats, contributors }));

	onMount(() => {
		loadOwnedMap<Record<string, RepoStats>>(user, 'repo-stats').then((map) => (stats = map ?? {}));
		loadOwnedMap<Record<string, number>>(user, 'contributors').then(
			(map) => (contributors = map ?? {})
		);
	});
</script>

<Panel title="Top Repos" icon={Trophy}>
	<div class="mb-3 flex items-center justify-between gap-2">
		<p class="text-muted-foreground text-xs">{metric.label}</p>
		<Select.Root type="single" bind:value={metricKey}>
			<Select.Trigger class="h-8 w-auto text-xs">{metric.short}</Select.Trigger>
			<Select.Content>
				{#each REPO_METRICS as option (option.key)}
					<Select.Item value={option.key} disabled={option.lazy && !loaded}>
						{option.short}{option.lazy && !loaded ? ' (loading)' : ''}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
	{#if leaders.length}
		<HBarList
			data={leaders}
			color="var(--chart-4)"
			valueLabel={metric.short}
			format={metric.format}
		/>
	{:else}
		<p class="text-muted-foreground text-sm">Nothing here yet</p>
	{/if}
</Panel>
