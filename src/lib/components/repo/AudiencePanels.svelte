<script lang="ts">
	import { Star, GitFork, Eye } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import PeopleList from '$lib/components/stats/PeopleList.svelte';
	import { compactNumber, relativeTime } from '$lib/format';
	import type { PersonRow, RepoPeople } from '$lib/server/github/repo-people';

	let { people }: { people: RepoPeople } = $props();

	// Turn the timestamp into a hover tip at render time, so it stays relative to now
	function rows(list: PersonRow[], verb: string) {
		return list.map((person) => ({
			login: person.login,
			avatarUrl: person.avatarUrl,
			tip: person.at ? `${verb} ${relativeTime(person.at)}` : undefined
		}));
	}

	const stargazers = $derived(rows(people.stargazers, 'Starred'));
	const forks = $derived(rows(people.forks, 'Forked'));
	const watchers = $derived(rows(people.watchers, 'Watching'));
</script>

<div class="grid gap-5">
	<Panel title="Stargazers" icon={Star} empty={stargazers.length === 0} emptyText="No stars yet">
		{#snippet actions()}
			<span class="text-muted-foreground text-xs tabular-nums">
				{compactNumber(people.stargazersTotal)}
			</span>
		{/snippet}
		<PeopleList people={stargazers} />
	</Panel>
	<Panel title="Forks" icon={GitFork} empty={forks.length === 0} emptyText="No forks yet">
		{#snippet actions()}
			<span class="text-muted-foreground text-xs tabular-nums">
				{compactNumber(people.forksTotal)}
			</span>
		{/snippet}
		<PeopleList people={forks} />
	</Panel>
	<Panel title="Watchers" icon={Eye} empty={watchers.length === 0} emptyText="No watchers yet">
		{#snippet actions()}
			<span class="text-muted-foreground text-xs tabular-nums">
				{compactNumber(people.watchersTotal)}
			</span>
		{/snippet}
		<PeopleList people={watchers} />
	</Panel>
</div>
