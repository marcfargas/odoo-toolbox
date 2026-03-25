# Data Clone

Export records from a source Odoo instance (with transitive many2one dependencies) and replay them into a target instance. Primary use case: populating testcontainer Odoo instances with realistic data for behavior testing.

## Quick Start

```typescript
import { OdooClient } from '@marcfargas/odoo-client';
import { Introspector } from '@marcfargas/odoo-introspection';
import { exportData, importData } from '@marcfargas/odoo-state-manager';
import type { DataDomain } from '@marcfargas/odoo-state-manager';

// Connect to source and target
const source = new OdooClient({ url: 'https://staging.example.com', ... });
const target = new OdooClient({ url: 'http://localhost:8069', ... });

const sourceIntrospector = new Introspector(source);
const targetIntrospector = new Introspector(target);

// Declare what data you need
const domains: DataDomain[] = [
  { model: 'res.partner', domain: [['active', '=', true]], limit: 50 },
  { model: 'project.project', domain: [['id', 'in', [1002, 1004]]] },
  { model: 'project.task', domain: [['project_id', 'in', [1004]]], limit: 20 },
];

// Export (follows many2one dependencies automatically)
const snapshot = await exportData(source, sourceIntrospector, domains);

// Import into target
const result = await importData(target, targetIntrospector, snapshot);

// Use the ID mapping to reference records by their new IDs
const newPartnerId = result.idMap['res.partner'][42]; // source 42 → target 7
```

## API

### `exportData(client, introspector, domains, options?)`

Fetches records matching domain specs with optional BFS dependency resolution.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `client` | `OdooClient` | Connected to source instance |
| `introspector` | `Introspector` | For the source instance |
| `domains` | `DataDomain[]` | What to export |
| `options` | `ExportOptions` | See below |

**ExportOptions:**

| Option | Type | Default | Description |
|---|---|---|---|
| `followRelations` | `boolean` | `true` | Resolve many2one dependencies transitively |
| `maxDepth` | `number` | `5` | BFS recursion depth limit |
| `excludeModels` | `string[]` | `[]` | Models to skip during dependency crawl |
| `excludeFields` | `string[]` | `[]` | Field names to skip (all models) |
| `includeBinaryFields` | `boolean` | `false` | Include binary fields in export |

**Returns:** `Snapshot` — a JSON-serializable object containing all exported records grouped by model.

### `importData(client, introspector, snapshot, options?)`

Replays a snapshot into a target instance.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `client` | `OdooClient` | Connected to target instance |
| `introspector` | `Introspector` | For the target instance |
| `snapshot` | `Snapshot` | Previously exported data |
| `options` | `ImportOptions` | See below |

**ImportOptions:**

| Option | Type | Default | Description |
|---|---|---|---|
| `onConflict` | `'skip' \| 'error'` | `'skip'` | What to do when a create fails |

**Returns:** `ImportResult` with:

- `idMap` — `Record<string, Record<number, number>>` mapping source IDs to target IDs
- `created` — count of records created per model
- `skipped` — count of records skipped per model
- `errors` — array of `{ model, sourceId, error }` for failed creates

### `DataDomain`

```typescript
interface DataDomain {
  model: string;    // Odoo model name
  domain: any[];    // Odoo domain filter
  limit?: number;   // Max records to fetch
}
```

### `Snapshot`

```typescript
interface Snapshot {
  version: 1;
  records: Record<string, ExportedRecord[]>;
  metadata: SnapshotMetadata;
}
```

Snapshots are plain JSON — save/load with `JSON.stringify`/`JSON.parse`.

## How It Works

### Export

1. For each domain spec, `searchRead` records with writable fields only (computed, readonly, one2many, binary, and mail/activity fields are excluded automatically)
2. Normalize many2one values from `[id, name]` tuples to plain IDs
3. For each many2one reference, queue the target record for fetching (BFS)
4. Deduplicate by `(model, id)` — each record fetched at most once
5. Repeat up to `maxDepth` levels

### Import

1. Topologically sort models by many2one dependencies (uses the same `topologicalSort` as state-manager)
2. For each model in dependency order, create records with many2one IDs remapped to target IDs
3. Self-referential fields (e.g., `parent_id` pointing to same model) are handled in two passes:
   - Pass 1: Create record with self-ref fields set to `false`
   - Pass 2: Update self-ref fields with the now-known target IDs
4. Unresolvable references (target record not in snapshot) are set to `false`

## Usage in Tests

