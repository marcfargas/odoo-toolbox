# CRUD Operations

Patterns for Create, Read, Update, and Delete operations in Odoo.

> **MCP Tools**: Use `odoo_create`, `odoo_read`, `odoo_search_read`, `odoo_write`, `odoo_unlink` for data operations.

## Overview

All Odoo data manipulation follows CRUD patterns. When using the MCP server, these operations are available through dedicated tools. Understanding the patterns below is essential for any Odoo integration.

## Create

### Basic Create

```typescript testable id="crud-basic-create" needs="client" creates="res.partner" expect="id > 0"
const id = await client.create('res.partner', {
  name: uniqueTestName('Basic Create Test'),
  email: 'basic@example.com',
});
trackRecord('res.partner', id);

return id;
```

### Create with Required Fields

Always check required fields first:

```typescript
import { Introspector } from '@odoo-toolbox/introspection';

const introspector = new Introspector(client);
const fields = await introspector.getFields('crm.lead');

// Find required fields (excluding readonly/computed)
const required = fields.filter(f => f.required && !f.readonly);
console.log('Required fields:', required.map(f => f.name));

// Then create with all required fields
const leadId = await client.create('crm.lead', {
  name: 'New Lead',  // Usually required
  // ... other required fields
});
```

### Create with Relations

```typescript
// Many2One: Pass just the ID
const leadId = await client.create('crm.lead', {
  name: 'Lead with Partner',
  partner_id: 42,  // ID of existing res.partner
  team_id: 1,      // ID of existing crm.team
});

// Many2Many: Pass array of IDs using commands
const userId = await client.create('res.users', {
  name: 'New User',
  login: 'user@example.com',
  group_ids: [[6, 0, [1, 2, 3]]],  // Set groups to IDs 1, 2, 3
});
```

### Create with Defaults

Odoo often provides default values. You can rely on them:

```typescript testable id="crud-create-defaults" needs="client" creates="res.partner" expect="id > 0"
// Minimal create - Odoo fills defaults
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Minimal Partner'),
  // is_company defaults to false
  // active defaults to true
  // etc.
});
trackRecord('res.partner', partnerId);
return partnerId; // Return the ID for testing
```

## Read

### Read by ID

```typescript testable id="crud-read-by-id" needs="client" creates="res.partner" expect="result.name !== null"
// Create a record to read
const id = await client.create('res.partner', {
  name: uniqueTestName('Read Test'),
  email: 'read@example.com',
});
trackRecord('res.partner', id);

// Read single record
const records = await client.read('res.partner', [id], [
  'name', 'email', 'phone'
]);
const partner = records[0];

return { name: partner.name, email: partner.email };
```

### Read All Fields

```typescript
// Omit fields array to get all fields (expensive!)
const records = await client.read('res.partner', [id]);
```

### Reading Relational Fields

```typescript
const records = await client.read('crm.lead', [leadId], [
  'name',
  'partner_id',  // Returns [id, display_name]
  'team_id',     // Returns [id, display_name]
  'tag_ids',     // Returns [id1, id2, ...]
]);

const lead = records[0];

// Many2One returns [id, name] or false
if (lead.partner_id) {
  const partnerId = lead.partner_id[0];
  const partnerName = lead.partner_id[1];
}

// One2Many/Many2Many return array of IDs
const tagIds = lead.tag_ids;  // [1, 2, 3]
```

### Read with Search

```typescript testable id="crud-searchread" needs="client" creates="res.partner" expect="result.found === true"
// Create a test company
const id = await client.create('res.partner', {
  name: uniqueTestName('SearchRead Company'),
  is_company: true,
});
trackRecord('res.partner', id);

// Combined search and read - more efficient
const partners = await client.searchRead(
  'res.partner',
  [['id', '=', id]],  // Domain filter
  {
    fields: ['name', 'email', 'is_company'],
    limit: 10,
    offset: 0,
    order: 'name asc',
  }
);

return { found: partners.length > 0 && partners[0].is_company === true };
```

## Update (Write)

### Basic Write

```typescript testable id="crud-basic-write" needs="client" creates="res.partner" expect="result.updated === true"
// Create a record to update
const id = await client.create('res.partner', {
  name: uniqueTestName('Write Test'),
  email: 'old@email.com',
});
trackRecord('res.partner', id);

// Update single record
await client.write('res.partner', id, {
  email: 'new@email.com',
  phone: '+1 555-0123',
});

// Verify the update
const [partner] = await client.read('res.partner', [id], ['email', 'phone']);

return { updated: partner.email === 'new@email.com' };
```

### Write with Relations

```typescript
// Many2One: Pass just the ID
await client.write('crm.lead', leadId, {
  partner_id: newPartnerId,
});

// Many2Many: Use commands
await client.write('res.partner', partnerId, {
  category_id: [
    [4, tagId, 0],      // Add tag
    [3, removeId, 0],   // Remove tag
  ],
});

// Replace all Many2Many
await client.write('res.partner', partnerId, {
  category_id: [[6, 0, [1, 2, 3]]],  // Replace with exactly these IDs
});
```

### Safe Update Pattern

Read first, then update to avoid overwriting:

