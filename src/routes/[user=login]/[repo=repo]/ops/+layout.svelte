<script lang="ts">
	import RepoSubNav from '$lib/components/layout/RepoSubNav.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<div class="space-y-5">
	<RepoSubNav section="ops" user={data.user} repo={data.repo.name} viewerLogin={data.viewerLogin} />
	{@render children()}
</div>
