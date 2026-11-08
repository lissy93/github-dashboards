<h1 align="center">GitHub Dashboards</h1>
<p align="center">
  <i>Fast, detailed dashboards for any GitHub user, org or repo</i><br>
  🌐 <b><a href="https://github-dashboards.as93.net">github-dashboards.as93.net</a></b>
</p>
<p align="center">
  <a href="https://github-dashboards.as93.net"><img width="96" src="https://github.com/Lissy93/github-dashboards/blob/main/static/logo.svg?raw=true" /></a>
</p>

---

### About

Stats, charts, history and to-do lists for any GitHub account or repo, all in one place.<br>
Just swap `github.com` for `github-dashboards.as93.net` in any user or repo URL.

<img width="900" alt="github-dashboards-slideshow" src="https://pixelflare.cc/alicia/project-screens/github-dashboards-slideshow.gif" />

- **Users** - profile, repos, stats, activity, contributions, plus open PRs and issues waiting on you
- **Repos** - issue/PR trends, git tree, dependencies, CI runs, deployments, releases, security and people
- **History** - daily snapshots keep your repo traffic long after GitHub's 14-day window
- **Sign in** - log in with GitHub for traffic analytics on your own repos and higher rate limits

---

### Deploying

You'll need a Postgres database ([Neon](https://neon.com) works well).<br>
Run `npm run db:push` against it to create the tables, and again after each upgrade.

#### Option 1 - Vercel

Fork the repo, import it into Vercel, and set your [environment variables](#configuring).<br>
The daily maintenance cron is picked up from `vercel.json` automatically.

#### Option 2 - Docker

Build the image with `docker build -t github-dashboards .`<br>
Then start it with `docker run -p 3000:3000 -e DATABASE_URL='postgres://...' -e ORIGIN='http://localhost:3000' github-dashboards`

#### Option 3 - Node

Follow the dev steps below and set `ORIGIN` in your `.env`.<br>
Then run `npm run build` and start the server with `node --env-file=.env build`.

> [!NOTE]
> Outside of Vercel, call `GET /api/maintenance` once a day (with `CRON_SECRET` as a bearer token) to snapshot traffic and tidy the cache.

#### Configuring

| Variable                                                                    | Description                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                              | Postgres connection string (required)                                           |
| `GITHUB_TOKEN`                                                              | Fine-grained PAT used for anonymous visitors, public repos only (recommended)   |
| `GITHUB_APP_ID`<br>`GITHUB_APP_PRIVATE_KEY`<br>`GITHUB_APP_INSTALLATION_ID` | GitHub App, gives anonymous visitors their own rate-limit pool                  |
| `GITHUB_CLIENT_ID`<br>`GITHUB_CLIENT_SECRET`<br>`SESSION_SECRET`            | OAuth app, enables sign in with GitHub. Callback URL is `/auth/github/callback` |
| `CRON_SECRET`                                                               | Locks the maintenance endpoint behind a bearer token                            |
| `ORIGIN`                                                                    | Your public URL, like `http://localhost:3000` (required when self-hosting)      |

See [`.env.example`](https://github.com/Lissy93/github-dashboards/blob/main/.env.example) for details.

---

### Developing

#### Prerequisites

You'll need Node.js 24+, Git and Docker (for the local Postgres).<br>
The app is built with SvelteKit + TypeScript, and Postgres via Drizzle.

#### Setup Commands

```
git clone git@github.com:Lissy93/github-dashboards.git
cd github-dashboards
npm install
cp .env.example .env    # then add your GITHUB_TOKEN
docker compose up -d    # starts Postgres on port 5433
npm run db:push
npm run dev
```

#### Testing

Run `npm test` for unit tests, `npm run check` for type checks and `npm run lint` for linting.

---

### Contributing

Contributions are welcome (and much appreciated!)<br>
Follow the dev instructions above to get started, then submit your changes as a PR.<br>

---

<!-- License + Copyright -->
<p  align="center">
  <i>© <a href="https://aliciasykes.com">Alicia Sykes</a> 2026</i><br>
  <i>Licensed under <a href="https://gist.github.com/Lissy93/143d2ee01ccc5c052a17">MIT</a></i><br>
  <a href="https://github.com/lissy93"><img src="https://cdn.as93.net/84m3gc?w=56" /></a><br>
  <sup>Thanks for visiting :)</sup>
</p>

<!-- Dinosaur -->
<!--
                        . - ~ ~ ~ - .
      ..     _      .-~               ~-.
     //|     \ `..~                      `.
    || |      }  }              /       \  \
(\   \\ \~^..'                 |         }  \
 \`.-~  o      /       }       |        /    \
 (__          |       /        |       /      `.
  `- - ~ ~ -._|      /_ - ~ ~ ^|      /- _      `.
              |     /          |     /     ~-.     ~- _
              |_____|          |_____|         ~ - . _ _~_-_
-->
