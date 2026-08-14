# Agent guidance

- Use TypeScript and Biome formatting. Keep route handlers thin; place external-provider logic in services or scrapers.
- `docs/openapi.yaml` is the manually maintained contract for endpoints consumed by `syndikat-web`. Update it with every public API shape change.
- SQL migrations are append-only, ordered files in `migrations/<area>/`. `src/migrations.ts` applies unapplied files under a PostgreSQL advisory lock; never edit an applied migration.
- Do not expose or document secret values. Environment configuration is described by category in `docs/development.md`.
- Validate with `npm run build`, `npm run biome:check`, and `npm run openapi:lint`.
- Cross-repository changes must also update browser calls and documentation in [maxgreive/syndikat-web](https://github.com/maxgreive/syndikat-web) when an endpoint, payload, API URL, or user-visible behavior changes.
