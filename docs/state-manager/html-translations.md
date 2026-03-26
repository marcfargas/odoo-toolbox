# HTML Fields & Translations

The state manager supports Markdown authoring, CSS injection, translated fields, and HTML sanitization validation for Odoo HTML fields.

## Markdown Authoring

Write content in Markdown — it renders to HTML at plan time.

### Inline Markdown

```typescript
import { resource, md } from '@marcfargas/odoo-state-manager';

export const template = resource('mail.template', {
  externalId: 'mymod.welcome_email',
  values: {
    body_html: md('# Welcome\n\nThank you for joining.'),
  },
});
```

### File-Based Markdown

For longer templates, keep Markdown in separate files:

```typescript
import { resource, mdFile } from '@marcfargas/odoo-state-manager';

export const template = resource('mail.template', {
  externalId: 'mymod.welcome_email',
  values: {
    body_html: mdFile('./templates/welcome.md'),
  },
});
```

File paths are relative to the project directory (the `--dir` argument).

## CSS Injection

Email clients don't support `<style>` blocks — styles must be inlined as `style=""` attributes. The state manager handles this automatically.

### With Markdown

```typescript
body_html: mdFile('./templates/welcome.md', { css: './email.css' })
```

Renders Markdown to HTML, then inlines CSS from the file using [juice](https://github.com/Automattic/juice).

### With Raw HTML

```typescript
import { withCss } from '@marcfargas/odoo-state-manager';

body_html: withCss('<div class="header">Logo</div>', './email.css')
```

### Opt-Out of Inlining

For non-email contexts (website pages), inject a `<style>` block instead:

```typescript
body_html: mdFile('./page.md', { css: './page.css', inlineCss: false })
// or
body_html: withCss('<div>...</div>', './page.css', { inline: false })
```

## Translated Fields

Odoo fields with `translate=True` store per-language values. The state manager writes translations using Odoo's `context: { lang }` mechanism.

### Basic Usage

The first argument to `translated()` is always the **instance default language** (auto-detected at runtime). Additional languages go in the translations map:

```typescript
import { resource, translated } from '@marcfargas/odoo-state-manager';

// Instance default is es_ES
export const template = resource('mail.template', {
  externalId: 'mymod.welcome_email',
  values: {
    subject: translated('Bienvenido!', {
      en_UK: 'Welcome!',
      ca_CA: 'Benvingut!',
    }),
    description: translated('Correo de bienvenida', {
      en_UK: 'Welcome email',
    }),
  },
});
```

### Translated HTML with Markdown

`translated()` composes with `md()` and `mdFile()`:

```typescript
body_html: translated(
  mdFile('./templates/welcome_es.md', { css: './email.css' }),
  {
    en_UK: mdFile('./templates/welcome_en.md'),
    ca_CA: mdFile('./templates/welcome_ca.md'),
  }
)
```

CSS options from the default value are inherited by translations. Each translation value is independently rendered through the Markdown/CSS pipeline.

### How It Works

1. **Plan time** — the default value is diffed against the instance (default language). Each translation is diffed per-language using `context: { lang }`.
2. **Apply time** — the primary `create()` / `write()` sets the default value. Then one `write()` call per language sends each translation.
3. **Plan output** — translation diffs display with language annotations:

```
~ mail.template (mymod.welcome_email)
    ~ subject [en_UK]: "Welcome" -> "Welcome!"
```

## Sanitization Validation

Odoo sanitizes HTML fields on write — stripping scripts, event handlers, forms, and other elements depending on the field's configuration. The state manager validates this in two ways.

### Plan-Time Warnings

When your HTML contains patterns that Odoo would strip, the plan output shows warnings:

```
! mail.template (mymod.welcome_email) body_html:
  HTML contains <style> block likely stripped by server (sanitize_tags=true)
```

The sanitization settings are read from the Odoo instance via `fields_get()`. Checks include `<script>`, `<style>`, event handlers, `<form>`/`<input>`, `<iframe>`, inline styles, and class attributes — depending on the field's configuration.

### Post-Apply Verification

After `apply()` completes, the state manager re-runs `plan()` to verify the server state matches what was declared. Any drift — from HTML sanitization, server defaults, float rounding, or any other server-side transformation — appears in the result:

```typescript
const result = await apply({ dir: './myproject', client });

if (result.drift) {
  console.log('Drift detected after apply:');
  console.log(formatPlan(result.drift));
}
```

This catches cases where Odoo silently modifies values on write.

### Suppressing Warnings

For fields where you know sanitization is disabled or your HTML is intentional:

```typescript
import { html } from '@marcfargas/odoo-state-manager';

arch: html('<div class="container">...</div>', { verify: false })
```

## Pipeline

The full pipeline with HTML/translation support:

1. **Evaluate** — load `.ts` files, collect definitions
2. **Flatten** — promote `children()` to top-level resources
3. **Resolve** — replace `lookup()` markers with record IDs
4. **Introspect** — build dependency graph, fetch field metadata (`fields_get()`)
5. **Transform** — render Markdown, inline CSS, extract translations, run sanitization checks
6. **Diff** — compare desired vs actual (including per-language diffs)
7. **Plan** — generate ordered operations with warnings
8. **Apply** — execute operations, write translations per-language
9. **Verify** — re-run plan, report drift
