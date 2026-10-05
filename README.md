## Sutekkapakku

Bot for stealing stickers 😈

Send any sticker to [@sutekkapakku_bot](https://t.me/sutekkapakku_bot) and it is added to your personal sticker
pack. Send a sticker from a pack created by the bot and it is removed. Send a photo with an emoji caption and
it becomes a sticker.

### Development

Requires [Bun](https://bun.sh) 1.4.2.

```sh
bun --bun install
bun --bun run check   # format, lint, types, tests
bun --bun run start   # WEBHOOK mode: serves /health and /webhook/main
```

Environment variables: `API_TOKEN`, `ADMIN_USERNAME`, `DATABASE_URL`, `DOMAIN`, `PORT`, `POLL_TYPE`
(`WEBHOOK` or `POLLING`). See `.env.example`.

Tests provision a real PostgreSQL with rootless Docker (`postgres:15-alpine`) and apply the generated Drizzle
migrations. The data-preservation tests restore a production dump when `SUTEKKAPAKKU_BACKUP_DIR` points at one.

### Deployment

Railway is described in `.railway/railway.ts` (TypeScript Infrastructure as Code using the `railway` SDK).
Run `railway config plan` and `railway config apply` from the repository root. The service builds with
Railpack (Bun detected from `bun.lock`, version pinned by `.bun-version`) and starts with
`bun --bun run src/index.ts`.
