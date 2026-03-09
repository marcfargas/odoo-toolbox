# Product Configurator (sale_product_configurator)

Read and write product attribute values on sale order lines. Requires the `sale_product_configurator` Odoo module (ships with Odoo Enterprise/Community, optional).

**Check before using:**
```typescript testable id="configurator-check" needs="client"
const installed = await client.modules.isModuleInstalled('sale_product_configurator');
return { installed };
```

---

## Concept: Three Variant Creation Modes

Every `product.attribute` has a `create_variant` field that controls how Odoo handles its values:

| Mode | `create_variant` | What Odoo creates | Where value lives on sale line |
|------|-----------------|-------------------|-------------------------------|
| **Instantly** | `always` | One `product.product` per combination | `product_template_attribute_value_ids` (readonly) |
| **Dynamically** | `dynamic` | `product.product` created on first sale | `product_template_attribute_value_ids` (readonly) |
| **Never (option)** | `no_variant` | No extra variants — single `product.product` | `product_no_variant_attribute_value_ids` (writable) |

> **Key insight**: `no_variant` attributes are selected *at sale time*, not at product configuration time.
> The template keeps one `product.product`. Each sale line carries which value was chosen.

> **`create_variant` is immutable** once the attribute is used on any product.
> @see https://github.com/odoo/odoo/blob/17.0/addons/product/models/product_attribute.py

---

## Model Map

```
product.attribute          — attribute definition (create_variant, display_type)
  └─ product.attribute.value (PAV)  — global values (is_custom flag)

product.template
  └─ product.template.attribute.line (PTAL)  — which attributes this template has
       └─ product.template.attribute.value (PTAV)  — per-template values (price_extra, is_custom, ptav_active)

sale.order.line
  ├─ product_template_attribute_value_ids  → PTAV  (always/dynamic — readonly, set by product choice)
  ├─ product_no_variant_attribute_value_ids → PTAV  (no_variant — writable, chosen at sale time)
  └─ product_custom_attribute_value_ids    → product.attribute.custom.value  (free-text custom values)
```

### `product.attribute` — Key Fields

| Field | Type | Notes |
|-------|------|-------|
| `name` | char | e.g. "Color", "Size" |
| `create_variant` | selection | `always` / `dynamic` / `no_variant` |
| `display_type` | selection | `radio` / `pills` / `select` / `color` / `multi` |
| `value_ids` | o2m → PAV | Global values for this attribute |

### `product.template.attribute.value` (PTAV) — Key Fields

| Field | Type | Notes |
|-------|------|-------|
| `attribute_id` | m2o → attribute | The attribute |
| `product_attribute_value_id` | m2o → PAV | The underlying global value |
| `product_tmpl_id` | m2o → template | The template this PTAV belongs to |
| `attribute_line_id` | m2o → PTAL | The attribute line |
| `price_extra` | float | Added to `price_unit` when this value is selected |
| `ptav_active` | bool | False if the value was removed from the template (archived, not deleted) |
| `is_custom` | bool | True if this PTAV accepts a free-text custom value at sale time |

### `product.attribute.custom.value` — Key Fields

| Field | Type | Notes |
|-------|------|-------|
| `custom_product_template_attribute_value_id` | m2o → PTAV | Which PTAV this custom value is for |
| `custom_value` | char | The free-text value entered by the user |
| `sale_order_line_id` | m2o → sale.order.line | Parent line |

---

## Reading Patterns

### Get all attribute options for a product template

```typescript testable id="get-template-attributes" needs="client"
// Get all PTAVs for a template — these are the selectable options
const ptavs = await client.searchRead(
  'product.template.attribute.value',
  [
    ['product_tmpl_id', '=', 144],
    ['ptav_active', '=', true],           // exclude archived values
  ],
  {
    fields: [
      'attribute_id',
      'product_attribute_value_id',
      'price_extra',
      'is_custom',
      'attribute_line_id',
    ],
  }
);
// Returns: [{id, attribute_id:[13,"ABCD"], price_extra:66.12, is_custom:false, ...}, ...]
return { count: ptavs.length };
```

### Get attribute options grouped by attribute line

```typescript testable id="get-template-attributes-grouped" needs="client"
// Step 1: get attribute lines for the template
const ptals = await client.searchRead(
  'product.template.attribute.line',
  [['product_tmpl_id', '=', 144]],
  { fields: ['attribute_id', 'value_ids', 'product_template_value_ids'] }
);

// Step 2: for each PTAL, resolve PTAVs with their price_extra
const ptavIds = ptals.flatMap(l => l.product_template_value_ids as number[]);
const ptavs = await client.searchRead(
  'product.template.attribute.value',
  [['id', 'in', ptavIds], ['ptav_active', '=', true]],
  { fields: ['attribute_id', 'product_attribute_value_id', 'price_extra', 'is_custom', 'attribute_line_id'] }
);

// Group by attribute
const byAttr: Record<string, typeof ptavs> = {};
for (const ptav of ptavs) {
  const attrName = (ptav.attribute_id as [number, string])[1];
  (byAttr[attrName] ??= []).push(ptav);
}
return { attributes: Object.keys(byAttr) };
```

### Get selected no-variant values on a sale line

