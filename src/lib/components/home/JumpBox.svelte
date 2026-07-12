<script lang="ts">
	import { ChevronDown, CornerDownLeft, TriangleAlert } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Icon from '$lib/components/common/Icon.svelte';
	import { iconFor } from '$lib/components/layout/nav';
	import { parseGithubInput, quickLinks } from '$lib/utils/github-input';
	import { cn } from '$lib/utils';

	let { class: className }: { class?: string } = $props();

	let query = $state('');
	let rejected = $state(false);
	const target = $derived(parseGithubInput(query));
	const links = $derived(target ? quickLinks(target) : []);
	const scope = $derived(target?.repo ? 'repo' : 'user');

	const kindWords = { user: 'user', repo: 'repo', 'repo-page': 'page' } as const;

	// Showcase samples for the Try chips, tweak freely: page is a goard sub-path
	const EXAMPLES: { user: string; repo?: string; page?: string }[] = [
		{ user: 'lissy93', page: 'stats' },
		{ user: 'sveltejs', repo: 'svelte', page: 'code/supply-chain' },
		{ user: 'torvalds', repo: 'linux', page: 'code/activity' },
		{ user: 'anthropics', repo: 'claude-code' }
	];

	// Each sample becomes a chip: href plus a name with an optional page suffix
	const chips = EXAMPLES.map(({ user, repo, page }) => ({
		href: '/' + [user, repo, page].filter(Boolean).join('/'),
		name: repo ? `${user}/${repo}` : user,
		page: page?.split('/').pop()
	}));

	// Open the parsed target, or flag the input as unrecognised
	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (target) goto(target.href);
		else rejected = true;
	}
</script>

<Card.Root class={cn('gap-4', className)}>
	<Card.Header>
		<h2 class="text-base leading-normal font-medium">Open anything</h2>
		<Card.Description>Enter a GitHub user or repo</Card.Description>
	</Card.Header>
	<Card.Content class="flex h-full flex-col justify-between gap-4">
		<div class="space-y-2">
			<form class="flex gap-2" onsubmit={submit}>
				<Input
					bind:value={query}
					oninput={() => (rejected = false)}
					placeholder="user, owner/repo or URL"
					aria-label="GitHub user, repo or URL"
					aria-describedby="jump-hint"
					autocomplete="off"
					spellcheck="false"
					class="h-10"
				/>
				<div class="flex">
					<Button type="submit" class={cn('h-10', target && 'rounded-r-none')}>Open</Button>
					{#if target}
						<DropdownMenu.Root>
							<DropdownMenu.Trigger
								type="button"
								aria-label="Open a specific page"
								class={cn(
									buttonVariants(),
									'border-l-primary-foreground/20 h-10 w-8 rounded-l-none px-0'
								)}
							>
								<Icon icon={ChevronDown} size={14} />
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end" class="w-max min-w-40">
								{#each links as link (link.href)}
									{@const PageIcon = iconFor(scope, ...link.slugs)}
									<DropdownMenu.Item onSelect={() => goto(link.href)}>
										{#if PageIcon}<Icon icon={PageIcon} class="text-muted-foreground" />{/if}
										{link.label}
									</DropdownMenu.Item>
								{/each}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					{/if}
				</div>
			</form>
			<p id="jump-hint" role="status" class="flex min-h-4 items-start gap-1.5 text-xs">
				{#if rejected}
					<Icon icon={TriangleAlert} size={13} class="text-warning mt-0.5" />
					<span class="text-warning">Not recognised, try a user, owner/repo or GitHub URL</span>
				{:else if target}
					<Icon
						icon={CornerDownLeft}
						size={13}
						class="text-muted-foreground mt-0.5 dark:bg-input/30 border-input p-1"
					/>
					<span class="text-muted-foreground">
						Enter opens {kindWords[target.kind]}
						<a href={target.href} class="text-foreground">{target.label}</a>
					</span>
				{:else}
				  <span class="text-muted-foreground">Paste any username, repository or GitHub URL</span>
				{/if}
			</p>
		</div>
		<hr class="border-border" />
		<div class="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
			<span>Try</span>
			{#each chips as chip (chip.href)}
				<a
					href={chip.href}
					class="hover:border-ring hover:text-foreground rounded-md border px-2 py-0.5 transition-colors"
				>
					{chip.name}{#if chip.page}<span class="opacity-60">&nbsp;· {chip.page}</span>{/if}
				</a>
			{/each}
		</div>
	</Card.Content>
</Card.Root>
