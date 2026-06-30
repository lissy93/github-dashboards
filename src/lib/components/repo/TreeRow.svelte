<script lang="ts">
	import { Folder, FolderOpen, ChevronRight } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Self from './TreeRow.svelte';
	import { iconForFile } from '$lib/views/repo-tree';
	import { formatBytes } from '$lib/format';
	import { cn } from '$lib/utils';
	import type { TreeNode } from '$lib/types';

	type Props = {
		node: TreeNode;
		depth: number;
		repoUrl: string;
		branch: string;
		isOpen: (path: string) => boolean;
		toggle: (path: string) => void;
	};
	let { node, depth, repoUrl, branch, isOpen, toggle }: Props = $props();

	const open = $derived(node.type === 'dir' && isOpen(node.path));
	const kind = $derived(node.type === 'dir' ? 'tree' : 'blob');
	const href = $derived(`${repoUrl}/${kind}/${branch}/${node.path}`);
	const pad = $derived(`calc(${depth} * 1rem + 0.5rem)`);

	const ROW =
		'hover:bg-muted flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm transition-colors';
</script>

{#if node.type === 'dir'}
	<button
		type="button"
		class={ROW}
		style:padding-left={pad}
		aria-expanded={open}
		onclick={() => toggle(node.path)}
	>
		<Icon
			icon={ChevronRight}
			size={14}
			class={cn('text-muted-foreground transition-transform', open && 'rotate-90')}
		/>
		<Icon icon={open ? FolderOpen : Folder} size={15} class="text-foreground/70" />
		<span class="flex-1 truncate">{node.name}</span>
		<span class="text-muted-foreground shrink-0 text-xs tabular-nums">
			{node.fileCount} · {formatBytes(node.size)}
		</span>
	</button>
	{#if open && node.children}
		{#each node.children as child (child.path)}
			<Self node={child} depth={depth + 1} {repoUrl} {branch} {isOpen} {toggle} />
		{/each}
	{/if}
{:else}
	<a class={ROW} style:padding-left={pad} {href} target="_blank" rel="noreferrer">
		<span class="w-3.5 shrink-0"></span>
		<Icon icon={iconForFile(node.name)} size={15} class="text-muted-foreground" />
		<span class="flex-1 truncate">{node.name}</span>
		<span class="text-muted-foreground shrink-0 text-xs tabular-nums">
			{formatBytes(node.size)}
		</span>
	</a>
{/if}
