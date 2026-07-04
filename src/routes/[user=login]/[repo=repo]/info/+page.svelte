<script lang="ts">
	import { ChartColumn, ChartArea, Users, ShieldCheck } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import SummaryPanel from '$lib/components/common/SummaryPanel.svelte';
	import { paths } from '$lib/config';
	import {
		statsSummary,
		trafficSummary,
		peopleSummary,
		securitySummary
	} from '$lib/views/repo-status';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();

	const section = (slug: string) => paths.repoInfoSection(data.user, data.repo.name, slug);
</script>

<PageMeta
	title={`Info · ${data.repo.nameWithOwner}`}
	description={`Stats, traffic, people and security for ${data.repo.nameWithOwner}`}
/>

<div class="grid gap-4 sm:grid-cols-2">
	<Panel title="Stats" icon={ChartColumn} href={section('stats')}>
		<p class="text-muted-foreground text-sm">{statsSummary(data.repo)}</p>
	</Panel>

	{#if data.canSeeTraffic && data.traffic}
		<SummaryPanel
			title="Traffic"
			icon={ChartArea}
			href={section('traffic')}
			result={data.traffic}
			summary={trafficSummary}
			fallback="No traffic data"
		/>
	{:else}
		<Panel title="Traffic" icon={ChartArea}>
			<p class="text-muted-foreground text-sm">Only {data.user} can view repo traffic</p>
		</Panel>
	{/if}

	<SummaryPanel
		title="People"
		icon={Users}
		href={section('people')}
		result={data.contributors}
		summary={(c) => peopleSummary(c, data.repo)}
		fallback="Contributors, stargazers and forks"
	/>

	<SummaryPanel
		title="Security"
		icon={ShieldCheck}
		href={section('security')}
		result={data.security}
		summary={securitySummary}
		fallback="Security policy, checks and advisories"
	/>
</div>
