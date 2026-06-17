const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const number = new Intl.NumberFormat('en');
const decimal = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const SIZE_UNITS = ['KB', 'MB', 'GB', 'TB'];
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const dateFmt = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31536000],
	['month', 2592000],
	['week', 604800],
	['day', 86400],
	['hour', 3600],
	['minute', 60]
];

// Short human number, e.g. 12345 -> 12.3K
export function compactNumber(value: number): string {
	return compact.format(value);
}

// Full grouped number for tooltips, e.g. 12345 -> 12,345
export function formatNumber(value: number): string {
	return number.format(value);
}

// Human disk size from a kilobyte count, e.g. 2048 -> 2 MB
export function formatSize(kb: number): string {
	let value = kb;
	let unit = 0;
	while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${decimal.format(value)} ${SIZE_UNITS[unit]}`;
}

// Relative time from now, e.g. 3 days ago
export function relativeTime(iso: string): string {
	const seconds = (Date.parse(iso) - Date.now()) / 1000;
	const abs = Math.abs(seconds);
	for (const [unit, size] of UNITS) {
		if (abs >= size) return relative.format(Math.round(seconds / size), unit);
	}
	return relative.format(Math.round(seconds), 'second');
}

// Absolute short date, e.g. 5 Jun 2024
export function formatDate(iso: string): string {
	return dateFmt.format(Date.parse(iso));
}
