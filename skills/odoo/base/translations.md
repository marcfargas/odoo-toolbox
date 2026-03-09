# Field Translations (Odoo 17+)

Manage translated values for char/text/html fields in any model. In Odoo 17, `ir.translation` was removed — translations are stored directly in each field and managed via context-based RPC or dedicated methods.

## Prerequisites

Know which languages are active on the instance:

```typescript testable id="list-active-languages" needs="client"
const langs = await client.searchRead('res.lang', [['active', '=', true]], {
  fields: ['name', 'code', 'iso_code'],
});
// Returns: [{id, name:"Spanish / Español", code:"es_ES", iso_code:"es"}, ...]
return { langs: langs.map(l => l.code) };
```

---

## Discover Translatable Fields

Not all fields are translatable. Check the `translate` attribute:

```typescript testable id="find-translatable-fields" needs="client"
const fields = await client.call('product.template', 'fields_get', [], {
  attributes: ['string', 'type', 'translate'],
});
const translatable = Object.entries(fields)
  .filter(([, f]: [string, any]) => f.translate)
  .map(([key, f]: [string, any]) => ({ field: key, string: f.string, type: f.type }));
// product.template translatable fields: name, description, description_purchase, description_sale
return { count: translatable.length, fields: translatable };
```

---

## Reading Translations

### Read a field in a specific language (context-based)

Pass `{lang: 'xx_XX'}` as the context argument to `read()`:

```typescript testable id="read-field-in-lang" needs="client"
// Read product name in each installed language
const [es] = await client.read('product.template', [144], ['name', 'description_sale'], { lang: 'es_ES' });
const [en] = await client.read('product.template', [144], ['name', 'description_sale'], { lang: 'en_GB' });
const [ca] = await client.read('product.template', [144], ['name', 'description_sale'], { lang: 'ca_ES' });
// Each returns the field value in that language (falls back to source if no translation set)
return { es_name: es.name, en_name: en.name, ca_name: ca.name };
```

### Read all translations for a field at once

Use `get_field_translations(id, fieldName)` to get every language in one call:

```typescript testable id="get-all-translations" needs="client"
const [translations, meta] = await client.call(
  'product.template',
  'get_field_translations',
  [144, 'name']
) as [Array<{ lang: string; source: string; value: string }>, { translation_type: string }];

// translations = [
//   { lang: 'es_ES', source: 'AEAT Model 100...', value: 'Modelo AEAT 100...' },
//   { lang: 'en_GB', source: 'AEAT Model 100...', value: 'AEAT Model 100...' },
//   { lang: 'ca_ES', source: 'AEAT Model 100...', value: 'Model AEAT 100...' },
// ]
// meta = { translation_type: 'char', translation_show_source: false }
return { langs: translations.map(t => t.lang), type: meta.translation_type };
```

> **`source`** is the original value in the base language (the field value as stored in the DB).
> **`value`** is the translation for that lang. If no translation is set, `value` equals `source`.

---

## Writing Translations

### Write one language at a time (context-based)

Pass `{lang: 'xx_XX'}` to `write()`. Only the targeted language is updated — other translations are untouched:

```typescript
// Write Spanish name without touching EN or CA translations
await client.write('product.template', [220], { name: 'Modelo 720 — Declaración informativa' }, { lang: 'es_ES' });

// Write Catalan
await client.write('product.template', [220], { name: 'Model 720 — Declaració informativa' }, { lang: 'ca_ES' });
```

