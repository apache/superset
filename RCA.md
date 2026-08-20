# RCA: GSheets Date-column time-range filter fails with "Invalid query: NO_COLUMN: null"

## What Happened

Filtering a Google Sheets-backed dataset on a `Date`-typed column using a
built-in time-range filter (e.g. "Previous Calendar Month") fails with
`Error: Invalid query: NO_COLUMN: null`. The same scenario works on Postgres.

## Root Cause

**verified** (traced end-to-end through `apache/superset` and the installed
`shillelagh==1.4.4` package, and reproduced the exact literal transformation
at each stage with a standalone Python script — full script and captured
output in [Reproduction Evidence](#reproduction-evidence) below):

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
`GSheetsDate.quote` with the literal Superset produces today (see "BEFORE
fix: Date column" trace in [Reproduction Evidence](#reproduction-evidence)).

### Correction to the initial hypothesis

The initial trace (pre-worktree) hypothesized that the bareword `null` comes
from `GSheetsDate.quote()`'s `self.pattern is None` branch (Google not
reporting a display pattern for the column). That branch **does** produce
`null` too, but it is not what fires for the reported scenario: it was
verified that even with a realistic pattern set (e.g. `"M/d/yyyy"`, which is
also Google's own default for date-typed columns), the bug reproduces via the
`value == ""` branch instead, because the upstream `ISODate.parse()` step
already destroys the value before `quote()` ever sees the original literal
Superset produced (both the `pattern="M/d/yyyy"` and `pattern=None` traces in
the evidence below produce the identical `'null'` result from the same
`value == ""` branch, for this reason). The pattern-parsing failure mode
described as hypothesis "(b)" in the pre-trace does not occur in practice,
because `quote()` never receives the raw mismatched-shape literal directly —
it receives whatever `GSheetsDate.format()` produced from the
(already-`None`) parsed constraint.

## Why It Wasn't Caught

**verified**:

```
$ git show c2d653b4b8:tests/unit_tests/db_engine_specs/test_gsheets.py | grep -c convert_dttm
0
$ git show c2d653b4b8:tests/unit_tests/db_engine_specs/test_sqlite.py | grep -n -A8 'target_type,expected_result'
30:    "target_type,expected_result",
31-    [
32-        ("Text", "'2019-01-02 03:04:05'"),
33-        ("DateTime", "'2019-01-02 03:04:05'"),
34-        ("TimeStamp", "'2019-01-02 03:04:05'"),
35-        ("Other", None),
36-    ],
```
(`c2d653b4b8` is the commit this branch forked from, i.e. `master` before
this fix.)

`tests/unit_tests/db_engine_specs/test_gsheets.py` had no test coverage for
`convert_dttm` at all. `test_sqlite.py` has a `test_convert_dttm`, but its
parametrization (`Text`/`DateTime`/`TimeStamp`/`Other`) has no `Date` case,
so `SqliteEngineSpec.convert_dttm`'s `None`-for-`types.Date` fallback was
never exercised by any test in the `sqlite`/`shillelagh`/`gsheets`
engine-spec family, even though the equivalent `TO_DATE(...)` case is
explicitly tested for Postgres in
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
`shillelagh` package, see "AFTER fix: Date column" trace in
[Reproduction Evidence](#reproduction-evidence)) that with this literal,
`ISODate.parse` now succeeds, `GSheetsDate.format` produces the sheet's
display-pattern-formatted string (e.g. `"8/1/2022"` for pattern
`"M/d/yyyy"`), and `GSheetsDate.quote` now returns a well-formed
`date '2022-08-01'` GQL literal instead of the bare `null` bareword.

`DateTime`-typed columns were not affected by this bug:
`SqliteEngineSpec.convert_dttm` already emits
`'YYYY-MM-DD HH:MM:SS'` (no microseconds, via `isoformat(sep=" ",
timespec="seconds")`), which `shillelagh.fields.FastISODateTime.parse`
(`datetime.datetime.fromisoformat`) parses successfully — confirmed by
running the same trace with a `DateTime` target type (see "DateTime column"
trace in the evidence below). Only the `Date` case was broken, matching the
guardrail to keep this change minimal.

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
- **verified, shillelagh-side, out of scope for `apache/superset`**: when
  Google's Chart API does not report a `pattern` for a given column at all
  (`self.pattern is None` in `GSheetsDate`), `GSheetsDate.quote()` returns
  the bare `null` literal for **any** filter value, regardless of what
  Superset sends — confirmed by direct reproduction:
  ```
  $ python3 -c "
  from shillelagh.adapters.api.gsheets.fields import GSheetsDate
  print(repr(GSheetsDate(pattern=None).quote('2022-08-01')))
  "
  'null'
  ```
  This is a distinct, narrower gap inside the `shillelagh` PyPI package
  itself (not `apache/superset`), and is out of scope for this fix per the
  dispatch brief's hard-stop instruction on `shillelagh`-only fixes.
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

## Reproduction Evidence

Standalone script exercising the installed `shillelagh==1.4.4` package
directly (`python3 --version`: 3.11.2), independent of Superset. This is the
exact script the "verified" claims above are based on. Requires only
`pip install shillelagh` — no Superset app context, no Google credentials,
no network access.

```python
"""
Standalone repro against the installed shillelagh==1.4.4 package (no Superset
import needed -- this exercises exactly the layer shillelagh's apsw virtual
table implementation (shillelagh/backends/apsw/vt.py::get_all_bounds) runs
constraint values through before building the Google Chart API query).

Run: python3 rca_repro.py
"""
import datetime
from shillelagh.fields import ISODate, FastISODateTime
from shillelagh.adapters.api.gsheets.fields import GSheetsDate, GSheetsDateTime

dttm = datetime.datetime(2022, 8, 1, 0, 0, 0)


def trace(label, literal_value, isodate_field, gsheets_field_cls, pattern):
    print(f"\n--- {label} (pattern={pattern!r}) ---")
    print(f"1. Superset dttm_sql_literal() produces: {literal_value!r}")
    constraint = isodate_field().parse(literal_value)
    print(f"2. shillelagh ISODate/FastISODateTime.parse() -> {constraint!r}")
    field = gsheets_field_cls(pattern=pattern)
    internal_value = field.format(constraint)
    print(f"3. GSheetsDate(Time).format(constraint) -> {internal_value!r}")
    try:
        quoted = field.quote(internal_value)
        print(f"4. GSheetsDate(Time).quote(internal_value) -> {quoted!r}")
    except Exception as e:
        print(f"4. GSheetsDate(Time).quote(internal_value) raised: {type(e).__name__}: {e}")


# BEFORE the fix: SqliteEngineSpec.convert_dttm returns None for types.Date,
# so models/helpers.py::dttm_sql_literal falls back to a full ISO
# datetime-with-microseconds literal, even for a pure Date column.
before_literal = dttm.strftime("%Y-%m-%d %H:%M:%S.%f")
trace("BEFORE fix: Date column", before_literal, ISODate, GSheetsDate, pattern="M/d/yyyy")
trace("BEFORE fix: Date column, no display pattern", before_literal, ISODate, GSheetsDate, pattern=None)

# AFTER the fix: GSheetsEngineSpec.convert_dttm emits a plain ISO date literal.
after_literal = f"'{dttm.date().isoformat()}'".strip("'")
trace("AFTER fix: Date column", after_literal, ISODate, GSheetsDate, pattern="M/d/yyyy")

# DateTime was never affected: SqliteEngineSpec.convert_dttm already emits a
# literal with seconds precision and no trailing microseconds.
datetime_literal = dttm.isoformat(sep=" ", timespec="seconds")
trace("DateTime column (always worked)", datetime_literal, FastISODateTime, GSheetsDateTime, pattern="M/d/yyyy H:mm:ss")
```

Captured output:

```
--- BEFORE fix: Date column (pattern='M/d/yyyy') ---
1. Superset dttm_sql_literal() produces: '2022-08-01 00:00:00.000000'
2. shillelagh ISODate/FastISODateTime.parse() -> None
3. GSheetsDate(Time).format(constraint) -> ''
4. GSheetsDate(Time).quote(internal_value) -> 'null'

--- BEFORE fix: Date column, no display pattern (pattern=None) ---
1. Superset dttm_sql_literal() produces: '2022-08-01 00:00:00.000000'
2. shillelagh ISODate/FastISODateTime.parse() -> None
3. GSheetsDate(Time).format(constraint) -> ''
4. GSheetsDate(Time).quote(internal_value) -> 'null'

--- AFTER fix: Date column (pattern='M/d/yyyy') ---
1. Superset dttm_sql_literal() produces: '2022-08-01'
2. shillelagh ISODate/FastISODateTime.parse() -> datetime.date(2022, 8, 1)
3. GSheetsDate(Time).format(constraint) -> '8/1/2022'
4. GSheetsDate(Time).quote(internal_value) -> "date '2022-08-01'"

--- DateTime column (always worked) (pattern='M/d/yyyy H:mm:ss') ---
1. Superset dttm_sql_literal() produces: '2022-08-01 00:00:00'
2. shillelagh ISODate/FastISODateTime.parse() -> datetime.datetime(2022, 8, 1, 0, 0)
3. GSheetsDate(Time).format(constraint) -> '8/1/2022 0:00:00'
4. GSheetsDate(Time).quote(internal_value) -> "datetime '2022-08-01 00:00:00'"
```

Note both "BEFORE fix" traces converge on step 2 (`ISODate.parse()` returning
`None` because the literal has a trailing time-of-day component that
`date.fromisoformat` rejects) regardless of `pattern` — this is what backs
the "Correction to the initial hypothesis" note above: the `pattern=None`
and `pattern` mismatched-shape hypotheses from the pre-trace both turned out
to be moot, because the value never reaches `quote()` intact either way.
