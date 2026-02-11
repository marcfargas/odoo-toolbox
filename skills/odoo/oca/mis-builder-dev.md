# MIS Builder — Developing Report Templates

Creating, editing, and styling MIS Builder report templates via RPC.

> **Companion skill**: See `mis-builder.md` for *reading and executing* reports (compute, drilldown, export). This skill covers *authoring* — building the templates themselves.

## Overview

A MIS Builder report template (`mis.report`) defines the **structure** of a financial report: which KPI rows to display, what formulas compute them, and how they look. Templates are time-independent — they become concrete when bound to date periods through report instances.

**Required modules:** `mis_builder`, `date_range`, `report_xlsx`

## Architecture

```
mis.report (Template)
├── mis.report.kpi (Row definitions — the expressions)
│   └── mis.report.kpi.expression (One per sub-KPI, or one if not multi)
├── mis.report.subkpi (Column sub-values: Initial, Debit, Credit, Ending)
├── mis.report.query (Fetch data from non-accounting models)
├── mis.report.subreport (Cross-references to other templates)
└── mis.report.style (Reusable visual styles)
```

## Creating a Report Template

```typescript
// 1. Create the report template
const reportId = await client.create('mis.report', {
  name: 'Custom P&L Report',
  description: 'Profit and Loss for our chart of accounts',
});

// 2. Add KPI rows (the report lines)
const revenueKpiId = await client.create('mis.report.kpi', {
  report_id: reportId,
  name: 'revenue',               // Must be valid Python identifier (a-z, 0-9, _)
  description: '1. Net Revenue',  // Display label
  expression: '-balp[700%,701%,702%,703%,704%,705%]',
  type: 'num',                    // 'num' | 'pct' | 'str'
  compare_method: 'pct',          // 'pct' | 'diff' | 'none'
  accumulation_method: 'sum',     // 'sum' | 'avg' | 'none'
  auto_expand_accounts: true,     // Show account-level detail
  sequence: 10,
});

const costsKpiId = await client.create('mis.report.kpi', {
  report_id: reportId,
  name: 'costs',
  description: '2. Cost of Sales',
  expression: '-balp[600%,601%,602%]',
  type: 'num',
  compare_method: 'pct',
  accumulation_method: 'sum',
  auto_expand_accounts: true,
  sequence: 20,
});

// 3. Computed KPI: references other KPI names
const grossProfitId = await client.create('mis.report.kpi', {
  report_id: reportId,
  name: 'gross_profit',
  description: 'Gross Profit',
  expression: 'revenue + costs',   // References KPIs above by name
  type: 'num',
  compare_method: 'pct',
  accumulation_method: 'sum',
  auto_expand_accounts: false,
  sequence: 30,
});
```

### KPI Name Rules

The `name` field **must be a valid Python identifier**: letters, digits, and underscores, starting with a letter or underscore. This is enforced by a constraint.

```
✅ revenue, cost_of_sales, total_assets, kpi_01
❌ 1_revenue, cost-of-sales, total assets, A)_TOTAL
```

The `description` is the human-readable label. It can contain any characters.

---

## The Expression Language

This is the heart of MIS Builder. Every KPI has an expression that evaluates to a number (or string). Expressions are **valid Python** enhanced with accounting primitives.

### Accounting Expressions — The Full Syntax

```
<field><mode>[<account_selector>][<optional_move_line_domain>]
```

#### Fields (what to measure)

| Field | Meaning | Formula |
|-------|---------|---------|
| `bal` | Balance | `debit - credit` |
| `pbal` | Positive balance only | `debit - credit` if ≥ 0, else `AccountingNone` |
| `nbal` | Negative balance only | `debit - credit` if < 0, else `AccountingNone` |
| `deb` | Total debits | `sum(debit)` |
| `crd` | Total credits | `sum(credit)` |
| `fld` | Custom field | Sum of a specified field (see below) |

#### Modes (when to measure)

| Mode | Meaning | Date logic |
|------|---------|------------|
| `p` | **Period** variation | Moves within `[date_from, date_to]` |
| `i` | **Initial** balance | Cumulative balance *before* `date_from` |
| `e` | **Ending** balance | Cumulative balance *up to* `date_to` |
| `u` | **Unallocated** P&L | Cumulative balance *before* the fiscal year start — prior-year retained earnings for P&L accounts |
| *(none)* | Default = `p` | Same as period variation |
| `s` | Legacy alias | Same as `e` (ending) |

**Fiscal year logic for `i` and `e`**: For balance sheet accounts (`include_initial_balance=True`), sums from the beginning of time. For P&L accounts, sums only from the start of the current fiscal year.

#### Account Selectors

Three syntax forms inside the `[]`:

**1. Account codes with wildcards** (most common):
```
balp[700%]              ← accounts starting with 700
balp[700%,701%,702%]    ← multiple account code patterns
bale[57%]               ← ending balance of cash accounts
```

