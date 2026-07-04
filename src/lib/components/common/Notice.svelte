<script lang="ts">
	import type { Component } from 'svelte';
	import Icon from '$lib/components/common/Icon.svelte';

	type Props = {
		icon: Component<{ size?: number | string; class?: string }>;
		title: string;
		message?: string;
		heading?: 'h1' | 'h2';
	};
	let { icon, title, message, heading = 'h2' }: Props = $props();
</script>

<div class="mx-auto max-w-md space-y-3 py-20 text-center">
	<Icon {icon} size={28} class="text-muted-foreground mx-auto" />
	<svelte:element this={heading} class="text-lg font-medium">{title}</svelte:element>
	{#if message}<p class="text-muted-foreground text-sm">{message}</p>{/if}
</div>
