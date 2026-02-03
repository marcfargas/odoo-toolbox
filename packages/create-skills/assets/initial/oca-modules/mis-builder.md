# MIS Builder

Working with OCA MIS Builder for financial reports (PnL, Balance Sheet).

## Overview

MIS Builder (Management Information System Builder) is an OCA module for creating customizable financial reports. It computes KPI-based reports from accounting data with support for periods, comparisons, and drill-down to journal entries.

**Required modules:**
- `mis_builder` (core)
- `date_range` (from OCA/server-ux)
- `report_xlsx` (from OCA/reporting-engine)

**Optional:**
- `l10n_es_mis_report` - Spanish PGCE 2008 report templates

## Key Models

| Model | Description |
|-------|-------------|
| `mis.report` | Report template defining KPIs and structure |
| `mis.report.instance` | Configured report for specific periods/companies |
| `mis.report.instance.period` | Period configuration within an instance |
| `mis.report.kpi` | KPI/row definitions with formulas |
| `mis.report.style` | Visual styling for reports |

## Listing Report Templates

```typescript testable id="mis-list-templates" needs="client" expect="result.count >= 0"
// List all MIS report templates
const reports = await client.searchRead('mis.report', [], {
  fields: ['id', 'name', 'description']
});

reports.forEach(r => {
  console.log(`[${r.id}] ${r.name}`);
});

return { count: reports.length };
```

## Creating a Report Instance

To compute a report, you need a `mis.report.instance` linked to a template and at least one period.

```typescript
// Get company ID
const companies = await client.searchRead('res.company', [], {
  fields: ['id', 'name'],
  limit: 1
});
const companyId = companies[0].id;

// Create report instance
const instanceId = await client.create('mis.report.instance', {
  name: 'P&L Report 2024',
  report_id: 7,  // Template ID (e.g., PyG PYME)
  company_id: companyId,
  target_move: 'posted',  // 'posted' or 'all'
  comparison_mode: false,
});

// Create a period for the instance
const periodId = await client.create('mis.report.instance.period', {
  name: 'Year 2024',
  report_instance_id: instanceId,
  mode: 'fix',  // 'fix' for manual dates
  manual_date_from: '2024-01-01',
  manual_date_to: '2024-12-31',
});
```

### Period Modes

| Mode | Description |
|------|-------------|
| `fix` | Manual date range (`manual_date_from`, `manual_date_to`) |
| `relative` | Relative to pivot date |
| `date_range` | Use a `date.range` record |

## Computing Report Data

The `compute()` method returns the full report data structure.

```typescript
// Compute report (instanceId = 1)
const reportData = await client.call('mis.report.instance', 'compute', [[instanceId]]);

// Structure: { header, body, notes }
console.log('Columns:', reportData.header);
console.log('Rows:', reportData.body.length);
```

### Report Data Structure

```javascript
{
  "header": [
    {
      "cols": [
        { "label": "Default", "description": null, "colspan": 1 },
        { "label": "Year 2024", "description": null, "colspan": 1 }
      ]
    }
  ],
  "body": [
    {
      "label": "1. Importe neto de la cifra de negocios",
      "description": "",
      "style": "text-indent: 1em",
      "cells": [
        {
          "cell_id": "404##1#",
          "val": 150000.00,          // Numeric value (null if no data)
          "val_r": "150,000.00",     // Formatted for display
          "val_c": "expression",      // Formula (for debugging)
          "style": null,
          "can_be_annotated": true,
          "drilldown_arg": {          // Parameters for drilldown()
            "expr": "-balp[700%,701%,...]",
            "period_id": 2,
            "kpi_id": 404
          }
        }
      ]
    }
  ],
  "notes": {}
}
```

### Cell Values

| Field | Type | Description |
|-------|------|-------------|
| `val` | number/null | Raw numeric value |
| `val_r` | string | Formatted value for display |
| `val_c` | string | KPI expression (formula) |
| `drilldown_arg` | object | Parameters to call drilldown() |

## Drilldown to Journal Entries

The drilldown feature navigates from a report cell to the underlying `account.move.line` records.

```typescript
// Use drilldown_arg from compute() result
const drilldownArg = cell.drilldown_arg;  // { expr, period_id, kpi_id }

const action = await client.call(
  'mis.report.instance',
  'drilldown',
  [[instanceId], drilldownArg]
);

// Returns ir.actions.act_window
console.log('Model:', action.res_model);  // 'account.move.line'
console.log('Domain:', action.domain);    // Filters for the entries
```

### Drilldown Result Structure

