<script lang="ts">
	import MainNav from '$lib/components/layout/MainNav.svelte';
	import RepoHeader from '$lib/components/repo/RepoHeader.svelte';
	import { repoNav } from '$lib/components/layout/nav';
	import type { RepoStats } from '$lib/types';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const viewer = $derived({
		loggedIn: !!data.viewerLogin,
		isOwner: !!data.viewerLogin && data.viewerLogin.toLowerCase() === data.user.toLowerCase()
	});
	const items = $derived(repoNav(data.user, data.repo.name, viewer));

	// Header renders at once from the loaded repo, heavier counts fill in when settled
	let stats = $state<RepoStats>();
	$effect(() => {
		stats = undefined;
		Promise.resolve(data.stats).then((result) => {
			stats = result.ok ? (result.data ?? undefined) : undefined;
		});
	});
</script>

<div class="space-y-5">
	<RepoHeader repo={data.repo} {stats} />
	<MainNav {items} label="{data.repo.nameWithOwner} sections" />
	{@render children()}
</div>
