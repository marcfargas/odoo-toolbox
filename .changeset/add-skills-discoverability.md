---
"@marcfargas/odoo-skills": minor
---

Add skills discoverability metadata for ecosystem tooling

Packages can now discover odoo-skills via standardized `.well-known/skills/index.json`:

- Skill registry file at `.well-known/skills/index.json` with schema reference
- Lists skill name, path, and description in machine-readable format
- Enables `npx skills add @marcfargas/odoo-skills` and similar tooling discovery
- `.well-known` directory now included in published package
- README now lists all shipped skills including accounting, attendance, contracts, skill-generation, and mis-builder-dev

This is a non-breaking enhancement that improves integration with AI agent ecosystems.
