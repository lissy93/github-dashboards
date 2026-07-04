<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import Notice from '$lib/components/common/Notice.svelte';
	import { Button } from '$lib/components/ui/button';
	import GithubMark from '$lib/components/common/GithubMark.svelte';

	// Lock notice for owner-only pages, with a login nudge for signed-out visitors
	let {
		title,
		user,
		subject,
		loggedIn
	}: { title: string; user: string; subject: string; loggedIn: boolean } = $props();
</script>

<Notice
	icon={Lock}
	{title}
	message={loggedIn ? `Only ${user} can view ${subject}` : `Sign in as ${user} to view ${subject}`}
/>
{#if !loggedIn}
	<div class="-mt-12 flex justify-center">
		<Button href="/auth/github" variant="outline" class="h-10">
			<GithubMark />Login with GitHub
		</Button>
	</div>
{/if}
