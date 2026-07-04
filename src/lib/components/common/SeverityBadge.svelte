<script lang="ts">
	import { SEVERITY_COLOR } from '$lib/views/supply-chain';
	import type { VulnSeverity } from '$lib/types';

	// Uppercase severity tag, tinted with the shared advisory palette
	let { severity }: { severity: VulnSeverity } = $props();
</script>

<span
	class="w-20 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium uppercase"
	style="color: {SEVERITY_COLOR[severity]}; background: color-mix(in oklch, {SEVERITY_COLOR[
		severity
	]} 14%, transparent)"
>
	{severity}
</span>
