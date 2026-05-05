# Handoff: odoopy — Python Port of odoo-toolbox

> Generated 2026-03-24 from deep exploration of the TypeScript monorepo.
> Target packages: **odoo-client**, **odoo-introspection**, **odoo-testcontainers**

---

## 1. What We're Porting

### Scope

| TS Package | Python Package | Purpose |
|---|---|---|
| `@marcfargas/odoo-client` | `odoopy-client` | JSON-RPC 2.0 client with CRUD, services, safety guards |
| `@marcfargas/odoo-introspection` | `odoopy-introspection` | Schema discovery from `ir.model` / `ir.model.fields` + codegen |
| `@marcfargas/odoo-testcontainers` | `odoopy-testcontainers` | Docker-based Odoo instances for integration testing |

### Explicitly Out of Scope (for now)

- `odoo-state-manager` (Terraform-style plan/apply — complex, port later)
- `odoo-cli` / `odoo-mcp` (targets — build new Python targets as needed)
- Skills system (Claude-specific)

---

## 2. Architecture Overview

### Dependency Graph (preserve this in Python)

```
Base Layer (no internal deps):
  odoo-client
  odoo-testcontainers

Middle Layer:
  odoo-introspection  →  depends on odoo-client

Future:
  odoo-state-manager  →  depends on odoo-client + odoo-introspection
```

**Rule:** Libraries never depend on targets. Targets depend on libraries. Unidirectional.

### Package Layout (TypeScript)

```
packages/odoo-client/src/
  client/           # OdooClient class, createClient factory, configFromEnv
  rpc/              # JsonRpcTransport (HTTP), request/response types
  safety/           # SafetyLevel, OperationInfo, confirm callback
  services/         # Domain services (mail, modules, attendance, timesheets, ...)
    {service}/
      {service}-service.ts   # Public class (accessed via client.{service})
      functions.ts           # Standalone implementations
      types.ts               # Domain types
      index.ts               # Barrel re-export
  types/
    errors.ts        # Full error hierarchy
    properties.ts    # Property field types

packages/odoo-introspection/src/
  introspection/     # Introspector class, IntrospectionCache, types
  codegen/           # CodeGenerator, type-mappers, formatter
  cli/               # CLI entry point

packages/odoo-testcontainers/src/
  odoo-container.ts  # OdooTestContainer, startOdoo, snapshot restore/save
```

---

## 3. Recommended Python Project Structure

### Tooling

| Concern | Tool |
|---|---|
| Package manager | **uv** (workspace mode) |
| Build backend | **hatchling** or **setuptools** |
| Test runner | **pytest** |
| Test containers | **testcontainers-python** |
| Linting | **ruff** (replaces flake8 + isort + black) |
| Type checking | **mypy** (strict mode) |
| CI/CD | **GitHub Actions** (mirror TS workflow structure) |
| Versioning | **uv** or **python-semantic-release** |

### Proposed Layout

```
odoopy/
  pyproject.toml              # Workspace root (uv workspace)
  uv.lock
  .github/
    workflows/
      test.yml                # Lint + Unit + Docker Build + Integration (matrix: Odoo 17/18/19)
      release.yml             # Publish to PyPI
  docker/
    odoo-entrypoint.sh        # Same as TS (reuse!)
  packages/
    odoopy-client/
      pyproject.toml
      src/odoopy_client/
        __init__.py           # Public API barrel
        client.py             # OdooClient class
        config.py             # create_client(), config_from_env()
        rpc/
          __init__.py
          transport.py        # JsonRpcTransport (httpx)
          types.py            # Request/Response dataclasses
        safety/
          __init__.py
          guards.py           # SafetyLevel, OperationInfo, confirm protocol
        services/
          __init__.py
          mail/
            __init__.py
            service.py        # MailService
            functions.py
            types.py
          modules/
            __init__.py
            service.py        # ModuleManager
          attendance/
          timesheets/
          accounting/
          urls/
          properties/
          cdc/
        errors.py             # Full error hierarchy
      tests/
        test_safety.py
        test_errors.py
        test_config.py
        integration/
          test_crud.py
          test_mail.py
          ...
    odoopy-introspection/
      pyproject.toml
      src/odoopy_introspection/
        __init__.py
        introspector.py       # Introspector class
        cache.py              # IntrospectionCache
        types.py              # OdooModel, OdooField, ModelMetadata
        codegen/
          __init__.py
          generator.py        # CodeGenerator
          type_mappers.py     # Odoo type -> Python type mapping
          formatter.py        # Dataclass/TypedDict generation
      tests/
        test_type_mappers.py
        test_formatter.py
        integration/
          test_introspection.py
    odoopy-testcontainers/
      pyproject.toml
      src/odoopy_testcontainers/
        __init__.py
        container.py          # OdooTestContainer
        snapshots.py          # Local DB snapshot keys, dump, restore
        presets.py            # OdooPresets (version configs)
      tests/
        test_container.py
  tests/
    conftest.py               # Shared fixtures (equivalent to globalSetup.ts)
    helpers/
      __init__.py
      fixtures.py             # get_test_config, wait_for_odoo, cleanup helpers
```