> **Gotcha**: Writing without a lang context (or with the user's default lang) updates the **source/base value**.
> Always pass `{lang: ...}` when updating a specific translation.

### Write multiple languages in one call

Use `update_field_translations(id, fieldName, {lang: value, ...})`:

```typescript
// Set all translations for a field in one RPC call
await client.call('product.template', 'update_field_translations', [
  220,
  'name',
  {
    en_GB: 'Form 720 — Declaration of assets abroad',
    es_ES: 'Modelo 720 — Declaración de bienes en el extranjero',
    ca_ES: 'Model 720 — Declaració de béns a l\'estranger',
  },
]);
```

> **Preferred for bulk setup**: one RPC call vs N `write()` calls.

### Set all translatable fields for a new product

Typical pattern when creating a product and then adding translations:

```typescript
// 1. Create with the base language value (source)
const tmplId = await client.create('product.template', {
  name: 'Form 720 — Informative Declaration',    // source (en_GB / base lang)
  type: 'service',
  list_price: 0,
});

// 2. Set translations for each translatable field
const fieldTranslations: Record<string, Record<string, string>> = {
  name: {
    es_ES: 'Modelo 720 — Declaración informativa. Declaración de bienes en el extranjero.',
    ca_ES: 'Model 720 — Declaració informativa. Declaració de béns a l\'estranger.',
  },
  description_sale: {
    en_GB: 'We prepare and file your Form 720 declaration.',
    es_ES: 'Preparamos y presentamos tu declaración informativa del modelo 720.',
    ca_ES: 'Preparem i presentem la teva declaració informativa del model 720.',
  },
};

for (const [field, langMap] of Object.entries(fieldTranslations)) {
  await client.call('product.template', 'update_field_translations', [tmplId, field, langMap]);
}
```

---

## Checking if a Translation Exists

When a lang has no translation set, `get_field_translations` still returns it — but `value` equals `source`. Use this to detect missing translations:

```typescript testable id="check-missing-translations" needs="client"
const [translations] = await client.call(
  'product.template',
  'get_field_translations',
  [144, 'name']
) as [Array<{ lang: string; source: string; value: string }>, any];

const missing = translations.filter(t => !t.value || t.value === t.source);
return { missing_langs: missing.map(t => t.lang) };
```

---

## Searching by Translation

To search records by a translated field value, pass the lang in the `read_group`/`search_read` context:

```typescript testable id="search-by-translated-field" needs="client"
// Find products whose Spanish name contains "Modelo"
const results = await client.searchRead(
  'product.template',
  [['name', 'ilike', 'Modelo']],
  { fields: ['name'], context: { lang: 'es_ES' } }
);
return { count: results.length };
```

> **Gotcha**: `searchRead` domain filters evaluate against the field value in the **requesting user's language** by default. Pass `context: {lang: 'xx_XX'}` to search in a specific language.

---

## Quick Reference

| Operation | Method | Notes |
|-----------|--------|-------|
| Read one lang | `client.read(model, [id], fields, {lang})` | Falls back to source if no translation |
| Read all langs | `client.call(model, 'get_field_translations', [id, field])` | Returns `[Array<{lang,source,value}>, meta]` |
| Write one lang | `client.write(model, [id], {field: value}, {lang})` | Only updates that lang |
| Write many langs | `client.call(model, 'update_field_translations', [id, field, {lang:val}])` | One RPC, all langs |
| Find translatable fields | `fields_get` filtered by `translate: true` | Check before assuming a field is translatable |
| Search in a lang | `searchRead` with `context: {lang}` | Filters against translated values |

---

## Gotchas

### `ir.translation` is gone in Odoo 17
Do not query `ir.translation` — the model was removed. All translation operations go through the model's own methods or context-based `read`/`write`.

### Creating a record always sets the source value
`client.create()` sets the field's source (base) value regardless of the user's language. Call `update_field_translations` after create to add language-specific translations.

### Translatable ≠ all text fields
Only fields with `translate=True` in their Python definition are translatable. `fields_get` with `translate` attribute tells you which ones.

### `searchRead` context vs read context
In `client.searchRead()`, the context goes inside the options object:
```typescript
// ✅ correct
await client.searchRead(model, domain, { fields: [...], context: { lang: 'es_ES' } });

// ❌ wrong — context is not a 4th positional arg on searchRead
await client.searchRead(model, domain, { fields: [...] }, { lang: 'es_ES' });
```

In `client.read()`, the context is the 4th positional argument:
```typescript
// ✅ correct
await client.read(model, ids, fields, { lang: 'es_ES' });
```
