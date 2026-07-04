<script lang="ts">
	import * as Select from '$lib/components/ui/select';

	// One single-select whose trigger shows the current option's label
	type Option = { value: string; label: string; disabled?: boolean };
	let {
		options,
		value = $bindable(),
		allLabel,
		class: className = 'h-9'
	}: {
		options: Option[];
		value: string;
		allLabel?: string;
		class?: string;
	} = $props();

	const label = $derived(options.find((option) => option.value === value)?.label ?? allLabel ?? '');
</script>

<Select.Root type="single" bind:value>
	<Select.Trigger class={className}>{label}</Select.Trigger>
	<Select.Content>
		{#if allLabel}<Select.Item value="">{allLabel}</Select.Item>{/if}
		{#each options as option (option.value)}
			<Select.Item value={option.value} disabled={option.disabled}>{option.label}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
