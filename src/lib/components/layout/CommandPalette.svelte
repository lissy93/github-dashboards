<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { BookMarked, ExternalLink, Search, Star, TriangleAlert } from '@lucide/svelte';
	import * as Command from '$lib/components/ui/command';
	import GithubMark from '$lib/components/common/GithubMark.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { iconFor } from '$lib/components/layout/nav';
	import { fetchApi } from '$lib/state/api';
	import { compactNumber } from '$lib/utils/format';
	import { parseGithubInput, paletteSections } from '$lib/utils/github-input';
	import { paths } from '$lib/config';
	import { cn } from '$lib/utils';
	import type { SessionUser, TopRepo } from '$lib/types';

	let { user, class: className }: { user: SessionUser | null; class?: string } = $props();

	const DEBOUNCE_MS = 400;

	let open = $state(false);
	let query = $state('');
	let isMac = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);
	let suggestions = $state<{ key: string; repos: TopRepo[] }>({ key: '', repos: [] });
	const fetched = new SvelteMap<string, TopRepo[]>();

	// The board being viewed, so the palette opens scoped to where you are
	const current = $derived(
		page.params.user ? [page.params.user, page.params.repo].filter(Boolean).join('/') : ''
	);

	// An empty query falls back to the signed-in user's own board
	const target = $derived(
		parseGithubInput(query) ?? (!query.trim() && user ? parseGithubInput(user.login) : null)
	);
	const sections = $derived(target ? paletteSections(target, user?.login) : []);
	const repoOwner = $derived(target && !target.repo ? target.owner.toLowerCase() : null);
	const topRepos = $derived(repoOwner === suggestions.key ? suggestions.repos : []);
	// The highlight snaps back to the parsed target whenever the input changes
	let selected = $derived(target?.href ?? '');

	onMount(() => {
		isMac = /mac|iphone|ipad/i.test(navigator.platform);
	});

	// Fetch the owner's top repos once the typed login settles, cached per login
	$effect(() => {
		if (!open || !repoOwner) return;
		const key = repoOwner;
		const hit = fetched.get(key);
		if (hit) {
			suggestions = { key, repos: hit };
			return;
		}
		const timer = setTimeout(async () => {
			try {
				const repos = await fetchApi<TopRepo[]>(`/api/${key}/top-repos`);
				fetched.set(key, repos);
				if (repoOwner === key) suggestions = { key, repos };
			} catch {
				suggestions = { key, repos: [] };
			}
		}, DEBOUNCE_MS);
		return () => clearTimeout(timer);
	});

	// Pre-filled text stays selected, so typing replaces it straight away
	$effect(() => {
		if (open && inputEl) requestAnimationFrame(() => inputEl?.select());
	});

	function show() {
		query = current;
		open = true;
	}

	function onKeydown(event: KeyboardEvent) {
		const chord = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey;
		if (!chord || event.key.toLowerCase() !== 'k') return;
		event.preventDefault();
		if (open) open = false;
		else show();
	}

	const close = () => (open = false);
</script>

<svelte:window onkeydown={onKeydown} />

<button
	type="button"
	onclick={show}
	aria-label="Go to anything"
	aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
	class={cn(
		'dark:bg-input/30 border-input hover:border-ring text-muted-foreground flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm shadow-xs transition-colors max-sm:size-9 max-sm:justify-center max-sm:px-0',
		className
	)}
>
	<Icon icon={Search} size={15} />
	<span class="max-sm:hidden">Go to anything</span>
	<kbd class="bg-muted ml-auto rounded border px-1.5 font-mono text-[0.65rem] max-sm:hidden">
		{isMac ? '⌘' : 'Ctrl'} K
	</kbd>
</button>

<Command.Dialog
	bind:open
	bind:value={selected}
	shouldFilter={false}
	loop
	title="Go to anything"
	description="Open any GitHub user, repo or page"
	class="sm:max-w-xl"
>
	<Command.Input
		bind:ref={inputEl}
		bind:value={query}
		placeholder="user, owner/repo or GitHub URL"
	/>
	<Command.List>
		{#each sections as section, index (section.heading)}
			<Command.Group heading={section.heading}>
				{#each section.links as link (link.href)}
					{@const external = link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {}}
					<Command.LinkItem value={link.href} href={link.href} onSelect={close} {...external}>
						{#if link.external}
							<GithubMark class="text-muted-foreground" size={14} />
						{:else}
							{@const PageIcon = iconFor(section.scope, ...link.slugs)}
							{#if PageIcon}<Icon icon={PageIcon} class="text-muted-foreground" />{/if}
						{/if}
						{#if link.parent}<span class="text-muted-foreground">{link.parent} /</span>{/if}
						{link.label}
						{#if link.external}
							<Icon icon={ExternalLink} size={12} class="text-muted-foreground ml-auto" />
						{/if}
					</Command.LinkItem>
				{/each}
			</Command.Group>
			{#if index === 0 && target && topRepos.length}
				<Command.Group heading="Top repos">
					{#each topRepos as repo (repo.name)}
						{@const href = paths.repo(target.owner, repo.name)}
						<Command.LinkItem value={href} {href} onSelect={close}>
							<Icon icon={BookMarked} class="text-muted-foreground" />
							{repo.name}
							<span
								class="text-muted-foreground ml-auto flex items-center gap-1 text-xs tabular-nums"
							>
								<Icon icon={Star} size={12} />{compactNumber(repo.stars)}
							</span>
						</Command.LinkItem>
					{/each}
				</Command.Group>
			{/if}
		{/each}
		{#if !target}
			<p role="status" class="text-muted-foreground px-3 py-6 text-center text-sm">
				{#if query.trim()}
					<Icon icon={TriangleAlert} size={13} class="text-warning mr-1 inline" />
					Not recognised, try a user, owner/repo or GitHub URL
				{:else}
					Type a user, owner/repo, or paste any GitHub URL
				{/if}
			</p>
		{/if}
	</Command.List>
</Command.Dialog>
