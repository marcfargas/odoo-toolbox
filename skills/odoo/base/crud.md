# CRUD Operations

Create, Read, Update, Delete patterns for Odoo records.

## Create

```typescript testable id="crud-basic-create" needs="client" creates="res.partner" expect="id > 0"
const id = await client.create('res.partner', {
  name: uniqueTestName('Basic Create Test'),
  email: 'basic@example.com',
});
trackRecord('res.partner', id);

return id;
```

### Relations in Create

```typescript
// Many2One: pass the ID
const leadId = await client.create('crm.lead', {
  name: 'Lead with Partner',
  partner_id: 42,
});

// Many2Many: use command syntax
const userId = await client.create('res.users', {
  name: 'New User',
  login: 'user@example.com',
  group_ids: [[6, 0, [1, 2, 3]]],  // Set groups to IDs 1, 2, 3
});
```

### X2Many Command Reference

| Command | Format | Effect |
|---------|--------|--------|
| Create | `[0, 0, {values}]` | Create and link new record |
| Update | `[1, id, {values}]` | Update linked record |
| Delete | `[2, id, 0]` | Delete linked record |
| Unlink | `[3, id, 0]` | Remove link (don't delete) |
| Add | `[4, id, 0]` | Link existing record |
| Remove all | `[5, 0, 0]` | Remove all links |
| Replace | `[6, 0, [ids]]` | Replace with exactly these IDs |

## Read

```typescript testable id="crud-read-by-id" needs="client" creates="res.partner" expect="result.name !== null"
const id = await client.create('res.partner', {
  name: uniqueTestName('Read Test'),
  email: 'read@example.com',
});
trackRecord('res.partner', id);

const records = await client.read('res.partner', [id], [
  'name', 'email', 'phone'
]);
const partner = records[0];

return { name: partner.name, email: partner.email };
```

### Relational Field Read Format

**⚠️ Odoo gotcha:** Many2one fields return `[id, display_name]` tuples on read, but you write just the ID.

```typescript
const records = await client.read('crm.lead', [leadId], [
  'partner_id',  // Returns [42, 'Acme Corp'] or false
  'tag_ids',     // Returns [1, 2, 3] (array of IDs)
]);

const partnerId = records[0].partner_id[0];    // Extract ID from tuple
const partnerName = records[0].partner_id[1];  // Extract display name
```

### searchRead

```typescript testable id="crud-searchread" needs="client" creates="res.partner" expect="result.found === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('SearchRead Company'),
  is_company: true,
});
trackRecord('res.partner', id);

const partners = await client.searchRead(
  'res.partner',
  [['id', '=', id]],
  {
    fields: ['name', 'email', 'is_company'],
    limit: 10,
    offset: 0,
    order: 'name asc',
  }
);

return { found: partners.length > 0 && partners[0].is_company === true };
```

**⚠️ `searchRead` default limit is 100** — always pass explicit `limit` for large queries.

## Update (Write)

```typescript testable id="crud-basic-write" needs="client" creates="res.partner" expect="result.updated === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Write Test'),
  email: 'old@email.com',
});
trackRecord('res.partner', id);

await client.write('res.partner', id, {
  email: 'new@email.com',
  phone: '+1 555-0123',
});

const [partner] = await client.read('res.partner', [id], ['email', 'phone']);

return { updated: partner.email === 'new@email.com' };
```

### Relations in Write

```typescript
// Many2One: pass just the ID
await client.write('crm.lead', leadId, { partner_id: newPartnerId });

// Many2Many: use commands
await client.write('res.partner', partnerId, {
  category_id: [
    [4, tagId, 0],      // Add tag
    [3, removeId, 0],   // Remove tag
  ],
});

// Replace all Many2Many
await client.write('res.partner', partnerId, {
  category_id: [[6, 0, [1, 2, 3]]],
});
```

**⚠️ Never write computed/readonly fields** — write the source field instead (e.g., `name` not `display_name`).

## Delete (Unlink)

**⚠️ DESTRUCTIVE — permanent deletion.**

```typescript testable id="crud-basic-delete" needs="client" creates="res.partner" expect="result.deleted === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Delete Test'),
});

await client.unlink('res.partner', id);

const remaining = await client.search('res.partner', [['id', '=', id]]);

return { deleted: remaining.length === 0 };
```

### Archive Instead of Delete

Prefer archiving over deletion — it's reversible and avoids constraint errors:

```typescript testable id="crud-archive" needs="client" creates="res.partner" expect="result.archived === true && result.restored === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Archive Test'),
  active: true,
});
trackRecord('res.partner', id);

await client.write('res.partner', id, { active: false });
const [archived] = await client.read('res.partner', [id], ['active']);

await client.write('res.partner', id, { active: true });
const [restored] = await client.read('res.partner', [id], ['active']);

return { archived: archived.active === false, restored: restored.active === true };
```

## Upsert Pattern

```typescript testable id="crud-upsert" needs="client" creates="res.partner" expect="result.created === true && result.updated === true"
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

const result1 = await upsert(
  'res.partner',
  [['email', '=', testEmail]],
  { name: uniqueTestName('Upsert Test'), email: testEmail }
);
trackRecord('res.partner', result1.id);

const result2 = await upsert(
  'res.partner',
  [['email', '=', testEmail]],
  { name: uniqueTestName('Upsert Updated'), email: testEmail, phone: '555-0123' }
);

return { created: result1.created === true, updated: result2.created === false };
```

## Error Handling

```typescript
import { OdooError, OdooValidationError } from '@marcfargas/odoo-client';

try {
  await client.create('crm.lead', { /* missing required fields */ });
} catch (error) {
  if (error instanceof OdooValidationError) {
    console.error('Validation failed:', error.message);
  } else if (error instanceof OdooError) {
    console.error('Odoo error:', error.message);
  }
}
```

## Verification Patterns

Read back after every mutation to confirm Odoo accepted the values exactly as intended.
Some fields are silently transformed (trimmed strings, coerced types, computed overrides).

### Create → Read-back

```typescript testable id="crud-verify-create" needs="client" creates="res.partner" expect="result.nameMatches === true && result.isCompany === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Verify Create Corp'),
  is_company: true,
});
trackRecord('res.partner', id);

const [created] = await client.read('res.partner', [id], ['name', 'is_company']);

return {
  nameMatches: created.name.includes('Verify Create Corp'),
  isCompany: created.is_company === true,
};
```

CLI equivalent:

```bash
# Create and immediately read back the new record
id=$(odoo records create res.partner --data '{"name":"Acme Corp","is_company":true}' --confirm --format json | jq -r '.id')
odoo records get res.partner "$id" --fields name,is_company
```

### Write → Read-back

```typescript testable id="crud-verify-write" needs="client" creates="res.partner" expect="result.emailUpdated === true && result.phoneUpdated === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Verify Write Partner'),
  email: 'old@example.com',
});
trackRecord('res.partner', id);

await client.write('res.partner', id, {
  email: 'new@example.com',
  phone: '+1 555-9999',
});

const [updated] = await client.read('res.partner', [id], ['email', 'phone']);

return {
  emailUpdated: updated.email === 'new@example.com',
  phoneUpdated: updated.phone === '+1 555-9999',
};
```

CLI equivalent:

```bash
odoo records write res.partner 42 --data '{"email":"new@example.com"}' --confirm
odoo records get res.partner 42 --fields email
```

### Unlink → Count Verification

```typescript testable id="crud-verify-unlink" needs="client" creates="res.partner" expect="result.isGone === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Verify Delete Partner'),
});

await client.unlink('res.partner', id);

const count = await client.searchCount('res.partner', [['id', '=', id]]);

return { isGone: count === 0 };
```

CLI equivalent:

```bash
odoo records delete res.partner 42 --confirm
odoo records count res.partner --domain '[["id","=",42]]'
# Should print 0
```

### searchRead Pagination Verification

When paginating large result sets, verify totals match across pages:

```typescript testable id="crud-verify-pagination" needs="client" expect="result.paginationConsistent === true"
const PAGE_SIZE = 5;

const total = await client.searchCount('res.partner', [['is_company', '=', true]]);

const page1 = await client.searchRead('res.partner', [['is_company', '=', true]], {
  fields: ['id', 'name'],
  limit: PAGE_SIZE,
  offset: 0,
  order: 'id asc',
});

const page2 = await client.searchRead('res.partner', [['is_company', '=', true]], {
  fields: ['id', 'name'],
  limit: PAGE_SIZE,
  offset: PAGE_SIZE,
  order: 'id asc',
});

// No overlap between pages
const ids1 = new Set(page1.map(r => r.id));
const ids2 = new Set(page2.map(r => r.id));
const overlap = [...ids2].some(id => ids1.has(id));

return {
  paginationConsistent: !overlap,
  total,
  page1Count: page1.length,
  page2Count: page2.length,
};
```
