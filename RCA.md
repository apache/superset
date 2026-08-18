# RCA — SQL Lab virtual dataset saves the dropdown schema, not the query's schema

**Issue:** GitHub apache/superset#16791
**Analyzed commit:** `34cd50cc4840d72636f5d33c196ba3e0fcb8a7db`
**Scope:** where the virtual dataset's `schema` is populated, and how to make it reflect the query.
Permissions/RLS enforcement is explicitly out of scope.

Every causal claim below is labelled `verified` (read end-to-end, or executed) or
`inferred` (reasoned, unconfirmed).

---

## What Happened

In SQL Lab a user selects database `examples` and schema `information_schema` in the two
left-hand dropdowns, then runs a query that qualifies its tables against a *different*
schema:

```sql
select * from public."Vehicle Sales"
```

They click **EXPLORE**, name the dataset, and click **Save & Explore**, creating a new
virtual dataset (`SqlaTable` with a non-empty `sql`).

- **Expected:** the saved dataset's `schema` is `public` — the schema the query actually reads.
- **Actual:** the saved dataset's `schema` is `information_schema` — the SQL Lab dropdown value.

The POST body sent to `/api/v1/dataset/` is (`verified`, read from
`superset-frontend/src/SqlLab/actions/sqlLab.ts:1660-1700`):

```json
{ "database": 1, "catalog": null, "schema": "information_schema",
  "sql": "select * from public.\"Vehicle Sales\"", "table_name": "my dataset", ... }
```

Reported and independently reproduced since 2021; never fixed.

---

## Root Cause

Single-causal. **`schema` is carried verbatim from the SQL Lab dropdown to the persisted
column, and no code on that path ever looks at the SQL.** (`verified` — traced end-to-end.)

The chain, in order:

| # | Location | What it does |
|---|---|---|
| 1 | `superset-frontend/src/utils/datasourceUtils.ts:54` | `schema: source.schema \|\| null` — reads the QueryEditor/Query object, whose `schema` is the dropdown selection |
| 2 | `superset-frontend/src/SqlLab/components/SaveDatasetModal/index.tsx:369` | `schema: datasource?.schema ?? ''` |
| 3 | `superset-frontend/src/SqlLab/actions/sqlLab.ts:1660-1700` | `createDatasource` puts that `schema` straight in the POST body |
| 4 | `superset/datasets/api.py:441-509` | `POST /api/v1/dataset/` → `CreateDatasetCommand(item).run()` |
| 5 | `superset/datasets/schemas.py:172,174` | `DatasetPostSchema` accepts `schema` and `sql` as independent fields, no cross-field validation |
| 6 | **`superset/commands/dataset/create.py:60`** | **`schema = self._properties.get("schema")` — the defect anchor. The value is read from the payload and never reconciled against `sql` (read on the very next line, 62).** |
| 7 | `superset/daos/base.py:482` | `setattr(item, key, value)` writes `schema` onto the new `SqlaTable` |
| 8 | `superset/connectors/sqla/models.py:1531` | `schema = Column(String(255))` — persisted |

`create.py:97-104` **does** parse the SQL — but only to hand it to
`security_manager.raise_for_access(...)`. The parse result is discarded; it is never used
to inform the stored `schema` (`verified`).

### The stored `schema` is a *default schema*, not a label

The default-schema hypothesis is confirmed. `superset/db_engine_specs/base.py:1838-1840`
states it outright (`verified`):

> "This is used in SQL Lab, allowing users to select a schema from the list of schemas
> available in a given database, and have the query run with that schema as the default one."

Downstream, the dataset's `schema` is consumed as the fallback for *unqualified* table
references, via `Table.qualify()` (`superset/sql/parse.py:414-427`), which fills in
`self.schema or schema` — i.e. explicit schemas win, the stored value is only a default:

- `superset/models/helpers.py:3147` — `apply_rls(..., self.schema or default_schema or "", ...)` resolves RLS against it (`verified`).
- `superset/models/helpers.py:1949-1953` — `self.database.get_df(sql, self.catalog, self.schema, ...)` at chart execution (`verified`).
- `superset/security/manager.py:4174-4180` — permission checks qualify parsed tables with it (`verified`).

