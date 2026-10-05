# Adopt Effect v4 for the bot core

**Status**: accepted

## Context

The TypeScript rewrite replaced the Python bot but kept plain `async`/`await`: handlers talk to grammY and
Drizzle directly, expected Telegram failures surface as raw `GrammyError`, environment is read by a
hand-written loader, and retry and logging logic is ad hoc. The maintainer wants the core to match the
discipline used elsewhere in their stack: typed errors, services, validated configuration, structured logging,
and bounded retry.

Effect 4.0.0 is stable (released 2026-10-01) and clears the repository's three-day release quarantine; 4.0.1
does not, and the quarantine must not be defeated for this work.

## Decision

Adopt `effect@4.0.0` (exact pin) for the bot core, using the v4 conventions:

- services defined with `Context.Service`, `Layer.effect`, and `Service.of` — Telegram adapter, Database,
  Users, Packs, Flows, and Logger;
- operations written with `Effect.fn("Domain.operation")`;
- expected failures modelled as `Schema.TaggedError` classes (`TelegramError`, `TelegramRateLimited`,
  `StickerSetTooMuch`, `StickerSetInvalid`, `StickerSetNotModified`, `ChatUnavailable`);
- environment read through `Config` recipes with the same validation as before;
- one `ManagedRuntime` built at startup and disposed on shutdown;
- an Effect logger that emits evlog wide events, so services log through `Effect.log*`;
- bounded retry in the Telegram adapter only, honouring `retry_after`; no grammY `auto-retry` plugin, to
  avoid double retries;
- no `as any` or casts to satisfy Effect typing.

grammY stays the transport: middleware and handlers are thin adapters that run programs on the shared
runtime, and typed errors are mapped to user-facing replies in one place.

## Consequences

- Expected Telegram failures become explicit, testable values; retry, logging, and configuration each get a
  single home.
- Handlers shrink to adapters, and the Drizzle query layer stays the only data-access path.
- Contributors must learn Effect v4 idioms; AGENTS.md documents the conventions, and the dependency stays
  pinned at 4.0.0 until the quarantine clears 4.0.1+.
- The runtime adds startup and shutdown complexity to a small bot, and Effect's type errors are heavier to
  read than plain promises.

## Alternatives considered

- **Keep plain `async`/`await` and tighten it by hand.** Less machinery, but errors, retry, config, and
  logging stay bespoke and drift; the maintainer already runs Effect elsewhere.
- **Effect 3.x.** Mature, but the stack is on v4 idioms, and starting a rework one major version behind would
  mean migrating again soon.
- **Effect 4.0.1.** Blocked by the repository's release quarantine; installing it would mean defeating a
  deliberate safety rule for no gain.
- **Replace grammY with an Effect-native Telegram client.** No mature option covers the Bot API surface the
  bot needs; the adapter is small and keeps grammY for what it is good at.
