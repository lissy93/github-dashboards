<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import SortFilterBar from '$lib/components/filter/SortFilterBar.svelte';
	import { contributionRows, contributionsConfig } from '$lib/views/contributions';
	import type { View } from '$lib/utils/sort-filter';
	import type { AuthoredContributions, LoadResult } from '$lib/types';

	type Result = LoadResult<AuthoredContributions>;
	let { result, view = $bindable() }: { result: Promise<Result> | Result; view: View } = $props();
</script>

{#await result}
	<Card.Root class="p-3"><Skeleton class="h-9 w-full" /></Card.Root>
{:then res}
	{#if res.ok}
		<Card.Root class="p-3">
			<SortFilterBar
				config={contributionsConfig(contributionRows(res.data))}
				bind:view
				searchPlaceholder="Search repos"
			/>
		</Card.Root>
	{/if}
{/await}
