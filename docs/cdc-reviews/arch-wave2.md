# Architecture Review — CDC Design (_arch-reviewer, Wave 2)

## Summary Verdict

The design is grounded in real empirical work — the Odoo v17 findings are specific, well-documented, and correctly identify non-obvious platform constraints. That's the strongest part. But the proposed API and algorithms are built on a substrate that cannot support several of the guarantees they imply: `getStateAt` claims to reconstruct historical truth from data that is inherently lossy and racy; child lifecycle inference will emit fabricated events; the type system creates hidden failure modes; and the `getFeed` pagination will silently lose or duplicate events under concurrent load. The design correctly documents many limitations as caveats, but then proceeds to build APIs that obscure those same limitations from callers. v1 scope is too broad. The core is sound — narrow it, harden the invariants, and make uncertainty a first-class part of the contract.

---

## Strengths

**Empirical grounding is excellent.** The investigation actually ran queries on a live Odoo v17 instance, documented field-by-field encoding rules, discovered the `tracking_value_ids != false` domain quirk, confirmed which relational filters work, and caught the 1-second `create_date`/`message.date` drift. This level of specificity is rare in design docs and prevents entire classes of implementation bugs.

**The two-RPC strategy for `getHistory` is correct.** Fetching all tracking values for a record in one shot, then batch-resolving field metadata via a second `ir.model.fields` query, is the right shape. It avoids N+1 on field lookup and doesn't join through `mail.message` unnecessarily.

**The caveats table is honest.** Documenting the `contract.line` gap, selection label non-portability, and deleted-child incompleteness as first-class facts rather than footnotes is the right practice. This should become the runtime behavior documentation, not just design notes.

**`mail.thread` prerequisite check is correctly positioned.** `cdc check` as the first touchpoint prevents silent empty results for non-thread models.

**The value encoding table is the right artifact.** The mapping from `ttype` to value column, including the many2one dual-column and boolean-integer ambiguity, needs to exist exactly in this form as the authoritative reference for the resolver implementation.

---

## Critical Issues

### 1. `getStateAt` promises historical truth it cannot deliver

**What's wrong:** The unwind algorithm is:
1. Read current state via `searchRead`
2. Read all events where `date > timestamp`
3. Apply `event.old` in reverse order

This has three fatal correctness holes:

**(a) Concurrency gap.** Steps 1 and 2 are separate RPC calls under read-committed isolation. A write can occur between them. If a tracked field changes between RPC 1 and RPC 2, the current state read in step 1 won't match the event log in step 2 — the rewind produces a state that never existed.

**(b) Ordering within 1-second windows.** The design specifies `order: desc` but doesn't specify the tiebreaker. The caveat table correctly notes `create_date` has ~1s granularity and recommends `id` as tiebreaker — but the algorithm pseudocode doesn't enforce `date desc, id desc`. Events within the same second will be rewound in non-deterministic order, silently producing wrong snapshots.

**(c) `isPartial: true` always, but the API implies completeness.** The return type is `RecordSnapshot` with a `fields: Record<string, TypedValue>` — this looks like a complete snapshot. The `isPartial` flag is buried and its semantics are unclear: partial meaning "some fields not tracked" is very different from partial meaning "this field shows current value, not T-value." Callers using this for migration validation will not understand the distinction.

**What to do instead:**
- Rename to `getTrackedStateAt` — this is the function's actual contract.
- Return `fields` as `Record<string, { value: TypedValue; source: 'tracked_rewind' | 'current_fallback' }>` so callers know per-field reliability.
- Add a watermark: capture `max(id)` from the tracking query before the current-state read, then constrain the event query to `id <= watermark`. This doesn't eliminate the race but bounds it.
- Enforce `order: 'create_date desc, id desc'` everywhere. Make this a constant, not prose.

---

### 2. Child lifecycle inference will fabricate events

**What's wrong:**

Step 5 of child discovery: "first tracking event date = creation time" — this is false. Odoo creates records and sends a plain notification message with zero tracking values. The first tracked change can be days after creation. Using first-tracking-event as a proxy for creation time will produce wrong `child_created` timestamps.

Step 6: "not in step 1 + has tracking events = soft-deleted or hard-deleted" — this conflates three distinct states: (a) archived (`active=False`), (b) hard-deleted, (c) moved to a different parent (FK reassigned). All three produce the same observable signal: present in `mail.message` history but absent from the live child query. The design acknowledges this at a high level but the algorithm still emits `child_deleted` events, which will be wrong for case (c).

**Why it matters:** These are `UnifiedTimelineEvent` objects with `type: 'child_created' | 'child_deleted'`. Migration pipelines consuming this output will use these as facts. Fabricated lifecycle events corrupt the migration.

**What to do instead:**
- Use `create_date` from the child record itself (available on live records) for creation time.
- For missing children, query `write_date` and `active` (where available) to distinguish archived vs hard-deleted.
- Always emit lifecycle events with `inferred: true` and an `evidence` field: `{ method: 'absence_from_live_query', unreliable: true }`.
- If evidence is insufficient to distinguish deletion from reassignment, emit `child_disappeared` not `child_deleted`. Let the caller decide.
- Hard deletion without tracking history: emit nothing rather than a fabricated event.

