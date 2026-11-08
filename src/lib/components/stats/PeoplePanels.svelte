<script lang="ts">
	import { Users, Star, Heart, Building2 } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import SegmentedControl from '$lib/components/common/SegmentedControl.svelte';
	import PeopleList from './PeopleList.svelte';
	import { lazyEndpoint } from '$lib/state/lazy.svelte';
	import { restrictedGate } from '$lib/config/status';
	import { compactNumber, formatNumber, relativeTime } from '$lib/utils/format';
	import type { OverviewResult } from '$lib/views/overview';
	import type { RecentStar, UserSocial } from '$lib/types';

	let {
		user,
		result,
		loggedIn
	}: { user: string; result: Promise<OverviewResult> | OverviewResult; loggedIn: boolean } =
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

	// GitHub only shows stargazer lists to repo admins, so explain rather than look broken
	const starGate = $derived(
		stars.error?.code === 'forbidden' ? restrictedGate('recent stargazers', loggedIn) : null
	);

	// Sponsors kept private or behind the read:org scope still count toward the total
	const sponsors = $derived(data?.sponsors.slice(0, SHOWN) ?? []);
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
		error={starGate ? undefined : stars.error}
		empty={!!starGate || (stars.loaded && !stars.error && !starRows.length)}
		emptyText={starGate?.text ?? 'No recent stars'}
		emptyHint={starGate?.hint}
		cause={starGate?.cause}
	>
		{#if starRows.length}
			<PeopleList people={starRows} />
		{/if}
	</Panel>

	<div class="grid gap-5">
		<AsyncPanel
			title="Organizations"
			icon={Building2}
			{result}
			empty={(overview) => !overview.profile.organizations.length}
			emptyText="No public organizations"
			emptyHint="GitHub only lists memberships set to public"
		>
			{#snippet children(overview)}
				<PeopleList people={overview.profile.organizations.slice(0, SHOWN)} />
			{/snippet}
		</AsyncPanel>

		<Panel
			title="Sponsors"
			icon={Heart}
			loading={!social.loaded}
			error={social.error}
			empty={social.loaded && !social.error && !sponsors.length}
			emptyText="No sponsors yet"
		>
			{#snippet actions()}
				{#if data?.sponsorsTotal}
					<span class="text-xs text-muted-foreground tabular-nums">
						{formatNumber(data.sponsorsTotal)}{data.sponsorsTotal > sponsors.length ? '+' : ''}
					</span>
				{/if}
			{/snippet}
			{#if sponsors.length}
				<PeopleList people={sponsors} />
			{/if}
		</Panel>
	</div>
</div>
