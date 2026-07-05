<script lang="ts">
	import { Star, GitFork, Eye } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import PeopleList from '$lib/components/stats/PeopleList.svelte';
	import { compactNumber, relativeTime } from '$lib/utils/format';
	import type { AudienceSection, RepoPeople, StatusCause } from '$lib/types';

	let { people }: { people: RepoPeople } = $props();

	const SECTIONS = [
		{ key: 'stargazers', title: 'Stargazers', icon: Star, verb: 'Starred', noun: 'stars' },
		{ key: 'forks', title: 'Forks', icon: GitFork, verb: 'Forked', noun: 'forks' },
		{ key: 'watchers', title: 'Watchers', icon: Eye, verb: 'Watching', noun: 'watchers' }
	] as const;

	// Turn the timestamp into a hover tip at render time, so it stays relative to now
	function rows(section: AudienceSection, verb: string) {
		return section.people.map((person) => ({
			login: person.login,
			avatarUrl: person.avatarUrl,
			tip: person.at ? `${verb} ${relativeTime(person.at)}` : undefined
		}));
	}

	// A restricted list is a real access gap, a capped one is GitHub's paging limit
	const cause = (section: AudienceSection): StatusCause | undefined =>
		section.unavailable === 'restricted'
			? 'forbidden'
			: section.unavailable
				? 'partial'
				: undefined;

	function emptyText(section: AudienceSection, title: string, noun: string): string {
		if (section.unavailable === 'restricted') return `${title} not accessible`;
		if (section.unavailable === 'capped') return `Recent ${noun} unavailable`;
		return `No ${noun} yet`;
	}
</script>

<div class="grid gap-5">
	{#each SECTIONS as { key, title, icon, verb, noun } (key)}
		{@const section = people[key]}
		{@const list = rows(section, verb)}
		<Panel
			{title}
			{icon}
			empty={list.length === 0}
			cause={cause(section)}
			emptyText={emptyText(section, title, noun)}
			emptyHint={section.unavailable === 'restricted'
				? 'The current GitHub token cannot list them'
				: section.unavailable === 'capped'
					? 'GitHub only pages through the first 40k stargazers'
					: undefined}
		>
			{#snippet actions()}
				<span class="text-muted-foreground text-xs tabular-nums">
					{compactNumber(section.total)}
				</span>
			{/snippet}
			<PeopleList people={list} />
		</Panel>
	{/each}
</div>
