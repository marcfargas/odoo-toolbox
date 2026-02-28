# CDC Design Review — Synthesis

> **Coverage note:** Wave 1 review files (`arch-codex.md`, `impl-codex.md`) were not present
> on disk when this synthesis was produced. This document covers the two Wave 2 reviews:
> `_arch-reviewer` (architecture/correctness focus) and `_impl-reviewer` (implementation/
> buildability focus). Revisit when Wave 1 reviews are available.

---

## Unanimous Verdicts

Both reviewers agree on every item in this section — treat them as confirmed facts, not opinions.

### Design strengths (keep these)
- Empirical field-mapping investigation against live Odoo v17 is excellent; prevents whole classes of implementation bugs.
- Two-RPC strategy for `getHistory` (batch tracking values → batch `ir.model.fields`) is the right shape.
- The caveats table is honest and should become runtime documentation, not just design notes.
- `cdc check` as a prerequisite validation step is correctly positioned.

### Confirmed blockers (both reviewers independently flagged)
1. **`getFeed` pagination is broken** — timestamp-only cursor loses events when multiple rows share the same `create_date`. Silent data loss on first use with any batch write.
2. **`getStateAt` unwind ordering is non-deterministic** — missing `id` tiebreaker produces wrong snapshots for records with rapid changes; no read-skew protection between the two RPCs.
3. **`field_info` JSON format is unknown** — listed as Open Question #1 but is a resolver prerequisite, not a post-MVP concern. Must be investigated before the resolver is written.
4. **`Map` in public return types breaks JSON serialization** — `JSON.stringify(result)` returns `{}`. Will manifest immediately on first CLI `--format json` run with children.
5. **Resolver edge cases are unspecified** — `field_id = null` rows have no defined fallback; `many2one` 0 → null treatment is stated but not shown in code; boolean values outside `{0,1}` have no contract.
6. **`NOT IN knownIds` anti-pattern** — `includeDeleted` with hundreds of child IDs will produce SQL `NOT IN (N)` full table scans on `mail_message`, which can have millions of rows. No size cap, no warning, no fallback.
7. **ACL gaps produce silent partial data** — inaccessible `mail.message` records silently drop tracking events. Callers see "nothing changed" instead of "we couldn't read some changes."
8. **Scope is too broad for a reliable v1** — both reviewers recommend cutting to `check` + `getHistory` + cursor-correct `getFeed` (parent-only) before implementing children, `getStateAt`, or export.

---

## Key Divergences

### RPC 2 in `getFeed` — eliminate vs. harden?

- **_impl-reviewer:** Eliminate RPC 2 entirely. `mail_message_id.res_id` can be fetched as a relational field in RPC 1 via Odoo ORM, reducing `getFeed` from 3 RPCs/page to 2.
- **_arch-reviewer:** Keep RPC 2 but harden it: drop the redundant `author_id` fetch (already in `create_uid`), and surface a warning when fewer `mail.message` records return than expected (ACL filter indicator).

**These are compatible, not contradictory.** The impl path (relational fetch in RPC 1) should be verified first — if `mail_message_id.res_id` works reliably in the feed domain context, RPC 2 is dead code. If it doesn't, the arch hardening applies. **Human decision needed: verify the relational fetch before committing to either path.**

### Child lifecycle events — emit or suppress?

- **_arch-reviewer:** Fabricated lifecycle events (wrong `child_created` timestamps, `child_deleted` vs. FK-reassigned records) are a data corruption risk for migration pipelines. Recommendation: use `create_date` from live records, emit `child_disappeared` (not `child_deleted`) when evidence is ambiguous, suppress events rather than fabricate.
- **_impl-reviewer:** Flags the same risk but defers the entire child feature to phase 2, avoiding the problem for v1.

**Not a contradiction — the impl reviewer's phase deferral is the pragmatic resolution.** If children ship in any phase, the arch reviewer's signal semantics must apply.

---

## Critical Issues (Must Address)

