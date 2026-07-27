import { describe, it, expect, vi, afterEach } from 'vitest';
import { compactNumber, relativeTime, formatDate, formatDateTime } from './format';

describe('compactNumber', () => {
	it('keeps small numbers as-is', () => {
		expect(compactNumber(42)).toBe('42');
	});
	it('shortens large numbers', () => {
		expect(compactNumber(12345)).toBe('12.3K');
		expect(compactNumber(2_000_000)).toBe('2M');
	});
});

describe('relativeTime', () => {
	afterEach(() => vi.useRealTimers());

	it('formats past times relative to now', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-10T00:00:00Z'));
		expect(relativeTime('2026-01-07T00:00:00Z')).toBe('3 days ago');
	});

	it('formats future times', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-10T00:00:00Z'));
		expect(relativeTime('2026-01-12T00:00:00Z')).toBe('in 2 days');
	});

	it('falls back for a missing or invalid date', () => {
		expect(relativeTime(null as unknown as string)).toBe('never');
		expect(formatDate('')).toBe('never');
		expect(formatDateTime('not-a-date')).toBe('never');
	});
});
