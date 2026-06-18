<script lang="ts">
	import {
		Star,
		GitFork,
		Users,
		Eye,
		Download,
		CircleDot,
		GitPullRequest,
		GitCommit,
		HardDrive,
		Scale,
		Tag,
		Calendar,
		History,
		Archive,
		GitBranch,
		Lock
	} from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge';
	import Icon from '$lib/components/common/Icon.svelte';
	import Metric from '$lib/components/common/Metric.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import {
		compactNumber,
		formatNumber,
		formatSize,
		relativeTime,
		formatDate,
		formatDateTime
	} from '$lib/format';
	import { paths } from '$lib/config';
	import type { Repo, RepoExtras } from '$lib/types';

	let {
		repo,
		detailed = false,
		extras
	}: { repo: Repo; detailed?: boolean; extras?: RepoExtras } = $props();

	const tags = $derived(
		[
			repo.isArchived && { icon: Archive, label: 'Archived' },
			repo.isFork && { icon: GitBranch, label: 'Fork' },
			repo.isPrivate && { icon: Lock, label: 'Private' }
		].filter(Boolean) as { icon: typeof Archive; label: string }[]
	);

	const basicStats = $derived([
		{ icon: Star, value: repo.stars },
		{ icon: GitFork, value: repo.forks },
		{ icon: CircleDot, value: repo.openIssues },
		{ icon: GitPullRequest, value: repo.openPRs }
	]);

	// Star change over the selected window, only meaningful once history exists
	const delta = $derived(extras?.starDelta);
	// Heavier counts arrive lazily, so the card fills them in once loaded
	const stats = $derived(extras?.stats);

	// Tooltip labels spell out the full, exact figures the compact values abbreviate
	const starsLabel = $derived(
		`${formatNumber(repo.stars)} stars · ${formatNumber(repo.watchers)} watching` +
			(delta != null && delta !== 0 && extras?.starWindow
				? ` · ${delta > 0 ? '+' : '-'}${formatNumber(Math.abs(delta))} in ${extras.starWindow}d`
				: '')
	);
	const visitsLabel = $derived(
		extras?.uniqueViews != null
			? `${formatNumber(extras.views ?? 0)} visits, ${formatNumber(extras.uniqueViews)} unique in the last 14 days`
			: `${formatNumber(extras?.views ?? 0)} visits in the last 14 days`
	);
	const issuesLabel = $derived(
		`${formatNumber(repo.openIssues)} open${stats ? `, ${formatNumber(stats.closedIssues)} closed` : ''} issues`
	);
	const prsLabel = $derived(
		`${formatNumber(repo.openPRs)} open${stats ? `, ${formatNumber(stats.mergedPRs)} merged` : ''} pull requests`
	);
	const releaseLabel = $derived(
		stats?.latestRelease
			? `Latest release ${stats.latestRelease.tag} · ${formatDateTime(stats.latestRelease.publishedAt)}` +
					(stats.releaseCount > 1 ? ` · ${formatNumber(stats.releaseCount)} releases` : '')
			: ''
	);
</script>

