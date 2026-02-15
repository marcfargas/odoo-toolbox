---
"@marcfargas/odoo-skills": patch
---

Add CI validation for both skills installation paths

New `validate-skills` job in CI verifies skills install correctly before merge:
- SKILL.md validation against Agent Skills spec (`agentskills validate`)
- GitHub repo path: `skills add .` (simulates `skills add marcfargas/odoo-toolbox`)
- npm package path: `skills add ./packages/odoo-skills` (simulates `skills add @marcfargas/odoo-skills`)
- Both discovery (`--list`) and full install into throwaway `$HOME`
