# API architecture

`src/app.ts` creates the Express application, configures CORS, and mounts routers. `src/server.ts` runs migrations when PostgreSQL is configured, then starts the HTTP server.

## Request flow

```text
website -> Express router -> scraper/service -> external source
                              |              -> Redis cache (when configured)
                              -> PostgreSQL (training participants only)
```

- `routes/indexRouter.ts` provides the lightweight root and health responses.
- Tournament and ratings routers invoke scrapers. Tournament locations may be reverse-geocoded and enriched with a nearby station; production responses are cached.
- Product requests scrape stores or Shopify feeds. Search streaming runs store requests concurrently and emits server-sent events; disconnecting the browser aborts outstanding work.
- The route planner geocodes a German origin, requests a driving route, and optionally creates a Deutsche Bahn search link when station lookup is enabled.
- Training routes use PostgreSQL and issue a one-time removal token. The token is stored only as a hash.

`cache.ts` deliberately treats Redis as best-effort: a missing or failed local cache is a cache miss, not an API outage. Production requires `REDIS_URL` so availability is visible in `/health`.

## Database migrations

Migrations live in `migrations/<area>/` and are applied in lexical order. At startup, `runDatabaseMigrations` records filenames in `schema_migrations`, wraps each migration in a transaction, and holds a PostgreSQL advisory lock to prevent concurrent instances applying the same migration. Applied files must remain immutable.

## Website boundary

`syndikat-web` calls this API directly from browser JavaScript. Local browser development defaults to `http://localhost:8080`; production defaults to `https://api.syndikat.golf`. In production, CORS only allows the configured exact origins or HTTPS host suffixes. The contract for this boundary is [openapi.yaml](openapi.yaml).

Stripe webhooks and legacy/internal endpoints are intentionally outside the public website contract.
