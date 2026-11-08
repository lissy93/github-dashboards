<script lang="ts">
	import SegmentedControl from '$lib/components/common/SegmentedControl.svelte';
	import SearchInput from '$lib/components/common/SearchInput.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { UnfoldVertical, FoldVertical, GitBranch, TriangleAlert } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import TreeRow from './TreeRow.svelte';
	import { filterTree, sortNodes, allDirPaths, type TreeSort } from '$lib/views/repo-tree';
	import { formatBytes, compactNumber } from '$lib/utils/format';
	import type { RepoTree } from '$lib/types';

	let { tree, repoUrl }: { tree: RepoTree; repoUrl: string } = $props();

	let query = $state('');
	let sort = $state<TreeSort>('name');
	const expanded = new SvelteSet<string>();

	// A search overrides collapse state so every matching branch is shown open
	const filtering = $derived(query.trim().length > 0);
	const nodes = $derived(sortNodes(filterTree(tree.root, query), sort));

	const isOpen = (path: string) => filtering || expanded.has(path);
	function toggle(path: string): void {
		if (expanded.has(path)) expanded.delete(path);
		else expanded.add(path);
	}
	function expandAll(): void {
		for (const path of allDirPaths(tree.root)) expanded.add(path);
	}

	const SORTS: { key: TreeSort; label: string }[] = [
		{ key: 'name', label: 'Name' },
		{ key: 'size', label: 'Size' }
	];
</script>

<div class="space-y-3">
	<div class="flex flex-wrap items-center gap-2">
		<SearchInput bind:value={query} placeholder="Filter files" class="min-w-40 flex-1" />

		<SegmentedControl
			label="Sort files"
			options={SORTS.map(({ key, label }) => ({ value: key, label }))}
			bind:value={sort}
		/>

		<div class="flex items-center gap-1">
			<Hint text="Expand all folders">
				<button
					type="button"
					aria-label="Expand all folders"
					onclick={expandAll}
					disabled={filtering}
					class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
				>
					<Icon icon={UnfoldVertical} size={16} />
				</button>
			</Hint>
			<Hint text="Collapse all folders">
				<button
					type="button"
					aria-label="Collapse all folders"
					onclick={() => expanded.clear()}
					disabled={filtering}
					class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
				>
					<Icon icon={FoldVertical} size={16} />
				</button>
			</Hint>
		</div>
	</div>

	<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
		<span class="tabular-nums">{compactNumber(tree.totalFiles)} files</span>
		<span aria-hidden="true">·</span>
		<span class="tabular-nums">{compactNumber(tree.totalDirs)} folders</span>
		<span aria-hidden="true">·</span>
		<span class="tabular-nums">{formatBytes(tree.totalSize)}</span>
		<span class="inline-flex items-center gap-1 text-foreground/80">
			<Icon icon={GitBranch} size={13} />{tree.branch}
		</span>
	</p>

	{#if tree.truncated}
		<p class="flex items-center gap-1.5 text-xs text-warning">
			<Icon icon={TriangleAlert} size={13} />
			This repo is large, GitHub returned a partial listing
		</p>
	{/if}

	{#if nodes.length === 0}
		<p class="py-8 text-center text-sm text-muted-foreground">No files match your filter</p>
	{:else}
		<div class="-mx-1 max-h-[34rem] overflow-y-auto">
			{#each nodes as node (node.path)}
				<TreeRow {node} depth={0} {repoUrl} branch={tree.branch} {isOpen} {toggle} />
			{/each}
		</div>
	{/if}
</div>
