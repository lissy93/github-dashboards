import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '$lib/server/db/schema';
import { config } from '$lib/server/env';

type DB = PostgresJsDatabase<typeof schema>;

let instance: DB | undefined;

// connect lazily so importing this doesn't need DATABASE_URL at build
function getDb(): DB {
	if (!instance) {
		instance = drizzle(postgres(config.DATABASE_URL), { schema });
	}
	return instance;
}

export const db: DB = new Proxy({} as DB, {
	get: (_target, prop) => {
		const target = getDb();
		const value = target[prop as keyof DB];
		return typeof value === 'function'
			? (value as (...args: unknown[]) => unknown).bind(target)
			: value;
	}
});
