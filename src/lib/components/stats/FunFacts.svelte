<script lang="ts">
	import {
		Sparkles,
		Flame,
		Trophy,
		CalendarDays,
		Clock,
		Code,
		History,
		Zap,
		Percent
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StatTile from '$lib/components/common/StatTile.svelte';
	import { funFacts } from '$lib/views/stats';
	import type { ContributionsResult, LanguagesResult, RhythmResult } from '$lib/views/overview';

	let {
		contributions,
		rhythm,
		languages
	}: {
		contributions: ContributionsResult;
		rhythm: RhythmResult;
		languages: LanguagesResult;
	} = $props();

	// Icon per fact, keyed by its label so the pure helper stays UI-free
	const ICONS: Record<string, Component> = {
		'Active days': Percent,
		'Current streak': Flame,
		'Longest streak': Trophy,
		'Busiest day': CalendarDays,
		'Peak hour': Clock,
		'Top language': Code,
		'Best year': History,
		'Biggest day': Zap
	};

	const facts = $derived(
		contributions.ok && contributions.data.total > 0
			? funFacts(
					contributions.data,
					rhythm.ok ? rhythm.data : null,
					languages.ok ? languages.data : []
				)
			: []
	);
</script>

<Panel title="Fun facts" icon={Sparkles} empty={!facts.length} emptyText="No fun facts yet">
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
		{#each facts as fact (fact.label)}
			<StatTile label={fact.label} value={fact.value} hint={fact.hint} icon={ICONS[fact.label]} />
		{/each}
	</div>
</Panel>
