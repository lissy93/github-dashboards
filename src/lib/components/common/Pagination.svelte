<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$lib/components/common/Icon.svelte';

	let { page = $bindable(), totalPages }: { page: number; totalPages: number } = $props();

	// First, last, current and its neighbours, with gaps marked by null
	const items = $derived.by(() => {
		const wanted = [1, totalPages, page, page - 1, page + 1];
		const shown = [...new Set(wanted)]
			.filter((n) => n >= 1 && n <= totalPages)
			.sort((a, b) => a - b);
		const out: (number | null)[] = [];
		let prev = 0;
		for (const n of shown) {
			if (n - prev > 1) out.push(null);
			out.push(n);
			prev = n;
		}
		return out;
	});

	function go(target: number) {
		page = Math.min(Math.max(1, target), totalPages);
	}
</script>

{#if totalPages > 1}
	<nav class="flex items-center justify-center gap-1" aria-label="Pagination">
		<Button
			variant="outline"
			size="icon"
			class="size-8"
			disabled={page <= 1}
			aria-label="Previous page"
			onclick={() => go(page - 1)}
		>
			<Icon icon={ChevronLeft} />
		</Button>
		{#each items as item, index (index)}
			{#if item === null}
				<span class="px-1 text-sm text-muted-foreground">…</span>
			{:else}
				<Button
					variant={item === page ? 'default' : 'outline'}
					size="icon"
					class="size-8"
					aria-current={item === page ? 'page' : undefined}
					onclick={() => go(item)}
				>
					{item}
				</Button>
			{/if}
		{/each}
		<Button
			variant="outline"
			size="icon"
			class="size-8"
			disabled={page >= totalPages}
			aria-label="Next page"
			onclick={() => go(page + 1)}
		>
			<Icon icon={ChevronRight} />
		</Button>
	</nav>
{/if}
