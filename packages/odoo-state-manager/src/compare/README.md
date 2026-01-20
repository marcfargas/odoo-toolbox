# Compare

This directory contains the deep comparison logic for detecting differences between desired and current state.

## Planned Contents

- **compare.ts**: Main comparison function
  - Deep compare of Odoo records
  - Handle primitive fields
  - Handle many2one (compare by ID or nested)
  - Handle one2many/many2many (array comparison)
  - Ignore readonly/computed fields
- **diff.ts**: Diff type and formatting
  - `Diff` interface (field path, old value, new value, change type)
  - Human-readable diff output
- **utils.ts**: Comparison utilities

## Implementation Notes

- Recursive comparison for nested objects
- Handle Odoo-specific types (many2one returns [id, name])
- Generate diffs at field level for granular changes
- Change types: create, update, delete
- Skip computed/readonly fields in comparison
