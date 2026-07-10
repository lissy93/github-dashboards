<script lang="ts">
	import SubNav from '$lib/components/layout/SubNav.svelte';
	import { sectionPills, navViewer } from '$lib/components/layout/nav';
	import { paths } from '$lib/config';

	// Always-visible pills for a repo section's sub-pages, Overview first
	let {
		section,
		user,
		repo,
		viewerLogin
	}: { section: string; user: string; repo: string; viewerLogin: string | null } = $props();

	const items = $derived(
		sectionPills('repo', section, paths.repo(user, repo), user, navViewer(user, viewerLogin), false)
	);
</script>

<SubNav {items} />
