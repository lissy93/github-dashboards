<script lang="ts">
	import { Star } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StackedAreaChart from '$lib/components/charts/StackedAreaChart.svelte';
	import { loadJson } from '$lib/state/api';
	import { starHistory, type StarBreakdown } from '$lib/views/stats';
	import { restrictedGate } from '$lib/config/status';
	import type { DisplayError } from '$lib/utils/errors';

	let { user, loggedIn }: { user: string; loggedIn: boolean } = $props();

	// undefined while loading, then the reconstructed breakdown (possibly empty)
	let raw = $state<StarBreakdown>();
	let error = $state<DisplayError>();
	let loaded = $state(false);
	const stack = $derived(raw ? starHistory(raw) : null);
	const gate = $derived(raw?.restricted ? restrictedGate('star history', loggedIn) : null);
	// Only nudge about partial coverage when the list is not gated as restricted
	const covering = $derived(!gate && !!raw?.totalRepos && raw.coveredRepos !== raw.totalRepos);

	// Reload when client-side navigation changes the viewed user
	$effect(() => {
		const login = user;
		let active = true;
		raw = undefined;
		error = undefined;
		loaded = false;
		loadJson<StarBreakdown>(login, 'star-history').then((result) => {
			if (!active) return;
			loaded = true;
			if (result.ok) raw = result.data;
			else error = result.error;
		});
		return () => (active = false);
	});
</script>

<Panel
	title="Star history"
	icon={Star}
	loading={!loaded}
	{error}
	empty={!!gate || !stack || stack.days.length < 2}
	emptyText={gate ? gate.text : 'Not enough history yet'}
	emptyHint={gate?.hint}
	cause={gate ? gate.cause : covering ? 'partial' : undefined}
	detail={covering
		? `Covers ${raw?.coveredRepos ?? 0} of ${raw?.totalRepos} repos, more build up over visits`
		: undefined}
>
	{#snippet actions()}
		{#if stack && stack.days.length >= 2}
			{@const days = Math.max(
				1,
				(Date.parse(stack.days.at(-1)!) - Date.parse(stack.days[0])) / 86400000
			)}
			<span class="text-muted-foreground text-xs tabular-nums">
				Average {((stack.total.at(-1)! - stack.total[0]) / days).toFixed(1)} stars per day{covering
					? ` · ${raw?.coveredRepos ?? 0} of ${raw?.totalRepos} repos`
					: ''}
			</span>
		{:else if covering}
			<span class="text-muted-foreground text-xs tabular-nums">
				Building history for {raw?.coveredRepos ?? 0} of {raw?.totalRepos} repos
			</span>
		{/if}
	{/snippet}
	{#if stack}
		<StackedAreaChart data={stack} />
	{/if}
</Panel>
