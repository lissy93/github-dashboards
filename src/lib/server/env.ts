import { env } from '$env/dynamic/private';
import { z } from 'zod';
import { AppError } from '$lib/errors';

const schema = z.object({
	DATABASE_URL: z.string().url(),
	GITHUB_TOKEN: z.string().min(1),
	GITHUB_API: z.string().url().default('https://api.github.com'),
	GITHUB_GRAPHQL: z.string().url().default('https://api.github.com/graphql'),
	CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(900),
	// Login allowed to see private traffic insights, until per-user auth exists
	TRAFFIC_OWNER: z.string().default('')
});

const parsed = schema.safeParse(env);
if (!parsed.success) {
	const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
	throw new AppError('internal', `Invalid environment: ${missing}`, { expose: false });
}

export const config = parsed.data;
