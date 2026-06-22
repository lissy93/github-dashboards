<script lang="ts">
	import { ArrowRight, TriangleAlert } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$lib/components/common/Icon.svelte';
	import GithubMark from '$lib/components/common/GithubMark.svelte';
	import { APP_NAME, APP_DESCRIPTION, paths } from '$lib/config';

	let { data } = $props();

	let query = $state('');
	const examples = ['sveltejs', 'microsoft', 'torvalds'];
	const loginFailed = $derived(page.url.searchParams.get('login') === 'failed');

	// Navigate to a board for the given login
	function open(login: string) {
		const clean = login.trim().replace(/^@/, '');
		if (clean) goto(paths.user(clean));
	}
</script>

<svelte:head>
	<title>{APP_NAME}</title>
	<meta name="description" content={APP_DESCRIPTION} />
</svelte:head>

<section class="mx-auto max-w-xl space-y-6 py-16 text-center">
	<div class="space-y-2">
		<h1 class="text-3xl font-semibold">{APP_NAME}</h1>
		<p class="text-muted-foreground">{APP_DESCRIPTION}</p>
	</div>

	<form
		class="flex gap-2"
		onsubmit={(event) => {
			event.preventDefault();
			open(query);
		}}
	>
		<Input bind:value={query} placeholder="GitHub user or org" class="h-10" />
		<Button type="submit" class="h-10">Open<Icon icon={ArrowRight} /></Button>
	</form>

	<div class="text-muted-foreground flex items-center justify-center gap-2 text-sm">
		<span>Try</span>
		{#each examples as example (example)}
			<a href={paths.user(example)} class="hover:text-foreground underline underline-offset-4"
				>{example}</a
			>
		{/each}
	</div>

	{#if data.loginEnabled && !data.user}
		<div class="space-y-3 border-t pt-6">
			<p class="text-muted-foreground text-sm">Sign in for higher rate limits and your own board</p>
			<Button href="/auth/github" variant="outline" class="mx-auto h-10">
				<GithubMark />Login with GitHub
			</Button>
		</div>
	{:else if data.user}
		<div class="text-muted-foreground border-t pt-6 text-sm">
			Signed in as
			<a href={paths.user(data.user.login)} class="text-foreground underline underline-offset-4"
				>{data.user.login}</a
			>
		</div>
	{/if}

	{#if loginFailed}
		<p class="text-warning flex items-center justify-center gap-2 text-sm">
			<Icon icon={TriangleAlert} size={14} />GitHub login failed, please try again
		</p>
	{/if}
</section>
