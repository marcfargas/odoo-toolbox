# CDC (Change Data Capture) — Design Document

> **Status**: Pre-implementation design — findings from live Odoo v17 investigation  
> **Date**: 2026-02-28  
> **Investigator**: Marc Fargas + AI (odoo-test instance, 181 modules, production data)

---

## Overview

Odoo has a built-in field-level audit log via `mail.tracking.value`, linked to `mail.message`.
Every time a field marked `tracking=True` changes on a model that inherits `mail.thread`,
Odoo creates one `mail.tracking.value` row per changed field, grouped under a `mail.message`
record.

This gives us a **change data capture substrate** without custom code. We will expose it as:

- `CdcService` in `odoo-client` → `client.cdc.*`
- `odoo cdc` CLI command group

---

## Empirical Findings (Odoo v17, live instance)

### `mail.tracking.value` — Accessible Fields

These are the fields actually readable via RPC (confirmed by `fields_get` + live queries):

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer | |
| `field_id` | many2one → `ir.model.fields` | `[id, "Label (Model)"]` — label includes model name |
| `field_info` | json | Populated when tracked field was later **deleted** from the schema |
| `old_value_char` | char | |
| `new_value_char` | char | |
| `old_value_text` | text | |
| `new_value_text` | text | |
| `old_value_integer` | integer | |
| `new_value_integer` | integer | |
| `old_value_float` | float | |
| `new_value_float` | float | |
| `old_value_datetime` | datetime | |
| `new_value_datetime` | datetime | |
| `currency_id` | many2one → `res.currency` | Only set for monetary fields |
| `create_date` | datetime | ≈ `mail_message_id.date` (within ~1s) |
| `create_uid` | many2one → `res.users` | Person who made the change |
| `mail_message_id` | many2one → `mail.message` | Groups changes from same write() call |

> **`field_type` and `field_desc` are NOT accessible via RPC.** They appear in Odoo source
> as non-stored computed fields. Must resolve `field_id → ir.model.fields.ttype` instead.

### Value Encoding by Field Type

Integer defaults to `0` (not null), float defaults to `0.0` — cannot use null-check to
determine which column holds the value. **Always resolve `ttype` from `ir.model.fields`.**

| Odoo `ttype` | Value column | Notes |
|--------------|-------------|-------|
| `char` | `old/new_value_char` | |
| `text` | `old/new_value_text` | |
| `integer` | `old/new_value_integer` | `*_value_char` = false |
| `boolean` | `old/new_value_integer` | `0` = False, `1` = True |
| `float` | `old/new_value_float` | |
| `monetary` | `old/new_value_float` + `currency_id` | |
| `date` | `old/new_value_datetime` | Stored as datetime (00:00:00 time) |
| `datetime` | `old/new_value_datetime` | |
| `many2one` | `old/new_value_integer` (ID) + `old/new_value_char` (display name) | **Both filled** |
| `selection` | `old/new_value_char` | ⚠️ **Translated label, not technical key** |

### `mail.message` — Key Facts

- Filter field is **`model`** (not `res_model`) — char, filterable ✅
- `res_id` is `many2one_reference` type but **is filterable** ✅
- `message_type = 'notification'` for all field-tracking messages
- `subtype_id = [2, "Note"]` (`mail.mt_note`) for field-tracking messages
- **`tracking_value_ids != false` domain is unreliable** — returns messages with empty
  arrays due to Odoo ORM quirk with one2many domains. Do not use as a filter.

### Relational Domain Filters (Confirmed Working)

All of these work as domain filters on `mail.tracking.value`:
```python
[['mail_message_id.model', '=', 'account.move']]    # ✅
[['mail_message_id.res_id', '=', 31051]]             # ✅
[['field_id.ttype', '=', 'selection']]              # ✅
[['mail_message_id.model', '=', 'X'],
 ['mail_message_id.res_id', '=', Y]]                # ✅ combined
```

### Timestamp Strategy

`mail.tracking.value.create_date` ≈ `mail.message.date` (within ~1 second).  
Use `create_date` from tracking values to avoid an extra join to `mail.message`.  
Use `mail.message.date` for precision-critical scenarios.

### Author Strategy

`mail.tracking.value.create_uid` (`res.users`) = person who made the change.  
`mail.message.author_id` (`res.partner`) = same person, partner representation.  
Use `create_uid` from tracking values to avoid extra join.

### Record Creation — No Initial Snapshot