Ordered by severity / earliest failure point.

### BLOCKING — Fix before writing any code

**B1. `field_info` format must be investigated immediately**
Both reviewers flag this as the blocker that determines resolver architecture. Do one of:
- Read `odoo/addons/mail/models/mail_tracking_value.py` in the Odoo 17 source.
- Run a single RPC on a live instance against a record with a deleted field.
Expected fields based on source (unverified): `name`, `type`, `string`. Until confirmed, the resolver cannot be written safely.

**B2. Value resolver needs an explicit contract per ttype before implementation**

The full contract, not implied behavior:
- `boolean`: `0 → false`, `1 → true`, any other integer → `true` + warning log.
- `many2one`: `<= 0 → null`; `> 0 → { id, displayName: old_value_char }` (display name survives even if target record is deleted).
- `integer`: pass through `old_value_integer`; ignore `old_value_char` (`'false'`).
- `float`/`monetary`: see B5.
- `selection`: see B4.
- `field_id = null` (deleted field): try `field_info.type` → fall back to `{ kind: 'unknown', rawColumns, confidence: 'unknown' }`. **Never throw.**

Write unit tests for every ttype with boundary values before the resolver touches live data.

**B3. `getFeed` must use a keyset cursor**

Replace `['create_date', '>', since]` + `order: 'id asc'` with:
- Domain: `['|', ['create_date', '>', lastDate], ['&', ['create_date', '=', lastDate], ['id', '>', lastId]]]`
- Order: `create_date asc, id asc` (both columns, always)
- Return the cursor token from the iterator — callers need it to resume. Minimum: `{ lastDate: string, lastId: number }` as a property on the async iterable.
- Define `since` as inclusive (`>=`) and `until` as exclusive (`<`). Document this in JSDoc.

**B4. `getStateAt` ordering and concurrency**

- Sort must be `create_date desc, id desc` (not `date desc` alone).
- Group tracking rows by `mail_message_id` before unwinding — treat rows from the same message as one atomic unit.
- Add a watermark: capture `max(id)` of `mail.tracking.value` before the current-state RPC, then constrain the event query to `id <= watermark`. This bounds the concurrency window.
- Rename to `getTrackedStateAt` to set honest expectations about coverage.

**B5. Float rounding — resolve Open Question #2 in the spec, not at runtime**

The correct contract: when `currency_id` is set, round to `currency.decimal_places` on read (requires one additional currency field fetch in the monetary batch). When no currency, preserve raw float. This is deterministic and must be documented before implementation, not discovered by callers seeing `1047.8700000000001`.

**B6. `Map` must not appear in any public return type**

`Map<string, Map<number, TrackingEvent[]>>` serializes to `{}`. Replace with:
- `Record<string, Record<number, TrackingEvent[]>>`, or
- Flat array `{ model: string; recordId: number; events: TrackingEvent[] }[]` (preferred for CLI serialization).

Audit all public interfaces — this may appear in more than one place.

**B7. `NOT IN knownIds` needs a hard limit and a fallback**

`includeDeleted` must:
- Refuse (error, not timeout) when `knownIds.length > N` (suggest N=100 as initial limit).
- Document the complexity class in the JSDoc: O(N) RPC payload, O(M log N) database scan.
- For larger sets, the inversion strategy (_arch-reviewer_): query `mail.message` for the child model within a time window, cross-reference against live children — don't enumerate the full exclusion set.

---

### BLOCKING — Fix before children ship (phase 2)

**B8. Child lifecycle events must not fabricate facts**
(_arch-reviewer only — impl-reviewer defers children entirely_)

- `child_created` timestamp: use `create_date` from the live child record, not the first tracking event date.
- Missing children: query `write_date` and `active` to distinguish archived vs. hard-deleted; for records that may have been FK-reassigned, emit `child_disappeared` + `{ inferred: true, unreliable: true }`, not `child_deleted`.
- If hard deletion with no tracking history: emit nothing.

