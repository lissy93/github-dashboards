import type { Component } from 'svelte';
import { File, FileCode, FileJson, FileText, FileImage, FileCog } from '@lucide/svelte';
import type { TreeNode } from '$lib/types';

export type TreeSort = 'name' | 'size';

// Directories first, then by the chosen key with name as the tiebreak
function comparator(sort: TreeSort) {
	return (first: TreeNode, second: TreeNode): number => {
		if (first.type !== second.type) return first.type === 'dir' ? -1 : 1;
		if (sort === 'size' && first.size !== second.size) return second.size - first.size;
		return first.name.localeCompare(second.name);
	};
}

// Re-sort every level of the tree, returning new arrays so the source is untouched
export function sortNodes(nodes: TreeNode[], sort: TreeSort): TreeNode[] {
	return nodes
		.map((node) => (node.children ? { ...node, children: sortNodes(node.children, sort) } : node))
		.sort(comparator(sort));
}

// Prune the tree to entries matching the query, keeping directories on a matching path.
// A directory whose own name matches keeps all of its children so the match opens fully
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return nodes;
	const kept: TreeNode[] = [];
	for (const node of nodes) {
		const self = node.name.toLowerCase().includes(needle);
		if (node.children) {
			const children = filterTree(node.children, needle);
			if (self || children.length)
				kept.push({ ...node, children: self ? node.children : children });
		} else if (self) {
			kept.push(node);
		}
	}
	return kept;
}

// Every directory path in the tree, used to expand or collapse all at once
export function allDirPaths(nodes: TreeNode[]): string[] {
	const paths: string[] = [];
	for (const node of nodes) {
		if (!node.children) continue;
		paths.push(node.path);
		paths.push(...allDirPaths(node.children));
	}
	return paths;
}

const ICON_BY_EXT: Record<string, Component> = {};
const ICON_GROUPS: [Component, string[]][] = [
	[
		FileCode,
		// prettier-ignore
		['js', 'jsx', 'ts', 'tsx', 'svelte', 'vue', 'py', 'go', 'rs', 'rb', 'php', 'java', 'c', 'h', 'cpp', 'cs', 'sh', 'css', 'scss', 'html']
	],
	[FileJson, ['json', 'yml', 'yaml', 'toml', 'lock', 'xml']],
	[FileText, ['md', 'mdx', 'txt', 'rst', 'csv']],
	[FileImage, ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'avif']],
	[FileCog, ['env', 'cfg', 'conf', 'ini', 'config']]
];
for (const [icon, exts] of ICON_GROUPS) for (const ext of exts) ICON_BY_EXT[ext] = icon;

// Lucide icon for a filename, chosen by extension with a generic fallback
export function iconForFile(name: string): Component {
	const dot = name.lastIndexOf('.');
	const ext = dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
	return ICON_BY_EXT[ext] ?? File;
}
