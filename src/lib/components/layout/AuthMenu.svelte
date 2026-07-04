<script lang="ts">
	import { LogOut } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$lib/components/common/Icon.svelte';
	import GithubMark from '$lib/components/common/GithubMark.svelte';
	import { paths } from '$lib/config';
	import type { SessionUser } from '$lib/types';

	let { user, loginEnabled }: { user: SessionUser | null; loginEnabled: boolean } = $props();
</script>

{#if user}
	<div class="flex items-center gap-2">
		<a
			href={paths.user(user.login)}
			aria-label="Your board"
			class="hover:text-foreground flex items-center gap-2 text-sm font-medium"
		>
			<img src={user.avatarUrl} alt="" class="size-7 rounded-full" />
			<span class="hidden sm:inline">{user.name ?? user.login}</span>
		</a>
		<form method="POST" action="/auth/logout">
			<Button type="submit" variant="ghost" size="icon" class="size-9" aria-label="Sign out">
				<Icon icon={LogOut} />
			</Button>
		</form>
	</div>
{:else if loginEnabled}
	<Button href="/auth/github" variant="outline" size="sm">
		<GithubMark />
		<span class="hidden sm:inline">Login</span>
	</Button>
{/if}