```typescript
// Read current values
const [record] = await client.read('crm.lead', [id], [
  'name', 'expected_revenue'
]);

// Modify and write
await client.write('crm.lead', id, {
  expected_revenue: record.expected_revenue * 1.1,  // 10% increase
});
```

### Computed Fields Warning

Never try to write computed/readonly fields:

```typescript
// WRONG - display_name is computed
await client.write('res.partner', id, {
  display_name: 'New Name',  // Error!
});

// CORRECT - write the source field
await client.write('res.partner', id, {
  name: 'New Name',
});
```

## Delete (Unlink)

### Basic Delete

```typescript testable id="crud-basic-delete" needs="client" creates="res.partner" expect="result.deleted === true"
// Create a record to delete
const id = await client.create('res.partner', {
  name: uniqueTestName('Delete Test'),
});
// Don't track - we're going to delete it

// Delete single record
await client.unlink('res.partner', id);

// Verify deletion
const remaining = await client.search('res.partner', [['id', '=', id]]);

return { deleted: remaining.length === 0 };
```

### Safe Delete

```typescript testable id="crud-safe-delete" needs="client" creates="res.partner" expect="result.safeDeleted === true"
// Create a record
const id = await client.create('res.partner', {
  name: uniqueTestName('Safe Delete Test'),
});

// Check if record exists first
const existing = await client.search('res.partner', [['id', '=', id]], { limit: 1 });

let deleted = false;
if (existing.length > 0) {
  await client.unlink('res.partner', id);
  deleted = true;
}

return { safeDeleted: deleted };
```

### Cascade Considerations

Deleting records may fail if other records reference them:

```typescript
try {
  await client.unlink('res.partner', partnerId);
} catch (error) {
  if (error.message.includes('constraint')) {
    console.log('Cannot delete: record is referenced by other records');
    // Option 1: Archive instead of delete
    await client.write('res.partner', partnerId, { active: false });
    // Option 2: Find and handle references first
  }
}
```

## Common Patterns

### Create or Update (Upsert)

```typescript testable id="crud-upsert" needs="client" creates="res.partner" expect="result.created === true && result.updated === true"
// Upsert function
async function upsert(model, domain, values) {
  const existing = await client.search(model, domain, { limit: 1 });

  if (existing.length > 0) {
    await client.write(model, existing[0], values);
    return { id: existing[0], created: false };
  } else {
    const id = await client.create(model, values);
    return { id, created: true };
  }
}

const testEmail = `upsert-${Date.now()}@example.com`;

// First call creates
const result1 = await upsert(
  'res.partner',
  [['email', '=', testEmail]],
  { name: uniqueTestName('Upsert Test'), email: testEmail }
);
trackRecord('res.partner', result1.id);

// Second call updates
const result2 = await upsert(
  'res.partner',
  [['email', '=', testEmail]],
  { name: uniqueTestName('Upsert Updated'), email: testEmail, phone: '555-0123' }
);

return { created: result1.created === true, updated: result2.created === false };
```

### Batch Operations

```typescript
// Create multiple records
const ids = [];
for (const data of recordsToCreate) {
  const id = await client.create('res.partner', data);
  ids.push(id);
}

// Batch update
await client.write('res.partner', ids, { active: true });
```

### Transaction-Like Pattern

Odoo doesn't expose transactions via API, but you can handle cleanup:

```typescript
const createdIds = [];

try {
  const partnerId = await client.create('res.partner', { name: 'Test' });
  createdIds.push({ model: 'res.partner', id: partnerId });

  const orderId = await client.create('sale.order', {
    partner_id: partnerId,
  });
  createdIds.push({ model: 'sale.order', id: orderId });

  // ... more operations

} catch (error) {
  // Cleanup on failure
  console.error('Operation failed, cleaning up...');
  for (const { model, id } of createdIds.reverse()) {
    try {
      await client.unlink(model, id);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  throw error;
}
```

### Archive Instead of Delete

```typescript testable id="crud-archive" needs="client" creates="res.partner" expect="result.archived === true && result.restored === true"
// Create a record
const id = await client.create('res.partner', {
  name: uniqueTestName('Archive Test'),
  active: true,
});
trackRecord('res.partner', id);

// "Soft delete" by archiving
await client.write('res.partner', id, { active: false });

// Check archived
const [archived] = await client.read('res.partner', [id], ['active']);

// Restore
await client.write('res.partner', id, { active: true });

// Check restored
const [restored] = await client.read('res.partner', [id], ['active']);

return { archived: archived.active === false, restored: restored.active === true };
```

## Error Handling

```typescript
import { OdooError, OdooValidationError } from '@odoo-toolbox/client';

try {
  await client.create('crm.lead', { /* missing required fields */ });
} catch (error) {
  if (error instanceof OdooValidationError) {
    console.error('Validation failed:', error.message);
    // Usually missing required fields or invalid values
  } else if (error instanceof OdooError) {
    console.error('Odoo error:', error.message);
    // Permission denied, record not found, etc.
  } else {
    throw error;
  }
}
```

## Related Documents

- [field-types.md](../01-fundamentals/field-types.md) - Field types and behaviors
- [domains.md](../01-fundamentals/domains.md) - Filtering records
- [search-patterns.md](./search-patterns.md) - Search patterns
- [properties.md](./properties.md) - Properties fields
