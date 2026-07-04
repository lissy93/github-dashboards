// Best-effort localStorage access, quietly ignored when it is unavailable, such as
// private browsing or a full quota. Only call from the browser (effects, handlers)
export function readStored(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function writeStored(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// storage unavailable, the preference just will not persist
	}
}