**2. Odoo domain on account.account**:
```
-balp[('account_type', '=', 'income')]
bale[('account_type', '=', 'asset_cash')]
bale['|', ('account_type', '=', 'liability_current'), ('account_type', '=', 'liability_payable')]
```

**3. Empty selector** (all accounts):
```
debp[]     ← total debits of all accounts over the period
```

#### Optional Move Line Domain

A second `[]` to filter `account.move.line` records:

```
balp[700%][('analytic_account_id', '=', 42)]
balp[600%][('journal_id.type', '=', 'purchase')]
crdp[][('partner_id', '=', 7)]
```

#### Custom Field Sums (`fld`)

Sum any numeric field from move lines, not just debit/credit:

```
fldp.quantity[600%]     ← sum of quantity field on account 600
fldp.amount_currency[700%][('currency_id', '=', 2)]
```

> ⚠️ `fld` only works with mode `p` (period variation).

### Combining Expressions

Expressions are Python, so you can combine accounting expressions with arithmetic:

```python
# Basic arithmetic
-balp[700%,701%]                                  # Negate (revenue is credit, negate for positive)
balp[600%] + balp[610%]                            # Sum of two account groups
-balp[700%] - balp[600%]                           # Revenue minus costs

# Python functions available in expressions
abs(bale[410%])                                    # Absolute value
round(balp[700%] / balp[600%], 2)                  # Division with rounding

# Conditional (ternary)
revenue if revenue > 0 else AccountingNone

# Reference other KPIs by name
revenue + other_income
gross_profit - operating_expenses
total_assets - total_liabilities
```

### Available Variables in Expressions

| Variable | Type | Description |
|----------|------|-------------|
| Other KPI names | number | Value of previously-computed KPIs in sequence order |
| `AccountingNone` | special | Null value that dissolves in arithmetic (see below) |
| `date_from` | `datetime.date` | Period start date |
| `date_to` | `datetime.date` | Period end date |
| `sum`, `min`, `max`, `avg`, `len` | functions | Aggregation helpers |
| `time`, `datetime`, `dateutil` | modules | Python time modules |
| `abs`, `round` | builtins | Standard Python builtins |
| Query names | data | Results from `mis.report.query` (see Queries section) |
| `subreport_name.kpi_name` | number | KPI from a sub-report (see Subreports section) |

### AccountingNone — The Null Value

`AccountingNone` is a special singleton that represents "no data". It behaves like zero in arithmetic but preserves the distinction between "zero" and "no data":

```python
AccountingNone + 100       → 100        # dissolves in addition
AccountingNone - 50        → -50        # dissolves in subtraction
AccountingNone * 2         → 0.0        # multiplication yields 0
AccountingNone / 2         → 0.0        # division yields 0
2 / AccountingNone         → ZeroDivisionError → #DIV/0
bool(AccountingNone)       → False
AccountingNone == 0        → True       # equal to zero in comparisons
```

In display, cells with `AccountingNone` render as empty (no value shown).

### Error Handling in Expressions

| Error | Display | Cause |
|-------|---------|-------|
| `#NAME` | Unresolved reference | KPI name not found (yet) — may resolve after recompute |
| `#DIV/0` | Division by zero | Denominator is zero or `AccountingNone` |
| `#ERR` | Any other exception | Python error in expression |

MIS Builder retries `#NAME` errors in a second pass to handle forward references between KPIs. If still unresolved, it's a real error (typo or circular dependency).

---

## Real-World Expression Patterns

### P&L Report (Spanish PGCE 2008)

```python
# Revenue accounts (credit-normal) — negate to show positive
'-balp[700%,701%,702%,703%,704%,705%,706%,708%,709%]'

# Expense accounts (debit-normal) — negate to show negative
'-balp[600%,601%,602%,606%,607%,608%,609%,61%]'

# Subtotal referencing other KPIs
'+revenue + cost_of_sales + other_income + staff_costs + other_expenses + depreciation'

# Sub-section with multiple components
'+financial_income + financial_expenses + fair_value_changes + exchange_diffs'
```

### Balance Sheet (Spanish PGCE 2008)

```python
# Asset accounts — ending balance
'+bale[20%,280%,290%]'                             # Intangible assets (net of amortization)
'+bale[21%,281%,291%,23%]'                          # Tangible assets

# Liability accounts — negate (credit-normal accounts shown positive)
'-bale[100%,101%,102%]'                             # Share capital
'-bale[120%,121%]'                                  # Retained earnings

# Result of the year (special: P&L accounts + unallocated)
'-bale[129%,6%,7%] - balu[6%,7%]'                  # Net income + unallocated prior P&L

# Positive/negative balance filtering
'+ pbale[5523%]'                                    # Only if positive (asset-side)
'- nbale[550%]'                                     # Only if negative (liability-side)
```