---

## Suggestions (Should Address)

### Type system hardening

**S1. Replace `TypedValue` property bag with a discriminated union** (_arch-reviewer_)

The current shape allows `char` values to have a `currency` field — no compile-time safety. Use:

```typescript
type TypedValue =
  | { kind: 'char' | 'text'; value: string | null }
  | { kind: 'integer'; value: number | null }
  | { kind: 'float'; value: number | null }
  | { kind: 'boolean'; value: boolean | null }
  | { kind: 'monetary'; value: number | null; currencyId: number; currencyCode: string }
  | { kind: 'many2one'; id: number | null; displayName: string | null }
  | { kind: 'selection'; displayLabel: string | null; isTranslated: true }
  | { kind: 'datetime' | 'date'; value: string | null }
  | { kind: 'unknown'; rawColumns: Record<string, unknown>; fieldInfo: unknown; confidence: 'field_info' | 'unknown' };
```

**S2. Remove `| string` from `OdooFieldType`** (_arch-reviewer_)

`OdooFieldType = 'char' | ... | string` disables exhaustiveness checking on switch statements. Remove the trailing `| string`. Unknown ttypes hit the `kind: 'unknown'` path in `TypedValue` instead.

**S3. `isPartial` must be per-field, not per-snapshot** (_arch-reviewer_)

`RecordSnapshot.isPartial: boolean` collapses two different things: "this field was tracked and correctly rewound" vs. "this field was never tracked and shows today's value." These are not the same. Shape: `fields: Record<string, { value: TypedValue; source: 'tracked_rewind' | 'current_live' }>`.

### Selection values

**S4. Selection key resolution must be explicit opt-in** (_impl-reviewer_)

Never attempt silent key recovery. Default: `{ display: 'Confirmado', key: null, isTranslated: true }`. Add `resolveSelectionKey: true` option that does the extra `fields_get` RPC and returns `{ key: string | null, keyAmbiguous: boolean }`. Document: selection values are not portable across locales; key recovery can fail if selection options changed since the event was recorded.

### Performance

**S5. Cache `ir.model.fields` in a short-TTL LRU** (_arch-reviewer_)

Schema doesn't change between calls in normal operation. A 5-minute TTL LRU keyed on `field_id` eliminates redundant `ir.model.fields` reads across `getHistory` calls. Add to the service instance, not global state.

**S6. Verify `mail_message_id.res_id` relational fetch for `getFeed`** (_impl-reviewer_)

If Odoo ORM resolves `mail_message_id.res_id` correctly in `searchRead` fields, RPC 2 is eliminable. Test this empirically. If it works: drop RPC 2, reducing `getFeed` to 2 RPCs/page.

### API contract clarity

**S7. Timezone contract must be explicit** (_arch-reviewer_)

All timestamp parameters (`since`, `until`, `asOf`) and all returned timestamps must be documented as UTC ISO 8601. Odoo stores `create_date` in UTC. Add to JSDoc and to the CLI help text.

**S8. Define `ORDER_BY_STABLE` as a named constant** (_arch-reviewer_)

```typescript
const ORDER_BY_STABLE = 'create_date asc, id asc' as const;
const ORDER_BY_STABLE_DESC = 'create_date desc, id desc' as const;
```
Use these everywhere — never write an order string inline. Prevents the tiebreaker being omitted by accident.

**S9. ACL warning on incomplete results** (_both reviewers, different angles_)

After any batch fetch, if fewer `mail.message` records return than expected, surface `hasAccessGaps: true` in the result. In strict mode, throw. Recommend in docs that the CDC service account use `base.group_system` (or equivalent) to avoid silent data loss.

### CLI / output

**S10. Rename `UnifiedTimelineEvent.t` to `date`** (_arch-reviewer_)

`t` is opaque in JSON/NDJSON export, migration logs, and external tooling. Use `date` or `timestamp` throughout the public API.