---

### 3. `getFeed` pagination will produce incorrect results under concurrent load

**What's wrong:** The RPC strategy shows `order: 'id asc', limit: pageSize` with `create_date > since` as the domain filter. Three problems:

**(a) `create_date > since` boundary semantics are undefined.** If `since` is `2026-01-01T00:00:00`, does it include events at exactly that timestamp? The document doesn't say. Consumers who set `since` to the last-seen event's timestamp will either miss or duplicate that event.

**(b) Timestamp-only cursor loses events when multiple rows share the same second.** If 50 events land at the same second and page size is 20, the cursor `create_date > lastDate` will skip the remaining 30. The design's own caveat (item 8) notes this: "use `id` as tiebreaker" — but the `getFeed` domain doesn't implement it.

**(c) New rows arriving during paging.** Because Odoo auto-increment IDs are not guaranteed to be monotonically ordered with respect to `create_date` (replication lag, sequence gaps), pure `id asc` with date cursor can miss rows if a high-volume write creates rows with lower IDs that land at the same timestamp after paging started.

**What to do instead:**
- Cursor must be `(create_date, id)` pair, not a single timestamp.
- Query domain: `['|', ['create_date', '>', lastDate], ['&', ['create_date', '=', lastDate], ['id', '>', lastId]]]`
- Return the cursor token in the API: `AsyncIterable<{ events: TrackingEvent[], nextCursor: string }>` — or at minimum expose a `getCursor()` method on the iterable.
- Document inclusive/exclusive semantics explicitly in the interface JSDoc.

---

### 4. The type system has hidden failure modes

**What's wrong:**

`OdooFieldType = 'char' | ... | string` — the trailing `| string` eliminates exhaustiveness checking. Switch statements on `type` will silently fall through for unknown types. This is the most common cause of "works fine until it doesn't" TypeScript bugs.

`TypedValue` is a property bag, not a discriminated union. `id?: number`, `currency?: [number, string]`, `isTranslated?: boolean` are all optional on every value. A `char` value technically has an `id`, a `boolean` value technically has a `currency`. There's no compile-time prevention of wrong field access.

`getHistoryWithChildren` returns `Map<string, Map<number, TrackingEvent[]>>`. `Map` is not JSON-serializable. The CLI layer will call `JSON.stringify` on this and get `{}`. Nested `Map` in a public API return type is almost always a mistake — it leaks internal representation and breaks every serialization path.

**What to do instead:**

```typescript
// Discriminated union — exhaustiveness enforced by compiler
type TypedValue =
  | { kind: 'char' | 'text'; value: string | null }
  | { kind: 'integer'; value: number | null }
  | { kind: 'float'; value: number | null }
  | { kind: 'boolean'; value: boolean | null }
  | { kind: 'monetary'; value: number | null; currencyId: number; currencyCode: string }
  | { kind: 'many2one'; id: number | null; displayName: string | null }
  | { kind: 'selection'; displayLabel: string | null; isTranslated: true }
  | { kind: 'datetime' | 'date'; value: string | null }  // ISO string
  | { kind: 'unknown'; rawColumns: Record<string, unknown>; fieldInfo: unknown };
```

Replace `Map<string, Map<number, TrackingEvent[]>>` with `Record<string, Record<number, TrackingEvent[]>>` or a typed array of `{ model: string; recordId: number; events: TrackingEvent[] }[]`.

Remove `| string` from `OdooFieldType`. Unknown types should map to `kind: 'unknown'` in `TypedValue`.

---

### 5. `NOT IN knownIds` is an O(N) RPC anti-pattern that will time out

**What's wrong:** Deleted child discovery builds a domain `[['model','=',childModel], ['res_id','not in', knownIds]]`. If a parent has 500 contract lines, this produces `res_id NOT IN (1, 2, 3, ... 500)`. At 2000 lines, this hits RPC payload limits. At 10,000 lines, the Odoo ORM translates this to a `NOT IN (10000 values)` SQL clause, which causes full table scans on `mail_message` — which can have millions of rows in production.

The design marks this as `includeDeleted: true` opt-in, which is good, but there's no cap, no warning, and no fallback. The first user who enables it on a large dataset will see a timeout with no explanation.

**What to do instead:**
- Add explicit limits: `includeDeleted` is only supported for known-ID sets up to N=100 (or similar).
- Return a clear error when the limit is exceeded, not a slow query.
- For larger sets, invert the logic: query `mail.message` for the child model with `date > someWindow` and cross-reference — don't enumerate the full exclusion set.
- Document the complexity class in the API: `includeDeleted` is O(N) RPC payload and O(M log N) database, not O(1).

---

### 6. `getFeed` RPC 2 (message → res_id lookup) is an architectural seam that could collapse

