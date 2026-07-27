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
	import type { ActivityEvent, ActivityPage, TaskData } from '$lib/types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import { revalidatingResult } from '$lib/state/revalidate.svelte';
	import { OVERVIEW_TASK_PREVIEW, OVERVIEW_ACTIVITY_PREVIEW } from '$lib/views/overview';

	let { data }: { data: PageData } = $props();

	// Freshen every SSR panel on land for a signed-in viewer
	const enabled = () => !!data.viewerLogin;
	const overview = revalidatingResult({
		url: () => `/api/${data.user}/overview?fresh=1`,
		initial: () => data.overview,
		enabled
	});
	const task = revalidatingResult<TaskData>({
		url: () => `/api/${data.user}/tasks?fresh=1&preview=${OVERVIEW_TASK_PREVIEW}`,
		initial: () => data.task,
		enabled
	});
	const activity = revalidatingResult<ActivityEvent[], ActivityPage>({
		url: () => `/api/${data.user}/activity?fresh=1&limit=${OVERVIEW_ACTIVITY_PREVIEW}`,
		initial: () => data.activity!,
		enabled: () => enabled() && !data.isOrg,
		map: (page) => page.events
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
			<TasksPreview user={data.user} result={task.result} />
			<ReposPanel
				user={data.user}
				canSeeTraffic={data.canSeeTraffic}
				repos={result.data.ownedRepos}
				capped={result.data.ownedReposCapped}
			/>
			{#if data.activity}
				<ActivityPreview user={data.user} result={activity.result} />
			{/if}
		</div>
	{:else}
		<ErrorState error={result.error} />
	{/if}
{/await}
