# Local Dev Setup

## Prerequisites

- Node.js 24+
- Docker

## 1. Install deps

```sh
npm install
```

## 2. Start the database

Spins up a local Postgres container on port 5433.

```sh
docker compose up -d
```

## 3. Set up your .env

Copy the example and fill in your GitHub token:

```sh
cp .env.example .env
```

The defaults in `.env.example` already point at the local Docker Postgres, so `DATABASE_URL` should just work as-is.

## 4. Push the schema

```sh
npm run db:push
```

This creates all the tables in your local database.

## 5. Run the app

```sh
npm run dev
```

## Other useful commands

| Command | What it does |
|---|---|
| `npm run db:studio` | Opens Drizzle Studio (database GUI) |
| `npm run db:generate` | Generates migration files from schema changes |
| `npm run db:migrate` | Runs migrations |
| `npm run test` | Runs unit tests |
| `npm run lint` | Checks formatting and linting |
| `npm run format` | Auto-formats everything |

## Tearing down

To stop and remove the database container:

```sh
docker compose down
```

Your data is in a Docker volume (`pgdata`), so it survives restarts. To nuke everything and start fresh:

```sh
docker compose down -v
```