**S11. Fix `--children model:field` CLI syntax** (_arch-reviewer_)

`contract.line:contract_id` parsed from a string will break on OCA module names containing colons. Use separate flags (`--child-model`, `--child-fk`) or structured JSON (`--children '[{"model":"...","field":"..."}]'`).

---

## Open Questions

The following require human answers before or during implementation.

| # | Question | Raised by | Blocks |
|---|----------|-----------|--------|
| Q1 | Is the primary consumer human audit review or automated migration pipelines? API shape, error tolerance, and key portability requirements differ significantly. | _arch-reviewer_ | API design decisions |
| Q2 | What are the row counts for `mail.tracking.value` on the target instance? Does `mail_message_id.model = X` domain hit an index? | _arch-reviewer_ | Performance feasibility of all read paths |
| Q3 | Is the Odoo instance under active write load during CDC queries, or read-only/quiesced? | _arch-reviewer_ | Whether `getStateAt` concurrency risks are academic or real |
| Q4 | One-time migration tool or persistent sync daemon? Changes investment level in cursor strategy and error recovery. | _arch-reviewer_ | Scope of phases 2–3 |
| Q5 | What does `field_info` JSON look like on the live instance? | _both_ | **Immediate code blocker** (see B1) |
| Q6 | Does `mail_message_id.res_id` work as a relational field in `searchRead` on `mail.tracking.value` in feed query context? | _impl-reviewer_ | Whether RPC 2 can be eliminated |

---

## Concrete Next Actions

**Before writing any resolver code:**

1. **Resolve B1** — Read `mail/models/mail_tracking_value.py` in Odoo 17 source (or run one exploratory RPC). Document the `field_info` JSON schema. This is the gate to starting the resolver.

2. **Resolve B2** — Write the full resolver contract as a spec table (ttype → column → edge cases → output). Get sign-off before coding.

3. **Write resolver unit tests** — Hardcoded tracking row fixtures, no Odoo dependency. Cover every ttype with: normal value, null value, zero value, boundary/corrupt value. These tests define the contract; they pass when the impl is correct.

**For the MVP (phase 1):**

4. **Implement `check`** — Simple diagnostics; confirms connectivity, `mail.thread` presence, field coverage. Good first commit.

5. **Implement `getHistory`** with `ORDER_BY_STABLE` constant locked in. Integration test: verify two same-second changes produce identical output across repeated calls.

6. **Implement `getFeed` with keyset cursor (B3)** — Test with simulated duplicate `create_date` values. Return cursor token in iterator. Verify `mail_message_id.res_id` relational fetch (Q6) and decide RPC 2 fate.

**Defer to phase 2 (after phase 1 validated against real data):**

7. **Implement `getStateAt`** with watermark (B4), group-by-`mail_message_id` atomic undo, and per-field source annotation (S3).

8. **Implement `getHistoryWithChildren`** with corrected child lifecycle semantics (B8), `includeDeleted` size cap (B7), and flat serializable return type (B6).

**Defer to phase 3 or drop:**

9. `getStateAtWithChildren`, deleted-child detection, `export` command — these compound all phase 1/2 correctness risks. Validate phases 1–2 completely before proceeding.

---

## Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| `getFeed` cursor loses events silently | HIGH | Certain on any batch write | B3 — keyset cursor |
| Resolver crashes on deleted fields | HIGH | Certain on any upgraded instance | B1 + B2 |
| `getStateAt` returns non-existent state | HIGH | Likely under any write load | B4 |
| `NOT IN` query times out | HIGH | Certain above ~500 children | B7 |
| `Map` serialization breaks CLI | MEDIUM | First `--format json` with children | B6 |
| Child lifecycle events corrupt migration | HIGH | Certain for FK-reassigned records | B8 (phase 2 gate) |
| ACL gaps cause silent data gaps | MEDIUM | Depends on service account ACL | S9 + documentation |
| Float imprecision in monetary values | LOW | Present but easy to miss | B5 |