The first `mail.message` on a record is a plain notification (e.g., `"Contrato creado"`)
with **zero tracking values**. Initial field values are never stored.

**Implication for `getStateAt(T)`**: fields that have never changed show their *current*
value, not their value at T. If T is before any tracked change, the result for untracked
or never-changed fields is the current live value.

### `mail.thread` Prerequisite

**Only models that inherit `mail.thread` have tracking.**  
Verify with `ir.model.is_mail_thread` before assuming data exists.

Key findings from this instance:

| Model | `is_mail_thread` | CDC available |
|-------|-----------------|---------------|
| `contract.contract` | ✅ true | ✅ |
| `contract.line` | ❌ false | ❌ **Zero data** |
| `account.move` | ✅ true | ✅ |
| `crm.lead` | ✅ true | ✅ |

> **Migration impact**: `contract.line` changes are completely invisible to CDC.
> Line-level history requires either adding `mail.thread` (module change) or
> falling back to `write_date`/`create_date` on the line records.

---

## Proposed Architecture

### Package Location

```
packages/odoo-client/src/services/cdc/
├── cdc-service.ts          # CdcService class → client.cdc.*
├── tracking-reader.ts      # Low-level mail.tracking.value queries
├── value-resolver.ts       # Typed old/new value extraction by ttype
├── state-reconstructor.ts  # Unwind-from-current logic
├── child-discovery.ts      # Children: active + archived + orphaned detection
├── timeline.ts             # Merge & sort parent + child events
├── types.ts
└── index.ts
```

### Core Types

```typescript
type OdooFieldType = 'char' | 'text' | 'integer' | 'float' | 'monetary' |
                     'datetime' | 'date' | 'boolean' | 'selection' | 'many2one' |
                     'many2many' | 'one2many' | 'binary' | string;

interface FieldMeta {
  id: number;
  name: string;           // technical name, e.g. 'state'
  label: string;          // snapshot label at time of change, e.g. 'Status'
  type: OdooFieldType;
  deletedInfo?: unknown;  // field_info JSON if field was deleted after tracking
}

interface TypedValue {
  raw: string | number | boolean | null;
  display: string | null;   // human label (= raw for most; display_name for m2o)
  id?: number;              // for many2one: the related record ID
  currency?: [number, string]; // for monetary: [id, code]
  isTranslated?: boolean;   // true for selection — value is locale-dependent
}

interface TrackingEvent {
  id: number;               // mail.tracking.value id
  messageId: number;        // mail.message id (groups same-write changes)
  model: string;
  recordId: number;
  date: string;             // ISO — from create_date (≈ message.date)
  authorId: number;         // res.users id
  authorName: string;
  field: FieldMeta;
  old: TypedValue;
  new: TypedValue;
}

interface ChildRelation {
  model: string;            // e.g. 'contract.line'
  field: string;            // FK field name, e.g. 'contract_id'
  includeArchived?: boolean; // query with active_test: false (default: true)
  includeDeleted?: boolean;  // attempt orphaned mail.message discovery
}

interface RecordSnapshot {
  model: string;
  id: number;
  asOf: string;             // ISO timestamp used for reconstruction
  fields: Record<string, TypedValue>;
  isPartial: boolean;       // true: some fields not tracked → current value shown
  untrackedWarning?: string;
  children?: Record<string, RecordSnapshot[]>; // keyed by child model
}

interface UnifiedTimelineEvent {
  t: string;               // ISO
  type: 'field_change' | 'child_created' | 'child_deleted' | 'child_archived';
  model: string;
  recordId: number;
  parentId?: number;
  authorId?: number;
  authorName?: string;
  field?: FieldMeta;
  old?: TypedValue;
  new?: TypedValue;
}

interface CdcCheckResult {
  model: string;
  isMailThread: boolean;
  trackedFieldCount: number;  // fields with tracking=True
  hasHistory: boolean;        // any mail.tracking.value exists
  children: {
    model: string;
    field: string;
    isMailThread: boolean;
  }[];
}
```

### Service API

