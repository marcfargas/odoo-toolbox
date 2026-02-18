---
"@marcfargas/odoo-skills": minor
---

Skill docs overhaul: add safety model, cut 24% token bloat.

- Add Safety Model table to SKILL.md classifying all operations as READ/WRITE/DESTRUCTIVE
- Cut 57KB across 13 skill docs (238KB → 181KB) — remove boilerplate, duplicates, common-sense patterns
- Preserve all Odoo-specific gotchas and testable code blocks
- New skill docs: `base/urls.md` (URL generation), updated `modules/accounting.md`
- Simplified `mail/chatter.md` and `mail/discuss.md`
