---
"@marcfargas/odoo-state-manager": minor
---

Add a rich content pipeline and translated-field support to the plan/apply engine.

**DSL marker functions** — `md()`, `mdFile()`, `translated()`, `withCss()`, and `html()` let you express content intent directly in resource definitions.

**Transform phase** — a new pipeline stage converts markers to Odoo-ready values: Markdown is rendered to HTML via `marked`, CSS is inlined with `juice`, translated fields are extracted into per-language write operations, and sanitization heuristics emit warnings for fields that may strip markup.

**Translated fields** — `plan()` diffs each active language separately and `apply()` writes each language using `context: { lang }`. Plan output shows per-language changes alongside sanitization warnings.

**Post-apply verification** — after `apply()` completes, `plan()` is re-run automatically to detect any drift between the declared state and what Odoo actually persisted.

**Instance language detection** — the engine auto-detects active languages from the Odoo instance.

**Many2many resolution** — `lookup()` references and inline `ResourceRef` values are now resolved inside many2many arrays.

**`mdFile()` frontmatter stripping** — YAML frontmatter is stripped by default when rendering file-backed Markdown, preventing it from appearing in Odoo HTML output.