```typescript
class CdcService {

  // ── Diagnostics ────────────────────────────────────────────────────────

  /** Check if a model supports CDC and which fields are tracked */
  check(model: string, opts?: {
    children?: Pick<ChildRelation, 'model' | 'field'>[];
  }): Promise<CdcCheckResult>

  // ── Per-record ─────────────────────────────────────────────────────────

  /** All tracked field changes for a record */
  getHistory(model: string, id: number, opts?: {
    fields?: string[];     // filter to specific field names
    since?: string;        // ISO
    until?: string;
    order?: 'asc' | 'desc'; // default: 'asc'
  }): Promise<TrackingEvent[]>

  /** Reconstruct field values at a point in time (unwind from current) */
  getStateAt(model: string, id: number, timestamp: string): Promise<RecordSnapshot>

  // ── With children ──────────────────────────────────────────────────────

  /** History for parent + all child records, with child lifecycle events */
  getHistoryWithChildren(model: string, id: number, opts: {
    children: ChildRelation[];
    since?: string;
    until?: string;
  }): Promise<{
    record: TrackingEvent[];
    children: Map<string, Map<number, TrackingEvent[]>>; // model → id → events
  }>

  /** Snapshot of parent + children at a point in time */
  getStateAtWithChildren(model: string, id: number, timestamp: string, opts: {
    children: ChildRelation[];
  }): Promise<RecordSnapshot>

  /** Merged chronological timeline of all events */
  getTimeline(model: string, id: number, opts: {
    children?: ChildRelation[];
    since?: string;
    until?: string;
  }): Promise<UnifiedTimelineEvent[]>

  // ── Bulk / migration ──────────────────────────────────────────────────

  /** Paginated feed of all changes to a model (for sync / migration) */
  getFeed(model: string, opts?: {
    domain?: unknown[];
    since?: string;
    until?: string;
    pageSize?: number;        // default: 100
  }): AsyncIterable<TrackingEvent>

  /** Export unified parent+children timeline for a set of records */
  export(model: string, opts: {
    ids?: number[];
    domain?: unknown[];
    children?: ChildRelation[];
    since?: string;
    until?: string;
    format?: 'json' | 'ndjson';
  }): AsyncIterable<UnifiedTimelineEvent>
}
```

### RPC Query Strategy

#### `getHistory(model, id)` — 2 RPCs

```typescript
// RPC 1: all tracking values for this record
searchRead('mail.tracking.value',
  [['mail_message_id.model','=', model],
   ['mail_message_id.res_id','=', id]],
  ['field_id','field_info','old_value_char','new_value_char',
   'old_value_integer','new_value_integer','old_value_float','new_value_float',
   'old_value_datetime','new_value_datetime','old_value_text','new_value_text',
   'currency_id','create_date','create_uid','mail_message_id'],
  { order: 'id asc' }
);

// RPC 2: batch resolve field metadata
searchRead('ir.model.fields',
  [['id','in', uniqueFieldIds]],
  ['name','ttype','field_description']
);
```

#### `getFeed(model, since)` — 3 RPCs per page

```typescript
// RPC 1: tracking values by model + date window
searchRead('mail.tracking.value',
  [['mail_message_id.model','=', model],
   ['create_date','>', since]],
  [..., 'mail_message_id'],
  { order: 'id asc', limit: pageSize }
);

// RPC 2: messages → get res_id (record ID) per message group
searchRead('mail.message',
  [['id','in', uniqueMessageIds]],
  ['id','res_id','date','author_id']
);

// RPC 3: field metadata (batch)
searchRead('ir.model.fields',
  [['id','in', uniqueFieldIds]],
  ['name','ttype','field_description']
);
```

### CLI Commands

```
odoo cdc check  <model> [--children model:field,...]
                   # Is mail.thread? Which fields tracked? Any data?

odoo cdc history <model> <id> [--field name] [--since ISO] [--until ISO]
                              [--format table|json]

odoo cdc at     <model> <id> <timestamp> [--format table|json]

odoo cdc feed   <model> [--since ISO] [--until ISO] [--domain json]
                        [--format table|json|ndjson]

odoo cdc export <model> [--ids 1,2,3 | --domain json]
                        [--children model:field,...] [--include-deleted]
                        [--since ISO] [--output file.ndjson]
```

### `getStateAt` — Unwind Algorithm

```
1. Fetch current record fields via searchRead
2. Fetch all TrackingEvents for this record WHERE date > timestamp (order: desc)
3. For each event (newest-first):
     currentState[field.name] = event.old   ← undo the change
4. Return RecordSnapshot{
     fields: currentState,
     isPartial: true,   // always true — untracked fields show current value
     asOf: timestamp
   }
```

**Known limitation**: `isPartial: true` is always set because we cannot know
which fields were never tracked. The caller must understand that non-tracked
fields always reflect current state.

### Child Discovery Strategy

