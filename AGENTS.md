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
