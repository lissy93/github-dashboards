<script lang="ts">
	import { ChartColumn, ChartArea, Users, ShieldCheck } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import { paths, APP_NAME } from '$lib/config';
	import {
		statsSummary,
		trafficSummary,
		peopleSummary,
		securitySummary
	} from '$lib/views/repo-status';
	import type { LoadResult } from '$lib/views/overview';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const section = (slug: string) => paths.repoInfoSection(data.user, data.repo.name, slug);
	const ok = <T,>(result: LoadResult<T>): T | null => (result.ok ? result.data : null);
</script>

<svelte:head>
	<title>Info · {data.repo.nameWithOwner} · {APP_NAME}</title>
	<meta
		name="description"
		content="Stats, traffic, people and security for {data.repo.nameWithOwner}"
	/>
</svelte:head>

<div class="grid gap-4 sm:grid-cols-2">
	<Panel title="Stats" icon={ChartColumn} href={section('stats')}>
		<p class="text-muted-foreground text-sm">{statsSummary(data.repo)}</p>
	</Panel>

	<Panel
		title="Traffic"
		icon={ChartArea}
		href={data.canSeeTraffic ? section('traffic') : undefined}
	>
		{#if !data.canSeeTraffic}
			<p class="text-muted-foreground text-sm">Only {data.user} can view repo traffic</p>
		{:else if data.traffic}
			{#await data.traffic}
				<p class="text-muted-foreground text-sm">Loading...</p>
			{:then res}
				{@const t = ok(res)}
				<p class="text-muted-foreground text-sm">{t ? trafficSummary(t) : 'No traffic data'}</p>
			{/await}
		{/if}
	</Panel>

	<Panel title="People" icon={Users} href={section('people')}>
		{#await data.contributors}
			<p class="text-muted-foreground text-sm">Loading...</p>
		{:then res}
			{@const c = ok(res)}
			<p class="text-muted-foreground text-sm">
				{c ? peopleSummary(c, data.repo) : 'Contributors, stargazers and forks'}
			</p>
		{/await}
	</Panel>

	<Panel title="Security" icon={ShieldCheck} href={section('security')}>
		{#await data.security}
			<p class="text-muted-foreground text-sm">Loading...</p>
		{:then res}
			{@const s = ok(res)}
			<p class="text-muted-foreground text-sm">
				{s ? securitySummary(s) : 'Security policy, checks and advisories'}
			</p>
		{/await}
	</Panel>
</div>
