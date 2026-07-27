<script lang="ts">
	import { FolderGit2 } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import ContributionsList from '$lib/components/contributions/ContributionsList.svelte';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import { APP_NAME } from '$lib/config';
	import { progressiveAuthored } from '$lib/state/progressive.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const contributions = progressiveAuthored(() => ({
		user: data.user,
		contributions: data.result,
		viewerLogin: data.viewerLogin
	}));
</script>

<PageMeta
	title={`Contributions · ${data.user}`}
	description={`Repositories ${data.user} has contributed to on ${APP_NAME}, by year`}
/>

<AsyncPanel
	title="Contributions"
	icon={FolderGit2}
	result={contributions.result}
	empty={(data) => data.complete && !data.years.length}
	emptyText="No contributions found"
	cause={contributions.cause}
	detail={contributions.detail}
>
	{#snippet children(data)}
		<ContributionsList {data} />
	{/snippet}
</AsyncPanel>
