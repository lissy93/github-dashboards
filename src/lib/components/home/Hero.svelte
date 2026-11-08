<script lang="ts">
	import { ChartColumn, ListTodo, TrendingUp, Workflow } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge';
	import Icon from '$lib/components/common/Icon.svelte';
	import Logo from '$lib/components/common/Logo.svelte';
	import { APP_NAME, APP_DESCRIPTION } from '$lib/config';

	// Feature hints shown as chips under the tagline
	const features = [
		{ icon: ChartColumn, label: 'Stats' },
		{ icon: Workflow, label: 'CI/CD' },
		{ icon: TrendingUp, label: 'Traffic' },
		{ icon: ListTodo, label: 'Issues & PRs' }
	];
</script>

<section class="relative isolate space-y-5 py-12 text-center sm:py-16">
	<!-- token-derived dot grid and glow, purely decorative -->
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10">
		<div
			class="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_55%_65%_at_50%_40%,black,transparent)] [background-size:1rem_1rem]"
		></div>
		<div
			class="absolute top-8 left-1/2 h-40 w-full max-w-md -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
		></div>
	</div>

	<h1
		class="flex items-center justify-center gap-3 text-4xl font-semibold tracking-tight sm:text-5xl"
	>
		<Logo size={64} />{APP_NAME}
	</h1>
	<p class="mx-auto max-w-xl text-lg text-balance text-muted-foreground">{APP_DESCRIPTION}</p>

	<ul class="flex flex-wrap items-center justify-center gap-2">
		{#each features as feature (feature.label)}
			<li>
				<Badge variant="secondary"><Icon icon={feature.icon} />{feature.label}</Badge>
			</li>
		{/each}
	</ul>
</section>
