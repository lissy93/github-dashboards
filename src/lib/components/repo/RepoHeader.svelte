<script lang="ts">
	import {
		Star,
		GitFork,
		Eye,
		CircleDot,
		GitPullRequest,
		GitCommit,
		HardDrive,
		Scale,
		Tag,
		Calendar,
		Archive,
		GitBranch,
		Lock,
		ExternalLink
	} from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import Icon from '$lib/components/common/Icon.svelte';
	import StatTile from '$lib/components/common/StatTile.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import {
		compactNumber,
		formatNumber,
		formatSize,
		formatDate,
		formatDateTime
	} from '$lib/utils/format';
	import type { Repo, RepoStats } from '$lib/types';

	let { repo, stats }: { repo: Repo; stats?: RepoStats } = $props();

	// Closed and merged totals arrive with the lazy stats, so append them once loaded
	const issuesHint = $derived(
		`Currently open issues. ${formatNumber(repo.openIssues)} open` +
			(stats ? `, ${formatNumber(stats.closedIssues)} closed` : '')
	);
	const prsHint = $derived(
		`Currently open pull requests. ${formatNumber(repo.openPRs)} open` +
			(stats
				? `, ${formatNumber(stats.mergedPRs)} merged, ${formatNumber(stats.closedPRs)} closed`
				: '')
	);

	const tags = $derived(
		[
			repo.isArchived && { icon: Archive, label: 'Archived' },
			repo.isFork && { icon: GitBranch, label: 'Fork' },
			repo.isPrivate && { icon: Lock, label: 'Private' }
		].filter(Boolean) as { icon: typeof Archive; label: string }[]
	);

	const meta = $derived(
		[
			repo.language && { dot: repo.language.color, text: repo.language.name },
			repo.license && { icon: Scale, text: repo.license },
			stats?.latestRelease && {
				icon: Tag,
				text: stats.latestRelease.tag,
				title: `Released ${formatDateTime(stats.latestRelease.publishedAt)}`
			},
			stats && { icon: GitCommit, text: `${compactNumber(stats.commits)} commits` },
			repo.diskUsage > 0 && { icon: HardDrive, text: formatSize(repo.diskUsage) },
			{ icon: Calendar, text: `Created ${formatDate(repo.createdAt)}` }
		].filter(Boolean) as {
			icon?: typeof Scale;
			dot?: string | null;
			text: string;
			title?: string;
		}[]
	);

	const tiles = $derived([
		{
			label: 'Stars',
			value: compactNumber(repo.stars),
			icon: Star,
			hint: `Users who have starred this repo. ${formatNumber(repo.stars)} total`
		},
		{
			label: 'Forks',
			value: compactNumber(repo.forks),
			icon: GitFork,
			hint: `Times this repo has been forked. ${formatNumber(repo.forks)} total`
		},
		{
			label: 'Watchers',
			value: compactNumber(repo.watchers),
			icon: Eye,
			hint: `Users watching this repo for activity. ${formatNumber(repo.watchers)} total`
		},
		{
			label: 'Open issues',
			value: compactNumber(repo.openIssues),
			icon: CircleDot,
			hint: issuesHint
		},
		{ label: 'Open PRs', value: compactNumber(repo.openPRs), icon: GitPullRequest, hint: prsHint }
	]);
</script>

<Card.Root class="p-4 sm:p-5">
	<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
		<div class="flex min-w-0 grow flex-col gap-3">
			<div class="flex flex-wrap items-center gap-2">
				<h1 class="flex min-w-0 items-baseline gap-1.5 text-lg font-semibold">
					<span class="text-muted-foreground font-normal">{repo.owner}/</span>
					<a
						href={repo.url}
						target="_blank"
						rel="noopener noreferrer"
						class="truncate hover:underline"
					>
						{repo.name}
					</a>
				</h1>
				<a
					href={repo.url}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Open on GitHub"
					class="text-muted-foreground hover:text-foreground"
				>
					<Icon icon={ExternalLink} size={14} />
				</a>
				{#each tags as tag (tag.label)}
					<Badge variant="outline" class="gap-1">
						<Icon icon={tag.icon} size={11} />{tag.label}
					</Badge>
				{/each}
			</div>
			{#if repo.description}
				<p class="text-muted-foreground max-w-prose text-sm">{repo.description}</p>
			{/if}
			<div class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
				{#each meta as item (item.text)}
					<Hint text={item.title} class="gap-1.5">
						{#if item.dot !== undefined}
							<span
								class="size-2.5 rounded-full"
								style="background-color: {item.dot ?? 'var(--muted-foreground)'}"
							></span>
						{:else if item.icon}<Icon icon={item.icon} size={13} />{/if}
						{item.text}
					</Hint>
				{/each}
			</div>
		</div>
		<div
			class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:ml-auto lg:flex lg:shrink-0 lg:justify-end lg:gap-8"
		>
			{#each tiles as tile (tile.label)}
				<StatTile label={tile.label} value={tile.value} icon={tile.icon} hint={tile.hint} />
			{/each}
		</div>
	</div>
</Card.Root>
