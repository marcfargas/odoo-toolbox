# Plan

This directory contains logic for generating execution plans from diffs.

## Planned Contents

- **plan.ts**: Plan generation
  - `Plan` interface (operations, affected models/IDs, dependency order)
  - Generate plan from diffs
  - Order operations (creates before updates)
  - Handle dependencies
- **formatter.ts**: Plan formatting for console output
  - Terraform-like output format
  - Color coding (green add, yellow change, red delete)
  - Human-readable summary
- **validate.ts**: Plan validation

## Implementation Notes

- Read current state from Odoo using client
- Compare with desired state using compare module
- Generate ordered list of operations (create, update, delete)
- Handle dependencies (e.g., create parent before children)
- Provide clear output showing what will change
