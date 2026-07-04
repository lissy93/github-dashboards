<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ExternalLink } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { cn } from '$lib/utils';

	// External link with the little outbound arrow
	type Props = { href: string; class?: string; children: Snippet };
	let { href, class: className, children }: Props = $props();
</script>

<a
	{href}
	target="_blank"
	rel="noopener noreferrer"
	class={cn('inline-flex items-center gap-1 hover:underline', className)}
>
	{@render children()}<Icon icon={ExternalLink} size={12} class="text-muted-foreground" />
</a>
