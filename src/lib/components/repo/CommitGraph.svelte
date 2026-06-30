<script lang="ts">
	import { untrack } from 'svelte';
	import { Tag, Search, GitBranch, Loader2 } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { computeGraph, laneColor, mergeCommits, type Connector } from '$lib/views/commit-graph';
	import { relativeTime } from '$lib/format';
	import { GITHUB_WEB } from '$lib/config';
	import { toDisplayError } from '$lib/errors';
	import { cn } from '$lib/utils';
	import type { GraphRow } from '$lib/views/commit-graph';
	import type { CommitPage, RepoCommitGraph } from '$lib/types';

	let {
		graph,
		repoUrl,
		owner,
		repo
	}: { graph: RepoCommitGraph; repoUrl: string; owner: string; repo: string } = $props();

	const COL = 18;
	const ROW = 34;
	const DOT = 4;
	const MORE_BTN =
		'text-muted-foreground hover:text-foreground hover:bg-muted rounded-md px-3 py-1.5 text-xs transition-colors';

	let commits = $state(untrack(() => graph.commits));
	let cursor = $state(untrack(() => graph.nextCursor));
	let branch = $state(untrack(() => graph.defaultBranch));
	let search = $state('');
	let loading = $state(false);
	let error = $state<unknown>(null);
	let sentinel = $state<HTMLElement>();

	const layout = $derived(computeGraph(commits));
	const railWidth = $derived(Math.max(layout.laneCount, 1) * COL);
	const needle = $derived(search.trim().toLowerCase());
	const cx = (lane: number) => lane * COL + COL / 2;

	// A search dims non-matching rows rather than removing them, so the rails stay intact
	function matches(row: GraphRow): boolean {
		if (!needle) return true;
		const { message, author, short } = row.commit;
		return (
			message.toLowerCase().includes(needle) ||
			short.includes(needle) ||
			!!author?.toLowerCase().includes(needle)
		);
	}

	async function fetchPage(ref: string, from: string | null): Promise<CommitPage> {
		const query = [`branch=${encodeURIComponent(ref)}`];
		if (from) query.push(`cursor=${encodeURIComponent(from)}`);
		const res = await fetch(`/api/${owner}/${repo}/commits?${query.join('&')}`);
		if (!res.ok) throw new Error('Could not load commits');
		return res.json();
	}

	// Switch the graph to another branch, replacing the loaded history
	async function selectBranch(value: string | undefined): Promise<void> {
		if (!value || value === branch || loading) return;
		branch = value;
		loading = true;
		error = null;
		try {
			const page = await fetchPage(value, null);
			commits = page.commits;
			cursor = page.nextCursor;
		} catch (caught) {
			error = caught;
		}
		loading = false;
	}

	// Append the next older page, ignoring overlapping triggers and the end
	async function loadMore(): Promise<void> {
		if (loading || cursor === null) return;
		loading = true;
		error = null;
		try {
			const page = await fetchPage(branch, cursor);
			commits = mergeCommits(commits, page.commits);
			cursor = page.nextCursor;
		} catch (caught) {
			error = caught;
		}
		loading = false;
	}

	// Pull more as the sentinel nears the viewport
	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => entries[0]?.isIntersecting && loadMore(),
			{ rootMargin: '300px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	// S-curve between two columns across one half of the row, vertical when aligned
	function path(edge: Connector, half: 'top' | 'bottom'): string {
		const x1 = cx(edge.from);
		const x2 = cx(edge.to);
		const [y1, y2] = half === 'top' ? [0, ROW / 2] : [ROW / 2, ROW];
		const ymid = (y1 + y2) / 2;
		return `M ${x1} ${y1} C ${x1} ${ymid}, ${x2} ${ymid}, ${x2} ${y2}`;
	}
</script>

<div class="space-y-3">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<p class="text-muted-foreground flex items-center gap-2 text-xs">
			<span class="tabular-nums">{graph.branchCount} branches</span>
			<span aria-hidden="true">·</span>
			<span class="tabular-nums">{graph.tagCount} tags</span>
		</p>

		<div class="flex items-center gap-2">
			<div class="relative min-w-36">
				<Icon
					icon={Search}
					size={14}
					class="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2"
				/>
				<Input
					bind:value={search}
					placeholder="Search commits"
					aria-label="Search commits"
					class="h-8 pl-8 text-xs"
				/>
			</div>
			<Select.Root type="single" value={branch} onValueChange={selectBranch}>
				<Select.Trigger class="h-8 w-40 text-xs">
					<span class="flex items-center gap-1.5 truncate">
						<Icon icon={GitBranch} size={13} />{branch}
					</span>
				</Select.Trigger>
				<Select.Content>
					{#each graph.branches as name (name)}
						<Select.Item value={name}>{name}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</div>

	<div class="-mx-1">
		{#each layout.rows as row (row.commit.oid)}
			<div
				class={cn(
					'hover:bg-muted flex items-stretch rounded-md transition-[background-color,opacity]',
					needle && !matches(row) && 'opacity-40'
				)}
			>
				<svg
					width={railWidth}
					height={ROW}
					class="shrink-0"
					viewBox="0 0 {railWidth} {ROW}"
					aria-hidden="true"
				>
					{#each row.passes as lane (lane)}
						<line
							x1={cx(lane)}
							y1="0"
							x2={cx(lane)}
							y2={ROW}
							stroke={laneColor(lane)}
							stroke-width="2"
						/>
					{/each}
					{#each row.top as edge, index (index)}
						<path d={path(edge, 'top')} fill="none" stroke={edge.color} stroke-width="2" />
					{/each}
					{#each row.bottom as edge, index (index)}
						<path d={path(edge, 'bottom')} fill="none" stroke={edge.color} stroke-width="2" />
					{/each}
					<circle cx={cx(row.col)} cy={ROW / 2} r={DOT + 1.5} class="fill-card" />
					<circle cx={cx(row.col)} cy={ROW / 2} r={DOT} fill={row.color} />
				</svg>

				<div class="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-sm">
					{#each row.commit.refs as ref (ref.name)}
						<span
							class={cn(
								'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
								ref.isDefault
									? 'border-primary/40 text-primary'
									: ref.type === 'tag'
										? 'border-border text-muted-foreground'
										: 'border-border text-foreground/80'
							)}
						>
							{#if ref.type === 'tag'}<Icon icon={Tag} size={11} />{/if}{ref.name}
						</span>
					{/each}
					<span class="truncate">{row.commit.message}</span>
					<span
						class="text-muted-foreground ml-auto flex shrink-0 items-center gap-2 text-xs tabular-nums"
					>
						{#if row.commit.author}
							{#if row.commit.login}
								<a
									href="{GITHUB_WEB}/{row.commit.login}"
									target="_blank"
									rel="noreferrer"
									class="hover:text-foreground hidden sm:inline">{row.commit.author}</a
								>
							{:else}
								<span class="hidden sm:inline">{row.commit.author}</span>
							{/if}
						{/if}
						<a
							href="{repoUrl}/commit/{row.commit.oid}"
							target="_blank"
							rel="noreferrer"
							class="hover:text-foreground font-mono">{row.commit.short}</a
						>
						<span class="hidden md:inline">{relativeTime(row.commit.date)}</span>
					</span>
				</div>
			</div>
		{/each}
	</div>

	{#if cursor !== null}
		<div bind:this={sentinel} class="flex flex-col items-center gap-2 py-3">
			{#if error}
				<p class="text-danger text-center text-sm">{toDisplayError(error).message}</p>
				<button type="button" onclick={loadMore} class={MORE_BTN}>Retry</button>
			{:else if loading}
				<Icon icon={Loader2} class="text-muted-foreground animate-spin" />
			{:else}
				<button type="button" onclick={loadMore} class={MORE_BTN}>Load more</button>
			{/if}
		</div>
	{:else if commits.length}
		<p class="text-muted-foreground py-3 text-center text-xs">End of history</p>
	{/if}
</div>
