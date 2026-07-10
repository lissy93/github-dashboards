<script lang="ts">
	import './layout.css';
	import { TriangleAlert } from '@lucide/svelte';
	import favicon from '$lib/assets/favicon.svg';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import PanelStatusReport from '$lib/components/common/PanelStatusReport.svelte';
	import { providePanelStatus } from '$lib/state/panel-status.svelte';
	import { provideNavTree } from '$lib/state/nav-tree.svelte';

	let { children, data } = $props();

	providePanelStatus();
	provideNavTree();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<a
	href="#main"
	class="bg-background focus:ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-2 focus:outline-none"
>
	Skip to content
</a>

<TopBar user={data.user} loginEnabled={data.loginEnabled} />
{#snippet warning(children: import('svelte').Snippet)}
	<div
		role="status"
		class="bg-warning/10 text-warning flex items-center justify-center gap-2 border-b px-4 py-1.5 text-xs"
	>
		<Icon icon={TriangleAlert} size={14} />
		{@render children()}
	</div>
{/snippet}

{#if data.storageDegraded}
	{#snippet storageText()}Storage unavailable, showing live data without cache{/snippet}
	{@render warning(storageText)}
{/if}
{#if data.tokenMissing && !data.user}
	{#snippet tokenText()}
		No GitHub token set, data is limited.{#if data.loginEnabled}
			<a href="/auth/github" class="underline underline-offset-2">Sign in with GitHub</a> for full access{/if}
	{/snippet}
	{@render warning(tokenText)}
{/if}
<main id="main" class="mx-auto max-w-7xl px-4 py-6">
	{@render children()}
	<PanelStatusReport />
</main>
