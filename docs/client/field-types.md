# Field Types

Odoo's field type system and how it maps to JavaScript values in `@marcfargas/odoo-client`.

## Basic Types

| Odoo Type | JSON Value | Notes |
|-----------|-----------|-------|
| `char` | `'Hello'` | Short string, single-line |
| `text` | `'Long text...'` | Multi-line string |
| `html` | `'<p>Hello</p>'` | HTML string, sanitized on save |
| `integer` | `42` | JavaScript number (integer) |
| `float` | `99.99` | JavaScript number (float) |
| `monetary` | `1000.00` | Number, always associated with a currency field |
| `boolean` | `true` / `false` | |
| `date` | `'2024-01-15'` | String in `YYYY-MM-DD` format |
| `datetime` | `'2024-01-15 14:30:00'` | String in UTC, `YYYY-MM-DD HH:MM:SS` |
| `binary` | `'SGVsbG8='` | Base64-encoded string |
| `selection` | `'draft'` | One of the predefined option strings |

```typescript testable id="ft-basic" needs="client" creates="res.partner" expect="id > 0"
const id = await client.create('res.partner', {
  name: 'Field Types Demo',   // char
  comment: 'A note',          // text
  color: 5,                   // integer
  is_company: false,          // boolean
});
return id;
```

## Many2one — Read/Write Asymmetry

**This is the #1 Odoo gotcha.** Many2one fields behave differently on read versus write:

| Operation | Format | Example |
|-----------|--------|---------|
| **Write** | Pass just the integer ID | `parent_id: 42` |
| **Read** | Returns `[id, display_name]` tuple | `parent_id: [42, 'Acme Corp']` |
| **Not set** | Returns `false` (not `null`) | `parent_id: false` |

```typescript testable id="ft-many2one" needs="client" creates="res.partner" expect="result.parentId > 0 && result.parentName.length > 0"
const parentId = await client.create('res.partner', {
  name: 'Parent Company',
  is_company: true,
});

const childId = await client.create('res.partner', {
  name: 'Child Contact',
  parent_id: parentId,       // Write: integer ID
});

const [child] = await client.read('res.partner', [childId], ['parent_id']);

// Read: comes back as [42, 'Parent Company']
if (child.parent_id === false) {
  console.log('No parent set');
} else {
  const [id, name] = child.parent_id;
  console.log(`Parent: ${name} (ID ${id})`);
}

return {
  parentId: child.parent_id[0],
  parentName: child.parent_id[1],
};
```

**Helper pattern** for safe Many2one access:

```typescript
function getM2oId(field: [number, string] | false): number | null {
  return field === false ? null : field[0];
}

function getM2oName(field: [number, string] | false): string | null {
  return field === false ? null : field[1];
}

const [record] = await client.read('crm.lead', [id], ['partner_id']);
const partnerId = getM2oId(record.partner_id);   // number | null
const partnerName = getM2oName(record.partner_id); // string | null
```

## One2many and Many2many

