# RCA: GSheets Date-column time-range filter fails with "Invalid query: NO_COLUMN: null"

## What Happened

Filtering a Google Sheets-backed dataset on a `Date`-typed column using a
built-in time-range filter (e.g. "Previous Calendar Month") fails with
`Error: Invalid query: NO_COLUMN: null`. The same scenario works on Postgres.

## Root Cause

**verified** (traced end-to-end through `apache/superset` and the installed
`shillelagh==1.4.4` package, and reproduced the exact literal transformation
at each stage with a standalone Python script):

1. `superset/models/helpers.py::get_time_filter` builds the WHERE-clause
   bounds for a time-range filter by calling `dttm_sql_literal(dttm, col)`
   for the start/end bounds (`superset/models/helpers.py:3575-3585`).
2. `dttm_sql_literal` calls `db_engine_spec.convert_dttm(col.type, dttm, ...)`
   first. `GSheetsEngineSpec` had no `convert_dttm` override, so it inherited
   `SqliteEngineSpec.convert_dttm` (via `ShillelaghEngineSpec`,
   `superset/db_engine_specs/sqlite.py:144-150`), which only special-cases
   `types.String`/`types.DateTime` and returns `None` for `types.Date`.
3. When `convert_dttm` returns `None`, `dttm_sql_literal` falls back to a
   full `'YYYY-MM-DD HH:MM:SS.ffffff'` literal
   (`superset/models/helpers.py`, fallback branch) — e.g.
   `'2022-08-01 00:00:00.000000'` — even for a pure Date column.
4. That literal is sent as SQL text through SQLAlchemy/apsw to shillelagh's
   virtual-table layer. `shillelagh/backends/apsw/vt.py::get_all_bounds`
   converts the raw SQLite-bound constraint value using
   `type_map[column_type.type]().parse(constraint)`, and for a `DATE`-typed
   column this is `shillelagh.fields.ISODate.parse`, which calls
   `datetime.date.fromisoformat(value)`.
5. `date.fromisoformat` rejects a string with a trailing time-of-day
   component and raises `ValueError`. `ISODate.parse` catches this and
   **silently returns `None`** (`shillelagh/fields.py:358-365`).
6. `vt.py::get_all_bounds` then calls `value = column_type.format(constraint)`
   — i.e. `GSheetsDate.format(None)` — which returns `""` per its own
   None-guard (`shillelagh/adapters/api/gsheets/fields.py:154-158`).
7. That empty string becomes the `Range` filter's bound value, which is later
   passed to `GSheetsDate.quote("")` when shillelagh builds the Google
   Visualization/Chart API (GQL) query text
   (`shillelagh/adapters/api/gsheets/fields.py:160-168`,
   `shillelagh/lib.py:353-366`). Because `value == ""`, `quote()` returns the
   **bare, unquoted literal `null`** — not a quoted string, not a `date '...'`
   literal.
8. That bareword is spliced directly into the GQL query text sent to
   Google's servers (e.g. `... WHERE C >= null ...`). Google's GQL parser
   treats an unquoted bareword as a column identifier, doesn't find a column
   named `null`, and returns `Invalid query: NO_COLUMN: null` — the exact
   reported error text.

This reproduces the exact reported error message, confirmed by directly
exercising `shillelagh.fields.ISODate.parse` →
`shillelagh.adapters.api.gsheets.fields.GSheetsDate.format` →
`GSheetsDate.quote` with the literal Superset produces today.

### Correction to the initial hypothesis

