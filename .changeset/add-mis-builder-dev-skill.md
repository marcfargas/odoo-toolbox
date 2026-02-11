---
"@marcfargas/odoo-skills": minor
"@marcfargas/create-odoo-skills": minor
---

Add MIS Builder report authoring skill (`oca/mis-builder-dev.md`)

New skill for creating and editing MIS Builder report templates via RPC, covering:

- **Expression language**: Complete reference for the accounting expression syntax — fields (`bal`, `pbal`, `nbal`, `crd`, `deb`, `fld`), modes (`p`, `i`, `e`, `u`), account selectors (code patterns, domains), move line filters, and custom field sums
- **Real-world patterns**: Annotated examples from Spanish (PGCE 2008), French, and US report templates showing both code-based and domain-based account selectors
- **Styles**: All 12 style properties, inheritance system, conditional `style_expression` with severity-colored comments
- **Sub-KPIs**: Multi-column value setup for reports needing Initial/Debit/Credit/Ending columns
- **Queries**: Fetching non-accounting data from arbitrary Odoo models
- **Subreports**: Cross-report KPI composition (e.g., Balance Sheet referencing P&L for current year earnings)
- **Proven patterns**: Conditional comment lines, subreport-based ratio reports, division-by-zero guards, section headers, sequencing strategies

Also updates `oca/mis-builder.md` with `row.style` vs `cell.style` gotcha and expanded model reference.