Both field types return **arrays of integer IDs** when read. When writing, use the [X2many command syntax](./crud.md#x2many-command-reference).

```typescript testable id="ft-o2m-read" needs="client" creates="res.partner" expect="result.childIds.length >= 0"
const parentId = await client.create('res.partner', {
  name: 'Parent',
  is_company: true,
  child_ids: [
    [0, 0, { name: 'Child 1' }],   // Create and link
    [0, 0, { name: 'Child 2' }],
  ],
});

const [parent] = await client.read('res.partner', [parentId], ['child_ids']);
// parent.child_ids = [101, 102] — array of integer IDs

const childRecords = await client.read('res.partner', parent.child_ids, ['name']);
return { childIds: parent.child_ids };
```

## Selection Fields

Selection fields have a fixed set of string options defined by the model. Use `ilike`-based introspection or the Odoo UI to discover valid values:

```typescript testable id="ft-selection" needs="client" creates="res.partner" expect="result.type !== undefined"
const id = await client.create('res.partner', {
  name: 'Selection Demo',
  type: 'contact',    // selection value — a string
});

// Change selection value
await client.write('res.partner', id, { type: 'invoice' });

const [partner] = await client.read('res.partner', [id], ['type']);
return { type: partner.type };   // 'invoice'
```

Common `res.partner.type` values: `'contact'`, `'invoice'`, `'delivery'`, `'private'`, `'other'`.

To discover available options for any selection field, use [schema introspection](../introspection/schema-discovery.md):

```typescript
import { Introspector } from '@marcfargas/odoo-introspection';

const introspector = new Introspector(client);
const fields = await introspector.getFields('res.partner');
const typeField = fields.find(f => f.name === 'type');
// typeField.selection = [['contact', 'Contact'], ['invoice', 'Invoice Address'], ...]
```

## Date and Datetime

Odoo stores all datetimes in **UTC**. Dates use `YYYY-MM-DD`, datetimes use `YYYY-MM-DD HH:MM:SS`.

```typescript testable id="ft-datetime" needs="client" creates="res.partner" expect="result.hasDate === true"
const today = new Date().toISOString().split('T')[0];  // 'YYYY-MM-DD'

const id = await client.create('res.partner', {
  name: 'Date Demo',
});

// Read an auto-set datetime field
const [partner] = await client.read('res.partner', [id], ['create_date']);
// partner.create_date = '2024-01-15 14:30:00' — UTC string

return { hasDate: !!partner.create_date };
```

**Converting to a JavaScript Date:**

```typescript
const [record] = await client.read('crm.lead', [id], ['date_deadline']);

if (record.date_deadline) {
  // Date fields: 'YYYY-MM-DD' — parse as local date
  const deadline = new Date(record.date_deadline);

  // Datetime fields: 'YYYY-MM-DD HH:MM:SS' UTC — add 'Z' suffix
  const created = new Date(record.create_date.replace(' ', 'T') + 'Z');
}
```

**Writing dates:**

```typescript
// Date field: string 'YYYY-MM-DD'
await client.write('crm.lead', id, {
  date_deadline: '2024-12-31',
});

// Datetime: 'YYYY-MM-DD HH:MM:SS' in UTC
await client.write('crm.lead', id, {
  date_action: new Date().toISOString().replace('T', ' ').substring(0, 19),
});
```

## Binary Fields

Binary fields store Base64-encoded strings. Upload a file by encoding it first:

```typescript testable id="ft-binary" needs="client" creates="ir.attachment" expect="result.id > 0"
const fileContent = Buffer.from('Hello, World!').toString('base64');

const attachmentId = await client.create('ir.attachment', {
  name: 'hello.txt',
  datas: fileContent,       // Base64 encoded content
  res_model: 'res.partner',
  res_id: 1,
});

return { id: attachmentId };
```

## Computed (Readonly) Fields

Computed fields are calculated by Odoo and cannot be written directly. Writing to them is silently ignored or raises an error. Always write the **source field** instead:

| ❌ Don't write | ✅ Write instead |
|---------------|----------------|
| `display_name` | `name` |
| `complete_name` | `name` |
| `amount_total` | The invoice lines |

To discover which fields are computed, use [introspection](../introspection/schema-discovery.md):

```typescript
const fields = await introspector.getFields('res.partner');
const computedFields = fields.filter(f => f.readonly);
// These cannot be written
```

## Properties Fields

Properties are dynamic, user-defined fields. They appear on models like `crm.lead` (`lead_properties`) and `project.task` (`task_properties`).

⚠️ Properties have **full-replacement write semantics** — never write them directly, or you'll lose data. Always use `client.properties.*` helpers.

```typescript
// ❌ NEVER — wipes all other properties!
await client.write('crm.lead', id, { lead_properties: { priority: 'high' } });

// ✅ Safe update — preserves all existing properties
await client.properties.updateSafely('crm.lead', id, 'lead_properties', {
  priority: 'high',
});
```

See [Properties](../services/properties.md) for the full guide.

## Field Metadata Reference

Use [introspection](../introspection/schema-discovery.md) to discover field attributes programmatically:

| Attribute | Meaning |
|-----------|---------|
| `name` | Technical field name (e.g., `partner_id`) |
| `ttype` | Odoo field type (`char`, `many2one`, etc.) |
| `field_description` | Human-readable label (e.g., `Customer`) |
| `required` | Must have a value on create |
| `readonly` | Computed — cannot be written |
| `store` | Stored in DB (vs computed on-the-fly) |
| `relation` | Target model for relational fields |
| `selection` | Available `[value, label]` pairs for selection fields |

---

See also:
- [CRUD Operations](./crud.md) — X2many command reference, write patterns
- [Properties Service](../services/properties.md) — safe dynamic field updates
- [Schema Discovery](../introspection/schema-discovery.md) — discover fields at runtime

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
