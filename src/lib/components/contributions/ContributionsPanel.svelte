<script lang="ts">
	import { untrack } from 'svelte';
	import { FolderGit2 } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import ContributionYearSection from './ContributionYearSection.svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { panelYears, hasEnoughExternal } from '$lib/views/contributions';
	import { paths } from '$lib/config';
	import type { AuthoredContributions, LoadResult, StatusCause } from '$lib/types';

	let {
		user,
		result,
		cause,
		detail
	}: {
		user: string;
		result: Promise<LoadResult<AuthoredContributions>> | LoadResult<AuthoredContributions>;
		cause?: (data: AuthoredContributions) => StatusCause | undefined;
		detail?: (data: AuthoredContributions) => string | undefined;
	} = $props();

	// Toggle between all repos and only those the user does not own. Seed the default from
	// the first paint's data so warm data renders external straight away with no flip
	let settled = $state(untrack(() => (result instanceof Promise ? null : result)));
	const seed = untrack(() => settled);

	// A streamed result lands in settled once it resolves, so the default still gets decided
	$effect(() => {
		const current = result;
		if (!(current instanceof Promise)) {
			settled = current;
			return;
		}
		let active = true;
		current.then((value) => {
			if (active) settled = value;
		});
		return () => (active = false);
	});
	const seedExternal = seed?.ok && seed.data.complete ? hasEnoughExternal(seed.data) : false;
	let externalOnly = $state(seedExternal);
	let decidedFor = $state<string | null>(
		untrack(() => (seed?.ok && seed.data.complete ? user : null))
	);

	// Once per profile, when the crawl completes, open on external by default unless the user
	// has very little external work. A later manual toggle or a profile change is respected
	$effect(() => {
		if (decidedFor === user || !settled?.ok || !settled.data.complete) return;
		externalOnly = hasEnoughExternal(settled.data);
		decidedFor = user;
	});

	// No year sections to show, e.g. a cold crawl not yet warmed or no external work.
	// The predicates below route every such case to the shared skeleton or empty state,
	// so the panel body is never left blank
	const noYears = (data: AuthoredContributions) => !panelYears(data, externalOnly).length;
</script>

<AsyncPanel
	title="Contributions"
	icon={FolderGit2}
	href={paths.userContributions(user)}
	{result}
	{cause}
	{detail}
	loading={(data) => noYears(data) && cause?.(data) === 'loading'}
	empty={(data) => noYears(data) && cause?.(data) !== 'loading'}
	emptyText={(data) =>
		data.complete
			? externalOnly
				? 'No merged PRs in other repos yet'
				: 'No merged PRs found'
			: 'No contributions loaded yet'}
	emptyHint={(data) => detail?.(data)}
	emptyCause={(data) => cause?.(data) ?? 'empty'}
>
	{#snippet actions()}
		<label class="flex items-center gap-1.5 text-sm">
			<Switch size="sm" bind:checked={externalOnly} />
			<span class="text-muted-foreground">External</span>
		</label>
	{/snippet}
	{#snippet children(data)}
		<div class="flex flex-col gap-3">
			{#each panelYears(data, externalOnly) as year (year.year)}
				<ContributionYearSection {year} />
			{/each}
		</div>
	{/snippet}
</AsyncPanel>