### US-Style Report (Domain Selectors)

```python
# Using account_type instead of code patterns
"-balp[('account_type', '=', 'income')]"             # Operating income
"balp[('account_type', '=', 'expense')]"             # Expenses
"bale[('account_type', '=', 'asset_cash')]"          # Cash & bank
"bale[('account_type', '=', 'asset_receivable'), ('non_trade', '=', False)]"  # Receivables

# Complex domains
"bale['|',('account_type', '=', 'asset_current'), '&', ('account_type', '=', 'asset_receivable'), ('non_trade', '=', True)]"
```

### French P&L (Mixed Patterns)

```python
# Credits shown as revenue (no negation — balp returns debit-credit, so expenses are positive)
'-balp[707%,7097%]'      # Sales of goods
'-balp[701%,702%,703%]'  # Production sold
'balp[607%,608%]'        # Purchases (positive = expense)

# Computed result
'+total_products - total_charges'    # Profit = income - expenses
```

---

## Styles

Styles control visual rendering in UI, PDF, and Excel. They're reusable objects assigned to KPI rows.

### Style Properties

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `color` | char | `#000000`–`#FFFFFF` | Text color (RGB hex) |
| `background_color` | char | `#000000`–`#FFFFFF` | Background color |
| `font_style` | selection | `normal`, `italic` | Font style |
| `font_weight` | selection | `normal`, `bold` | **Note:** source has typo `nornal` for normal |
| `font_size` | selection | `xx-small`, `x-small`, `small`, `medium`, `large`, `x-large`, `xx-large` | Font size |
| `indent_level` | integer | ≥ 0 | Indentation (rendered as `text-indent: Nem`) |
| `prefix` | char | e.g. `€`, `$` | Prefix before number |
| `suffix` | char | e.g. `%`, `EUR` | Suffix after number |
| `dp` | integer | ≥ 0 | Decimal places (rounding) |
| `divider` | selection | `1e-6` (µ), `1e-3` (m), `1` (1), `1e3` (k), `1e6` (M) | Display factor |
| `hide_empty` | boolean | | Hide row if all values are empty |
| `hide_always` | boolean | | Always hide this row |

### Inheritance System

Each property has a companion `*_inherit` boolean (default `True`). When `True`, the property value is ignored and inherited from the parent (report-level default). Set `*_inherit = False` to override.

### Creating Styles

```typescript
// Create styles
const headerStyleId = await client.create('mis.report.style', {
  name: 'Report Header',
  font_weight_inherit: false,
  font_weight: 'bold',
  color_inherit: false,
  color: '#ffa500',           // Orange
  indent_level_inherit: false,
  indent_level: 0,
});

const subtotalStyleId = await client.create('mis.report.style', {
  name: 'Subtotal Row',
  font_weight_inherit: false,
  font_weight: 'bold',
  indent_level_inherit: false,
  indent_level: 0,
});

const detailStyleId = await client.create('mis.report.style', {
  name: 'Detail Row',
  indent_level_inherit: false,
  indent_level: 2,            // Indented 2em
});

const detailItalicStyleId = await client.create('mis.report.style', {
  name: 'Detail Row Italic',
  indent_level_inherit: false,
  indent_level: 2,
  font_style_inherit: false,
  font_style: 'italic',
});

// Style with number formatting
const thousandsStyleId = await client.create('mis.report.style', {
  name: 'Thousands',
  dp_inherit: false,
  dp: 0,
  divider_inherit: false,
  divider: '1e3',             // Show values in thousands
  suffix_inherit: false,
  suffix: 'k',
});

// Hidden row (for intermediate calculations)
const hiddenStyleId = await client.create('mis.report.style', {
  name: 'Hidden',
  hide_always_inherit: false,
  hide_always: true,
});
```

### Assigning Styles to KPIs

```typescript
await client.write('mis.report.kpi', [grossProfitKpiId], {
  style_id: subtotalStyleId,
});
```

### Conditional Styles (style_expression)

The `style_expression` field on a KPI allows dynamic styling based on the KPI value at render time. It must evaluate to a style name (string) or `None`.

```typescript
await client.write('mis.report.kpi', [netProfitKpiId], {
  // Show "Loss Style" if negative, otherwise no override
  style_expression: '"Loss Style" if net_profit < 0 else None',
});

// Traffic light with three severity levels
// style_expression: '"Style Red" if value < 0 else "Style Green" if value > 1000 else "Style Amber"'
```

> ⚠️ The style referenced by name must exist as a `mis.report.style` record. The expression is evaluated in the same context as KPI expressions, so you can reference KPI names.

> ⚠️ **`style_expression` applies at the CELL level, not the row level.** In the `compute()` output, `row.style` always reflects the base `style_id`; the `style_expression` result appears only in `cell.style`. Both are CSS strings. When reading computed reports programmatically, always check `cell.style` for the effective color/formatting — not `row.style`.