```typescript testable id="read-sale-line-no-variant" needs="client"
// Find lines that have no_variant attribute values set
const lines = await client.searchRead(
  'sale.order.line',
  [['product_no_variant_attribute_value_ids', '!=', false]],
  {
    fields: [
      'order_id',
      'product_id',
      'product_no_variant_attribute_value_ids',
      'product_custom_attribute_value_ids',
      'price_unit',
    ],
    limit: 10,
  }
);

// Resolve the PTAV details for the first line
if (lines.length > 0) {
  const ptavIds = lines[0].product_no_variant_attribute_value_ids as number[];
  const ptavs = await client.searchRead(
    'product.template.attribute.value',
    [['id', 'in', ptavIds]],
    { fields: ['attribute_id', 'product_attribute_value_id', 'price_extra'] }
  );
  return { lines: lines.length, firstLinePtavs: ptavs };
}
return { lines: 0 };
```

### Get custom values on a sale line

```typescript testable id="read-sale-line-custom" needs="client"
const customVals = await client.searchRead(
  'product.attribute.custom.value',
  [['sale_order_line_id', '=', 12678]],  // replace with your line id
  {
    fields: [
      'custom_product_template_attribute_value_id',
      'custom_value',
    ],
  }
);
// Returns: [{custom_product_template_attribute_value_id:[ptav_id,"Name"], custom_value:"free text"}]
return { count: customVals.length };
```

---

## Writing Patterns

### Create a sale line with a no_variant attribute value

```typescript
// Find the PTAV id for the value you want (e.g. "B" on template 144)
const [ptav] = await client.searchRead(
  'product.template.attribute.value',
  [
    ['product_tmpl_id', '=', 144],
    ['product_attribute_value_id.name', '=', 'B'],
  ],
  { fields: ['price_extra'] }
);

// Get the product's base price
const [tmpl] = await client.searchRead(
  'product.template',
  [['id', '=', 144]],
  { fields: ['list_price'] }
);

const lineId = await client.create('sale.order.line', {
  order_id: 2878,                                    // sale.order id
  product_id: 144,                                   // product.product id
  product_uom_qty: 1,
  price_unit: (tmpl.list_price as number) + (ptav.price_extra as number),
  product_no_variant_attribute_value_ids: [[6, 0, [ptav.id]]],  // set command
});
```

> **Write command `[6, 0, [ids]]`** replaces the entire many2many set.
> Use `[4, id, 0]` to add a single value without clearing existing ones.
> @see `base/field-types.md` for full ORM command reference.

### Create a sale line with a custom attribute value

```typescript
// Find the PTAV with is_custom=true
const [ptav] = await client.searchRead(
  'product.template.attribute.value',
  [['product_tmpl_id', '=', 144], ['is_custom', '=', true]],
  { fields: ['attribute_id'] }
);

const lineId = await client.create('sale.order.line', {
  order_id: 2878,
  product_id: 144,
  product_uom_qty: 1,
  price_unit: 0,
  product_no_variant_attribute_value_ids: [[6, 0, [ptav.id]]],
  product_custom_attribute_value_ids: [[0, 0, {
    custom_product_template_attribute_value_id: ptav.id,
    custom_value: 'Special request text here',
  }]],
});
```

### Update attribute values on an existing sale line

```typescript
// Replace the no_variant values with a new selection
await client.write('sale.order.line', [lineId], {
  product_no_variant_attribute_value_ids: [[6, 0, [newPtavId]]],
});
```

---

## Price Extra Calculation

When a `no_variant` PTAV is selected, Odoo does **not** automatically recompute `price_unit`.
You must add `price_extra` yourself when creating/writing the line.

```typescript
// Compute price_unit = base_price + sum of price_extras
const basePrice = tmpl.list_price as number;
const ptavExtras = await client.searchRead(
  'product.template.attribute.value',
  [['id', 'in', selectedPtavIds]],
  { fields: ['price_extra'] }
);
const priceUnit = basePrice + ptavExtras.reduce((s, p) => s + (p.price_extra as number), 0);
```

> **Observed behavior**: Odoo's UI configurator handles this in JS.
> Via RPC, you are responsible for the arithmetic.

---

## Gotchas

### `product_no_variant_attribute_value_ids` is many2many — read vs write
- **Read**: returns `number[]` (list of PTAV ids)  
- **Write**: requires ORM commands `[6, 0, [ids]]`, not plain ids

### PTAVs can be archived (`ptav_active = false`)
Old PTAVs are never deleted — they stay linked to historical sale lines but become inactive.
Always filter `['ptav_active', '=', true]` when showing options to users.

### `is_custom` on PAV vs PTAV
Both `product.attribute.value` and `product.template.attribute.value` have `is_custom`.
The PTAV flag is the one that matters at sale time.

### `multi` display type allows multiple values per attribute line
When `product.attribute.display_type = 'multi'`, the user can select more than one PTAV
from the same attribute line. `product_no_variant_attribute_value_ids` will contain multiple
PTAV ids from the same line.

### Checking if a module is installed before reading these fields
On instances without `sale_product_configurator`, `product_no_variant_attribute_value_ids`
does not exist on `sale.order.line`. Always check module presence first.

```typescript
const ok = await client.modules.isModuleInstalled('sale_product_configurator');
if (!ok) throw new Error('sale_product_configurator not installed');
```
