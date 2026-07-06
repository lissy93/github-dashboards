<script lang="ts">
	import { untrack } from 'svelte';
	import SearchInput from '$lib/components/common/SearchInput.svelte';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { Tag, GitBranch, GitFork, Loader2 } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { computeGraph, laneColor, mergeCommits, type Connector } from '$lib/views/commit-graph';
	import { relativeTime } from '$lib/utils/format';
	import { fetchApi } from '$lib/state/api';
	import { GITHUB_WEB, paths } from '$lib/config';
	import { toDisplayError } from '$lib/utils/errors';
	import { cn } from '$lib/utils';
	import type { GraphRow } from '$lib/views/commit-graph';
	import type { CommitPage, RepoCommitGraph } from '$lib/types';

	// A limit renders a fixed preview: first commits only, no toolbar or paging
	let {
		graph,
		repoUrl,
		owner,
		repo,
		limit
	}: { graph: RepoCommitGraph; repoUrl: string; owner: string; repo: string; limit?: number } =
		$props();

	const COL = 18;
	const ROW = 34;
	const DOT = 4;
	const MORE_BTN =
		'text-muted-foreground hover:text-foreground hover:bg-muted rounded-md px-3 py-1.5 text-xs transition-colors';
	const PR_COLOR = {
		open: 'var(--lifecycle-open)',
		merged: 'var(--lifecycle-resolved)',
		closed: 'var(--lifecycle-discarded)'
	};
	// Only offer the branch filter once the list is long enough to need it
	const FILTER_MIN = 10;

	let commits = $state(untrack(() => graph.commits));
	let cursor = $state(untrack(() => graph.nextCursor));
	let branch = $state(untrack(() => graph.defaultBranch));
	let search = $state('');
	let branchFilter = $state('');
	let loading = $state(false);
	let error = $state<unknown>(null);
	let sentinel = $state<HTMLElement>();

	const layout = $derived(computeGraph(limit ? commits.slice(0, limit) : commits));
	const railWidth = $derived(Math.max(layout.laneCount, 1) * COL);
	const needle = $derived(search.trim().toLowerCase());
	const shownBranches = $derived(
		graph.branches.filter((name) => name.toLowerCase().includes(branchFilter.trim().toLowerCase()))
	);
	const cx = (lane: number) => lane * COL + COL / 2;

	// A search dims non-matching rows rather than removing them, so the rails stay intact
	function matches(row: GraphRow): boolean {
		if (!needle) return true;
		const { message, author, short, pr } = row.commit;
		return (
			message.toLowerCase().includes(needle) ||
			short.includes(needle) ||
			!!author?.toLowerCase().includes(needle) ||
			(!!pr && `#${pr.number}`.includes(needle))
		);
	}

	function fetchPage(ref: string, from: string | null): Promise<CommitPage> {
		const query = [`branch=${encodeURIComponent(ref)}`];
		if (from) query.push(`cursor=${encodeURIComponent(from)}`);
		return fetchApi(`/api/${owner}/${repo}/commits?${query.join('&')}`);
	}

	// Mirror the branch into the url so the view survives refresh and sharing
	function syncUrl(value: string): void {
		const url = new URL(page.url);
		if (value === graph.defaultBranch) url.searchParams.delete('branch');
		else url.searchParams.set('branch', value);
		replaceState(url, page.state);
	}

	// Switch the graph to another branch, replacing the loaded history
	async function selectBranch(value: string | undefined): Promise<void> {
		if (!value || value === branch || loading) return;
		branch = value;
		loading = true;
		error = null;
		try {
			const loaded = await fetchPage(value, null);
			commits = loaded.commits;
			cursor = loaded.nextCursor;
			syncUrl(value);
		} catch (caught) {
			error = caught;
		}
		loading = false;
	}

	// A ?branch= param deep-links straight to that branch's history
	const urlBranch = untrack(() => (browser && !limit ? page.url.searchParams.get('branch') : null));
	if (urlBranch) selectBranch(urlBranch);

	// Append the next older page, ignoring overlapping triggers and the end
	async function loadMore(): Promise<void> {
		if (loading || cursor === null) return;
		loading = true;
		error = null;
		try {
			const loaded = await fetchPage(branch, cursor);
			commits = mergeCommits(commits, loaded.commits);
			cursor = loaded.nextCursor;
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
	{#if !limit}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p class="text-muted-foreground flex items-center gap-2 text-xs">
				<span class="tabular-nums">{graph.branchCount} branches</span>
				<span aria-hidden="true">·</span>
				<span class="tabular-nums">{graph.tagCount} tags</span>
			</p>

			<div class="flex items-center gap-2">
				<SearchInput
					bind:value={search}
					placeholder="Search commits"
					class="min-w-36"
					inputClass="h-8 pl-8 text-xs"
				/>
				<Select.Root
					type="single"
					value={branch}
					onValueChange={selectBranch}
					onOpenChange={() => (branchFilter = '')}
				>
					<Select.Trigger class="h-8 w-40 text-xs">
						<span class="flex items-center gap-1.5 truncate">
							<Icon icon={GitBranch} size={13} />{branch}
						</span>
					</Select.Trigger>
					<Select.Content>
						{#if graph.branches.length >= FILTER_MIN}
							<div class="p-1">
								<Input
									bind:value={branchFilter}
									placeholder="Filter branches"
									aria-label="Filter branches"
									class="h-7 text-xs"
									onkeydown={(event) => event.key !== 'Escape' && event.stopPropagation()}
								/>
							</div>
						{/if}
						{#each shownBranches as name (name)}
							<Select.Item value={name}>{name}</Select.Item>
						{:else}
							<p class="text-muted-foreground px-2 py-1.5 text-xs">No matching branches</p>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>
	{/if}

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
					{#if row.hasStub}
						<line
							x1={cx(row.col)}
							y1={ROW / 2}
							x2={cx(row.col)}
							y2={ROW}
							stroke={row.color}
							stroke-width="2"
							stroke-dasharray="2 3"
							opacity="0.4"
						/>
					{/if}
					<circle cx={cx(row.col)} cy={ROW / 2} r={DOT + 1.5} class="fill-card" />
					{#if row.commit.parents.length > 1}
						<circle
							cx={cx(row.col)}
							cy={ROW / 2}
							r={DOT - 0.5}
							fill="none"
							stroke={row.color}
							stroke-width="2"
						>
							<title>Merge commit</title>
						</circle>
					{:else}
						<circle cx={cx(row.col)} cy={ROW / 2} r={DOT} fill={row.color} />
					{/if}
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
					{#if row.commit.pr}
						{@const pr = row.commit.pr}
						<a
							href="{repoUrl}/pull/{pr.number}"
							target="_blank"
							rel="noreferrer"
							title="{pr.state} pull request{pr.external ? ' from a fork' : ''}"
							class="hover:bg-muted inline-flex shrink-0 items-center gap-1 rounded-full
								border px-2 py-0.5 text-xs transition-colors"
							style="color: {PR_COLOR[pr.state]};
								border-color: color-mix(in oklab, {PR_COLOR[pr.state]} 40%, transparent)"
						>
							{#if pr.external}<Icon icon={GitFork} size={11} />{/if}#{pr.number}
						</a>
					{/if}
					<span class="truncate">{row.commit.message}</span>
					<span
						class="text-muted-foreground ml-auto flex shrink-0 items-center gap-2 text-xs tabular-nums"
					>
						{#if row.commit.author}
							{#if row.commit.login}
								<a
									href={paths.user(row.commit.login)}
									class="hover:text-foreground hidden items-center gap-1.5 sm:flex"
								>
									<UserAvatar
										login={row.commit.login}
										src="{GITHUB_WEB}/{row.commit.login}.png?size=40"
										alt=""
										size="sm"
										class="size-5"
										fallbackClass="text-[0.5rem]"
									/>
									{row.commit.author}
								</a>
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

	{#if limit === undefined && cursor !== null}
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
	{:else if limit === undefined && commits.length}
		<p class="text-muted-foreground py-3 text-center text-xs">End of history</p>
	{/if}
</div>
