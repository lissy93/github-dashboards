<script lang="ts" generics="T">
	import { untrack, type Snippet } from 'svelte';
	import { Loader2 } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { toDisplayError } from '$lib/errors';

	type Page = { items: T[]; nextCursor: string | null };
	type Props = {
		initial: T[];
		initialCursor: string | null;
		fetchPage: (cursor: string | null) => Promise<Page>;
		key: (item: T) => string | number;
		item: Snippet<[T]>;
		resetKey?: string;
		empty?: string;
	};
	let {
		initial,
		initialCursor,
		fetchPage,
		key,
		item,
		resetKey = '',
		empty = 'Nothing here yet'
	}: Props = $props();

	let items = $state<T[]>(untrack(() => initial));
	let cursor = $state<string | null>(untrack(() => initialCursor));
	let loading = $state(false);
	let error = $state<unknown>(null);
	let sentinel = $state<HTMLElement>();
	const done = $derived(cursor === null);

	// Append the next older page, ignoring overlapping triggers and the end
	async function loadMore() {
		if (loading || cursor === null) return;
		loading = true;
		try {
			const page = await fetchPage(cursor);
			items = [...items, ...page.items];
			cursor = page.nextCursor;
		} catch (caught) {
			error = caught;
		}
		loading = false;
	}

	// Reload from the top when the filters change, keeping the first SSR render
	let appliedKey = untrack(() => resetKey);
	$effect(() => {
		if (resetKey === appliedKey) return;
		appliedKey = resetKey;
		reload();
	});

	async function reload() {
		loading = true;
		error = null;
		try {
			const page = await fetchPage(null);
			items = page.items;
			cursor = page.nextCursor;
		} catch (caught) {
			error = caught;
		}
		loading = false;
	}

	// Pull more as the sentinel nears the viewport
	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => entries[0]?.isIntersecting && loadMore(),
			{
				rootMargin: '300px'
			}
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

{#if items.length}
	<ul class="divide-y">
		{#each items as entry (key(entry))}
			<li>{@render item(entry)}</li>
		{/each}
	</ul>
{:else if !loading}
	<p class="text-muted-foreground py-10 text-center text-sm">{empty}</p>
{/if}

{#if error}
	<p class="text-danger py-4 text-center text-sm">{toDisplayError(error).message}</p>
{:else if !done}
	<div bind:this={sentinel} class="flex justify-center py-4">
		{#if loading}<Icon icon={Loader2} class="text-muted-foreground animate-spin" />{/if}
	</div>
{:else if items.length}
	<p class="text-muted-foreground py-4 text-center text-xs">End of timeline</p>
{/if}