Whether it changes execution is **engine-dependent** (`verified`): Presto/Trino write it
into the connection URI (`superset/db_engine_specs/presto.py:344-362`), so it really is
the engine's default schema; Postgres ignores it
(`superset/db_engine_specs/postgres.py:662-675` sets only the catalog). So in the
Postgres repro the wrong value does not break the chart — it silently mis-scopes
metadata, RLS resolution, and permission checks.

---

## Why It Wasn't Caught

1. **The buggy behaviour is codified as a passing test** (`verified`).
   `superset-frontend/src/SqlLab/components/SaveDatasetModal/SaveDatasetModal.test.tsx:249-268`
   is literally named `'sends the schema when creating the dataset'` and asserts
   `schema: 'main'` is forwarded. It was written to lock in the passthrough as the spec,
   so nobody read the passthrough as a defect.
2. **No backend test asserts anything about `schema` on virtual-dataset creation**
   (`verified`). `tests/unit_tests/commands/dataset/test_create.py` has zero occurrences
   of the string `schema` outside imports; its virtual-dataset cases
   (`test_create_dataset_invalid_sql_parse_error`, `..._valid_sql_with_access_error`)
   assert only on error handling.
3. **Assumption gap:** the dropdown schema and the query's schema coincide in the
   overwhelmingly common case (users pick the schema they're about to query). The defect
   only surfaces when a user deliberately cross-references, which no fixture does.
4. **The parse result was right there and unused** (`verified`). Because `create.py:99`
   already parses the SQL for the *security* question, a reviewer scanning the file sees
   "this command does look at the SQL" and does not notice that the *schema* question was
   never asked of it.

---

## The Fix

**File:** `superset/commands/dataset/create.py`, inside `validate()`.
**Insertion point:** after catalog defaulting (line 73), **before** `table = Table(...)`
at line 75.

**Before** (lines 60, 73-75):
```python
schema = self._properties.get("schema")
...
    if not catalog:
        catalog = self._properties["catalog"] = database.get_default_catalog()

    table = Table(table_name, schema, catalog)
```

**After** — when `sql` is present and the Jinja-aware parse unambiguously names one
catalog/schema pair, replace the dropdown value (and write it back to `_properties`
so the DAO persists it). The implementation logs and falls back for each unsafe case;
the core decision is:
```python
    if not catalog:
        catalog = self._properties["catalog"] = database.get_default_catalog()

    if sql:
        try:
            template_params = json_to_dict(
                self._properties.get("template_params") or ""
            )
            parse_result = process_jinja_sql(sql, database, template_params)
        except Exception:
            logger.debug(...)
        else:
            script = parse_result.script
            tables = {table for table in parse_result.tables if table.table}
            if (
                not script.has_unparseable_statement
                and not script.has_mutation()
                and not script.changes_default_schema()
                and not script.has_quoted_table_location()
                and tables
                and all(table.schema is not None for table in tables)
            ):
                qualified_pairs = {
                    (table.catalog, table.schema) for table in tables
                }
                if len(qualified_pairs) == 1:
                    derived_catalog, derived_schema = qualified_pairs.pop()
                    schema = self._properties["schema"] = derived_schema
                    if derived_catalog is not None:
                        catalog = self._properties["catalog"] = derived_catalog

    table = Table(table_name, schema, catalog)
```

The new logic reuses the Jinja-aware parser already used by the access check — **no new
SQL parsing is written**. `process_jinja_sql()` returns both the processed `SQLScript`
and the union of ordinary SQL table references plus tables harvested from partition
macros (`verified`; see the matrix below):

```python
parse_result = process_jinja_sql(sql, database)
script = parse_result.script
tables = parse_result.tables
```

### Adopt the query's schema only when ALL of these hold

| # | Condition | Why (all `verified` by execution) |
|---|---|---|
| 1 | Optional template-parameter decoding and Jinja-aware processing succeed | Partition macros can reference tables invisible to a raw SQL parse, but any enrichment failure must retain the submitted schema rather than block creation. |
| 2 | `script.has_unparseable_statement` is `False` | An opaque command plus a qualified `SELECT` exposes an incomplete table set, so derivation cannot be proven safe. |
| 3 | `script.has_mutation()` is `False` | `statement.tables` reports query sources, not DML/DDL write targets; deriving from an `INSERT ... SELECT` source would ignore its target schema. |
| 4 | `script.changes_default_schema()` is `False` | `USE other; SELECT * FROM t` and `SET search_path = other; ...` rebind runtime resolution, so any static answer is wrong. |
| 5 | Empty-name parser artifacts are filtered, with at least one real table left | Table-valued functions such as `generate_series()` can produce a non-table artifact with an empty name. |
| 6 | **Every real referenced table has an explicit schema** (zero unqualified refs) | The correctness-critical condition beyond the 2022 proposal. See below. |
| 7 | No table catalog/schema identifier is quoted | Superset's `Table` value drops sqlglot's quote bit; on case-folding engines, quoted and unquoted identifiers with identical text can name different schemas. Conservatively retain the dropdown. |
| 8 | Exactly one distinct **`(catalog, schema)` pair** — not one schema | `SELECT * FROM c1.s.t1 JOIN c2.s.t2` yields schema `{'s'}` (looks single!) but catalogs `{'c1','c2'}`. Schema alone is not a sufficient key. |
| 9 | The script contains no `SHOW` metadata statement | A metadata command can expose a resolvable table target but has no meaningful virtual-dataset schema. |

Otherwise: **keep today's dropdown value, unchanged.**

### Why condition 6 is required (this is the important finding)

The 2022 proposal was "if the query references exactly one explicit schema, use it." That
rule is **unsafe** for mixed queries. Executed result:

```
SELECT * FROM public.t1 JOIN t2 ON t1.id = t2.id
  → explicit={'public'}  bare=['t2']
```

Exactly one explicit schema — so the naive rule stores `public`. But `t2` was resolving
against `information_schema` (the dropdown) when the user ran it in SQL Lab, and would now
resolve against `public`. **That silently changes what the query means** — and on
Presto/Trino, what it actually executes. Requiring zero unqualified references makes the
stored value provably inert: with nothing left to qualify, changing the default cannot
change resolution. That also makes the fix order-independent w.r.t. the
`raise_for_access` call below (`inferred`, follows from `Table.qualify`'s
`self.schema or schema` semantics).

### Verified parser behaviour matrix

Executed against `superset/sql/parse.py` at the analyzed commit via an isolated harness
outside the repository. `postgresql` dialect unless noted.

| Query | Parsed | Rule fires? |
|---|---|---|
| `select * from public."Vehicle Sales"` *(the repro)* | `{Table("Vehicle Sales","public")}` | ✅ → `public` |
| `SELECT * FROM my_table` | bare=`['my_table']` | ❌ zero → dropdown |
| `SELECT * FROM a.t1 JOIN b.t2` | explicit=`{'a','b'}` | ❌ multi → dropdown |
| `SELECT * FROM a.t1 JOIN a.t2` | explicit=`{'a'}` | ✅ → `a` |
| `SELECT * FROM public.t1 JOIN t2` | explicit=`{'public'}`, bare=`['t2']` | ❌ **cond. 6** → dropdown |
| `WITH orders AS (SELECT * FROM public.orders) SELECT * FROM orders` | `{Table("orders","public")}` — CTE correctly excluded | ✅ → `public` |
| `SELECT * FROM public.t1 WHERE id IN (SELECT id FROM other.t2)` | explicit=`{'other','public'}` | ❌ multi → dropdown |
| `SELECT * FROM (SELECT * FROM public.t1) sub` | explicit=`{'public'}` | ✅ → `public` |
| `SELECT * FROM c1.s.t1 JOIN c2.s.t2` | schemas=`{'s'}`, catalogs=`{'c1','c2'}` | ❌ **cond. 8** → dropdown |
| `SELECT * FROM public.t1 JOIN "public".t2` | quote bit is present only on the sqlglot AST | ❌ quoted-location guard → dropdown |
| `USE other; SELECT * FROM t` | `changes_default_schema=True` | ❌ **cond. 4** → dropdown |
| `SELECT * FROM {{ my_schema }}.t` | `SupersetParseError` | ❌ **cond. 1** → dropdown |
| `SELECT 1` | no tables | ❌ zero → dropdown |
| `SELECT * FROM \`proj.ds.tbl\`` (bigquery) | `Table("tbl","ds","proj")`, quoted location | ❌ quoted-location guard → dropdown |
| `INSERT INTO secret.t SELECT * FROM public.s` | source=`public.s`, `has_mutation=True` | ❌ mutation guard → dropdown |
| `EXPLAIN SELECT * FROM hidden.t; SELECT * FROM public.t1` | opaque first statement, enumerable=`public.t1` | ❌ unparseable guard → dropdown |
| `SELECT * FROM public.t1 WHERE ds = '{{ presto.latest_partition("secret.audit") }}'` | Jinja-aware tables=`{public.t1, secret.audit}` | ❌ multi → dropdown |

CTE handling is correct and needs no special-casing: `is_cte()`
(`superset/sql/parse.py:2233-2250`) already excludes CTE names while still reporting a
real table that shares a CTE's name.

### Explicitly unchanged

- **Zero-schema and multi-schema queries** keep today's dropdown behaviour. This is an
  accepted limitation of the fix, not a defect to address here.
- **Permissions / RLS enforcement** — untouched. `raise_for_access` keeps its current
  arguments and semantics; permissions/RLS enforcement remains out of scope.
- **The multi-schema dataset model** — deferred redesign, out of scope.
- **Physical datasets** (`sql` empty) — untouched; `schema` remains required and authoritative.
- **Frontend** — no change needed. The backend is the right and only place: it is the
  convergence point for all three callers (SQL Lab modal, ResultSet panel, MCP tool).

---

## Latent Bugs Found

- `superset/commands/dataset/update.py:206-217` — `PUT /api/v1/dataset/<id>` accepts a new
  `schema` for a virtual dataset with the same no-reconciliation-against-`sql` gap; editing
  a virtual dataset's SQL leaves a now-stale `schema`. Same defect class, separate entry point. (`verified`)
- `superset/mcp_service/dataset/tool/create_virtual_dataset.py:130-131` — passes
  `schema_name` through for virtual datasets. **Routes through `CreateDatasetCommand`, so
  the fix above covers it automatically** — a convergence point, not a second fix site. (`verified`)
- `superset/commands/dataset/duplicate.py:79` — `table.override(self._base_model)` copies
  `schema` (in `export_fields`, `superset/connectors/sqla/models.py:1553`). Correct for a
  duplicate, but propagates an already-wrong value. Not a defect in itself. (`verified`)
- Dataset import (`superset/commands/dataset/importers/v1/utils.py:338,407`) trusts the
  `schema` in the YAML for virtual datasets. Correct for round-tripping; perpetuates bad
  values. Not a defect in itself. (`verified`)
- **Identifier case folding is unmodelled anywhere in this path.** `SELECT * FROM
  MySchema.tbl` stores `MySchema` verbatim, while Postgres folds the unquoted identifier to
  `myschema` at execution. Pre-existing, affects the dropdown value equally, and broader
  than this bug. (`verified` by execution)
- `SELECT * FROM generate_series(1,10)` yields a table entry with an **empty-string name**.
  The derivation logic filters this parser artifact before applying its safety conditions;
  an empty-only reference set still falls back to the dropdown. (`verified`)
- The quote guard cannot see quoting that appears only inside a partition-macro table
  argument because macro extraction strips those quotes before returning `Table` values.
  This is limited to partition-macro use on the Presto/Hive/Trino family and is deferred
  to a separately scoped follow-up. (`verified by review`)
- `process_jinja_sql()` can execute Jinja macros on the create path for users with
  database access. The pre-existing `dataset_macro` missing-access-check issue is broader
  than schema derivation and requires its own security ticket rather than a bundled fix.
  (`verified by review`)
- A schema-qualified table-valued function can be represented as an empty-name table and
  is removed by the artifact filter. Distinguishing it safely from false table references
  is deferred. (`verified by review`)

---

## Prevention

1. **Backend regression guards are implemented** in
   `tests/unit_tests/commands/dataset/test_create.py`, matching the file's existing
   mock-based style (no live DB):
   - `test_create_dataset_schema_derived_from_single_schema_query` — construct
     `CreateDatasetCommand({"database": 1, "table_name": "d", "schema": "information_schema",
     "sql": 'select * from public."Vehicle Sales"'})`, call `validate()`, assert
     `command._properties["schema"] == "public"`. It failed on the pre-fix baseline
     (`"information_schema"`) for exactly the intended reason.
   - Companions pinning the fallbacks so the fix cannot over-reach:
     `..._keeps_dropdown_schema_when_query_has_no_schema` (`SELECT * FROM t`),
     `..._keeps_dropdown_schema_for_multi_schema_query` (`a.t1 JOIN b.t2`),
     `..._keeps_dropdown_schema_for_unqualified_reference` (`public.t1 JOIN t2` — the
     all-qualified guard), `..._keeps_dropdown_schema_when_sql_is_unparseable` (Jinja),
     and `..._keeps_dropdown_schema_after_schema_change` (`USE`).
   - Review hardening is pinned by cases for Jinja partition-macro tables, mutation and
     opaque-statement guards, catalog differentiation, quoted schema identity, and
     empty-name table-function artifacts. These cover the three additional safety
     dimensions found in review: Jinja-aware table extraction, write-target blindness,
     and case-folding ambiguity.
   - Unit-level assertion on `_properties` rather than a persisted row keeps it a true
     unit test; `validate()` already mutates `_properties["database"]`/`["catalog"]`, so
     asserting on it follows the established contract.

2. **Rule: a field that is *derived* from user-supplied SQL must never be accepted raw from
   the client on a path that already parses that SQL.** `create.py` parsed the SQL for
   security four lines below where it took `schema` on trust. A review checklist item —
   "this endpoint parses `sql`; which other payload fields are answerable from the parse?" —
   would have caught it in 2021.

3. **Keep the frontend transport test unchanged.**
   `SaveDatasetModal.test.tsx:249` asserts that the modal forwards the editor's schema in
   the request payload. The backend remains responsible for reconciling that value with
   the query, so this assertion remains factually correct and is not part of the fix.

**Not preventable by monitoring** — the failure is silent and produces a working chart in
the common (Postgres) case. Only an assertion at creation time catches it.

---

## Known Limitations of the Recommended Fix

- **Case-differing schemas read as multi-schema.** `Public.t1 JOIN public.t2` →
  `{'Public','public'}` → classified multi → falls back to the dropdown (`verified`).
  Conservative and safe (never worse than today). Fixing it properly needs per-dialect
  identifier folding (Postgres→lower, Snowflake/Oracle→upper, MySQL filesystem-dependent);
  `sqlglot.optimizer.normalize_identifiers` could do it but needs dialect plumbing.
  **Recommendation: leave as an explicit known limitation**, not worth the blast radius here.
- **Case-preserved storage.** `MySchema.tbl` stores `MySchema` where Postgres would resolve
  `myschema`. Pre-existing and equally true of the dropdown value today — not a regression.
- **Quoted catalog/schema identifiers conservatively fall back.** This includes schema
  names that require quoting because they contain dots or spaces. Superset's extracted
  `Table` value does not retain the quote bit needed to compare their engine-specific
  identity safely; retaining the dropdown is the safe status quo.
- **Uniqueness-key shift.** Deriving `schema` before `Table(...)` at line 75 means the
  uniqueness check keys on the derived value. That is intended and necessary — deriving it
  *after* line 77 would let two datasets collide on `(table_name, public, catalog)`.
  Reviewers should confirm this ordering is deliberate.
