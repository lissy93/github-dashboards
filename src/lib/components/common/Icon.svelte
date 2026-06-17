<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = {
		icon: Component<{ size?: number | string; strokeWidth?: number; class?: string }>;
		size?: number;
		strokeWidth?: number;
		class?: string;
	};
	let { icon: IconComponent, size = 16, strokeWidth = 2, class: className }: Props = $props();
</script>

<IconComponent {size} {strokeWidth} class={cn('shrink-0', className)} />