### Account Detail Row Styling

When `auto_expand_accounts = True`, individual account rows appear beneath the KPI. These can have their own style:

```typescript
await client.write('mis.report.kpi', [revenueKpiId], {
  auto_expand_accounts: true,
  auto_expand_accounts_style_id: detailItalicStyleId,
});
```

---

## Sub-KPIs (Multi-Column Values)

Sub-KPIs allow a single KPI row to display multiple values — for example: Initial Balance, Debit, Credit, Ending Balance.

### Setting Up Sub-KPIs

```typescript
// 1. Define sub-KPIs on the report template
const subkpiIds = [];
for (const [seq, name, desc] of [
  [1, 'initial', 'Initial'],
  [2, 'debit',   'Debit'],
  [3, 'credit',  'Credit'],
  [4, 'ending',  'Ending'],
]) {
  const id = await client.create('mis.report.subkpi', {
    report_id: reportId,
    name: name,          // Valid Python identifier
    description: desc,
    sequence: seq,
  });
  subkpiIds.push(id);
}

// 2. Create a KPI with multi=true
const kpiId = await client.create('mis.report.kpi', {
  report_id: reportId,
  name: 'cash_accounts',
  description: 'Cash & Bank',
  multi: true,
  type: 'num',
  sequence: 10,
});

// 3. Create one expression per sub-KPI
// When multi=true, expressions are stored in mis.report.kpi.expression
// with a link to the sub-KPI
await client.create('mis.report.kpi.expression', {
  kpi_id: kpiId,
  subkpi_id: subkpiIds[0],  // initial
  name: 'bali[57%]',
});
await client.create('mis.report.kpi.expression', {
  kpi_id: kpiId,
  subkpi_id: subkpiIds[1],  // debit
  name: 'debp[57%]',
});
await client.create('mis.report.kpi.expression', {
  kpi_id: kpiId,
  subkpi_id: subkpiIds[2],  // credit
  name: 'crdp[57%]',
});
await client.create('mis.report.kpi.expression', {
  kpi_id: kpiId,
  subkpi_id: subkpiIds[3],  // ending
  name: 'bale[57%]',
});
```

### Non-Multi KPIs Referencing Multi Values

A non-multi KPI can reference a multi-valued KPI. It receives a tuple and must return a scalar or tuple:

```python
# If "cash_accounts" is multi (initial, debit, credit, ending),
# referencing it in a non-multi KPI yields a tuple.
# You can sum its components or pick one:
'cash_accounts'          # Returns the tuple as-is → error unless KPI is also multi
'cash_accounts[0]'       # Not supported — use sub-KPI expressions instead
```

> **Rule**: If a report has sub-KPIs, non-multi KPIs must evaluate to a scalar or a tuple of the same length as the number of sub-KPIs.

---

## Queries (Non-Accounting Data)

Queries let you pull data from **any Odoo model** into KPI expressions — not just accounting.

### Creating a Query

```typescript
// Get model and field IDs first
const [saleModel] = await client.searchRead('ir.model',
  [['model', '=', 'sale.order']], { fields: ['id'], limit: 1 });

const saleFields = await client.searchRead('ir.model.fields',
  [['model_id', '=', saleModel.id], ['name', 'in', ['amount_total', 'date_order']]],
  { fields: ['id', 'name'] });

const amountField = saleFields.find(f => f.name === 'amount_total');
const dateField = saleFields.find(f => f.name === 'date_order');

// Create the query
const queryId = await client.create('mis.report.query', {
  report_id: reportId,
  name: 'confirmed_sales',        // Used as variable name in expressions
  model_id: saleModel.id,
  field_ids: [[6, 0, [amountField.id]]],
  date_field: dateField.id,
  aggregate: 'sum',                // 'sum' | 'avg' | 'min' | 'max' | null
  domain: "[('state', 'in', ['sale', 'done'])]",
});
```

### Using Queries in Expressions

With `aggregate` set, the query returns a single object with the aggregated field values:

```python
# Query "confirmed_sales" with aggregate='sum' on field amount_total
'confirmed_sales.amount_total'           # Total confirmed sales amount
'confirmed_sales.count'                  # Count of matching records
```

Without `aggregate`, the query returns a **list of objects** — one per matching record:

```python
# Query without aggregate → list of AutoStruct objects
'sum([s.amount_total for s in confirmed_sales])'     # Manual aggregation
'len(confirmed_sales)'                                # Count
```

### Query Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | char | Yes | Variable name (valid Python identifier) |
| `model_id` | many2one | Yes | Target model (`ir.model`) |
| `field_ids` | many2many | Yes | Fields to fetch (`ir.model.fields`) |
| `date_field` | many2one | Yes | Date field to filter by period |
| `aggregate` | selection | No | `sum`, `avg`, `min`, `max`, or empty |
| `domain` | char | No | Odoo domain to filter records |
| `company_field_id` | many2one | No | Field for multi-company filtering |

