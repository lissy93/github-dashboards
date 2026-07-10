<script lang="ts">
	import SubNav from '$lib/components/layout/SubNav.svelte';
	import { sectionPills, navViewer } from '$lib/components/layout/nav';
	import { paths } from '$lib/config';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Overview plus the visible task lists, authored lists drop off org boards
	const items = $derived(
		sectionPills(
			'user',
			'tasks',
			paths.user(data.user),
			data.user,
			navViewer(data.user, data.viewerLogin),
			data.isOrg
		)
	);
</script>

<div class="space-y-5">
	<SubNav {items} label="Task lists" />
	{@render children()}
</div>
