import { graphql, rest } from '$lib/server/github/client';
import { cached } from '$lib/server/cache';
import { createLogger } from '$lib/logger';
import type { RepoTree, TreeNode } from '$lib/types';

const log = createLogger('repo-tree');
const TTL = 3600;

type RawEntry = { path: string; type: string; size?: number };
type RawTree = { tree: RawEntry[]; truncated: boolean };
type BranchData = {
	repository: { defaultBranchRef: { name: string; target: { oid: string } | null } | null } | null;
};

const BRANCH_QUERY = `
	query RepoBranch($owner: String!, $name: String!) {
		repository(owner: $owner, name: $name) {
			defaultBranchRef { name target { oid } }
		}
	}
`;

const treeKey = (owner: string, name: string) => `repo:tree:v1:${owner}/${name}`.toLowerCase();

// Directories before files, then case-insensitive by name
function byKind(first: TreeNode, second: TreeNode): number {
	if (first.type !== second.type) return first.type === 'dir' ? -1 : 1;
	return first.name.localeCompare(second.name);
}

// Roll child sizes and file counts up into each directory, then sort every level
function finalize(nodes: TreeNode[]): void {
	for (const node of nodes) {
		if (node.type !== 'dir' || !node.children) continue;
		finalize(node.children);
		node.size = node.children.reduce((sum, child) => sum + child.size, 0);
		node.fileCount = node.children.reduce(
			(count, child) => count + (child.type === 'file' ? 1 : (child.fileCount ?? 0)),
			0
		);
	}
	nodes.sort(byKind);
}

type TreeShape = Pick<RepoTree, 'root' | 'totalFiles' | 'totalDirs' | 'totalSize'>;

// Flat recursive git-tree entries into a nested tree with aggregate metrics
export function buildTree(entries: RawEntry[]): TreeShape {
	const root: TreeNode[] = [];
	const dirs = new Map<string, TreeNode>();

	// Directory node for a path, creating it and any missing ancestors on first use
	function ensureDir(path: string): TreeNode {
		const existing = dirs.get(path);
		if (existing) return existing;
		const slash = path.lastIndexOf('/');
		const node: TreeNode = {
			name: path.slice(slash + 1),
			path,
			type: 'dir',
			size: 0,
			fileCount: 0,
			children: []
		};
		dirs.set(path, node);
		const siblings = slash === -1 ? root : ensureDir(path.slice(0, slash)).children;
		siblings?.push(node);
		return node;
	}

	let totalFiles = 0;
	for (const entry of entries) {
		if (entry.type === 'tree') {
			ensureDir(entry.path);
			continue;
		}
		const slash = entry.path.lastIndexOf('/');
		const siblings = slash === -1 ? root : ensureDir(entry.path.slice(0, slash)).children;
		siblings?.push({
			name: entry.path.slice(slash + 1),
			path: entry.path,
			type: 'file',
			size: entry.size ?? 0
		});
		totalFiles += 1;
	}

	finalize(root);
	return {
		root,
		totalFiles,
		totalDirs: dirs.size,
		totalSize: root.reduce((sum, node) => sum + node.size, 0)
	};
}

const emptyTree = (branch: string): RepoTree => ({
	branch,
	root: [],
	totalFiles: 0,
	totalDirs: 0,
	totalSize: 0,
	truncated: false
});

// Default branch name and its commit oid, null for an empty or missing repo
async function resolveBranch(
	owner: string,
	name: string
): Promise<{ name: string; oid: string } | null> {
	const { repository } = await graphql<BranchData>(BRANCH_QUERY, { owner, name });
	const ref = repository?.defaultBranchRef;
	return ref?.target ? { name: ref.name, oid: ref.target.oid } : null;
}

// Full file tree for a repo's default branch, cached and served stale-while-revalidate.
// The commit oid is used as the tree ref so branch names with slashes still resolve
export function getRepoTree(owner: string, name: string): Promise<RepoTree> {
	return cached(
		treeKey(owner, name),
		async () => {
			const ref = await resolveBranch(owner, name);
			if (!ref) return emptyTree('');
			const data = await rest<RawTree>(`/repos/${owner}/${name}/git/trees/${ref.oid}?recursive=1`);
			if (!data) return emptyTree(ref.name);
			if (data.truncated) log.warn(`tree truncated for ${owner}/${name}, partial listing`);
			return { branch: ref.name, truncated: data.truncated, ...buildTree(data.tree) };
		},
		TTL
	);
}
