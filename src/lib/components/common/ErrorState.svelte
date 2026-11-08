<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import type { DisplayError } from '$lib/utils/errors';

	let { error }: { error: DisplayError } = $props();
</script>

<div class="mx-auto max-w-md space-y-3 py-20 text-center">
	<Icon icon={TriangleAlert} size={28} class="mx-auto text-warning" />
	<h1 class="text-lg font-medium capitalize">{error.title}</h1>
	<p class="text-sm text-muted-foreground">{error.message}</p>
</div>