```javascript
{
  "name": "1. Importe neto de la cifra de negocios - Year 2024",
  "domain": [
    ["account_id", "in", [1, 2, 3]],  // Relevant accounts
    "&",
    ["date", ">=", "2024-01-01"],
    ["date", "<=", "2024-12-31"],
    ["parent_state", "=", "posted"]
  ],
  "type": "ir.actions.act_window",
  "res_model": "account.move.line",
  "views": [[false, "tree"], [false, "form"]],
  "view_mode": "tree,form,pivot,graph",
  "context": { "active_test": false }
}
```

### Using Drilldown Domain

```typescript
// Get the journal entries for a cell
const action = await client.call('mis.report.instance', 'drilldown',
  [[instanceId], drilldownArg]);

// Use the domain to fetch actual entries
const entries = await client.searchRead(
  'account.move.line',
  action.domain,
  { fields: ['name', 'debit', 'credit', 'account_id', 'move_id'] }
);

console.log(`Found ${entries.length} journal entries`);
entries.forEach(e => {
  console.log(`  ${e.account_id[1]}: Debit=${e.debit}, Credit=${e.credit}`);
});
```

## Exporting Reports

### Export to Excel

```typescript
// Export report to XLSX (returns base64 binary)
const xlsxData = await client.call(
  'mis.report.instance',
  'export_xls',
  [[instanceId]]
);

// xlsxData contains: { data: base64_string, filename: 'report.xlsx' }
```

### Export to PDF

```typescript
// Generate PDF report
const pdfAction = await client.call(
  'mis.report.instance',
  'print_pdf',
  [[instanceId]]
);

// Returns an ir.actions.report to generate the PDF
```

## KPI Expressions

KPI formulas use accounting expression syntax:

| Expression | Description |
|------------|-------------|
| `balp[700%]` | Balance variation of accounts starting with 700 |
| `bali[700%]` | Initial balance of accounts starting with 700 |
| `bale[1%]` | End balance of accounts starting with 1 |
| `crdp[40%]` | Credits on accounts starting with 40 |
| `debp[55%]` | Debits on accounts starting with 55 |

### Expression Prefixes

| Prefix | Description |
|--------|-------------|
| `bal` | Balance (debit - credit) |
| `crd` | Credit total |
| `deb` | Debit total |

### Expression Suffixes

| Suffix | Description |
|--------|-------------|
| `p` | Period variation (balance change during period) |
| `i` | Initial balance (at period start) |
| `e` | Ending balance (at period end) |
| `u` | Unallocated P&L (prior year retained earnings) |

## Spanish Report Templates (l10n_es_mis_report)

When `l10n_es_mis_report` is installed, these PGCE 2008 templates are available:

| ID | Template | Description |
|----|----------|-------------|
| 1 | Balance abreviado | Abbreviated Balance Sheet |
| 2 | Balance completo | Full Balance Sheet |
| 3 | Balance PYMEs | SME Balance Sheet |
| 5 | PyG abreviado | Abbreviated P&L |
| 6 | PyG completo | Full P&L |
| 7 | PyG PYMEs | SME P&L |

These templates use Spanish PGCE 2008 account codes (7XX for income, 6XX for expenses, etc.).

## Report Instance Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | char | Yes | Instance name |
| `report_id` | many2one | Yes | Template reference |
| `company_id` | many2one | No | Single company |
| `company_ids` | many2many | No | Multiple companies |
| `period_ids` | one2many | Yes | Report periods |
| `target_move` | selection | Yes | `'posted'` or `'all'` |
| `comparison_mode` | boolean | No | Enable period comparison |
| `currency_id` | many2one | No | Target currency |
| `landscape_pdf` | boolean | No | PDF orientation |

## Error Handling

```typescript
try {
  const reportData = await client.call('mis.report.instance', 'compute', [[instanceId]]);

  // Check for cells with errors
  reportData.body.forEach(row => {
    row.cells.forEach(cell => {
      if (cell.val === null && cell.val_c?.includes('Error')) {
        console.warn(`Error in ${row.label}: ${cell.val_c}`);
      }
    });
  });
} catch (error) {
  if (error.message.includes('period')) {
    console.error('No periods defined for report instance');
  } else {
    console.error('Report computation failed:', error.message);
  }
}
```

## Related Documents

- [modules.md](./modules.md) - Module management
- [introspection.md](./introspection.md) - Model discovery
- [search.md](./search.md) - Searching records

## Source References

- MIS Builder: https://github.com/OCA/mis-builder
- Spanish templates: https://github.com/OCA/l10n-spain/tree/17.0/l10n_es_mis_report
- Documentation: https://oca-mis-builder.readthedocs.io/
