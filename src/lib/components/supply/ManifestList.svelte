<script lang="ts">
	import { FileCode } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { compactNumber } from '$lib/utils/format';
	import type { ManifestFile } from '$lib/types';

	let { manifests, repoUrl }: { manifests: ManifestFile[]; repoUrl: string } = $props();
</script>

<ul class="grid gap-1.5 sm:grid-cols-2">
	{#each manifests as manifest (manifest.path)}
		<li>
			<a
				href="{repoUrl}/blob/HEAD/{manifest.path}"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:bg-muted/50 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
			>
				<Icon icon={FileCode} size={15} class="text-muted-foreground shrink-0" />
				<span class="truncate">{manifest.path}</span>
				<span class="text-muted-foreground shrink-0 text-xs">{manifest.ecosystem}</span>
				<span
					class="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums"
					title="{manifest.count} dependencies declared"
				>
					{compactNumber(manifest.count)}
				</span>
			</a>
		</li>
	{/each}
</ul>
