<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$lib/components/common/Icon.svelte';
	import { reverify } from '$lib/state/challenge';

	// A bare 403 is the firewall's bot check, our own 403s always have a message
	$effect(() => {
		if (page.status === 403 && page.error?.message === 'Error: 403') reverify();
	});
</script>

<section class="mx-auto max-w-md space-y-4 py-20 text-center">
	<Icon icon={TriangleAlert} size={32} class="text-warning mx-auto" />
	<div class="space-y-1">
		<h1 class="text-2xl font-semibold">{page.status}</h1>
		<p class="text-muted-foreground">{page.error?.message ?? 'Something went wrong'}</p>
	</div>
	<Button href="/" variant="outline">Back home</Button>
</section>
