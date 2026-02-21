# CRUD Operations

Create, read, update, and delete Odoo records using `@marcfargas/odoo-client`.

## Create

`client.create(model, values)` creates a record and returns its new ID:

```typescript testable id="crud-create" needs="client" creates="res.partner" expect="id > 0"
const id = await client.create('res.partner', {
  name: 'Acme Corp',
  email: 'contact@acme.com',
  is_company: true,
});

console.log(`Created partner with ID ${id}`);
return id;
```

### Relational Fields in Create

**Many2one**: pass the related record's ID directly:

```typescript testable id="crud-create-m2o" needs="client" creates="res.partner" expect="id > 0"
const parentId = await client.create('res.partner', {
  name: 'Parent Company',
  is_company: true,
});

const childId = await client.create('res.partner', {
  name: 'Child Contact',
  parent_id: parentId,   // Many2one: just the ID
});

return childId;
```

**Many2many**: use [command syntax](#x2many-command-reference):

```typescript testable id="crud-create-m2m" needs="client" creates="res.partner" expect="id > 0"
// Replace category_id with exactly these IDs
const id = await client.create('res.partner', {
  name: 'Tagged Partner',
  category_id: [[6, 0, []]],  // [6, 0, [ids]] = replace all
});

return id;
```

### X2many Command Reference

Used in both `create` and `write` for One2many and Many2many fields:

| Command | Format | Effect |
|---------|--------|--------|
| Create & link | `[0, 0, {values}]` | Create a new related record and link it |
| Update linked | `[1, id, {values}]` | Update an already-linked record |
| Delete linked | `[2, id, 0]` | Delete a linked record (removes from DB) |
| Unlink | `[3, id, 0]` | Remove the link (does not delete the record) |
| Add existing | `[4, id, 0]` | Link an existing record |
| Remove all | `[5, 0, 0]` | Remove all links (does not delete records) |
| Replace all | `[6, 0, [ids]]` | Replace the entire set with these record IDs |

```typescript testable id="crud-x2many-commands" needs="client" creates="res.partner" expect="result.childCount >= 1"
const parentId = await client.create('res.partner', {
  name: 'Parent Company',
  is_company: true,
  // Create and link a child in one go
  child_ids: [
    [0, 0, { name: 'Created Child' }],  // Command 0 = create & link
  ],
});

const [parent] = await client.read('res.partner', [parentId], ['child_ids']);
return { childCount: parent.child_ids.length };
```

## Read

`client.read(model, ids, fields)` fetches specific records by ID:

```typescript testable id="crud-read" needs="client" creates="res.partner" expect="result.name !== undefined"
const id = await client.create('res.partner', {
  name: 'Read Test Partner',
  email: 'read@example.com',
});

const [partner] = await client.read('res.partner', [id], [
  'name', 'email', 'is_company', 'create_date',
]);

console.log(`Name: ${partner.name}`);
console.log(`Email: ${partner.email}`);
return { name: partner.name, email: partner.email };
```

### Many2one Read Format — The Key Gotcha

**Many2one fields return `[id, display_name]` tuples when read, but you write just the ID.**

This asymmetry catches many developers off-guard:

```typescript testable id="crud-read-m2o-tuple" needs="client" creates="res.partner" expect="result.parentId > 0 && result.parentName.length > 0"
const parentId = await client.create('res.partner', {
  name: 'Parent Company',
  is_company: true,
});

const childId = await client.create('res.partner', {
  name: 'Child Contact',
  parent_id: parentId,  // Write: just the integer ID
});

const [child] = await client.read('res.partner', [childId], ['parent_id']);

// Read: parent_id comes back as [42, 'Parent Company'] — a tuple!
// Never treat it as just a number.
const parentIdExtracted = child.parent_id[0];   // → integer ID
const parentName = child.parent_id[1];           // → display name string

console.log(`Parent: ${parentName} (ID ${parentIdExtracted})`);
return { parentId: parentIdExtracted, parentName };
```

When a Many2one is not set, it returns `false` (not `null`):

```typescript
const [record] = await client.read('res.partner', [id], ['parent_id']);

if (record.parent_id === false) {
  console.log('No parent');
} else {
  const [parentId, parentName] = record.parent_id;
  console.log(`Parent: ${parentName}`);
}
```

### One2many and Many2many Read Format

These fields return **arrays of IDs** when read:

```typescript testable id="crud-read-o2m" needs="client" creates="res.partner" expect="result.childIds.length >= 0"
const [partner] = await client.read('res.partner', [42], ['child_ids']);
// partner.child_ids = [101, 102, 103]  — array of integers

const childIds: number[] = partner.child_ids;
return { childIds };
```

## searchRead

`client.searchRead(model, domain, options)` is the most commonly used method — it combines filtering and field fetching in one call:

```typescript testable id="crud-searchread" needs="client" creates="res.partner" expect="result.length >= 0"
const companies = await client.searchRead('res.partner', [
  ['is_company', '=', true],
], {
  fields: ['name', 'email', 'phone'],
  limit: 20,
  offset: 0,
  order: 'name asc',
});

return companies;
```

> **Warning:** `searchRead` defaults to `limit=100`. Always pass an explicit limit to avoid silent truncation.

## Update (Write)

`client.write(model, id, values)` updates a record. Pass a single ID or array of IDs:

```typescript testable id="crud-write" needs="client" creates="res.partner" expect="result.updated === true"
const id = await client.create('res.partner', {
  name: 'Write Test',
  email: 'old@example.com',
});

// Update single record
await client.write('res.partner', id, {
  email: 'new@example.com',
  phone: '+1 555-0100',
});

// Verify
const [partner] = await client.read('res.partner', [id], ['email']);
return { updated: partner.email === 'new@example.com' };
```

### Batch Write (Multiple Records at Once)

`write` accepts an array of IDs to update many records with the same values:

```typescript testable id="crud-write-batch" needs="client" creates="res.partner" expect="result.updated === true"
const id1 = await client.create('res.partner', { name: 'Batch A', is_company: false });
const id2 = await client.create('res.partner', { name: 'Batch B', is_company: false });

// Write to both records simultaneously — single RPC call
await client.write('res.partner', [id1, id2], { is_company: true });

const partners = await client.read('res.partner', [id1, id2], ['is_company']);
return { updated: partners.every(p => p.is_company === true) };
```

### Relational Fields in Write

```typescript
// Many2one: pass just the ID (same as create)
await client.write('crm.lead', leadId, { partner_id: 42 });

// Many2many: use command syntax
await client.write('res.partner', partnerId, {
  category_id: [
    [4, existingTagId, 0],   // Add a tag
    [3, removeTagId, 0],     // Remove a tag
  ],
});

// Replace entire Many2many set
await client.write('res.partner', partnerId, {
  category_id: [[6, 0, [tagId1, tagId2]]],
});
```

> **Never write to computed/readonly fields** — write the source field instead. For example, write `name` not `display_name`. Check `readonly` via [introspection](../introspection/schema-discovery.md) if unsure.

## Archive and Restore

Most Odoo models support archiving via the `active` field. Archiving is reversible; deletion is not:

```typescript testable id="crud-archive" needs="client" creates="res.partner" expect="result.archived === true && result.restored === true"
const id = await client.create('res.partner', {
  name: 'Archive Test',
  active: true,
});

// Archive (hide from default searches)
await client.write('res.partner', id, { active: false });
const [archived] = await client.read('res.partner', [id], ['active']);

// Restore
await client.write('res.partner', id, { active: true });
const [restored] = await client.read('res.partner', [id], ['active']);

return {
  archived: archived.active === false,
  restored: restored.active === true,
};
```

Note: archived records are hidden from searches by default. To include them, pass `context: { active_test: false }` — see [Domains](../advanced/domains.md#archived-records).

## Delete (Unlink)

`client.unlink(model, id)` permanently deletes records. **This is irreversible.**

```typescript testable id="crud-unlink" needs="client" creates="res.partner" expect="result.deleted === true"
const id = await client.create('res.partner', {
  name: 'To Be Deleted',
});

// ⚠️ DESTRUCTIVE — no undo
await client.unlink('res.partner', id);

const remaining = await client.search('res.partner', [['id', '=', id]]);
return { deleted: remaining.length === 0 };
```

Unlink can fail if:
- The record is referenced by other records (foreign key constraint)
- The model has deletion protection (e.g., posted accounting entries)
- The user lacks delete permission

**Prefer archiving** (`active: false`) unless you are certain about permanent deletion.

## Upsert Pattern

Odoo has no native upsert, but the pattern is straightforward:

```typescript testable id="crud-upsert" needs="client" creates="res.partner" expect="result.created === true && result.updated === true"
async function upsert(
  client: any,
  model: string,
  domain: any[],
  values: Record<string, any>
): Promise<{ id: number; created: boolean }> {
  const existing = await client.search(model, domain, { limit: 1 });
  if (existing.length > 0) {
    await client.write(model, existing[0], values);
    return { id: existing[0], created: false };
  }
  const id = await client.create(model, values);
  return { id, created: true };
}

const email = `upsert-test-${Date.now()}@example.com`;

const r1 = await upsert(client, 'res.partner',
  [['email', '=', email]],
  { name: 'Upsert Test', email }
);

const r2 = await upsert(client, 'res.partner',
  [['email', '=', email]],
  { name: 'Upsert Updated', email, phone: '555-0100' }
);

// Cleanup
await client.unlink('res.partner', r1.id);

return { created: r1.created === true, updated: r2.created === false };
```

## Error Handling

```typescript
import { OdooValidationError, OdooError } from '@marcfargas/odoo-client';

try {
  await client.create('crm.lead', {
    // Missing required 'name' field
  });
} catch (error) {
  if (error instanceof OdooValidationError) {
    // Odoo rejected the record — missing required field, constraint violation, etc.
    console.error('Validation error:', error.message);
  } else if (error instanceof OdooError) {
    console.error('Odoo error:', error.message);
  }
}
```

See [Error Handling](./error-handling.md) for the full error class hierarchy.

---

See also:
- [Search](./search.md) — `searchRead`, `search`, `searchCount`, pagination
- [Field Types](./field-types.md) — Many2one tuples, X2many command details
- [Advanced Domains](../advanced/domains.md) — complex filter expressions

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
