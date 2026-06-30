import type { GraphCommit } from '$lib/types';

const PALETTE = [
	'var(--chart-1)',
	'var(--chart-2)',
	'var(--chart-3)',
	'var(--chart-4)',
	'var(--chart-5)'
];

// Stable colour for a lane, cycling the chart palette by column
export const laneColor = (col: number) => PALETTE[col % PALETTE.length];

// A diagonal or vertical line piece within one row, between two columns
export type Connector = { from: number; to: number; color: string };

export type GraphRow = {
	commit: GraphCommit;
	col: number;
	color: string;
	passes: number[];
	top: Connector[];
	bottom: Connector[];
};

export type CommitGraph = { rows: GraphRow[]; laneCount: number };

// Append a newer-loaded page to the accumulated commits, dropping duplicate oids and
// keeping the whole list newest first so the lane layout stays consistent
export function mergeCommits(existing: GraphCommit[], incoming: GraphCommit[]): GraphCommit[] {
	const seen = new Set(existing.map((commit) => commit.oid));
	const merged = [...existing];
	for (const commit of incoming) if (!seen.has(commit.oid)) merged.push(commit);
	return merged.sort((first, second) => second.date.localeCompare(first.date));
}

// Lay commits out as a railroad DAG. Lanes track which commit each column is waiting
// for, top connectors pull child lines into a node, bottom connectors send it on to its
// parents. Commits must be newest first, parents may be absent when off the bottom edge
export function computeGraph(commits: GraphCommit[]): CommitGraph {
	const present = new Set(commits.map((commit) => commit.oid));
	const lanes: (string | null)[] = [];
	const rows: GraphRow[] = [];
	let laneCount = 0;

	const firstFree = () => {
		const free = lanes.indexOf(null);
		return free === -1 ? lanes.length : free;
	};

	for (const commit of commits) {
		// Lanes already waiting for this commit, its children converging from above
		const converged: number[] = [];
		lanes.forEach((oid, index) => oid === commit.oid && converged.push(index));

		const col = converged.length ? converged[0] : firstFree();
		while (lanes.length <= col) lanes.push(null);

		const top: Connector[] = converged.map((index) => ({
			from: index,
			to: col,
			color: laneColor(col)
		}));

		// Clear the node's lane and any extra converged lanes, ready for its parents
		for (const index of converged) lanes[index] = null;
		lanes[col] = null;

		const passes: number[] = [];
		lanes.forEach((oid, index) => oid !== null && index !== col && passes.push(index));

		// Route each in-view parent onward, the first one staying in the node's column
		const bottom: Connector[] = [];
		let keptColumn = false;
		for (const parent of commit.parents) {
			if (!present.has(parent)) continue;
			const existing = lanes.indexOf(parent);
			let target: number;
			if (existing !== -1) {
				target = existing;
			} else if (!keptColumn) {
				target = col;
				keptColumn = true;
				lanes[col] = parent;
			} else {
				target = firstFree();
				while (lanes.length <= target) lanes.push(null);
				lanes[target] = parent;
			}
			bottom.push({ from: col, to: target, color: laneColor(target) });
		}

		const used = lanes.reduce((max, oid, index) => (oid !== null ? index + 1 : max), 0);
		laneCount = Math.max(laneCount, used, col + 1, ...passes.map((lane) => lane + 1));
		rows.push({ commit, col, color: laneColor(col), passes, top, bottom });
	}

	return { rows, laneCount };
}
