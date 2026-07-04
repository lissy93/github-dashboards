<script lang="ts">
	import SelectFilter from '$lib/components/filter/SelectFilter.svelte';
	import { DEPLOY_WINDOWS, type DeploymentView } from '$lib/views/repo-deployments';

	// windowKey scopes the frequency chart, environment scopes the recent table
	let {
		view = $bindable(),
		environments
	}: { view: DeploymentView; environments: { value: string; label: string }[] } = $props();
</script>

<div class="flex flex-wrap items-center gap-2">
	<SelectFilter
		class="h-9 w-36"
		options={DEPLOY_WINDOWS.map(({ key, label }) => ({ value: key, label }))}
		bind:value={view.windowKey}
	/>

	{#if environments.length > 1}
		<SelectFilter
			class="h-9 w-44"
			options={environments}
			allLabel="All environments"
			bind:value={view.environment}
		/>
	{/if}
</div>
