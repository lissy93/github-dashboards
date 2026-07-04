import type { Repo, RepoTrafficData } from '$lib/types';
import type { SortFilterConfig, SortDef } from '$lib/utils/sort-filter';

// Build a sort/filter config for a repo list, deriving languages from the data.
// When traffic is provided, a Traffic sort is added (disabled while pending).
export function repoConfig(repos: Repo[], traffic?: RepoTrafficData): SortFilterConfig<Repo> {
	const languages = [...new Set(repos.map((repo) => repo.language?.name).filter(Boolean))].sort();

	const sorts: SortDef<Repo>[] = [
		{ key: 'stars', label: 'Stars', value: (repo) => repo.stars },
		{ key: 'updated', label: 'Updated', value: (repo) => Date.parse(repo.pushedAt) },
		{ key: 'created', label: 'Newest', value: (repo) => Date.parse(repo.createdAt) },
		{ key: 'forks', label: 'Forks', value: (repo) => repo.forks },
		{ key: 'watchers', label: 'Watchers', value: (repo) => repo.watchers },
		{ key: 'issues', label: 'Open issues', value: (repo) => repo.openIssues },
		{ key: 'prs', label: 'Open PRs', value: (repo) => repo.openPRs },
		{ key: 'size', label: 'Size', value: (repo) => repo.diskUsage },
		{ key: 'name', label: 'Name', value: (repo) => repo.name.toLowerCase() }
	];

	if (traffic) {
		sorts.splice(
			1,
			0,
			{
				key: 'traffic',
				label: 'Visits',
				value: (repo) => traffic.views[repo.nameWithOwner] ?? -1,
				disabled: traffic.pending
			},
			{
				key: 'clones',
				label: 'Clones',
				value: (repo) => traffic.clones[repo.nameWithOwner] ?? -1,
				disabled: traffic.pending
			}
		);
	}

	return {
		search: (repo) => `${repo.name} ${repo.description ?? ''}`,
		sorts,
		filters: [
			{
				key: 'language',
				label: 'Languages',
				options: languages.map((name) => ({ value: name as string, label: name as string })),
				test: (repo, value) => repo.language?.name === value
			},
			{
				key: 'type',
				label: 'Types',
				options: [
					{ value: 'source', label: 'Sources' },
					{ value: 'fork', label: 'Forks' },
					{ value: 'archived', label: 'Archived' }
				],
				test: (repo, value) =>
					value === 'fork'
						? repo.isFork
						: value === 'archived'
							? repo.isArchived
							: !repo.isFork && !repo.isArchived
			}
		]
	};
}
