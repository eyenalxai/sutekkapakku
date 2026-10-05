# Sutekkapakku — agent guide

Sutekkapakku ("sticker pack" in Finnish) is a Telegram bot that lets users collect
stickers into personal sticker packs. This repository is being rewritten in
TypeScript (grammY + Drizzle ORM, running on Bun) from the original Python
implementation (aiogram + SQLAlchemy + Alembic). The original Python code lives in
git history; tag `python-final` marks its final state.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`eyenalxai/sutekkapakku`), managed with the `gh` CLI.
See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Stack

- Runtime: Bun (`bun --bun ...` — never fall back to Node)
- Bot framework: grammY
- ORM: Drizzle ORM against PostgreSQL
- Deployment: Railway (Infrastructure as Code in `.railway/railway.ts` using the `railway` SDK; Railpack builder, no Dockerfile)
- Linting: oxlint

## Working rules

- No backwards compatibility. Refactor freely; optimize for long-term maintenance and best practices.
- Use subagents as much as possible, parallelize as much as possible. Do implementation work in separate rifts (git worktrees) and bring changes back by rebasing onto `main` — never merge.
- Bun is the runtime, used properly: `bun --bun run <script>`, `bun --bun test`, `bun --bun x <tool>`.
- Do not run dev servers or start the bot locally, and do not use a browser. Verify with `bun --bun run check` and the tests.
- All database access goes through Drizzle ORM. Never write raw SQL, even for tooling or verification — keep intermediate results in memory if needed. The one exception is the SQL inside generated migration files.
- Generate and apply migrations with commands only: `bun run db:generate`, `bun run db:migrate` (or `bun --bun x drizzle-kit generate --custom --name=<name>` for custom ones). Never create or edit migration files by hand.
- No data loss is paramount: production data must remain intact and readable at every step, and nothing is dropped unless explicitly requested.
- No re-exports and no barrel files. Import from the module that owns the code.
- Place files where they belong; respect the project structure.
- Do not write comments unless they explain a hard "why this way?" question that the code cannot answer itself.
- Do not suppress oxlint rules unless absolutely justified; surface every suppression in the change description.

## Testing

- Do not add tests.
- Do not test the Telegram Bot API. No fake Bot API servers, no handler round-trip harnesses, no assertions on API call payloads.
- Existing tests are kept only while they cover genuine risk (restoring production data, schema parity with production, image-resizing edge cases). Delete tests that no longer earn their place; an existing test is not a reason to keep it.
