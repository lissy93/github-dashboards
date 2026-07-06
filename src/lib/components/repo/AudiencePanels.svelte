<script lang="ts">
	import { Star, GitFork, Eye } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import PeopleList from '$lib/components/stats/PeopleList.svelte';
	import { compactNumber, relativeTime } from '$lib/utils/format';
	import { restrictedGate } from '$lib/config/status';
	import type { AudienceSection, RepoPeople } from '$lib/types';

	let { people, loggedIn }: { people: RepoPeople; loggedIn: boolean } = $props();

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
</script>

<div class="grid gap-5">
	{#each SECTIONS as { key, title, icon, verb, noun } (key)}
		{@const section = people[key]}
		{@const list = rows(section, verb)}
		{@const gate = section.unavailable === 'restricted' ? restrictedGate(noun, loggedIn) : null}
		<Panel
			{title}
			{icon}
			empty={gate !== null || list.length === 0}
			emptyText={gate ? gate.text : `No ${noun} yet`}
			emptyHint={gate?.hint}
			cause={gate?.cause}
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
