# Button-driven UI: inline-keyboard panels edited in place

**Status**: accepted

## Context

The bot was gesture-only: every feature was described in the help text, and users had to know that sending a
sticker adds it, sending one from their own pack removes it, and a photo with an emoji caption creates a
sticker. There was no overview of packs, no counts, no rename, no way to browse stickers, and no buttons. The
design must also respect Telegram's mechanics: callback data is capped at 64 bytes, a message can only be
edited into compatible content (not into a sticker), and editing fails when the message is too old or
unchanged.

## Decision

Add a navigation layer of **panels** — inline-keyboard messages edited in place — plus guided **flows**:

- Main menu (from `/start` and `/menu`): `📦 My packs`, `🗑 Remove a sticker`, `➕ How to add`, `ℹ️ Help`,
  `✉️ Contact` (URL).
- Packs overview: one line per sticker type with the active volume's title and live `n/120` count, one button
  per volume (active first, archived marked `(full)` or `(expired)`), plus `🔄 Refresh` and `⬅️ Menu`.
- Pack panel: title, count, and link; `📎 Open in Telegram`, `🗑 Remove a sticker`, `✏️ Rename`,
  `🔍 Browse stickers`, `⬅️ My packs`.
- Browse: one sticker per message with `◀️ i/n ▶️`, `🗑 Remove`, `✅ Done`; navigation deletes the previous
  browser message and sends the next, because Telegram cannot edit a message into a sticker.
- Remove and Rename flows: a prompt, validated input, and a Cancel button; `/cancel` exits any flow.
- Every callback query is answered with a toast; callback payloads are short typed payloads (`menu:*`,
  `pack:<id>:*`, `flow:cancel`, `noop`) decoded by an Effect `Schema` union, and unknown payloads are ignored
  safely.
- The gestures stay for parity: sending a sticker from one of the user's packs still removes it, and a photo
  with an emoji caption still creates a sticker.

Flow state — which chat is removing or renaming — lives in memory in the Flows service with a 15-minute lazy
expiry; a restart loses flows by design. Every panel edit falls back to sending a fresh panel when the old
message can no longer be edited, and an unchanged message is answered as a no-op.

## Consequences

- Every feature is discoverable without memorising commands, while commands are still registered with
  `setMyCommands` for Telegram's menu button.
- The bot is single-replica by design: in-memory flows do not follow a user to another instance and do not
  survive restarts. Acceptable for a single-instance bot; durable dialog state would need a different
  decision.
- Panels can go stale (old buttons, deleted messages); the layer must answer callbacks safely and re-send
  when needed, which is a first-class case rather than an error.
- Sticker browsing costs one message per sticker with delete-and-resend churn, since Telegram forbids editing
  into sticker content.

## Alternatives considered

- **Commands and help text only.** No new state or messages, but that was exactly the discoverability
  problem; commands are still registered in addition.
- **Reply keyboards.** Lose the edit-in-place panel model, clutter the chat, and cannot carry per-item
  context like a sticker count.
- **Conversation state in PostgreSQL.** Flows would survive restarts, but they are ephemeral by nature, and
  persisting them adds schema and cleanup work for little benefit.
- **A Telegram Mini App or web view.** Disproportionate for a small bot and impossible to keep inside the
  chat's message flow.
