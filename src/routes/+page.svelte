<script lang="ts">
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import Hero from '$lib/components/home/Hero.svelte';
	import JumpBox from '$lib/components/home/JumpBox.svelte';
	import LoginPanel from '$lib/components/home/LoginPanel.svelte';
	import { APP_DESCRIPTION } from '$lib/config';

	let { data } = $props();

	// Login panel drops out entirely when OAuth is not configured
	const showLogin = $derived(data.loginEnabled || !!data.user);
</script>

<PageMeta description={APP_DESCRIPTION} />
<Hero />

<section aria-label="Get started" class="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
	{#if showLogin}
		<LoginPanel user={data.user} />
		<JumpBox />
	{:else}
		<JumpBox class="mx-auto w-full max-w-xl md:col-span-2" />
	{/if}
</section>
