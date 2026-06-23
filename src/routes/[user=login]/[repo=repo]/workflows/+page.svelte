<script lang="ts">
	import { Workflow } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import WorkflowTable from '$lib/components/repo/WorkflowTable.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Workflows · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<AsyncPanel
	title="Workflows"
	icon={Workflow}
	result={data.workflows}
	count={(wf) => wf.totalWorkflows}
	capped={(wf) => wf.sampled}
	empty={(wf) => wf.workflows.length === 0}
	emptyText="No GitHub Actions workflows"
>
	{#snippet children(wf)}
		<WorkflowTable workflows={wf.workflows} />
	{/snippet}
</AsyncPanel>
