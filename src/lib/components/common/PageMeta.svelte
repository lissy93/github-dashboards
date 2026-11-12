<script lang="ts">
	import { page } from '$app/state';
	import { APP_NAME, OG_SIZE, paths } from '$lib/config';

	// One head block for every page, so titles, descriptions and share cards never drift
	let { title, description }: { title?: string; description: string } = $props();

	const fullTitle = $derived(title ? `${title} · ${APP_NAME}` : APP_NAME);
	const canonical = $derived(new URL(page.url.pathname, page.url).href);
	const image = $derived(new URL(paths.ogImage(page.url.pathname), page.url).href);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:site_name" content={APP_NAME} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title ?? APP_NAME} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={image} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content={String(OG_SIZE.width)} />
	<meta property="og:image:height" content={String(OG_SIZE.height)} />
	<meta property="og:image:alt" content={fullTitle} />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>
