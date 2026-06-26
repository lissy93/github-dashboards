<script lang="ts">
	import { Activity, Layers } from '@lucide/svelte';
	import { Switch } from '$lib/components/ui/switch';
	import * as Select from '$lib/components/ui/select';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { cn } from '$lib/utils';
	import {
		TIMELINE_WINDOWS,
		groupUnitsFor,
		type TimelineView,
		type FlowMode,
		type FlowScope,
		type GroupChoice,
		type GroupUnit
	} from '$lib/views/repo';

	let { view = $bindable(), base }: { view: TimelineView; base: GroupUnit } = $props();

	const MODES: { key: FlowMode; label: string; icon: typeof Activity; hint: string }[] = [
		{
			key: 'flow',
			label: 'Flow',
			icon: Activity,
			hint: 'Opened vs closed each period, with the open backlog'
		},
		{
			key: 'lifecycle',
			label: 'Lifecycle',
			icon: Layers,
			hint: 'Total ever created, stacked by state over time'
		}
	];
	const SCOPES: { key: FlowScope; label: string }[] = [
		{ key: 'issues', label: 'Issues' },
		{ key: 'prs', label: 'PRs' },
		{ key: 'both', label: 'Both' }
	];
	const GROUP_LABELS: Record<GroupUnit, string> = {
		week: 'Week',
		month: 'Month',
		quarter: 'Quarter',
		year: 'Year'
	};

	const windowLabel = $derived(
		TIMELINE_WINDOWS.find((window) => window.key === view.windowKey)?.label ?? ''
	);
	const groupChoices = $derived<GroupChoice[]>(['auto', ...groupUnitsFor(base)]);
	const groupLabel = (choice: GroupChoice) => (choice === 'auto' ? 'Auto' : GROUP_LABELS[choice]);
</script>

<div class="flex flex-wrap items-center gap-2">
	<!-- Chart mode -->
	<div class="bg-muted inline-flex rounded-md p-0.5 text-xs">
		{#each MODES as mode (mode.key)}
			<Hint text={mode.hint}>
				<button
					type="button"
					aria-pressed={view.mode === mode.key}
					onclick={() => (view.mode = mode.key)}
					class={cn(
						'flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors',
						view.mode === mode.key
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground'
					)}
				>
					<Icon icon={mode.icon} size={13} />{mode.label}
				</button>
			</Hint>
		{/each}
	</div>

	<!-- Issues, PRs or both -->
	<div class="bg-muted inline-flex rounded-md p-0.5 text-xs">
		{#each SCOPES as scope (scope.key)}
			<button
				type="button"
				aria-pressed={view.scope === scope.key}
				onclick={() => (view.scope = scope.key)}
				class={cn(
					'rounded px-2.5 py-1.5 transition-colors',
					view.scope === scope.key
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground'
				)}
			>
				{scope.label}
			</button>
		{/each}
	</div>

	<Select.Root type="single" bind:value={view.windowKey}>
		<Select.Trigger class="h-8 w-32">{windowLabel}</Select.Trigger>
		<Select.Content>
			{#each TIMELINE_WINDOWS as window (window.key)}
				<Select.Item value={window.key}>{window.label}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>

	<div class="ml-auto flex items-center gap-3">
		{#if view.mode === 'flow'}
			<Hint text={view.backlog ? 'Hide the open backlog line' : 'Show the open backlog line'}>
				<label class="flex items-center gap-1.5 text-xs">
					<Switch size="sm" bind:checked={view.backlog} />
					<span class="text-muted-foreground">Backlog</span>
				</label>
			</Hint>
		{/if}

		<!-- Bar grouping -->
		<div class="bg-muted inline-flex rounded-md p-0.5 text-xs">
			{#each groupChoices as choice (choice)}
				<button
					type="button"
					aria-pressed={view.group === choice}
					onclick={() => (view.group = choice)}
					class={cn(
						'rounded px-2 py-1.5 transition-colors',
						view.group === choice
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground'
					)}
				>
					{groupLabel(choice)}
				</button>
			{/each}
		</div>
	</div>
</div>
