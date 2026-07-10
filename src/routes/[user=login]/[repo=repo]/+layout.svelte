<script lang="ts">
	import MainNav from '$lib/components/layout/MainNav.svelte';
	import RepoHeader from '$lib/components/repo/RepoHeader.svelte';
	import { repoNav, navViewer } from '$lib/components/layout/nav';
	import { useNavTree } from '$lib/state/nav-tree.svelte';
	import { paths } from '$lib/config';
	import type { RepoStats } from '$lib/types';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const viewer = $derived(navViewer(data.user, data.viewerLogin));
	const items = $derived(repoNav(data.user, data.repo.name, viewer));

	// Feed the mobile drawer the repo tree plus a link back up to the owner
	const navTree = useNavTree();
	$effect(() => {
		navTree?.set({
			label: data.repo.nameWithOwner,
			backLink: { label: `Back to ${data.user}`, href: paths.user(data.user) },
			items
		});
		return () => navTree?.clear();
	});

	// Header renders at once from the loaded repo, heavier counts fill in when settled
	let stats = $state<RepoStats>();
	$effect(() => {
		let active = true;
		stats = undefined;
		Promise.resolve(data.stats).then((result) => {
			if (active) stats = result.ok ? (result.data ?? undefined) : undefined;
		});
		return () => {
			active = false;
		};
	});
</script>

<div class="space-y-5">
	<RepoHeader repo={data.repo} {stats} />
	<MainNav {items} label="{data.repo.nameWithOwner} sections" />
	{@render children()}
</div>