---

## Subreports (Cross-Report References)

A report template can include KPIs from another template using subreports. This enables composition — e.g., a Balance Sheet that references the P&L for "Current Year Earnings".

### Setting Up Subreports

```typescript
// The P&L template already exists with ID = plReportId
// Create a Balance Sheet template that references it
const bsReportId = await client.create('mis.report', {
  name: 'Balance Sheet',
});

// Link P&L as a subreport with a variable name
await client.create('mis.report.subreport', {
  report_id: bsReportId,
  subreport_id: plReportId,
  name: 'pl_report',            // Variable name to access it
});

// Now in Balance Sheet KPI expressions, reference P&L KPIs:
await client.create('mis.report.kpi', {
  report_id: bsReportId,
  name: 'current_year_earnings',
  description: 'Current Year Earnings',
  expression: 'pl_report.net_profit',    // Access P&L's "net_profit" KPI
  sequence: 50,
  type: 'num',
});
```

### Real-World Example: US Balance Sheet

The US Balance Sheet template (from `l10n_us_mis_financial_report`) references a P&L subreport:

```python
# Subreport named "subreport_pl_us" pointing to the P&L template
# In balance sheet KPI:
'subreport_pl_us.net_profit'     # Current year earnings = P&L net profit
```

### Constraints

- Subreport `name` must be a valid Python identifier
- Subreport names must be unique within a report
- **No circular references** — a report cannot (directly or indirectly) be its own subreport
- The same template cannot be included twice as a subreport of the same report

---

## KPI Fields Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | char | Yes | — | Python identifier for expression references |
| `description` | char | Yes | — | Display label (supports translation) |
| `expression` | char | computed | — | Convenience field; for non-multi KPIs, writes to the single `expression_ids` record |
| `multi` | boolean | No | `false` | Enable sub-KPI mode |
| `type` | selection | Yes | `num` | `num` (numeric), `pct` (percentage), `str` (string) |
| `compare_method` | selection | Yes | `pct` | `pct` (percentage diff), `diff` (absolute diff), `none` |
| `accumulation_method` | selection | Yes | `sum` | `sum`, `avg`, `none` — how values are adjusted pro-rata for different time periods |
| `sequence` | integer | No | `100` | Display order |
| `style_id` | many2one | No | — | `mis.report.style` for this row |
| `style_expression` | char | No | — | Python expression returning a style name or `None` |
| `auto_expand_accounts` | boolean | No | `false` | Show per-account detail rows |
| `auto_expand_accounts_style_id` | many2one | No | — | Style for expanded account rows |
| `report_id` | many2one | Yes | — | Parent `mis.report` |

### Type Defaults

When you change `type`, these defaults are automatically suggested:

| Type | compare_method | accumulation_method |
|------|---------------|---------------------|
| `num` (Numeric) | `pct` (Percentage) | `sum` |
| `pct` (Percentage) | `diff` (Difference) | `avg` |
| `str` (String) | `none` | `none` |

### Accumulation Method

Controls how values are normalized when the report period differs from the data period:

- **`sum`**: Values scale proportionally (e.g., revenue: 6 months → 1 year = ×2)
- **`avg`**: Values are averaged with pro-rata weighting (e.g., headcount, ratios)
- **`none`**: No normalization (e.g., string values)

---

## Report Template Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | char | Yes | — | Template name |
| `description` | char | No | — | Template description |
| `style_id` | many2one | No | — | Default style for all rows |
| `kpi_ids` | one2many | — | — | KPI definitions |
| `subkpi_ids` | one2many | — | — | Sub-KPI definitions |
| `query_ids` | one2many | — | — | Data queries |
| `subreport_ids` | one2many | — | — | Sub-report references |
| `move_lines_source` | many2one | auto | `account.move.line` | Source model for accounting expressions |

### move_lines_source

By default, accounting expressions query `account.move.line`. This can be changed to any "move-line-like" model — any model that has `debit`, `credit`, `account_id`, `date`, and `company_id` fields. This enables using database views or custom models as data sources.

---

## Reading and Editing Existing Templates

### Listing All Templates

```typescript
const templates = await client.searchRead('mis.report', [], {
  fields: ['id', 'name', 'description'],
});
```

### Reading a Template's KPIs

```typescript
const kpis = await client.searchRead('mis.report.kpi',
  [['report_id', '=', reportId]],
  {
    fields: [
      'name', 'description', 'expression', 'type', 'compare_method',
      'accumulation_method', 'sequence', 'style_id', 'style_expression',
      'auto_expand_accounts', 'auto_expand_accounts_style_id', 'multi',
    ],
    order: 'sequence asc',
    limit: 0,
  }
);
```

### Reading Styles

