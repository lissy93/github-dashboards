// Fetch one of our api routes, throwing the parsed apiError body on failure so
// panels can render the server's message through toDisplayError
export async function fetchApi<T>(url: string): Promise<T> {
	const response = await fetch(url);
	const body = await response.json();
	if (!response.ok) throw body;
	return body as T;
}
