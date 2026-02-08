# Agent Instructions

Load `SKILL.md` in this directory as a skill for Odoo integration.

## For Claude Code

The SKILL.md file should be automatically detected when you open this directory.

## For Other Agents

If your agent doesn't auto-detect SKILL.md, instruct it to:

1. Read `SKILL.md` to understand available capabilities
2. Follow the prerequisites section before any Odoo operation
3. Load additional modules as needed from `base/`

## Environment Setup

Copy `.env.example` to `.env` and configure your Odoo credentials:

```bash
cp .env.example .env
# Edit .env with your Odoo URL, database, username, and password
```
