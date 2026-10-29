<script lang="ts">
	import './layout.css';
	import { TriangleAlert, CircleAlert, Info } from '@lucide/svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import LoadProgress from '$lib/components/layout/LoadProgress.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import PanelStatusReport from '$lib/components/common/PanelStatusReport.svelte';
	import { providePanelStatus } from '$lib/state/panel-status.svelte';
	import { provideNavTree } from '$lib/state/nav-tree.svelte';
	import { session } from '$lib/state/session.svelte';

	let { children, data } = $props();

	const status = providePanelStatus();
	provideNavTree();

	// A rate limit means every panel is on cached data, so flag it in the status report
	// rather than letting it read all-green
	$effect(() => {
		if (data.rateLimited)
			status.set({
				id: 'rate-limit',
				title: 'Live data',
				cause: 'rate_limited',
				detail: data.rateLimitResetsIn
					? `Rate limited, showing cached data, resumes in ${data.rateLimitResetsIn}`
					: 'Rate limited, showing cached data'
			});
		else status.remove('rate-limit');
	});

	// A revoked sign-in leaves every panel on cached data, which used to read all-green
	const signInRejected = $derived(!!data.user && session.expired);
	$effect(() => {
		if (signInRejected)
			status.set({
				id: 'session',
				title: 'GitHub sign-in',
				cause: 'needs_auth',
				detail: 'GitHub rejected your sign-in, sign in again to refresh data'
			});
		else status.remove('session');
	});

	// Top-of-page banner styles by severity: info nudges, warning degrades, error blocks
	type BannerLevel = 'info' | 'warning' | 'error';
	const LEVELS: Record<BannerLevel, { icon: typeof TriangleAlert; class: string }> = {
		info: { icon: Info, class: 'bg-info/10 text-info' },
		warning: { icon: TriangleAlert, class: 'bg-warning/10 text-warning' },
		error: { icon: CircleAlert, class: 'bg-danger/10 text-danger' }
	};
</script>

<svelte:head><link rel="icon" href="/logo.svg" type="image/svg+xml" /></svelte:head>

<LoadProgress />

<a
	href="#main"
	class="bg-background focus:ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-2 focus:outline-none"
>
	Skip to content
</a>

<TopBar user={data.user} loginEnabled={data.loginEnabled} />
{#snippet banner(level: BannerLevel, content: import('svelte').Snippet)}
	{@const meta = LEVELS[level]}
	<div
		role="status"
		class="{meta.class} flex items-center justify-center gap-2 border-b px-4 py-1.5 text-xs"
	>
		<Icon icon={meta.icon} size={14} />
		{@render content()}
	</div>
{/snippet}

{#if data.rateLimited}
	{#snippet rateText()}
		GitHub rate limit reached.
		{#if data.rateLimitResetsIn}Fresh data resumes in {data.rateLimitResetsIn}.{/if}
		{#if !data.user && data.loginEnabled}
			<a href="/auth/github" class="underline underline-offset-2">Sign in</a> for a higher limit.{/if}
	{/snippet}
	{@render banner('error', rateText)}
{/if}
{#if signInRejected}
	{#snippet sessionText()}
		GitHub rejected your sign-in, it may have been revoked, so data can't refresh.
		<a href="/auth/github" class="underline underline-offset-2">Sign in again</a>
	{/snippet}
	{@render banner('error', sessionText)}
{/if}
{#if data.storageDegraded}
	{#snippet storageText()}Storage unavailable, showing live data without cache{/snippet}
	{@render banner('warning', storageText)}
{/if}
{#if data.tokenMissing && !data.loginEnabled}
	{#snippet tokenText()}No GitHub token set, data is limited{/snippet}
	{@render banner('warning', tokenText)}
{/if}
{#if !data.user && data.loginEnabled && !data.rateLimited}
	{#snippet guestText()}
		You're not signed in, so some data is limited.
		<a href="/auth/github" class="underline underline-offset-2">Sign in with GitHub</a> for full access.
	{/snippet}
	{@render banner('info', guestText)}
{/if}
<main id="main" class="mx-auto max-w-7xl px-4 py-6">
	{@render children()}
	<PanelStatusReport />
</main>
