<script lang="ts">
	import { GitPullRequest, CircleDot, BookMarked, Activity } from '@lucide/svelte';
	import ProfileCard from '$lib/components/profile/ProfileCard.svelte';
	import TasksPreview from '$lib/components/overview/TasksPreview.svelte';
	import ReposPanel from '$lib/components/overview/ReposPanel.svelte';
	import ActivityPreview from '$lib/components/overview/ActivityPreview.svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import { revalidatingResult } from '$lib/state/revalidate.svelte';

	let { data }: { data: PageData } = $props();

	const overview = revalidatingResult({
		url: () => `/api/${data.user}/overview?fresh=1`,
		initial: () => data.overview,
		enabled: () => !!data.viewerLogin
	});
</script>

<PageMeta
	title={`${data.user}`}
	description={`${data.user} on ${APP_NAME}: repos, stats and activity`}
/>

{#await overview.result}
	<div class="space-y-5">
		<Card.Root class="flex flex-row items-center gap-4 p-4 sm:p-5">
			<Skeleton class="size-16 rounded-md sm:size-20" />
			<div class="space-y-2">
				<Skeleton class="h-5 w-44" />
				<Skeleton class="h-4 w-64" />
				<Skeleton class="h-3 w-52" />
			</div>
		</Card.Root>
		<div class="grid gap-5 lg:grid-cols-2">
			<Panel title="PRs to review" icon={GitPullRequest} loading />
			<Panel title="Issues to review" icon={CircleDot} loading />
		</div>
		<Panel title="Repositories" icon={BookMarked} loading />
		<Panel title="Activity" icon={Activity} loading />
	</div>
{:then result}
	{#if result.ok}
		<div class="space-y-5">
			<ProfileCard profile={result.data.profile} />
			<TasksPreview user={data.user} result={data.task} />
			<ReposPanel
				user={data.user}
				canSeeTraffic={data.canSeeTraffic}
				repos={result.data.ownedRepos}
				capped={result.data.ownedReposCapped}
			/>
			{#if data.activity}
				<ActivityPreview user={data.user} result={data.activity} />
			{/if}
		</div>
	{:else}
		<ErrorState error={result.error} />
	{/if}
{/await}
