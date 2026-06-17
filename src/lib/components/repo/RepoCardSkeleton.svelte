<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="bg-card flex flex-col gap-3 rounded-md border p-4">
	<Skeleton class="h-5 w-2/5" />
	<div class="space-y-1.5">
		<Skeleton class="h-3.5 w-full" />
		<Skeleton class="h-3.5 w-3/4" />
	</div>
	<div class="mt-1 space-y-1.5">
		<div class="flex gap-3">
			<Skeleton class="h-3 w-14" />
			<Skeleton class="h-3 w-10" />
			<Skeleton class="h-3 w-10" />
		</div>
		<Skeleton class="h-3 w-2/3" />
	</div>
</div>