---

## 4. Core Design Decisions to Preserve

### 4.1 Error Hierarchy

The TS codebase has a comprehensive, serializable error hierarchy. Port it exactly:

```python
class OdooError(Exception):
    """Base for all Odoo errors. Has to_json() for structured serialization."""
    def to_json(self) -> dict: ...

class OdooRpcError(OdooError):
    """Generic RPC failure from the server."""
    code: int
    data: Any

class OdooAuthError(OdooRpcError):
    """Authentication/credential failure (AccessDenied)."""

class OdooNetworkError(OdooRpcError):
    """Connection failure."""

class OdooTimeoutError(OdooNetworkError):
    """Request timeout."""

class OdooValidationError(OdooRpcError):
    """Business logic rejection (ValidationError, UserError from Odoo)."""

class OdooAccessError(OdooRpcError):
    """ACL or record rule violation (AccessError)."""

class OdooMissingError(OdooRpcError):
    """Record not found (MissingError)."""

class OdooSafetyError(OdooError):
    """Local safety guard rejection. Never crosses the network."""
```

**Error classification** at the transport layer:
1. Check `error.data.exception_type` (Odoo 17+, preferred)
2. Fallback: check `error.data.name` (Python exception class path)
3. Map to the appropriate error subclass

**Every error must have `.to_json()`** returning `{"error": str, "message": str, "details": Any}`.

### 4.2 Service Accessor Pattern

Services are lazy-loaded via properties on the client, never instantiated directly:

```python
class OdooClient:
    @cached_property
    def mail(self) -> MailService:
        return MailService(self)

    @cached_property
    def modules(self) -> ModuleManager:
        return ModuleManager(self)

    # ... etc
```

**Each service module has:**
- `service.py` — Public class with typed methods
- `functions.py` — Standalone implementations (take client as first arg)
- `types.py` — Domain dataclasses/TypedDicts

The service class delegates to standalone functions. This enables both OOP access (`client.mail.post_note(...)`) and functional composition.

### 4.3 Environment-Driven Configuration

No config files. Everything from env vars:

```
ODOO_URL          Base URL (e.g., http://localhost:8069)
ODOO_DB           Database name (alias: ODOO_DATABASE)
ODOO_USER         Username (alias: ODOO_USERNAME)
ODOO_PASSWORD     Password
```

**Multi-environment via prefix:**
```python
client = await create_client()              # reads ODOO_*
prod   = await create_client("ODOO_PROD")   # reads ODOO_PROD_*
stg    = await create_client("ODOO_STG")    # reads ODOO_STG_*
```

### 4.4 Safety Guards (Opt-In)

Safety is OFF by default. When enabled, WRITE and DELETE operations call a `confirm` callback before executing:

```python
@dataclass
class OperationInfo:
    name: str           # e.g., "odoo.unlink"
    level: str          # "READ" | "WRITE" | "DELETE"
    model: str          # e.g., "res.partner"
    description: str
    target: str | None  # Base URL (helps distinguish dev/prod)
    details: dict | None

class SafetyContext(Protocol):
    async def confirm(self, op: OperationInfo) -> bool: ...
```

**Safety level inference from method name:**
- **READ**: `search`, `read`, `search_read`, `search_count`, `fields_get`, `name_get`, `name_search`, `default_get`
- **DELETE**: `unlink`
- **WRITE**: everything else

### 4.5 RPC Protocol

**JSON-RPC 2.0** over HTTP POST to `{base_url}/jsonrpc`.

**Authentication:**
```json
{"jsonrpc": "2.0", "method": "call", "id": 1,
 "params": {"service": "common", "method": "login",
            "args": ["database", "username", "password"]}}
```
Returns `uid` (int) or `0` on failure.

