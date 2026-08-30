<script lang="ts">
	import { Building2 } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import BubbleCloud from '$lib/components/charts/BubbleCloud.svelte';
	import { contributionOwners, type OwnerContribution } from '$lib/views/contributions';
	import { githubAvatar, paths } from '$lib/config';
	import { formatNumber } from '$lib/utils/format';
	import type { AuthoredContributions, Bubble, LoadResult, StatusCause } from '$lib/types';

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

	// The user's own repos are covered by the rest of the page, so this panel shows only the
	// outward reach: the orgs and people they contribute to elsewhere
	const EXTERNAL_ONLY = true;
	// Landed work only, an opened PR nobody merged is not reach
	const MERGED_ONLY = true;
	// Keep the cloud legible, the tail of one-off owners adds little
	const MAX_OWNERS = 50;

	const owners = (data: AuthoredContributions) =>
		contributionOwners(data, EXTERNAL_ONLY, MERGED_ONLY);
	const noOwners = (data: AuthoredContributions) => !owners(data).length;

	// One avatar bubble per owner, sized by merged pull requests with the rest in the tooltip
	function toBubbles(list: OwnerContribution[]): Bubble[] {
		return list.map((owner) => ({
			label: owner.owner,
			value: owner.mergedPrs,
			image: githubAvatar(owner.owner, 120),
			initials: owner.owner.slice(0, 2).toUpperCase(),
			note: owner.repos > 1 ? `${formatNumber(owner.repos)} repositories` : undefined,
			rows: [
				{ label: 'Merged PRs', value: formatNumber(owner.mergedPrs) },
				{ label: 'PRs opened', value: formatNumber(owner.prs) },
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
	href={paths.userContributions(user)}
	{result}
	{cause}
	{detail}
	loading={(data) => noOwners(data) && cause?.(data) === 'loading'}
	empty={(data) => noOwners(data) && cause?.(data) !== 'loading'}
	emptyText={(data) =>
		data.complete ? 'No merged PRs in other repos yet' : 'No contributions loaded yet'}
	emptyHint={(data) => detail?.(data)}
	emptyCause={(data) => cause?.(data) ?? 'empty'}
>
	{#snippet children(data)}
		{@const all = owners(data)}
		<BubbleCloud data={toBubbles(all.slice(0, MAX_OWNERS))} height={22} />
		{#if all.length > MAX_OWNERS}
			<p class="text-muted-foreground mt-2 text-center text-xs">
				Top {MAX_OWNERS} of {formatNumber(all.length)} orgs by merged pull requests
			</p>
		{/if}
	{/snippet}
</AsyncPanel>