```typescript
const styles = await client.searchRead('mis.report.style', [], {
  fields: [
    'name', 'color', 'color_inherit', 'background_color', 'background_color_inherit',
    'font_style', 'font_style_inherit', 'font_weight', 'font_weight_inherit',
    'font_size', 'font_size_inherit', 'indent_level', 'indent_level_inherit',
    'prefix', 'prefix_inherit', 'suffix', 'suffix_inherit',
    'dp', 'dp_inherit', 'divider', 'divider_inherit',
    'hide_empty', 'hide_empty_inherit', 'hide_always', 'hide_always_inherit',
  ],
  limit: 0,
});
```

### Modifying a KPI

```typescript
// Change expression
await client.write('mis.report.kpi', [kpiId], {
  expression: '-balp[700%,701%,702%,703%]',
});

// Change sequence (reorder)
await client.write('mis.report.kpi', [kpiId], {
  sequence: 25,
});

// Assign a style
await client.write('mis.report.kpi', [kpiId], {
  style_id: styleId,
});
```

### Deleting a KPI

```typescript
await client.unlink('mis.report.kpi', [kpiId]);
```

### Duplicating a Template

```typescript
// copy() handles sub-KPI reference patching automatically
const newReportId = await client.call('mis.report', 'copy', [[reportId], {}]);
```

---

## Building a Complete P&L Report — Step by Step

This example creates a minimal but functional P&L report programmatically:

```typescript
// === Step 1: Create styles ===
const boldStyle = await client.create('mis.report.style', {
  name: 'PL Bold',
  font_weight_inherit: false,
  font_weight: 'bold',
});

const indentStyle = await client.create('mis.report.style', {
  name: 'PL Indent',
  indent_level_inherit: false,
  indent_level: 1,
});

const totalStyle = await client.create('mis.report.style', {
  name: 'PL Total',
  font_weight_inherit: false,
  font_weight: 'bold',
  background_color_inherit: false,
  background_color: '#f0f0f0',
});

// === Step 2: Create report template ===
const reportId = await client.create('mis.report', {
  name: 'Simple P&L',
  style_id: indentStyle,   // Default style for all rows
});

// === Step 3: Define KPIs ===
const kpis = [
  { seq: 10,  name: 'revenue',     desc: 'Revenue',                expr: '-balp[700%,701%,702%,703%,704%,705%]',                           style: boldStyle, expand: true },
  { seq: 20,  name: 'cogs',        desc: 'Cost of Goods Sold',     expr: '-balp[600%,601%,602%]',                                           style: null,      expand: true },
  { seq: 30,  name: 'gross',       desc: 'GROSS PROFIT',           expr: 'revenue + cogs',                                                  style: totalStyle, expand: false },
  { seq: 40,  name: 'staff',       desc: 'Staff Costs',            expr: '-balp[64%]',                                                      style: null,      expand: true },
  { seq: 50,  name: 'other_exp',   desc: 'Other Expenses',         expr: '-balp[62%,63%,65%]',                                              style: null,      expand: true },
  { seq: 60,  name: 'depreciation',desc: 'Depreciation',           expr: '-balp[68%]',                                                      style: null,      expand: true },
  { seq: 70,  name: 'ebitda',      desc: 'EBITDA',                 expr: 'gross + staff + other_exp',                                       style: boldStyle, expand: false },
  { seq: 80,  name: 'ebit',        desc: 'EBIT',                   expr: 'ebitda + depreciation',                                           style: boldStyle, expand: false },
  { seq: 90,  name: 'fin_income',  desc: 'Financial Income',       expr: '-balp[76%]',                                                      style: null,      expand: true },
  { seq: 100, name: 'fin_expense', desc: 'Financial Expenses',     expr: '-balp[66%]',                                                      style: null,      expand: true },
  { seq: 110, name: 'ebt',         desc: 'PROFIT BEFORE TAX',      expr: 'ebit + fin_income + fin_expense',                                 style: boldStyle, expand: false },
  { seq: 120, name: 'tax',         desc: 'Income Tax',             expr: '-balp[630%,633%]',                                                style: null,      expand: true },
  { seq: 130, name: 'net_profit',  desc: 'NET PROFIT',             expr: 'ebt + tax',                                                       style: totalStyle, expand: false },
];

for (const kpi of kpis) {
  await client.create('mis.report.kpi', {
    report_id: reportId,
    sequence: kpi.seq,
    name: kpi.name,
    description: kpi.desc,
    expression: kpi.expr,
    type: 'num',
    compare_method: 'pct',
    accumulation_method: 'sum',
    auto_expand_accounts: kpi.expand,
    style_id: kpi.style || false,
  });
}

// === Step 4: Test — create instance and compute ===
const companies = await client.searchRead('res.company', [], {
  fields: ['id'], limit: 1,
});

const instanceId = await client.create('mis.report.instance', {
  name: 'P&L Test 2025',
  report_id: reportId,
  company_id: companies[0].id,
  target_move: 'posted',
  comparison_mode: false,
  date_from: '2025-01-01',
  date_to: '2025-12-31',
});

// Create period (required even in non-comparison mode, auto-created by UI)
await client.create('mis.report.instance.period', {
  name: 'FY 2025',
  report_instance_id: instanceId,
  mode: 'fix',
  manual_date_from: '2025-01-01',
  manual_date_to: '2025-12-31',
});

const result = await client.call('mis.report.instance', 'compute', [[instanceId]]);
console.log('Report rows:', result.body.length);
```

