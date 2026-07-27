<script lang="ts">
	import { Building2 } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import BubbleCloud from '$lib/components/charts/BubbleCloud.svelte';
	import SelectFilter from '$lib/components/filter/SelectFilter.svelte';
	import { contributionOwners, type OwnerContribution } from '$lib/views/contributions';
	import { githubAvatar } from '$lib/config';
	import { formatNumber } from '$lib/utils/format';
	import type { AuthoredContributions, Bubble, LoadResult, StatusCause } from '$lib/types';

	let {
		result,
		cause,
		detail
	}: {
		result: Promise<LoadResult<AuthoredContributions>> | LoadResult<AuthoredContributions>;
		cause?: (data: AuthoredContributions) => StatusCause | undefined;
		detail?: (data: AuthoredContributions) => string | undefined;
	} = $props();

	// The user's own repos are covered by the rest of the page, so this panel shows only the
	// outward reach: the orgs and people they contribute to elsewhere
	const EXTERNAL_ONLY = true;
	// Keep the cloud legible, the tail of one-off owners adds little
	const MAX_OWNERS = 50;

	// Year filter, empty string means all years. Drop a stale pick if the data no longer has it
	let year = $state('');
	const settled = $derived(result instanceof Promise ? null : result);
	$effect(() => {
		if (year && settled?.ok && !settled.data.years.some((group) => String(group.year) === year))
			year = '';
	});
	const yearNum = $derived(year ? Number(year) : null);
	const yearOptions = (data: AuthoredContributions) =>
		data.years.map((group) => ({ value: String(group.year), label: String(group.year) }));

	const owners = (data: AuthoredContributions) => contributionOwners(data, EXTERNAL_ONLY, yearNum);
	const noOwners = (data: AuthoredContributions) => !owners(data).length;

	// One avatar bubble per owner, sized by pull requests with the rest in the tooltip
	function toBubbles(list: OwnerContribution[]): Bubble[] {
		return list.map((owner) => ({
			label: owner.owner,
			value: owner.prs,
			image: githubAvatar(owner.owner, 120),
			initials: owner.owner.slice(0, 2).toUpperCase(),
			note: owner.repos > 1 ? `${formatNumber(owner.repos)} repositories` : undefined,
			rows: [
				{ label: 'Pull requests', value: formatNumber(owner.prs) },
				{ label: 'Merged', value: formatNumber(owner.mergedPrs) },
				{ label: 'Issues', value: formatNumber(owner.issues) },
				{ label: 'Additions', value: `+${formatNumber(owner.additions)}`, color: 'var(--chart-2)' },
				{ label: 'Deletions', value: `−${formatNumber(owner.deletions)}`, color: 'var(--danger)' }
			]
		}));
	}
</script>

<AsyncPanel
	title="Contribution reach"
	icon={Building2}
	{result}
	{cause}
	{detail}
	loading={(data) => noOwners(data) && cause?.(data) === 'loading'}
	empty={(data) => noOwners(data) && cause?.(data) !== 'loading'}
	emptyText={(data) =>
		data.complete ? 'No external contributions yet' : 'No contributions loaded yet'}
	emptyHint={(data) => detail?.(data)}
	emptyCause={(data) => cause?.(data) ?? 'empty'}
>
	{#snippet actions(data)}
		{#if yearOptions(data).length > 1}
			<SelectFilter
				options={yearOptions(data)}
				bind:value={year}
				allLabel="All years"
				class="h-8 w-auto text-xs"
			/>
		{/if}
	{/snippet}
	{#snippet children(data)}
		{@const all = owners(data)}
		<BubbleCloud data={toBubbles(all.slice(0, MAX_OWNERS))} height={22} />
		{#if all.length > MAX_OWNERS}
			<p class="text-muted-foreground mt-2 text-center text-xs">
				Top {MAX_OWNERS} of {formatNumber(all.length)} orgs by pull requests
			</p>
		{/if}
	{/snippet}
</AsyncPanel>