**Model operations:**
```json
{"jsonrpc": "2.0", "method": "call", "id": 2,
 "params": {"service": "object", "method": "execute_kw",
            "args": ["db", uid, "password", "res.partner", "search_read",
                     [[["is_company", "=", true]]],
                     {"fields": ["name", "email"], "limit": 10}]}}
```

**Key:** Every RPC call sends the password. No session cookies. `uid` stored from auth.

### 4.6 Introspection via ir.model

Only 2 RPC calls needed for full schema:

1. `searchRead("ir.model", domain, fields=["model", "name", "info", "transient", "modules"])` — list models
2. `searchRead("ir.model.fields", [["model", "=", name]], fields=[...])` — fields per model

**Cache:** Simple dict-based, instance-scoped, no TTL. `bypass_cache` option forces refresh.

**Type mapping** (Odoo → Python):

| Odoo Type | Python Type Hint |
|---|---|
| `char`, `text`, `html` | `str` |
| `integer` | `int` |
| `float`, `monetary` | `float` |
| `boolean` | `bool` |
| `date` | `str` (ISO format) |
| `datetime` | `str` (ISO format) |
| `many2one` | `int` (write) / `tuple[int, str] \| Literal[False]` (read) |
| `one2many`, `many2many` | `list[int]` |
| `selection` | `str` |
| `binary` | `str` (base64) |
| `reference` | `str` ("model,id") |

### 4.7 Logging

TS uses `debug` npm package with namespaced loggers (`odoo-client:rpc`, `odoo-client:auth`).

Python equivalent:

```python
import logging
logger = logging.getLogger("odoopy.client.rpc")
logger.debug("authenticate %s@%s", username, db)
```

**Rules:**
- Zero output by default (user enables via `logging.basicConfig(level=...)`)
- Never write to stdout (stdout = data only in CLIs)
- Module-scoped loggers: `odoopy.client.rpc`, `odoopy.client.safety`, `odoopy.introspection.cache`

---

## 5. Service Inventory (odoo-client)

### Core CRUD (on OdooClient directly)

```python
await client.search(model, domain, limit=None, offset=None, order=None)  # → list[int]
await client.read(model, ids, fields=None, context=None)                  # → list[dict]
await client.search_read(model, domain, fields=None, limit=None, ...)     # → list[dict]
await client.search_count(model, domain, context=None)                    # → int
await client.create(model, values, context=None)                          # → int
await client.write(model, ids, values, context=None)                      # → bool
await client.unlink(model, ids)                                           # → bool
await client.call(model, method, args=None, kwargs=None)                  # → Any
```

### Domain Services

| Service | Access | Key Methods |
|---|---|---|
| **MailService** | `client.mail` | `post_internal_note()`, `post_open_message()` |
| **ModuleManager** | `client.modules` | `install_module()`, `uninstall_module()`, `is_module_installed()`, `list_modules()` |
| **AttendanceService** | `client.attendance` | `clock_in()`, `clock_out()`, `get_status()`, `list()` |
| **TimesheetsService** | `client.timesheets` | `start_timer()`, `stop_timer()`, `log_time()`, `get_running_timers()` |
| **AccountingService** | `client.accounting` | `discover_cash_accounts()`, `trace_reconciliation()`, `get_cash_balance()` |
| **UrlService** | `client.urls` | `get_base_url()`, `get_record_url()`, `get_portal_url()` |
| **PropertiesService** | `client.properties` | `update_safely()`, `update_safely_batch()` |
| **CdcService** | `client.cdc` | `check()`, `get_history()`, `get_feed()` (async iterator) |

### Service Implementation Notes

- **Mail:** Body MUST be HTML. Plain text auto-wrapped in `<p>`. Empty body raises `OdooValidationError` locally.
- **Modules:** `install_module()` retries 3x with 5s delay on `ir_cron` lock errors.
- **Properties:** Odoo properties use full-replacement semantics. Service does read → merge → write.
- **CDC:** Uses `mail.tracking.value` audit log. Requires `mail.thread` + `tracking=True` fields. Cursor-based pagination (id-based, not timestamp).
- **Attendance:** If `employee_id` omitted, resolves from current user's `hr.employee`.

---

## 6. Testing Infrastructure

### Three-Tier Strategy (same as TS)

