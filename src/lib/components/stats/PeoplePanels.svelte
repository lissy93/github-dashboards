<script lang="ts">
	import { Users, Star, Heart, Building2 } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import PeopleList from './PeopleList.svelte';
	import { userSocial } from '$lib/social.svelte';
	import { latestStargazers } from '$lib/stargazers.svelte';
	import { compactNumber, formatNumber, relativeTime } from '$lib/format';
	import { cn } from '$lib/utils';
	import type { Org } from '$lib/types';

	let { user, organizations }: { user: string; organizations: Org[] } = $props();

	// Organizations and sponsors stack in one column, so keep each short
	const SHOWN = 6;
	const SORTS = ['newest', 'top'] as const;

	const social = userSocial(() => user);
	const stars = latestStargazers(() => user);
	const data = $derived(social.data);

	let sort = $state<(typeof SORTS)[number]>('newest');
	const followerRows = $derived(
		(data ? (sort === 'newest' ? data.newestFollowers : data.topFollowers) : []).map((person) => ({
			...person,
			tip: `${compactNumber(person.followers)} followers`
		}))
	);
	const hasFollowers = $derived(
		!!data && (data.newestFollowers.length || data.topFollowers.length)
	);

	const starRows = $derived(
		(stars.data ?? []).map((star) => ({
			login: star.login,
			avatarUrl: star.avatarUrl,
			tip: `Starred ${star.repo} · ${relativeTime(star.starredAt)}`
		}))
	);

	const showSponsors = $derived(!!data && data.sponsorsTotal > 0);
</script>

<div class="grid gap-5 lg:grid-cols-3 lg:items-start">
	<Panel
		title="Followers"
		icon={Users}
		loading={!data}
		empty={!!data && !followerRows.length}
		emptyText="No followers yet"
	>
		{#snippet actions()}
			{#if hasFollowers}
				<div class="bg-muted text-muted-foreground inline-flex rounded-md p-0.5 text-xs">
					{#each SORTS as option (option)}
						<button
							type="button"
							onclick={() => (sort = option)}
							class={cn(
								'rounded px-2 py-0.5 capitalize transition-colors',
								sort === option && 'bg-background text-foreground shadow-sm'
							)}
						>
							{option}
						</button>
					{/each}
				</div>
			{/if}
		{/snippet}
		{#if followerRows.length}
			<PeopleList people={followerRows} />
		{/if}
	</Panel>

	<Panel
		title="Latest stargazers"
		icon={Star}
		loading={!stars.loaded}
		empty={stars.loaded && !starRows.length}
		emptyText="No recent stars"
	>
		{#if starRows.length}
			<PeopleList people={starRows} />
		{/if}
	</Panel>

	{#if organizations.length || showSponsors}
		<div class="grid gap-5">
			{#if organizations.length}
				<Panel title="Organizations" icon={Building2}>
					<PeopleList people={organizations.slice(0, SHOWN)} />
				</Panel>
			{/if}

			{#if showSponsors && data}
				<Panel title="Sponsors" icon={Heart}>
					{#snippet actions()}
						<span class="text-muted-foreground text-xs tabular-nums">
							{formatNumber(data.sponsorsTotal)}{data.sponsorsTotal > data.sponsors.length
								? '+'
								: ''}
						</span>
					{/snippet}
					<PeopleList people={data.sponsors.slice(0, SHOWN)} />
				</Panel>
			{/if}
		</div>
	{/if}
</div>
