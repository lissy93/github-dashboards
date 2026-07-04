<script lang="ts">
	import { Users, Star, Heart, Building2 } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import SegmentedControl from '$lib/components/common/SegmentedControl.svelte';
	import PeopleList from './PeopleList.svelte';
	import { lazyEndpoint } from '$lib/state/lazy.svelte';
	import { compactNumber, formatNumber, relativeTime } from '$lib/utils/format';
	import type { OverviewResult } from '$lib/views/overview';
	import type { RecentStar, UserSocial } from '$lib/types';

	let { user, result }: { user: string; result: Promise<OverviewResult> | OverviewResult } =
		$props();

	// Organizations and sponsors stack in one column, so keep each short
	const SHOWN = 6;
	const SORTS = [
		{ key: 'newest', label: 'Newest' },
		{ key: 'top', label: 'Top' }
	] as const;

	const social = lazyEndpoint<UserSocial>(() => user, 'social');
	const stars = lazyEndpoint<RecentStar[]>(() => user, 'stargazers');
	const data = $derived(social.data);

	let sort = $state<(typeof SORTS)[number]['key']>('newest');
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
		loading={!social.loaded}
		error={social.error}
		empty={social.loaded && !social.error && !followerRows.length}
		emptyText="No followers yet"
	>
		{#snippet actions()}
			{#if hasFollowers}
				<SegmentedControl
					label="Follower sort"
					size="sm"
					options={SORTS.map(({ key, label }) => ({ value: key, label }))}
					bind:value={sort}
				/>
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
		error={stars.error}
		empty={stars.loaded && !stars.error && !starRows.length}
		emptyText="No recent stars"
	>
		{#if starRows.length}
			<PeopleList people={starRows} />
		{/if}
	</Panel>

	{#await result then res}
		{@const organizations = res.ok ? res.data.profile.organizations : []}
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
	{/await}
</div>