1. **Lint** — `ruff check` + `ruff format --check` + `mypy`
2. **Unit tests** — `pytest tests/ -m "not integration"` — no Docker needed
3. **Integration tests** — `pytest tests/ -m integration` — real Odoo via testcontainers

### Testcontainers Design

**Snapshot-aware startup** (critical performance optimization):

```
1. Compute snapshot hash from: Odoo version + postgres image + modules + addons + env + caller key
2. HIT:  Start fresh postgres, pg_restore the local dump, start Odoo without --init
3. MISS: Start fresh postgres + odoo --init modules, then pg_dump the baseline to local cache
```

Snapshots are local/generated artifacts owned by the consuming project. Do not depend on
language-shared prebuilt database images.

**Wait strategy (important — ORM readiness != HTTP readiness):**
1. Wait for PostgreSQL: `pg_isready` or log message
2. Wait for Odoo HTTP: `/web/health` returns 200
3. Wait for Odoo ORM: POST `/web/session/authenticate` succeeds (up to 30 retries x 2s)

Step 3 is critical. HTTP may respond before the ORM is fully initialized.

### pytest Fixtures (equivalent to globalSetup.ts)

```python
# conftest.py
import pytest
from odoo_testcontainers import OdooTestContainer

@pytest.fixture(scope="session")
async def odoo():
    """Session-scoped Odoo instance for all integration tests."""
    container = OdooTestContainer(
        version="17.0",
        modules=["crm", "sale", "project", "hr_attendance", "hr_timesheet"],
    )
    started = await container.start()
    yield started
    await started.cleanup()

@pytest.fixture
async def client(odoo):
    """Per-test authenticated client."""
    return odoo.client
```

### CI Matrix

Test against **Odoo 17, 18, 19** in parallel (same as TS):

```yaml
strategy:
  matrix:
    odoo-version: ["17.0", "18.0", "19.0"]
```

---

## 7. CI/CD Pipeline

### Workflow Structure (mirror from TS)

#### test.yml
```
Jobs:
  1. setup-build     → uv sync, build all packages
  2. lint            → ruff check + ruff format --check + mypy
  3. unit-tests      → pytest -m "not integration", coverage → Codecov
  4. docker-build    → Validate package/container builds if needed
  5. integration     → Matrix: Odoo 17/18/19, snapshot-aware containers
```

#### release.yml
```
Trigger: Successful test on main
Process:
  1. Build packages
  2. Publish to PyPI (uv publish or twine)
  3. Tag release
```

---

## 8. Python-Specific Design Decisions

### Async by Default

The TS client uses `async/await` throughout. Python port should do the same:

```python
import httpx

class JsonRpcTransport:
    def __init__(self, base_url: str):
        self._client = httpx.AsyncClient(base_url=base_url)

    async def call(self, service: str, method: str, args: list) -> Any:
        response = await self._client.post("/jsonrpc", json={
            "jsonrpc": "2.0",
            "method": "call",
            "params": {"service": service, "method": method, "args": args},
            "id": self._next_id(),
        })
        ...
```

Use **httpx** (async-native, similar API to requests) over aiohttp.

### Package Naming

- PyPI package names: `odoopy-client`, `odoopy-introspection`, `odoopy-testcontainers`
- Python import names: `odoopy_client`, `odoopy_introspection`, `odoopy_testcontainers`
- Repo name: `odoopy`
- Logger namespaces: `odoopy.client.rpc`, `odoopy.introspection.cache`, etc.

### Type Hints Everywhere

```python
from __future__ import annotations
from dataclasses import dataclass

@dataclass
class OdooClientConfig:
    url: str
    database: str
    username: str
    password: str
    safety: SafetyContext | None = None

Domain = list[str | list[str | int | float | bool | list]]
```

Run **mypy --strict** in CI.

### Dataclasses for Types

Prefer `@dataclass` over Pydantic for internal types (no validation overhead). Use Pydantic only at system boundaries if needed.

```python
@dataclass
class OdooModel:
    model: str
    name: str
    info: str | None
    transient: bool
    modules: str | None
    id: int

@dataclass
class OdooField:
    name: str
    field_description: str
    ttype: str
    required: bool
    readonly: bool
    relation: str | None
    help: str | None
    selection: str | None
    compute: str | None
    id: int
    model: str
```

### Codegen Targets Python

Instead of TypeScript interfaces, generate:
- **TypedDict** for record shapes (read results)
- **dataclass** for write inputs
- Or just TypedDict for both (simpler)

