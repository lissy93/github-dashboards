const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const number = new Intl.NumberFormat('en');
const decimal = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const SIZE_UNITS = ['KB', 'MB', 'GB', 'TB'];
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const dateFmt = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	hour: 'numeric',
	minute: '2-digit'
});

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

// Number to at most one decimal, for fractional shares e.g. 2.666 -> 2.7
export function formatDecimal(value: number): string {
	return decimal.format(value);
}

// Step a raw amount up through 1024-based units until it fits
function scaleUnit(amount: number, units: string[]): { value: number; unit: string } {
	let value = amount;
	let step = 0;
	while (value >= 1024 && step < units.length - 1) {
		value /= 1024;
		step++;
	}
	return { value, unit: units[step] };
}

// Human disk size from a kilobyte count, e.g. 2048 -> 2 MB
export function formatSize(kb: number): string {
	const { value, unit } = scaleUnit(kb, SIZE_UNITS);
	return `${decimal.format(value)} ${unit}`;
}

// Human byte size from a raw byte count, e.g. 2048 -> 2 KB
export function formatBytes(bytes: number): string {
	const { value, unit } = scaleUnit(bytes, BYTE_UNITS);
	return `${unit === 'B' ? value : decimal.format(value)} ${unit}`;
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

// Exact date and time for tooltips, e.g. Jun 5, 2024, 2:32 PM
export function formatDateTime(iso: string): string {
	return dateTimeFmt.format(Date.parse(iso));
}
