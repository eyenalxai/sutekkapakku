# Pack volumes: archive, never delete

**Status**: accepted

## Context

Telegram caps a sticker set at 120 stickers. The bot kept one set per sticker type, so once a user reached
the cap the next add failed with `Bad Request: STICKERS_TOO_MUCH`: the sticker was lost and the user got no
reply. Production evidence showed two packs at 119/120, and three more rows pointed at sets Telegram no
longer had (`STICKERSET_INVALID`), so every add and remove against them failed. The data-safety invariant is
absolute: production rows are never updated destructively, never deleted, and migrations are additive only.

## Decision

Model each user's collection per sticker type as a sequence of **volumes** — separate Telegram sets,
numbered `Vol. 2`, `Vol. 3`, … in their titles.

- The **active volume** for a user and type is the newest volume that is not archived.
- When a sticker cannot be added because the volume is full (cached count of 120, or Telegram answers
  `STICKERS_TOO_MUCH`), the bot archives that volume as `FULL`, creates the next volume, and adds the sticker
  there. The user is told the pack was full and shown the new link.
- When Telegram answers `STICKERSET_INVALID` for any call, the bot archives the volume as `INVALID` and heals
  by creating the next volume on the next add.
- Volumes are archived, never deleted: existing names and titles are never changed, and archived volumes stay
  browsable from the packs overview.
- The schema change is additive only — `sticker_count`, `archived_at`, and `archived_reason` — generated with
  `bun run db:generate`. Nothing is dropped, renamed, or rewritten, so rolling back to the old app stays
  safe.
- Pack creation commits the row before calling Telegram, so a set whose creation failed leaves a row that the
  next add heals as `INVALID`.

## Consequences

- Additions can no longer fail or lose stickers because of the 120 limit, and dead sets recover without
  maintainer action.
- History accumulates: more rows and more Telegram sets over time, and the overview must show archived
  volumes. The number of volumes is unbounded; if that ever becomes a problem it will be a separate
  decision.
- Every add, remove, and rename path must respect the active/archived split; counts are cached best-effort
  with a live refresh when the overview opens.
- The migration must be rehearsed on a restored production copy before production, and the existing
  data-preservation and schema-parity tests keep proving rows stay readable.

## Alternatives considered

- **Delete or reuse a full set.** Reusing would overwrite users' history, and deleting is irreversible; both
  break the data-safety invariant.
- **Raise the 120 limit.** Not possible — it is Telegram's platform cap.
- **Store stickers outside Telegram and serve them only through the bot.** A different product: users would
  lose the sticker sets they use in chats and every share link would break.
- **Ask the user to create a new pack manually.** Pushes an internal limit onto users and still needs all the
  same archive and creation machinery.
