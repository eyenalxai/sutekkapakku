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
- Deployment: Railway (Infrastructure as Code in `.railway/railway.ts` using the `railway` SDK)
- Linting: oxlint

## Working rules

- No backwards compatibility. Refactor freely; optimize for long-term maintenance and best practices.
- Use subagents as much as possible, parallelize as much as possible. Do implementation work in separate rifts (git worktrees) and bring changes back by rebasing onto `main` — never merge.
- Bun is the runtime, used properly: `bun --bun run <script>`, `bun --bun test`, `bun --bun x <tool>`.
- All database access goes through Drizzle ORM. Never write raw SQL, even for migrations tooling — keep intermediate results in memory if needed.
- Generate migrations with commands only: `bun run db:generate` (or `bun --bun x drizzle-kit generate --custom --name=<name>`). Never create migration files by hand.
- No data loss is paramount: production data must remain intact and readable at every step.
- No re-exports and no barrel files. Import from the module that owns the code.
- Place files where they belong; respect the project structure.
- Do not write comments unless they explain a hard "why this way?" question that the code cannot answer itself.
- Do not suppress oxlint rules unless absolutely justified; surface every suppression in the change description.
