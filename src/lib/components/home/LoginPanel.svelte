<script lang="ts">
	import { ArrowRight, Check, TriangleAlert } from '@lucide/svelte';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$lib/components/common/Icon.svelte';
	import GithubMark from '$lib/components/common/GithubMark.svelte';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import { iconFor } from '$lib/components/layout/nav';
	import { paths } from '$lib/config';
	import { findPage, pageHref, USER_PAGES } from '$lib/config/pages';
	import { cn } from '$lib/utils';
	import type { SessionUser } from '$lib/types';

	let { user, class: className }: { user: SessionUser | null; class?: string } = $props();

	const loginFailed = $derived(page.url.searchParams.get('login') === 'failed');
	const benefits = [
		'Repository traffic and analytics',
		'Custom activity and task boards',
		'Monitor your repo health and metrics',
		'Higher API rate limits'
	];

	// Quick links to the signed-in user's own pages, order tuned for the welcome card
	const USER_PILL_SLUGS = ['stats', 'analytics', 'repos', 'activity', 'tasks'];
	const pills = $derived(
		user
			? USER_PILL_SLUGS.map((slug) => ({
					href: pageHref(paths.user(user.login), slug),
					label: findPage(USER_PAGES, slug)?.label ?? slug,
					icon: iconFor('user', slug)
				}))
			: []
	);
</script>

<Card.Root class={cn('gap-4', className)}>
	{#if user}
		<Card.Header>
			<h2 class="text-base leading-normal font-medium">Welcome back</h2>
			<Card.Description>Pick up where you left off</Card.Description>
		</Card.Header>
		<Card.Content class="flex h-full flex-col gap-4">
			<div class="flex items-center gap-3 dark:bg-input/30 border-input rounded p-4">
				<UserAvatar login={user.login} src={user.avatarUrl} size="lg" />
				<div class="min-w-0">
					<p class="truncate font-medium">{user.name ?? user.login}</p>
					<p class="text-muted-foreground truncate text-xs">@{user.login}</p>
				</div>
			</div>

			<div class="text-muted-foreground flex flex-wrap gap-2 text-xs">
				{#each pills as pill (pill.href)}
					<a
						href={pill.href}
						class="hover:border-ring hover:text-foreground inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors"
					>
						{#if pill.icon}<Icon icon={pill.icon} size={13} />{/if}{pill.label}
					</a>
				{/each}
			</div>

			<Button href={paths.user(user.login)} class="mt-auto h-10 w-full">
				Open your board<Icon icon={ArrowRight} />
			</Button>
		</Card.Content>
	{:else}
		<Card.Header>
			<h2 class="text-base leading-normal font-medium">Sign in</h2>
			<Card.Description>Bring your own GitHub account (read-only)</Card.Description>
		</Card.Header>
		<Card.Content class="flex h-full flex-col justify-between gap-4">
			<ul class="text-muted-foreground space-y-1.5 text-sm">
				{#each benefits as benefit (benefit)}
					<li class="flex items-start gap-2">
						<Icon icon={Check} size={14} class="text-success mt-0.5" />{benefit}
					</li>
				{/each}
			</ul>
			<div class="space-y-2">
				<Button href="/auth/github" class="h-10 w-full">
					<GithubMark />Login with GitHub
				</Button>
				{#if loginFailed}
					<p role="status" class="text-warning flex items-center gap-1.5 text-xs">
						<Icon icon={TriangleAlert} size={13} />GitHub login failed, please try again
					</p>
				{/if}
			</div>
		</Card.Content>
	{/if}
</Card.Root>