---

## Common Patterns

### Sign Convention

Odoo stores everything as debit/credit. Revenue (credit-normal) has negative `debit - credit`. Expenses (debit-normal) have positive `debit - credit`. To display revenue as positive in a P&L:

```python
# P&L: negate credit-normal accounts
'-balp[700%]'     # Revenue shown positive
'-balp[600%]'     # Costs shown negative (expense accounts are debit-normal,
                  # so balp is positive, negation makes them negative)
```

For a Balance Sheet, the convention depends on the localization, but commonly:
```python
# Assets: positive (debit-normal)
'+bale[2%]'

# Liabilities & equity: negate (credit-normal)
'-bale[1%]'       # Capital shown positive
'-bale[4%]'       # Payables shown positive
```

### Section Headers (No Expression)

A KPI can serve as a section header without a formula. Use `hide_empty: false` and leave the expression referencing child KPIs:

```typescript
await client.create('mis.report.kpi', {
  report_id: reportId,
  name: 'section_financial',
  description: 'B) FINANCIAL RESULT',
  expression: 'fin_income + fin_expense + fair_value + exchange_diff',
  style_id: headerStyleId,
  sequence: 250,
  type: 'num',
});
```

### Hidden Intermediate KPIs

For calculations you don't want visible:

```typescript
await client.create('mis.report.kpi', {
  report_id: reportId,
  name: 'helper_ratio',
  description: 'Helper',
  expression: 'assets / liabilities',
  style_id: hiddenStyleId,      // hide_always = true
  sequence: 999,
  type: 'num',
});
```

### Percentage KPIs

```typescript
await client.create('mis.report.kpi', {
  report_id: reportId,
  name: 'gross_margin',
  description: 'Gross Margin %',
  expression: 'gross / revenue if revenue else AccountingNone',
  type: 'pct',                    // Renders as percentage
  compare_method: 'diff',         // Compare by difference in percentage points
  accumulation_method: 'avg',     // Average when spanning periods
  sequence: 35,
});
```

### Division-by-Zero Guard

Always protect division expressions. The standard pattern:

```python
'numerator / denominator if denominator else AccountingNone'
```

When the denominator is `AccountingNone` (no data), it's falsy, so the guard triggers. When it's `0.0`, the guard also triggers. This prevents `#DIV/0` errors and hides the row when there's no meaningful data.

### Conditional Comment Lines

A powerful pattern: add `type: 'str'` KPIs that display contextual explanations below a ratio, with severity-colored text via `style_expression`. The text and color both change based on the ratio's value.

```typescript
// 1. Create severity styles
const goodStyle = await client.create('mis.report.style', {
  name: 'Comment Good',
  indent_level_inherit: false, indent_level: 2,
  font_style_inherit: false, font_style: 'italic',
  font_size_inherit: false, font_size: 'small',
  color_inherit: false, color: '#2e7d32',        // green
});

const warnStyle = await client.create('mis.report.style', {
  name: 'Comment Warn',
  indent_level_inherit: false, indent_level: 2,
  font_style_inherit: false, font_style: 'italic',
  font_size_inherit: false, font_size: 'small',
  color_inherit: false, color: '#e65100',        // amber
});

const badStyle = await client.create('mis.report.style', {
  name: 'Comment Bad',
  indent_level_inherit: false, indent_level: 2,
  font_style_inherit: false, font_style: 'italic',
  font_size_inherit: false, font_size: 'small',
  color_inherit: false, color: '#b71c1c',        // red
  font_weight_inherit: false, font_weight: 'bold',
});

// 2. Create the comment KPI right after the ratio (sequence = ratio + 1)
await client.create('mis.report.kpi', {
  report_id: reportId,
  name: 'c_liquidity',
  description: '',                 // Empty — text comes from expression
  type: 'str',
  compare_method: 'none',
  accumulation_method: 'none',
  sequence: 291,                   // Right after ratio_liquidity at 290

  // Conditional text (Python ternary chain)
  expression: '"Comfortable — can cover short-term debt with margin" if ratio_liquidity >= 1.5 '
    + 'else "Tight — covers short-term debt but no margin" if ratio_liquidity >= 1 '
    + 'else "Insufficient — cannot cover short-term liabilities"',

  // Default style (fallback)
  style_id: warnStyle,

  // Conditional color: overrides style_id at the cell level
  style_expression: '"Comment Good" if ratio_liquidity >= 1.5 '
    + 'else "Comment Warn" if ratio_liquidity >= 1 '
    + 'else "Comment Bad"',
});
```