For `getHistoryWithChildren(model, id, { children })`:

1. **Current children**: `searchRead(childModel, [[fkField,'=',id]], ['id'])`
2. **Archived children** (if `includeArchived`): same + `context: {active_test: false}`
3. **Deleted children** (if `includeDeleted`): query `mail.message` for
   `model=childModel` where `res_id NOT IN` known ids — returns orphaned messages
   for hard-deleted records. Caveats apply (see below).
4. For each child id: call `getHistory(childModel, childId)`
5. Detect creation: first tracking event date = creation time
6. Detect deletion: child not in step 1 + has tracking events = soft-deleted or hard-deleted

**Child discovery limitations**:
- Hard-deleted children with no tracking events: **completely invisible**
- Hard-deleted children only discoverable if `mail.thread` was enabled AND they had
  at least one field change tracked after creation

---

## Known Caveats and Limitations

| # | Caveat | Impact | Mitigation |
|---|--------|--------|------------|
| 1 | Only `tracking=True` fields captured | Untracked fields show current value in snapshots | Always set `isPartial: true`; document prominently |
| 2 | Selection stores **translated label** | Not portable across locales; can't map back to key | Expose `isTranslated: true` on TypedValue; document |
| 3 | Many2one stores display name (may change) | Name at change time, not current name | Store both ID and name; use ID for re-linking |
| 4 | No initial state snapshot | Cannot reconstruct state before first tracked change | Document; for migration use `create_date` field as lower bound |
| 5 | `mail.tracking.value` can be purged | History may be incomplete | Detect gaps via `create_date` discontinuities; warn |
| 6 | `contract.line` (and similar) not `mail.thread` | Zero CDC coverage for child lines | Expose `cdc check`; fall back to `write_date`/`create_date` |
| 7 | Float precision issues | `1047.87` stored as `1047.8700000000001` | Round on read; warn about monetary precision |
| 8 | `create_date` ≈ `message.date` (1s diff) | Ordering within 1s window may be wrong | Use `id` as tiebreaker (auto-increment) |
| 9 | Deleted child records: incomplete discovery | Hard-deleted with no tracking → invisible | Document clearly; require `includeDeleted: true` opt-in |
| 10 | `tracking_value_ids != false` domain unreliable | Cannot pre-filter messages with tracking | Query `mail.tracking.value` directly, not via message |
| 11 | Boolean/integer ambiguity | Both use `*_value_integer`; `0` can mean false OR 0 | Resolve via `field_id.ttype` — always required |
| 12 | Many2one `old_value_integer = 0` means null | ID 0 is never a valid Odoo record ID | Treat 0 as null for many2one integer column |
| 13 | `field_info` JSON (deleted fields) | Needs investigation — format unknown | Expose raw JSON; parse opportunistically |

---

## Open Questions

1. **`field_info` format**: What does the JSON contain for a deleted field?
   Does it include `ttype`? Can we still resolve the value? Not yet tested.

2. **Float precision**: Should we round monetary values, and to how many decimals?
   Currently `1047.87` → `1047.8700000000001`. The currency's `decimal_places` field
   could be used for rounding.

3. **Selection key recovery**: Odoo stores the translated label. Can we recover the
   technical key by calling `fields_get` on the model and matching against selection
   values? This would require a 4th RPC but enables locale-independent exports.

4. **Performance at scale**: No index investigation done. For models with millions of
   tracking values (large `account.move` deployments), pagination strategy and
   query performance need real-world testing.

5. **`getStateAt` correctness for many2one**: If a many2one target record's display name
   changes after the tracked event, the stored `old_value_char` reflects the name at
   change time (good), but `getStateAt` reconstructs using that historical name. The
   ID (`old_value_integer`) is reliable. Is the display name useful or misleading?

---

## Migration Use Case: `contract.contract` + `contract.line`

**What CDC can provide:**
- Full field change history for `contract.contract` ✅
- Lifecycle events for `contract.contract` ✅
- Current state of `contract.line` records (no history) ⚠️

**Recommended export strategy:**
```
odoo cdc export contract.contract \
  --domain "[['partner_id','=',X]]" \
  --children contract.line:contract_id \
  --format ndjson \
  --output contracts-history.ndjson
```

Output would include parent contract changes + child line creation/deletion events
(detected via `mail.message` message dates), but **not** field-level line changes.

**For line-level history**: recommend adding `mail.thread` to `contract.line`
via a custom module (one-time setup), after which future changes are tracked.
