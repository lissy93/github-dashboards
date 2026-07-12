<script lang="ts">
	import { page } from '$app/state';
	import { APP_NAME, APP_DESCRIPTION } from '$lib/config';

	// Home is the one page without a title suffix, so it rolls its own head
	const canonical = $derived(new URL('/', page.url).href);
</script>

<svelte:head>
	<title>{APP_NAME}</title>
	<meta name="description" content={APP_DESCRIPTION} />
	<link rel="canonical" href={canonical} />
	<meta property="og:site_name" content={APP_NAME} />
	<meta property="og:title" content={APP_NAME} />
	<meta property="og:description" content={APP_DESCRIPTION} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonical} />
	<meta name="twitter:card" content="summary" />
</svelte:head>