**What's wrong:** The `getFeed` strategy fetches tracking values first, then does a second RPC to `mail.message` to get `res_id` (record ID) per message. This means `res_id` is NOT available on `mail.tracking.value` directly and must be joined. But the per-record `getHistory` uses `mail_message_id.res_id` as a domain filter — which works because Odoo resolves the relational domain server-side.

The asymmetry is: `getHistory` avoids the `mail.message` join by using relational domain syntax; `getFeed` cannot avoid it because it's querying across all records of a model and needs to return per-record grouping. This is correct. But the current RPC 2 fetches `author_id` — which `mail.tracking.value` already exposes via `create_uid`. This is a redundant read.

More critically: if any message ID in the batch is inaccessible (ACL, record rule), the join silently returns a sparse result. Some tracking events will have no `res_id` and the caller won't know why.

**What to do instead:**
- Drop `author_id` from RPC 2 — use `create_uid` from tracking values already in RPC 1.
- If `mail.message` returns fewer records than `uniqueMessageIds`, surface this as a warning: "N tracking events have inaccessible messages — ACL or record rule may be filtering results."
- Consider querying `res_id` via the relational domain approach on `mail.tracking.value` itself: `['mail_message_id.res_id', '!=', false]` is unreliable per the document's own findings, but this is worth investigating for feed use cases.

---

### 7. `field_info` JSON for deleted fields is a complete unknown

**What's wrong:** The design correctly notes that `field_info` is populated when a field is deleted post-tracking. But the Open Questions section acknowledges the format is unknown. This is listed as question #1 with no proposed approach.

This matters more than it appears. In long-running Odoo instances used for migration (the primary use case), deleted fields are common — module upgrades, customizations removed, fields renamed. The value resolver will encounter `field_info` records and have no `ttype` to decode the value columns. If the resolver throws or returns garbage on deleted fields, it corrupts the history of any record that had those fields.

**What to do instead:**
- Investigate `field_info` format before implementation begins — this is a blocker for the resolver, not an open question.
- The resolver must have an explicit `unknown` path: when `field_id` is null and `field_info` format is not understood, emit `TypedValue` with `kind: 'unknown'` and pass through all raw columns.
- Add a test fixture with a deleted-field tracking record before writing the resolver.

---

## Suggestions

**Add `id` tiebreaker as a constant, not prose.** Define `ORDER_BY_STABLE = 'create_date asc, id asc'` in `tracking-reader.ts` and use it everywhere. Never write `order: 'id asc'` without the date prefix — `id` alone is not stable across distributed writes.

**`isPartial` needs per-field resolution.** The current shape says `isPartial: boolean` at the snapshot level. This should be per field: `{ value: TypedValue; source: 'tracked_rewind' | 'current_live' }`. The distinction between "this field was tracked and rewound correctly" and "this field was never tracked and reflects today's value" is the entire correctness story for `getStateAt` — it shouldn't be collapsed into a single boolean.

**Cache `ir.model.fields` in an LRU within the service instance.** The schema doesn't change between calls in normal operation. Re-fetching field metadata on every `getHistory` call is wasteful and adds latency. A 5-minute TTL LRU keyed on `field_id` is sufficient for the service lifetime.

**Define timezone semantics explicitly in the API contract.** The document doesn't specify whether `since`/`until`/`asOf` parameters are UTC, server-local, or user-local. Odoo stores `create_date` in UTC. The API should declare "all timestamps are UTC ISO 8601" and enforce this — both input parsing and output formatting. Selection labels are locale-dependent; the API should document which locale is used for resolution (recommend defaulting to English/neutral and documenting the option).

**Float precision: pick a rounding strategy now.** Open question #2 about `1047.87 → 1047.8700000000001` should be resolved in design, not deferred. The correct approach: when `currency_id` is set, round to `currency.decimal_places` on read. When no currency, preserve raw float. This requires an additional `decimal_places` fetch from the currency record — add it to the monetary batch resolution pass.

**`UnifiedTimelineEvent.t` should be `date` not `t`.** `t` is cryptic in a JSON/NDJSON export. This will appear in CLI output, migration logs, and external tooling. Use `date` or `timestamp` throughout the public API.

**The export CLI option `--children model:field,...` syntax conflates model and field.** `contract.line:contract_id` is a colon-separated string that must be parsed. Consider `--child-model contract.line --child-fk contract_id` as separate flags, or accept a JSON object `--children '[{"model":"contract.line","field":"contract_id"}]'` for correctness. The colon syntax will break on model names that contain colons (unlikely but possible in OCA modules).

---

## Questions for the Author

1. What is the primary consumer: human audit review or automated migration pipelines?
2. What are the expected table sizes? (no index investigation done for large deployments)
3. Is the Odoo instance under active write load during CDC queries?
4. What is the expected lifecycle of the service? (one-time migration tool vs persistent sync daemon)
5. Have you tested `field_info` JSON format on your live instance?
6. What happens when `ir.model.fields.ttype` is not in the known set?
