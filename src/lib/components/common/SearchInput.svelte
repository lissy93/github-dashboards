<script lang="ts">
	import { Search } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input';
	import Icon from '$lib/components/common/Icon.svelte';
	import { cn } from '$lib/utils';

	// Text input with the search glass tucked into its left edge
	let {
		value = $bindable(),
		placeholder,
		label,
		class: className,
		inputClass = 'h-9 pl-8'
	}: {
		value: string;
		placeholder: string;
		label?: string;
		class?: string;
		inputClass?: string;
	} = $props();
</script>

<div class={cn('relative', className)}>
	<Icon
		icon={Search}
		size={15}
		class="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2"
	/>
	<Input bind:value {placeholder} aria-label={label ?? placeholder} class={inputClass} />
</div>
