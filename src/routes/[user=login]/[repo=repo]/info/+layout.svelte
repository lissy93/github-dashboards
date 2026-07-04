<script lang="ts">
	import RepoSubNav from '$lib/components/layout/RepoSubNav.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<div class="space-y-5">
	<RepoSubNav
		section="info"
		user={data.user}
		repo={data.repo.name}
		canSeeTraffic={data.canSeeTraffic}
	/>
	{@render children()}
</div>