{#snippet tagList()}
	{#if tags.length}
		<div class="relative z-10 flex gap-1">
			{#each tags as tag (tag.label)}
				<Badge variant="outline" class="gap-1"><Icon icon={tag.icon} size={11} />{tag.label}</Badge>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet description()}
	{#if repo.description}
		<p class="text-muted-foreground line-clamp-2 text-sm">{repo.description}</p>
	{/if}
{/snippet}

{#snippet langLabel()}
	{#if repo.language}
		<span class="flex items-center gap-1.5">
			<span
				class="size-2.5 rounded-full"
				style="background-color: {repo.language.color ?? 'var(--muted-foreground)'}"
			></span>
			{repo.language.name}
		</span>
	{/if}
{/snippet}

<!-- Closed count that width-reveals next to its open count on hover -->
{#snippet closedCount(count: number)}
	<span
		class="-ml-1 grid grid-cols-[0fr] overflow-hidden opacity-0 transition-[grid-template-columns,opacity] duration-150 ease-out group-hover/drawer:grid-cols-[1fr] group-hover/drawer:opacity-100 group-focus-within/drawer:grid-cols-[1fr] group-focus-within/drawer:opacity-100"
	>
		<span class="text-muted-foreground/55 min-w-0 truncate pl-1">/ {compactNumber(count)}</span>
	</span>
{/snippet}

{#if detailed}
	<div
		class="bg-popover hover:border-ring/50 focus-within:border-ring/50 relative flex flex-col overflow-hidden rounded-md border transition-colors"
	>
		<div class="flex flex-1 flex-col gap-3 p-4">
			<div class="flex items-start justify-between gap-2">
				<a
					href={paths.repo(repo.owner, repo.name)}
					class="truncate rounded-sm font-medium after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
				>
					{repo.name}
				</a>
				{@render tagList()}
			</div>

			<div class="min-h-12">{@render description()}</div>
		</div>

		<!-- Issues/PRs stay visible, the rest slides up when the drawer is hovered -->
		<div class="group/drawer relative">
			<div
				class="bg-muted absolute inset-x-0 bottom-full flex translate-y-full flex-col gap-2 border-t px-4 pt-2 text-xs transition-transform duration-300 ease-out group-hover/drawer:translate-y-0 group-focus-within/drawer:translate-y-0"
			>
				{#if repo.language || repo.license || stats || repo.diskUsage > 0}
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
						{#if repo.language}
							<Metric
								dot={repo.language.color}
								value={repo.language.name}
								label="Language: {repo.language.name}"
							/>
						{/if}
						{#if repo.license}
							<Metric icon={Scale} value={repo.license} label="License: {repo.license}" />
						{/if}
						{#if stats?.latestRelease}
							<Metric icon={Tag} value={stats.latestRelease.tag} label={releaseLabel} />
						{/if}
						{#if stats}
							<Metric
								icon={GitCommit}
								value={compactNumber(stats.commits)}
								label="{formatNumber(stats.commits)} commits on the default branch"
							/>
						{/if}
						{#if repo.diskUsage > 0}
							<Metric
								icon={HardDrive}
								value={formatSize(repo.diskUsage)}
								label="Repository size: {formatSize(repo.diskUsage)}"
							/>
						{/if}
					</div>
				{/if}

				<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
					<Metric icon={Star} value={compactNumber(repo.stars)} label={starsLabel}>
						{#snippet trailing()}
							{#if delta != null && delta !== 0}
								<span class={delta > 0 ? 'text-success' : 'text-muted-foreground'}>
									({delta > 0 ? '+' : '-'}{compactNumber(Math.abs(delta))})
								</span>
							{/if}
						{/snippet}
					</Metric>
					<Metric
						icon={GitFork}
						value={compactNumber(repo.forks)}
						label="{formatNumber(repo.forks)} forks"
					/>
					{#if extras?.contributors != null}
						<Metric
							icon={Users}
							value={compactNumber(extras.contributors)}
							label="{formatNumber(extras.contributors)} contributors"
						/>
					{/if}
					{#if extras?.views != null}
						<Metric icon={Eye} value={compactNumber(extras.views)} label={visitsLabel} />
					{/if}
					{#if extras?.clones != null}
						<Metric
							icon={Download}
							value={compactNumber(extras.clones)}
							label="{formatNumber(extras.clones)} clones in the last 14 days"
						/>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
					<Metric
						icon={History}
						value={relativeTime(repo.pushedAt)}
						label="Last updated {formatDateTime(repo.pushedAt)}"
					/>
					<Metric
						icon={Calendar}
						value={formatDate(repo.createdAt)}
						label="Created {formatDateTime(repo.createdAt)}"
					/>
				</div>
			</div>

			<div
				class="bg-muted relative z-10 flex items-center gap-x-3 border-t px-4 py-2 text-xs transition-colors group-hover/drawer:border-transparent group-focus-within/drawer:border-transparent"
			>
				<Metric icon={CircleDot} value={compactNumber(repo.openIssues)} label={issuesLabel}>
					{#snippet trailing()}
						{#if stats}{@render closedCount(stats.closedIssues)}{/if}
					{/snippet}
				</Metric>
				<Metric icon={GitPullRequest} value={compactNumber(repo.openPRs)} label={prsLabel}>
					{#snippet trailing()}
						{#if stats}{@render closedCount(stats.mergedPRs)}{/if}
					{/snippet}
				</Metric>

				<!-- Date and stars, collapse away once the panel slides open -->
				<div
					class="ml-auto grid grid-cols-[1fr] overflow-hidden transition-[grid-template-columns,opacity] duration-300 ease-out group-hover/drawer:grid-cols-[0fr] group-hover/drawer:opacity-0 group-focus-within/drawer:grid-cols-[0fr] group-focus-within/drawer:opacity-0"
				>
					<div class="flex min-w-0 items-center gap-x-3 truncate">
						<Metric
							icon={History}
							value={relativeTime(repo.pushedAt)}
							label="Last updated {formatDateTime(repo.pushedAt)}"
						/>
						<Metric icon={Star} value={compactNumber(repo.stars)} label={starsLabel} />
					</div>
				</div>
			</div>
		</div>
	</div>
{:else}
	<a
		href={paths.repo(repo.owner, repo.name)}
		class="bg-card hover:border-ring/50 flex flex-col gap-3 rounded-md border p-4 transition-colors"
	>
		<div class="flex items-start justify-between gap-2">
			<span class="truncate font-medium">{repo.name}</span>
			{@render tagList()}
		</div>

		{@render description()}

		<div class="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
			{@render langLabel()}
			{#each basicStats as stat (stat.icon)}
				<span class="flex items-center gap-1"
					><Icon icon={stat.icon} size={13} />{compactNumber(stat.value)}</span
				>
			{/each}
			<Hint text="Last updated {formatDateTime(repo.pushedAt)}" class="ml-auto">
				Updated {relativeTime(repo.pushedAt)}
			</Hint>
		</div>
	</a>
{/if}
