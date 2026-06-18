<script lang="ts">
	import type { Component } from 'svelte';
	import Icon from '$lib/components/common/Icon.svelte';

	type Props = {
		icon: Component<{ size?: number | string; class?: string }>;
		title: string;
		message?: string;
	};
	let { icon, title, message }: Props = $props();
</script>

<div class="mx-auto max-w-md space-y-3 py-20 text-center">
	<Icon {icon} size={28} class="text-muted-foreground mx-auto" />
	<h1 class="text-lg font-medium">{title}</h1>
	{#if message}<p class="text-muted-foreground text-sm">{message}</p>{/if}
</div>
