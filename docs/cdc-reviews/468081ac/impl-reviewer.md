# Implementation Review — CDC Design (_impl-reviewer, Wave 2)

## Summary Verdict

The CDC service is **buildable on top of Odoo v17's RPC layer**, and the empirical groundwork (field mapping, confirmed domain filters, `field_type`/`field_desc` non-availability) is solid. The core query strategy is sound. However, the design has several production-breaking gaps: `getFeed` pagination is underspecified and will produce duplicates/misses under concurrent writes; the unwind algorithm in `getStateAt` lacks an `id` tiebreaker and is vulnerable to read-skew; the value resolver has undefined behavior for deleted fields and boolean/integer ambiguity is only partially resolved; and `Map` in public return types will silently break JSON serialization. These are fixable, but they must be fixed before shipping — not post-MVP.

---

## Hard Problems

### 1. `getFeed` pagination is broken as specified

**What's wrong:** The RPC query uses `['create_date', '>', since]` with `order: 'id asc'` and `limit: pageSize`. There is no cursor return in the API. Callers have no way to resume without re-querying from the beginning.

More critically: `create_date > since` with a fixed `since` will *miss* rows that share the exact same `create_date` as the last row on the previous page. In a batch write that creates 50 tracking rows, all with identical `create_date`, a pageSize=20 cursor will return rows 1–20 on page 1, then on page 2 it queries `create_date > page1_last_date` — and if `page1_last_date == page2_rows.create_date`, it skips rows 21–50 entirely.

**How to fix:**
- Define a stable keyset cursor: `{ lastDate: string, lastId: number }`.
- Page 2 domain: `['|', ['create_date', '>', lastDate], ['&', ['create_date', '=', lastDate], ['id', '>', lastId]]]`
- Sort: `order: 'create_date asc, id asc'` — both columns required.
- Return cursor token from the `getFeed` AsyncIterable (e.g., as a property on the iterator or a separate channel).
- Define `since` as inclusive (`>=`) and `until` as exclusive (`<`). Document this.

### 2. `getStateAt` unwind ordering is non-deterministic within same-second batches

**What's wrong:** The algorithm fetches events `WHERE date > timestamp ORDER BY desc`, but the sort column is described as `date` alone. The design itself acknowledges (caveat #8) that `create_date` has ~1s granularity. Within a single `write()` call, multiple tracking rows share *the exact same* `create_date`. If sorted only by date descending, their relative order is database-dependent — PostgreSQL does not guarantee stable sort without a tiebreaker.

**Concrete failure scenario:** A `write()` call changes fields A and B simultaneously, producing two rows with identical `create_date`. Unwinding in wrong order produces an inconsistent intermediate state — we'd apply "undo B" then "undo A" instead of treating them atomically as one logical write (same `mail_message_id`).

**How to fix:**
- Always sort by `id desc` (or `create_date desc, id desc`).
- Group events by `mail_message_id` before unwinding: treat all rows sharing a `messageId` as one atomic unit. Apply or skip the entire group together.
- Add a `maxEventId` watermark: capture `max(id)` of the current tracking table before reading current state; constrain unwind query to `id <= maxEventId` to prevent read-skew from concurrent writes between the two RPCs.

### 3. Value resolver has undefined behavior for deleted fields

**What's wrong:** The resolver depends on `field_id.ttype` to select the correct value column. When a field is deleted from the schema, `field_id` is null and the value is in `field_info` JSON. The design lists `field_info` as a known field but says "Needs investigation — format unknown" in Open Questions. Code that assumes `field_id` is always present will either crash or silently decode the wrong column.

Specific failure modes:
- `field_id` is null → `ir.model.fields` batch lookup returns nothing for this row → resolver has no `ttype` → boolean `0` decoded as integer `0`; many2one ID `0` decoded as integer zero; selection char value decoded correctly by accident.
- The `field_info` JSON likely contains at minimum `name`, `type`, `string` based on Odoo source (`mail/models/mail_tracking_value.py`), but this is unverified.

**How to fix:**
- Investigate `field_info` format immediately (one RPC to a record with a deleted field, or read `mail/models/mail_tracking_value.py`). This must happen before the resolver is written.
- Implement three resolver modes in order of preference: (1) live `field_id.ttype`, (2) `field_info.type` if JSON is present, (3) `unknown` — keep raw column values without decoding.
- `TypedValue` needs a `confidence: 'resolved' | 'field_info' | 'unknown'` field.
- Never throw in the resolver — log and return `unknown` with `rawColumns` payload.

### 4. Boolean/integer ambiguity is documented but not fully resolved

**What's wrong:** The design correctly says "always resolve via `field_id.ttype`" but doesn't specify what happens at the edges:

- `old_value_integer = 0` for `many2one`: should be `null`. The design says "Treat 0 as null" (caveat #12) but the resolver code sketch doesn't show this branch explicitly.
- `old_value_integer = 2` for `boolean`: should this be `true`, `false`, or an error? Odoo only ever writes `0` or `1`, but corrupt data exists.
- `old_value_integer` for `many2one` where the target record has since been deleted: ID is valid but the `old_value_char` display name is the only recoverable data.

**How to fix:**
- Document the exact resolver contract per ttype:
  - `boolean`: `0 → false`, `1 → true`, anything else → `true` with a warning log.
  - `many2one`: `<= 0 → null` (no ID, display is char or empty); `> 0 → { id, display: char }`.
  - `integer`: pass through as-is; `old_value_char` is `'false'` — ignore it.
- Write unit tests for each ttype with boundary values before the resolver touches real data.

### 5. Selection label non-determinism is a silent correctness problem

**What's wrong:** `old_value_char` for `selection` fields stores the *translated* label (e.g., `"Confirmado"` in Spanish). The design marks this `isTranslated: true` and moves on. But this creates a real problem for migration workloads: if the Odoo instance language changes, or if two environments have different locales, the same technical key produces different stored strings — and there is no stable key to join on.

Worse: `fields_get` to recover the technical key (Open Question #3) can fail if the selection list has changed since the event was recorded (added/removed options). The label may no longer exist in the current `fields_get` response.

**How to fix:**
- Never attempt silent key recovery. Expose `{ display: 'Confirmado', key: null, isTranslated: true }`.
- Provide an explicit opt-in `resolveSelectionKey: true` flag that does the extra `fields_get` RPC and returns `{ key: 'confirmed' | null, keyAmbiguous: boolean }`.
- `keyAmbiguous: true` when multiple current selection options share the same label (legitimately rare but possible with custom modules).
- Document that selection values are not portable across languages. If portability is required, the Odoo instance must use a consistent `lang` context for all writes — this is an Odoo configuration concern, not something the CDC service can fix.

### 6. `getHistoryWithChildren` return type uses `Map` — will break JSON serialization

**What's wrong:** The return type is `Map<string, Map<number, TrackingEvent[]>>`. JavaScript `Map` is not JSON-serializable. Any caller doing `JSON.stringify(result)` gets `{}`. Any CLI command that prints this as JSON will output nothing useful.

**How to fix:**
- Return `Record<string, Record<number, TrackingEvent[]>>` for the children data structure.
- Or: flatten into an array `{ model, recordId, events }[]` which is both serializable and easier to iterate.
- Same issue applies anywhere `Map` appears in a public return type. Audit all types.

### 7. `getFeed` RPC 2 is unnecessary and adds latency

**What's wrong:** The design fetches `mail.message` records (RPC 2 per page) to get `res_id`. But `mail.tracking.value` is queryable with a relational domain `mail_message_id.res_id` — the design proves this works. `res_id` can be fetched as a relational field in RPC 1 without a second round-trip.

**How to fix:**
- Add `'mail_message_id.res_id'` to the fields list in the `searchRead` on `mail.tracking.value`. This resolves in Odoo's ORM as a single SQL join, not a second query.
- Drop RPC 2 entirely in the normal case.
- Keep `mail_message_id.date` available if needed for precision (vs `create_date`).
- This reduces `getFeed` from 3 RPCs/page to 2.

### 8. ACL gaps produce silent partial data

**What's wrong:** If the Odoo user running the CDC service lacks read access to some `mail.message` records (e.g., due to `mail.message` ACLs or record rules), the relational domain filter `mail_message_id.model = X` will silently skip invisible messages. The result: gaps in history that look like "nothing changed here" rather than "we couldn't see some changes."

Same risk for `ir.model.fields`: if a field was on a module the user can't read, `field_id` lookup returns empty.

**How to fix:**
- After RPC 1, cross-check: if `mail_message_id` IDs seen in results don't include expected IDs (e.g., from `mail.message` count query), flag `hasAccessGaps: true`.
- In strict mode, throw if any `field_id` in results is missing from the metadata batch lookup.
- Recommend running the CDC service as an Odoo user with `base.group_system` or equivalent read-all ACL.

---

## What Will Break First

1. **`getFeed` incremental sync (first week of use)** — Any consumer resuming from a cursor will miss rows at page boundaries when multiple tracking values share a `create_date`. Silent data loss.
2. **`getStateAt` on records with rapid field changes** — Non-deterministic unwind order produces subtly wrong, non-reproducible snapshots.
3. **Value resolver on deleted fields** — `field_id = null` rows will crash with `undefined.ttype`.
4. **`Map` serialization in CLI output** — `--format json` on children returns `{}`.
5. **`includeDeleted` on large parents** — SQL `NOT IN (5000+ values)` times out.

---

## Scope Reality Check

**Realistic MVP:** `check`, `getHistory`, and a cursor-correct `getFeed` (parent-only).

**Defer to phase 2:** `getStateAt` (needs watermark logic), `getHistoryWithChildren`, `getTimeline`.

**Defer to phase 3 or drop:** `getStateAtWithChildren`, deleted-child detection, `export`.

---

## Implementation Sequence

1. Nail down `field_info` format first (read `mail/models/mail_tracking_value.py` or RPC exploratory query).
2. Value resolver with full contract tests (unit-testable, no Odoo dependency).
3. `getHistory` with deterministic ordering (`create_date asc, id asc` locked in).
4. `getFeed` with keyset cursor (simulate duplicate `create_date` in integration tests).
5. `check` endpoint.
6. `getStateAt` with watermark + group-by-`mail_message_id` atomic undo.
7. Children (phase 2) — active + archived only first.
8. CLI thin wrappers.

---

## Missing from the Design

| Gap | Why it blocks implementation |
|-----|------------------------------|
| `field_info` JSON schema | Resolver cannot handle deleted fields without this |
| Cursor schema for `getFeed` | Iterator contract is undefined; callers can't resume |
| `since`/`until` inclusive/exclusive semantics | Off-by-one errors in every time-bounded query |
| `order` guarantee for all APIs | Must specify `create_date asc, id asc` everywhere |
| Resolver behavior when `field_id` is null | Missing from type contract and caveat table |
| Error model: warn vs throw vs partial result | Currently all or nothing |
| Max `res_id NOT IN` list size before degradation | Needed to gate `includeDeleted` safely |
| ACL requirements for the service account | Silent partial data is worse than an access error |
| Float/monetary rounding contract | Open Question #2 unanswered |
| Timezone normalization | Are `since`/`until` UTC? |
