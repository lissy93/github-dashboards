<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import { DEPLOY_WINDOWS, type DeploymentView } from '$lib/views/repo-deployments';

	// windowKey scopes the frequency chart, environment scopes the recent table
	let {
		view = $bindable(),
		environments
	}: { view: DeploymentView; environments: { value: string; label: string }[] } = $props();

	const windowLabel = $derived(
		DEPLOY_WINDOWS.find((window) => window.key === view.windowKey)?.label ?? ''
	);
	const envLabel = $derived(
		environments.find((env) => env.value === view.environment)?.label ?? 'All environments'
	);
</script>

<div class="flex flex-wrap items-center gap-2">
	<Select.Root type="single" bind:value={view.windowKey}>
		<Select.Trigger class="h-9 w-36">{windowLabel}</Select.Trigger>
		<Select.Content>
			{#each DEPLOY_WINDOWS as window (window.key)}
				<Select.Item value={window.key}>{window.label}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>

	{#if environments.length > 1}
		<Select.Root type="single" bind:value={view.environment}>
			<Select.Trigger class="h-9 w-44">{envLabel}</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All environments</Select.Item>
				{#each environments as env (env.value)}
					<Select.Item value={env.value}>{env.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	{/if}
</div>
