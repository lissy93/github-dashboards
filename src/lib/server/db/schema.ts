import { sql } from 'drizzle-orm';
import {
	pgTable,
	text,
	integer,
	jsonb,
	timestamp,
	date,
	uniqueIndex,
	index
} from 'drizzle-orm/pg-core';

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

// Normalised timeline rows per user, accumulated from the events feed and backfill.
// id is deterministic so the same action from either source dedupes on insert
export const activityEvent = pgTable(
	'activity_event',
	{
		id: text('id').primaryKey(),
		user: text('user').notNull(),
		type: text('type').notNull(),
		action: text('action'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		repo: text('repo').notNull(),
		title: text('title'),
		body: text('body'),
		url: text('url').notNull(),
		payload: jsonb('payload'),
		reactions: jsonb('reactions')
	},
	(table) => [
		index('activity_user_time_idx').on(table.user, table.createdAt.desc(), table.id.desc()),
		// Serves the repo-scoped feed, which filters on lower(repo)
		index('activity_repo_time_idx').on(
			sql`lower(${table.repo})`,
			table.createdAt.desc(),
			table.id.desc()
		)
	]
);
