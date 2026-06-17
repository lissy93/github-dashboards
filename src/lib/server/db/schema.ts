import { pgTable, text, integer, jsonb, timestamp, date, uniqueIndex } from 'drizzle-orm/pg-core';

// Generic key/value cache for any GitHub response, with per-entry ttl
export const cacheEntry = pgTable('cache_entry', {
	key: text('key').primaryKey(),
	value: jsonb('value').notNull(),
	etag: text('etag'),
	fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
	ttl: integer('ttl').notNull()
});

// Daily traffic snapshots, GitHub only exposes a rolling 14 day window
export const repoTrafficDaily = pgTable(
	'repo_traffic_daily',
	{
		repo: text('repo').notNull(),
		day: date('day').notNull(),
		views: integer('views').notNull().default(0),
		uniqueViews: integer('unique_views').notNull().default(0),
		clones: integer('clones').notNull().default(0),
		uniqueClones: integer('unique_clones').notNull().default(0)
	},
	(table) => [uniqueIndex('repo_traffic_day_idx').on(table.repo, table.day)]
);

// Daily star count snapshots, kept to draw long-run star history cheaply
export const repoStarsDaily = pgTable(
	'repo_stars_daily',
	{
		repo: text('repo').notNull(),
		day: date('day').notNull(),
		stars: integer('stars').notNull()
	},
	(table) => [uniqueIndex('repo_stars_day_idx').on(table.repo, table.day)]
);
