<script lang="ts">
	import type { Component } from 'svelte';
	import { Separator } from '$lib/components/ui/separator';
	import Icon from '$lib/components/common/Icon.svelte';

	// A titled section divider, used to group related panels on a page
	let {
		title,
		icon,
		description
	}: {
		title: string;
		icon?: Component<{ size?: number | string; class?: string }>;
		description?: string;
	} = $props();
</script>

<div class="space-y-1.5">
	<div class="flex items-center gap-2">
		{#if icon}<Icon {icon} size={18} class="text-muted-foreground" />{/if}
		<h2 class="text-base font-semibold">{title}</h2>
	</div>
	{#if description}<p class="text-muted-foreground text-sm">{description}</p>{/if}
	<Separator class="mt-2" />
</div>
