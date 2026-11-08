<script lang="ts">
	import { untrack } from 'svelte';
	import { Download, ChevronDown, ChevronUp } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$lib/components/common/Icon.svelte';
	import SortFilterBar from '$lib/components/filter/SortFilterBar.svelte';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { applyView, defaultView, type View } from '$lib/utils/sort-filter';
	import {
		supplyChainConfig,
		toCsv,
		RISK_COLOR,
		RISK_LABEL,
		SEVERITY_COLOR
	} from '$lib/views/supply-chain';
	import { compactNumber } from '$lib/utils/format';
	import { cn } from '$lib/utils';
	import type { Dependency } from '$lib/types';

	let { packages, repo }: { packages: Dependency[]; repo: string } = $props();

	const PAGE_SIZE = 30;
	const config = $derived(supplyChainConfig(packages));

	let view = $state<View>(untrack(() => defaultView(config)));
	let page = $state(1);
	const visible = $derived(applyView(packages, config, view));
	const totalPages = $derived(Math.max(1, Math.ceil(visible.length / PAGE_SIZE)));
	const shown = $derived(visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
	const viewKey = $derived(
		`${view.search}|${view.sortKey}|${view.dir}|${JSON.stringify(view.filters)}`
	);

	// Back to the first page whenever the sort, filter or search changes
	$effect(() => {
		if (viewKey) page = 1;
	});

	function sortBy(key: string, numeric: boolean) {
		if (view.sortKey === key) view.dir = view.dir === 'asc' ? 'desc' : 'asc';
		else view = { ...view, sortKey: key, dir: numeric ? 'desc' : 'asc' };
	}
	const ariaSort = (key: string) =>
		view.sortKey !== key ? 'none' : view.dir === 'asc' ? 'ascending' : 'descending';

	// Download the filtered rows as CSV for offline auditing
	function exportCsv() {
		const blob = new Blob([toCsv(visible)], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${repo}-dependencies.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

{#snippet head(key: string, label: string, numeric: boolean, hint: string, cls: string)}
	<th scope="col" class={cn('px-3 py-2 text-left font-medium', cls)} aria-sort={ariaSort(key)}>
		<button
			type="button"
			onclick={() => sortBy(key, numeric)}
			class="inline-flex max-w-full cursor-pointer items-center gap-1 select-none hover:text-foreground"
		>
			<Hint text="{hint}. Click to sort"><span class="truncate">{label}</span></Hint>
			{#if view.sortKey === key}
				<Icon icon={view.dir === 'asc' ? ChevronUp : ChevronDown} size={13} />
			{/if}
		</button>
	</th>
{/snippet}

<div class="space-y-3">
	<div class="flex flex-wrap items-center gap-2">
		<div class="min-w-40 flex-1">
			<SortFilterBar
				{config}
				bind:view
				searchPlaceholder="Search dependencies"
				showSort={false}
				showDir={false}
			/>
		</div>
		<Button variant="outline" size="sm" class="h-9 gap-1.5" onclick={exportCsv}>
			<Icon icon={Download} size={15} />
			CSV
		</Button>
	</div>

	{#if visible.length}
		<div class="overflow-x-auto rounded-md border bg-card">
			<table class="w-full table-fixed text-sm">
				<thead class="border-b text-xs text-muted-foreground">
					<tr>
						<th scope="col" class="w-8 py-2 pl-3">
							<span class="sr-only">Advisory</span>
						</th>
						{@render head('name', 'Package', false, 'Dependency name and version', '')}
						{@render head(
							'depth',
							'Depth',
							true,
							'Hops from the project root, 1 means direct',
							'hidden w-16 sm:table-cell lg:w-32'
						)}
						<th
							scope="col"
							class="hidden w-24 px-3 py-2 text-left font-medium sm:table-cell lg:w-32"
						>
							<Hint text="Package registry the dependency comes from">Ecosystem</Hint>
						</th>
						{@render head(
							'license',
							'Licence',
							false,
							'Declared licence, coloured by risk',
							'hidden w-32 md:table-cell'
						)}
						{@render head(
							'fanIn',
							'Dependents',
							true,
							'Packages that depend on this one',
							'w-24 lg:w-32'
						)}
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each shown as pkg (pkg.ecosystem + pkg.name + pkg.version)}
						<tr class="hover:bg-muted/40">
							<td class="py-2 pl-3">
								{#if pkg.vuln}
									<span
										class="block size-2 rounded-full"
										style="background: {SEVERITY_COLOR[pkg.vuln]}"
										title="{pkg.vuln} severity advisory"
									></span>
									<span class="sr-only">{pkg.vuln} severity advisory</span>
								{:else}
									<span class="block size-2 rounded-full bg-muted" title="No known advisory"></span>
									<span class="sr-only">No known advisory</span>
								{/if}
							</td>
							<td class="px-3 py-2">
								<div class="flex min-w-0 items-baseline gap-1.5">
									{#if pkg.url}
										<a
											href={pkg.url}
											target="_blank"
											rel="noopener noreferrer"
											class="truncate font-medium hover:underline"
										>
											{pkg.name}
										</a>
									{:else}
										<span class="truncate font-medium">{pkg.name}</span>
									{/if}
									<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
										{pkg.version ?? ''}
									</span>
								</div>
							</td>
							<td
								class="hidden px-3 py-2 text-muted-foreground tabular-nums sm:table-cell"
								title={pkg.direct ? 'Direct dependency' : 'Hops from project root'}
							>
								{pkg.depth ?? '-'}
							</td>
							<td class="hidden truncate px-3 py-2 text-muted-foreground sm:table-cell">
								{pkg.ecosystem}
							</td>
							<td class="hidden px-3 py-2 md:table-cell" title={RISK_LABEL[pkg.licenseRisk]}>
								<span class="block truncate" style="color: {RISK_COLOR[pkg.licenseRisk]}">
									{pkg.license ?? 'Unlicensed'}
								</span>
							</td>
							<td
								class="px-3 py-2 text-muted-foreground tabular-nums"
								title="Depended on by {pkg.fanIn} packages"
							>
								{compactNumber(pkg.fanIn)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pagination bind:page {totalPages} />
	{:else}
		<p class="py-10 text-center text-sm text-muted-foreground">No dependencies match</p>
	{/if}
</div>