```typescript
describe('Generar Tareas Fiscal', () => {
  let client: OdooClient;
  let idMap: Record<string, Record<number, number>>;

  beforeAll(async () => {
    client = await createTestClient(); // testcontainer

    const source = await createClient({ url: process.env.STAGING_URL, ... });
    const sourceIntro = new Introspector(source);
    const targetIntro = new Introspector(client);

    const snapshot = await exportData(source, sourceIntro, [
      { model: 'res.partner', domain: [['active', '=', true]], limit: 30 },
      { model: 'project.project', domain: [['id', '=', 1004]] },
    ]);

    const result = await importData(client, targetIntro, snapshot);
    idMap = result.idMap;
  });

  it('creates tasks for partners with needs', async () => {
    const projectId = idMap['project.project'][1004];
    // ... test logic using remapped IDs
  });
});
```

### Caching Snapshots

To avoid hitting staging on every test run:

```typescript
import { writeFileSync, readFileSync, existsSync } from 'fs';

const SNAPSHOT_PATH = './fixtures/fiscal-data.json';

let snapshot: Snapshot;
if (existsSync(SNAPSHOT_PATH)) {
  snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));
} else {
  snapshot = await exportData(source, sourceIntro, domains);
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
}
```

## Limitations and Caveats

### Field filtering heuristics

The exporter determines writable fields using `ir.model.fields` metadata. It skips:
- Fields with `compute` set (computed fields — recomputed on create)
- Fields with `readonly=true` (cannot be written via create/write)
- System fields (`id`, `create_date`, `write_uid`, etc.)
- Mail/messaging fields (`message_follower_ids`, `message_partner_ids`, `message_ids`, etc.) — writing these triggers follower subscriptions and "cannot follow twice" constraint violations
- Activity fields (`activity_ids`, `activity_user_id`, etc.)

The `store` field from `ir.model.fields` is **not** currently queried by `@marcfargas/odoo-introspection`, so we cannot distinguish between stored computed fields and virtual computed fields. In practice this is fine — stored computed fields are recomputed by Odoo on create anyway — but it means the snapshot may be missing fields that are technically writable-but-computed.

### one2many fields are not exported

One2many fields represent the inverse side of a relationship and cannot be written directly via `create()`. The exporter skips them entirely. If you need records from the "many" side, add them as a separate domain spec.

### many2many fields are exported but not followed

Many2many field *values* (arrays of IDs) are included in the export if the field is writable. However, dependency resolution does **not** follow many2many links — only many2one. If you need the related records, add them explicitly in your domain specs.

Many2many IDs are **not remapped** during import. If the referenced records were also part of the snapshot (and thus remapped), the many2many values will contain stale source IDs. For now, many2many fields pointing to models in the snapshot should be excluded via `excludeFields`, or the records should be linked manually after import.

### No xml_id / external ID matching

Conflict detection is not based on `xml_id` or any natural key. Every import creates fresh records. This is by design for the testcontainer use case but means the feature is not suitable for syncing data between persistent instances.

### Property fields

Odoo property fields use instance-specific hex keys. After import, properties in the target will have different internal identifiers. Tests that exercise property-based logic need to create property definitions in the target first and adjust accordingly.

### Binary fields excluded by default

Binary fields (images, attachments) are skipped by default to keep snapshots small. Pass `includeBinaryFields: true` to include them, but be aware this can dramatically increase snapshot size.

### Circular model dependencies

Circular dependencies between *different* models (A references B, B references A) are handled by the topological sort's cycle detection — one of the models will be created first with the cross-reference nulled, but **no second-pass fixup is performed for inter-model cycles**. Only self-referential fields (same model) get the two-pass treatment.

If you hit this (rare in practice), split the import manually or add the missing fixup as a post-import step.

### No batch create

The importer creates records one at a time via `OdooClient.create()`. Odoo's ORM supports batch creation (`create([{...}, {...}])`) which would be significantly faster, but the client wrapper doesn't expose it. For large snapshots (1000+ records per model), import will be slow.

### Computed field coverage

Fields with `compute` set are excluded, even if they're stored and technically writable. This is conservative — it avoids writing values that Odoo will recompute anyway. But if a stored computed field has a value that *differs* from what Odoo would compute (edge case: the compute method depends on data not in the snapshot), the imported value will differ from the source.

### No support for `reference` fields

Odoo `reference` fields store values as `"model,id"` strings. The importer does not remap IDs inside reference field values. If your data uses reference fields, you'll need to post-process them manually.