**Key details:**
- `description` is empty — the displayed text comes entirely from the expression
- The expression returns a Python string (wrapped in quotes), not a number
- Use `AccountingNone` as the return value to **hide** the comment when there's no data:
  `'("text" if condition else "other") if ratio is not AccountingNone else AccountingNone'`
- `style_expression` must return an **exact style name** that exists in `mis.report.style` — looked up with `search([('name', '=', style_name)])`

### Subreport-Based Ratio Reports

A proven architecture for financial ratio reports that derive values from existing BS and P&L templates:

```
Report: "Financial Ratios"
├── Subreport: bs → Balance Sheet template
├── Subreport: pl → P&L template
├── Hidden KPIs: pull values from subreports (bs.total_assets, pl.revenue, ...)
├── Hidden KPIs: derived intermediates (total_debt, ebitda, ...)
├── Section KPIs: visual headers (type: 'str', bold style)
├── Visible KPIs: the actual ratios (referencing hidden KPIs by name)
└── Comment KPIs: conditional explanations (type: 'str', style_expression)
```

**Why hidden building blocks?** Subreport references like `bs.es10000` are verbose. Pulling them into named hidden KPIs (`total_assets`) makes ratio expressions clean and readable: `total_assets / total_debt` instead of `bs.es10000 / (bs.es31000 + bs.es32000)`.

### Section Headers (Pure Label)

For visual section separators with no computed value:

```typescript
await client.create('mis.report.kpi', {
  report_id: reportId,
  name: 'sec_profitability',
  description: 'PROFITABILITY',
  expression: 'AccountingNone',    // No value — just the label
  type: 'str',
  compare_method: 'none',
  accumulation_method: 'none',
  style_id: sectionHeaderStyle,    // Bold, background color
  sequence: 410,
});
```

Using `type: 'str'` with `expression: 'AccountingNone'` is cleaner than a `type: 'num'` header — it won't render zeros or empty cells, just the description text as a label.

### Sequencing Strategy

Leave gaps in sequence numbers to allow inserting rows later (e.g., comment lines):

```typescript
// Use increments of 10 for main KPIs
// sequence: 10, 20, 30, ...
// Insert comments at 11, 21, 31, ...

// If you need to retrofit comments on an existing report,
// re-sequence first by multiplying all sequences:
const kpis = await client.searchRead('mis.report.kpi',
  [['report_id', '=', reportId]], { fields: ['id', 'sequence'], limit: 0 });
for (const k of kpis) {
  await client.write('mis.report.kpi', [k.id], { sequence: k.sequence * 3 });
}
// Now you have gaps of 3 between each KPI to insert comments
```

---

## Expression Syntax — Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│  FIELD   MODE   ACCOUNT SELECTOR   MOVE LINE FILTER     │
│  ─────   ────   ─────────────────  ─────────────────    │
│  bal     p      [700%,701%]        [('journal_id','=',1)]│
│  pbal    i      [('type','=','x')] (optional)           │
│  nbal    e      []                                      │
│  deb     u      [600%]                                  │
│  crd                                                    │
│  fld.qty p only                                         │
│                                                         │
│  COMBINING:                                             │
│  kpi1 + kpi2                    KPI cross-reference     │
│  subreport_name.kpi_name        Subreport reference     │
│  query_name.field_name          Query data              │
│  -balp[700%] + balp[740%]       Arithmetic              │
│  abs(val), round(val, 2)        Python builtins         │
│  x if condition else y          Conditional             │
│  AccountingNone                 Null/no-data value      │
└─────────────────────────────────────────────────────────┘
```

## Related Documents

- [mis-builder.md](./mis-builder.md) — Reading, computing, drilldown, and exporting reports
- [../modules/accounting.md](../modules/accounting.md) — Accounting model patterns and gotchas
- [../base/introspection.md](../base/introspection.md) — Schema discovery
- [../base/crud.md](../base/crud.md) — CRUD patterns

## Source References

- MIS Builder repo: https://github.com/OCA/mis-builder (see `mis_builder/models/`)
- Expression engine: `aep.py` — `AccountingExpressionProcessor._ACC_RE` regex
- Style system: `mis_report_style.py` — `MisReportKpiStyle`, `PROPS`, merge logic
- Safe eval: `mis_safe_eval.py` — uses Odoo's `safe_eval` with `_SAFE_OPCODES`
- Spanish templates: https://github.com/OCA/l10n-spain/tree/17.0/l10n_es_mis_report/data
- French templates: https://github.com/OCA/l10n-france/tree/18.0/l10n_fr_mis_reports/data
- US templates: https://github.com/OCA/l10n-usa/tree/18.0/l10n_us_mis_financial_report/data
