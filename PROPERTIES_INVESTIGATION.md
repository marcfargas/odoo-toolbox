# Odoo Properties Field Investigation - Summary

**Date**: January 24, 2026  
**Task**: Investigate and implement support for Odoo's dynamic Properties fields

## Overview

Properties in Odoo are user-definable fields that can be created dynamically via the web UI without modifying database structure. They are commonly used in:
- CRM: `lead_properties` / `lead_properties_definition` on `crm.lead` / `crm.team`
- Projects: `task_properties` / `task_properties_definition` on `project.task` / `project.project`

## Investigation Process

### 1. Setup Test Environment
- Started local Odoo 17.0 instance via Docker
- Installed CRM module to access properties-enabled models
- Used introspection tools to explore field structure

### 2. Research Findings

#### Field Types
- **`properties`**: Field on child records (e.g., crm.lead) storing property values
- **`properties_definition`**: Field on parent records (e.g., crm.team) defining property schemas

#### Asymmetric Read/Write Format

**Write Format** (Simple):
```json
{
  "custom_field": "value",
  "priority": 5,
  "active": true
}
```

**Read Format** (With Metadata):
```json
[
  {
    "name": "custom_field",
    "type": "char",
    "string": "Custom Field",
    "value": "value"
  },
  {
    "name": "priority",
    "type": "integer",
    "string": "Priority",
    "value": 5
  }
]
```

#### Critical Behavior: Full Replacement

When writing properties, Odoo REPLACES all property values. Any properties not included in the write operation are set to `false`.

**Example**:
```typescript
// Initial state: { field1: "A", field2: "B", field3: "C" }

// Write only field2
await client.write('crm.lead', id, {
  lead_properties: { field2: "Updated" }
});

// Result: { field1: false, field2: "Updated", field3: false }
// ❌ field1 and field3 were cleared!
```

**Correct Approach**:
```typescript
// 1. Read current properties
const lead = await client.read('crm.lead', id, ['lead_properties']);
const props = propertiesToWriteFormat(lead[0].lead_properties);

// 2. Modify only what you need
props.field2 = "Updated";

// 3. Write ALL properties
await client.write('crm.lead', id, { lead_properties: props });
```

#### Allowed Property Types

From `odoo/fields.py:Properties.ALLOWED_TYPES`:

**Standard Types**:
- `boolean` - True/False values
- `integer` - Whole numbers
- `float` - Decimal numbers
- `char` - Text (single line)
- `date` - Date (YYYY-MM-DD)
- `datetime` - Date with time

**Relational Types**:
- `many2one` - Reference to single record (requires `comodel`)
- `many2many` - References to multiple records (requires `comodel`)
- `selection` - Dropdown with predefined options (requires `selection` array)
- `tags` - Free-form tags

**UI Types**:
- `separator` - Visual organizer (no value)

**Important**: `text` is NOT a valid property type. Use `char` for text fields.

### 3. Source Code References

- Properties field class: https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3188
- PropertiesDefinition class: https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3419
- CRM implementation: https://github.com/odoo/odoo/blob/17.0/addons/crm/models/crm_lead.py

## Implementation

### Files Created

1. **`packages/odoo-client/src/types/properties.ts`** (7828 bytes)
   - Complete TypeScript type definitions
   - Property definition interfaces for all types
   - Property value interfaces for read format
   - Helper functions

2. **`packages/odoo-client/examples/5-properties.ts`** (7242 bytes)
   - Comprehensive example demonstrating:
     - Creating property definitions
     - Creating records with properties
     - Reading properties
     - Using helper functions
     - Updating properties (with correct approach)

3. **`packages/odoo-client/tests/properties.integration.test.ts`** (8743 bytes)
   - 10 integration tests covering:
     - Property definition CRUD
     - Property value CRUD
     - Helper functions
     - All property types
   - All tests passing ✅

### Helper Functions Provided

```typescript
import {
  getPropertyValue,
  propertiesToWriteFormat,
  getPropertyDefinition
} from '@odoo-toolbox/client';

// Extract single property value
const value = getPropertyValue(properties, 'field_name');

// Convert read format to write format
const writeFormat = propertiesToWriteFormat(properties);

// Find property definition
const definition = getPropertyDefinition(definitions, 'field_name');
```

### Documentation Updates

**AGENTS.md** updated with:
- Properties field section in "Odoo-Specific Knowledge"
- Asymmetric read/write format explanation
- Critical full replacement behavior warning
- Allowed property types reference
- Example code snippets
- Source code references

## Testing Results

✅ All integration tests pass (10/10)  
✅ Linting passes  
✅ Build succeeds  
✅ Code review found no issues  
✅ CodeQL security scan found no vulnerabilities  

## Usage Example

```typescript
import { OdooClient, PropertiesDefinition } from '@odoo-toolbox/client';

const client = new OdooClient({ /* config */ });
await client.authenticate();

// 1. Define properties
const definition: PropertiesDefinition = [
  {
    name: 'priority',
    string: 'Priority',
    type: 'selection',
    selection: [['low', 'Low'], ['high', 'High']]
  }
];

await client.write('crm.team', teamId, {
  lead_properties_definition: definition
});

// 2. Create record with properties
const leadId = await client.create('crm.lead', {
  name: 'My Lead',
  team_id: teamId,
  lead_properties: { priority: 'high' }
});

// 3. Read properties (gets metadata)
const lead = await client.read('crm.lead', leadId, ['lead_properties']);
// Returns: [{ name: 'priority', type: 'selection', value: 'high', ... }]

// 4. Update properties (read-modify-write pattern)
const props = propertiesToWriteFormat(lead[0].lead_properties);
props.priority = 'low';
await client.write('crm.lead', leadId, { lead_properties: props });
```

## Key Takeaways

1. ✅ Properties work out-of-the-box with existing odoo-client read/write methods
2. ⚠️ **Must** use read-modify-write pattern for partial updates
3. ✅ TypeScript types provide full type safety for all property types
4. ✅ Helper functions simplify common operations
5. ✅ Comprehensive documentation prevents future confusion

## Security Summary

No security vulnerabilities found:
- No sensitive data exposure
- No injection risks (Odoo handles validation)
- Proper input type checking via TypeScript
- CodeQL scan: 0 alerts

## Next Steps (Future Enhancements)

Potential future work:
- [ ] Add property definition validation helpers
- [ ] Add property definition diff/merge utilities
- [ ] Support for property definition inheritance
- [ ] Property definition migrations/versioning helpers

## Conclusion

Properties field support is now fully implemented with:
- Complete type safety
- Helper functions for common operations
- Comprehensive documentation
- Full test coverage
- Working examples

The odoo-toolbox can now handle Odoo's dynamic properties fields correctly and safely.
