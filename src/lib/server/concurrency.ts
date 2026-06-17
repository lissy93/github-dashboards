// Map items through an async fn with a bounded number of workers, preserving order
export async function mapLimit<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let cursor = 0;

	async function worker() {
		while (cursor < items.length) {
			const index = cursor++;
			results[index] = await fn(items[index], index);
		}
	}

	const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
	await Promise.all(workers);
	return results;
}
