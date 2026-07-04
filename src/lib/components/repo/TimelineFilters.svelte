<script lang="ts">
	import { Activity, Layers, Gauge, Timer, CalendarDays } from '@lucide/svelte';
	import { Switch } from '$lib/components/ui/switch';
	import Hint from '$lib/components/common/Hint.svelte';
	import SegmentedControl from '$lib/components/common/SegmentedControl.svelte';
	import SelectFilter from '$lib/components/filter/SelectFilter.svelte';
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
		},
		{
			key: 'velocity',
			label: 'Velocity',
			icon: Gauge,
			hint: 'Net of closed minus opened, are we keeping up'
		},
		{
			key: 'resolution',
			label: 'Speed',
			icon: Timer,
			hint: 'Median time to close issues and merge PRs over time'
		},
		{
			key: 'heatmap',
			label: 'Activity',
			icon: CalendarDays,
			hint: 'Activity by calendar month, year by year'
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

	const groupChoices = $derived<GroupChoice[]>(['auto', ...groupUnitsFor(base)]);
	const groupLabel = (choice: GroupChoice) => (choice === 'auto' ? 'Auto' : GROUP_LABELS[choice]);
</script>

<div class="flex flex-wrap items-center gap-2">
	<SegmentedControl
		label="Chart mode"
		options={MODES.map(({ key, label, icon, hint }) => ({ value: key, label, icon, hint }))}
		bind:value={view.mode}
	/>

	<SegmentedControl
		label="Issues or PRs"
		options={SCOPES.map(({ key, label }) => ({ value: key, label }))}
		bind:value={view.scope}
	/>

	<SelectFilter
		class="h-8 w-32"
		options={TIMELINE_WINDOWS.map(({ key, label }) => ({ value: key, label }))}
		bind:value={view.windowKey}
	/>

	<div class="ml-auto flex items-center gap-3">
		{#if view.mode === 'flow' || view.mode === 'velocity'}
			<Hint text={view.backlog ? 'Hide the open backlog line' : 'Show the open backlog line'}>
				<label class="flex items-center gap-1.5 text-xs">
					<Switch size="sm" bind:checked={view.backlog} />
					<span class="text-muted-foreground">Backlog</span>
				</label>
			</Hint>
		{/if}

		<!-- Bar grouping -->
		{#if view.mode !== 'heatmap'}
			<SegmentedControl
				label="Bar grouping"
				options={groupChoices.map((choice) => ({ value: choice, label: groupLabel(choice) }))}
				bind:value={view.group}
			/>
		{/if}
	</div>
</div>
