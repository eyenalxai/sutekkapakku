## Sutekkapakku

Bot for stealing stickers 😈

Send any sticker to [@sutekkapakku_bot](https://t.me/sutekkapakku_bot) and it is added to your personal
sticker pack. Send a sticker from a pack created by the bot and it is removed. Send a photo with an emoji
caption and it becomes a sticker.

The bot's core runs on [Effect](https://effect.website) v4 with typed errors, validated configuration, and
structured logging. Domain vocabulary lives in [GLOSSARY.md](./GLOSSARY.md); hard-to-reverse decisions live
in [docs/adr](./docs/adr).

### Using the bot

Open the bot and use the main menu — there is nothing to memorise:

- `📦 My packs` opens the packs overview: one line per sticker type with the active pack's title and live
  `n/120` count, a button per pack (active first, then archived volumes marked `(full)` or `(expired)`), and
  `🔄 Refresh` to fetch current counts from Telegram.
- `🗑 Remove a sticker` starts a guided remove flow: send the sticker you want to remove, or step through the
  pack with the sticker browser (`◀️ i/n ▶️`, `🗑 Remove`, `✅ Done`) and remove stickers one by one.
- The pack panel (opened from the overview) shows the title, count, and link, with `📎 Open in Telegram`,
  `🗑 Remove a sticker`, `✏️ Rename`, and `🔍 Browse stickers`.
- Rename asks for a new title of 1–64 characters and rejects titles already taken by another pack.
- Flows end with Cancel, and `/cancel` exits any flow.

Commands are registered with Telegram's menu button on startup: `/start`, `/menu`, `/packs`, `/add`,
`/remove`, `/help`, and `/cancel`. Every panel is edited in place, so the chat does not fill with messages;
if a panel is too old to edit, a fresh one is sent instead.

The old gestures still work: sending a sticker from one of your packs removes it, and a photo with an emoji
caption becomes a sticker.

### Packs and volumes

Telegram caps a sticker set at 120 stickers. Sutekkapakku handles that with **volumes**:

- Each sticker type (regular, animated, video) has one active volume. When it is full, the bot archives it,
  creates the next volume automatically (`… Vol. 2`, `… Vol. 3`), and adds the sticker there — collection
  never fails with `STICKERS_TOO_MUCH`.
- If a pack is gone or invalid on Telegram's side (`STICKERSET_INVALID`), the bot archives it and starts a
  fresh volume on the next add, so broken packs heal themselves.
- Archived volumes are never deleted, and existing names and titles are never changed. Older volumes stay
  reachable from the packs overview — the history is the user's, not the bot's to throw away.

### Data safety

- Migrations are additive only: nothing is dropped, renamed, or rewritten, so an app rollback stays safe.
- Rows are never deleted; the UI has no destructive pack action, and archives keep every sticker in place.
- Production is backed up before the cutover, the migration is rehearsed on a restored copy first, and the
  kept tests restore the production dump and compare schema to prove all rows stay readable.

### Development

Requires [Bun](https://bun.sh) 1.4.2.

```sh
bun --bun install
bun --bun run check    # format:check, lint, tsc, tests
bun --bun run format   # normalise formatting
bun --bun run start    # WEBHOOK mode: serves /health and /webhook/main
```

Environment variables: `API_TOKEN` (Telegram bot token), `ADMIN_USERNAME` (contact link), `DATABASE_URL`,
`DOMAIN` (webhook host, without scheme), `PORT`, and `POLL_TYPE` (`WEBHOOK` or `POLLING`). See `.env.example`;
values are validated at startup.

Tests provision a real PostgreSQL with rootless Docker (`postgres:15-alpine`) and apply the generated Drizzle
migrations. The data-preservation tests restore a production dump when `SUTEKKAPAKKU_BACKUP_DIR` points at
one.

### Migrations

Schema changes are generated from `src/db/schema.ts` — never written or edited by hand:

```sh
bun run db:generate   # generate a migration from schema changes
bun run db:migrate    # apply pending migrations
bun run db:check      # check migration consistency
```

Migrations must stay additive: no dropped or renamed columns, no data rewrites.

Existing databases that predate the journal (production included) are baselined once before their first
`db:migrate`: the `drizzle.__drizzle_migrations` row for the init migration is restored from the captured
baseline seed (`migration-journal-init-*.dump` in the backup directory). After that, `db:migrate` records
and applies new migrations normally.

### Deployment

Railway is described in `.railway/railway.ts` (TypeScript Infrastructure as Code using the `railway` SDK).
Run `railway config plan` and `railway config apply` from the repository root. The service builds with
Railpack (Bun detected from `bun.lock`, version pinned by `.bun-version`) and starts with
`bun --bun run src/index.ts`; Railway checks `/health`.