The initial trace (pre-worktree) hypothesized that the bareword `null` comes
from `GSheetsDate.quote()`'s `self.pattern is None` branch (Google not
reporting a display pattern for the column). That branch **does** produce
`null` too, but it is not what fires for the reported scenario: it was
verified that even with a realistic pattern set (e.g. `"M/d/yyyy"`, which is
also Google's own default for date-typed columns), the bug reproduces via the
`value == ""` branch instead, because the upstream `ISODate.parse()` step
already destroys the value before `quote()` ever sees the original literal
Superset produced. The pattern-parsing failure mode described as hypothesis
"(b)" in the pre-trace does not occur in practice, because `quote()` never
receives the raw mismatched-shape literal directly — it receives whatever
`GSheetsDate.format()` produced from the (already-`None`) parsed constraint.

## Why It Wasn't Caught

`tests/unit_tests/db_engine_specs/test_gsheets.py` had no test coverage for
`convert_dttm` at all (confirmed: `grep -c convert_dttm` on the file before
this change returned 0 matches). `test_sqlite.py` likewise has no coverage
asserting `SqliteEngineSpec.convert_dttm`'s behavior for `types.Date`, so the
`None` fallback for Date columns was never exercised by any test in the
`sqlite`/`shillelagh`/`gsheets` engine-spec family, even though the
equivalent `TO_DATE(...)` case is explicitly tested for Postgres in
`tests/unit_tests/db_engine_specs/test_postgres.py`.

## The Fix

`superset/db_engine_specs/gsheets.py`: added a `GSheetsEngineSpec.convert_dttm`
override that returns a plain `'YYYY-MM-DD'` literal for `types.Date` columns
(no time-of-day component, so `shillelagh.fields.ISODate.parse` succeeds),
and defers to the inherited `SqliteEngineSpec.convert_dttm` behavior
(String/DateTime/unknown) otherwise:

```python
@classmethod
def convert_dttm(
    cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
) -> str | None:
    sqla_type = cls.get_sqla_column_type(target_type)
    if isinstance(sqla_type, types.Date):
        return f"'{dttm.date().isoformat()}'"
    return super().convert_dttm(target_type, dttm, db_extra=db_extra)
```

Verified end-to-end (standalone script driving the real installed
`shillelagh` package) that with this literal, `ISODate.parse` now succeeds,
`GSheetsDate.format` produces the sheet's display-pattern-formatted string
(e.g. `"8/1/2022"` for pattern `"M/d/yyyy"`), and `GSheetsDate.quote` now
returns a well-formed `date '2022-08-01'` GQL literal instead of the bare
`null` bareword.

`DateTime`-typed columns were not affected by this bug:
`SqliteEngineSpec.convert_dttm` already emits
`'YYYY-MM-DD HH:MM:SS'` (no microseconds, via `isoformat(sep=" ",
timespec="seconds")`), which `shillelagh.fields.FastISODateTime.parse`
(`datetime.datetime.fromisoformat`) parses successfully — confirmed by
running the same trace with a `DateTime` target type. Only the `Date` case
was broken, matching the guardrail to keep this change minimal.

## Latent Bugs Found

- **Same root cause, GSheets-specific downstream symptom, deliberately not
  fixed here**: `ShillelaghEngineSpec`/`SqliteEngineSpec.convert_dttm` still
  returns `None` for `types.Date` for every other consumer of the
  `sqlite`/`shillelagh` engine-spec family (plain SQLite datasets, and other
  shillelagh adapters such as CSV or generic API adapters). Any such adapter
  with a genuine `Date`-typed column and no custom `convert_dttm` override
  will hit the same `dttm_sql_literal` fallback-to-datetime-with-microseconds
  literal. Whether that manifests as visibly as the GSheets
  `NO_COLUMN: null` error depends on how that adapter's own `Field.quote()`
  (or equivalent) handles an out-of-range/empty value — not verified for
  CSV/other adapters, so scoped out per the task guardrail rather than
  broadened to `ShillelaghEngineSpec`/`SqliteEngineSpec`.
- **inferred, shillelagh-side, out of scope for `apache/superset`**: when
  Google's Chart API does not report a `pattern` for a given column at all
  (`self.pattern is None` in `GSheetsDate`), `GSheetsDate.quote()` returns
  the bare `null` literal for **any** filter value, regardless of what
  Superset sends — confirmed by direct reproduction
  (`GSheetsDate(pattern=None).quote("2022-08-01")` → `'null'`). This is a
  distinct, narrower gap inside the `shillelagh` PyPI package itself (not
  `apache/superset`), and is out of scope for this fix per the dispatch
  brief's hard-stop instruction on `shillelagh`-only fixes.
- Open GitHub issue apache/superset#30413 ("Cannot Apply Filter in Dashboard
  to Google Sheet Data Source") reports the same `Invalid query: NO_COLUMN:
  null` error text for GSheets dashboard filters more broadly. Given the
  mechanism confirmed here, it's plausible some of those reports share this
  exact root cause (Date-typed columns hitting the `convert_dttm` gap this
  fix addresses); others may be hitting the separate `self.pattern is None`
  gap noted above, which remains open. Not independently investigated beyond
  what's described here.

## Prevention

A unit test on `GSheetsEngineSpec.convert_dttm` (added by this change,
following the existing `test_postgres.py::test_convert_dttm` pattern with
`assert_convert_dttm`) parameterized over `Date`/`DateTime`/unknown target
types would have caught this at the time `GSheetsEngineSpec` (or its
`ShillelaghEngineSpec`/`SqliteEngineSpec` ancestors) was introduced without a
`Date` case. More generally: any `BaseEngineSpec` subclass that overrides (or
inherits a partial override of) `convert_dttm` should have explicit test
coverage for every `GenericDataType.TEMPORAL` SQLAlchemy type it may
encounter (`Date`, `DateTime`/`TIMESTAMP`, `Time`), not just the ones a given
PR happened to touch — mirroring the coverage `test_postgres.py` already has.