```python
# Generated output example:
class ResPartner(TypedDict, total=False):
    """Contact"""
    id: int
    name: str                              # required
    email: str | None
    partner_id: int | tuple[int, str]      # Many2one
    child_ids: list[int]                   # One2many
```

---

## 9. Shared Docker Infrastructure

These files can be copied from the TS repo to the Python repo as needed:

| File | Purpose |
|---|---|
| `docker/odoo-entrypoint.sh` | Custom Odoo entrypoint |
| `docker-compose.test.yml` | Manual local testing |

Snapshot caches should be generated locally by the Python package or restored from the
consumer project's CI cache.

---

## 10. Implementation Order

### Phase 1: Foundation
1. **Repo scaffold** — uv workspace, pyproject.toml, ruff config, mypy config
2. **odoo-client core** — `OdooClient`, `JsonRpcTransport`, error hierarchy, `create_client()`
3. **Unit tests** — error classes, config parsing, safety guards

### Phase 2: Services
4. **Port services** one by one: modules → mail → attendance → timesheets → accounting → urls → properties → cdc
5. **Unit tests** for each service

### Phase 3: Introspection
6. **odoo-introspection** — `Introspector`, `IntrospectionCache`, type mappers
7. **Codegen** — generate Python TypedDicts from Odoo schemas

### Phase 4: Testing Infrastructure
8. **odoo-testcontainers** — `OdooTestContainer` with snapshot-aware startup
9. **Integration tests** — CRUD, services, introspection against real Odoo
10. **CI/CD** — GitHub Actions with matrix testing

### Phase 5: Polish
11. **Coverage** — Codecov integration
12. **Release pipeline** — PyPI publishing
13. **Documentation** — README, getting-started

---

## 11. Key Behavioral Contracts

These are non-obvious behaviors that MUST be preserved:

1. **`authenticate()` must be called before any RPC** — client raises if not authenticated
2. **`many2one` fields return `[id, name]` or `False`** — never `None`, never bare int on read
3. **Domain filters are nested arrays** — `[["field", "op", value]]`, with `"&"` / `"|"` prefix operators
4. **Mail body is always HTML** — plain text auto-wrapped in `<p>` tags, `body_is_html=True` kwarg sent
5. **Module install can hit ir_cron lock** — retry 3x with 5s delay
6. **Properties use full-replacement semantics** — must read-merge-write
7. **CDC pagination is id-based** — not timestamp-based (sub-second precision issues)
8. **Safety guards are LOCAL decisions** — they prevent the RPC call, not a server-side check
9. **`OdooSafetyError` is never an RPC error** — it's raised before any network call
10. **`searchRead` returns records, not a cursor** — pagination via `limit`/`offset` params

---

## 12. What NOT to Port

- TypeScript-specific codegen output (generate Python instead)
- JSDoc generation (use docstrings)
- CLI commands (build new Python CLI if needed)
- MCP server (separate concern)
- Skills system (Claude-specific)
- Changesets (use python-semantic-release or manual versioning)
- The specific vitest config (use pytest.ini / pyproject.toml `[tool.pytest]`)

---

## 13. Reference: TS Source Locations

For anyone reading the TS source alongside this document:

| Concern | TS File |
|---|---|
| Client class | `packages/odoo-client/src/client/odoo-client.ts` |
| RPC transport | `packages/odoo-client/src/rpc/transport.ts` |
| Error hierarchy | `packages/odoo-client/src/types/errors.ts` |
| Safety system | `packages/odoo-client/src/safety/index.ts` |
| Service pattern | `packages/odoo-client/src/services/mail/` (example) |
| Config/factory | `packages/odoo-client/src/client/config.ts` |
| Introspector | `packages/odoo-introspection/src/introspection/introspect.ts` |
| Cache | `packages/odoo-introspection/src/introspection/cache.ts` |
| Type mappers | `packages/odoo-introspection/src/codegen/type-mappers.ts` |
| Code formatter | `packages/odoo-introspection/src/codegen/formatter.ts` |
| Container setup | `packages/odoo-testcontainers/src/odoo-container.ts` |
| Snapshot startup | `packages/odoo-testcontainers/src/odoo-container.ts` |
| Global test setup | `tests/helpers/globalSetup.ts` |
| CI test workflow | `.github/workflows/test.yml` |
| CI release | `.github/workflows/release.yml` |
