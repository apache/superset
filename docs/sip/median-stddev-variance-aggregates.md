<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# SIP: System-wide MEDIAN, Sample Standard Deviation, and Sample Variance metric aggregates

## [DRAFT — proposal for discussion]

This document now has an accompanying implementation in this PR, for the
proposed mechanism plus a first, empirically-verified engine set (Postgres,
MySQL, DuckDB, Redshift by inheritance). It is intended to seed discussion on
whether this is the right shape and scope before it goes up for a formal SIP
vote, not to pre-empt that discussion, the code exists so reviewers have a
concrete design to react to rather than a description of one.

## Motivation

Before #41184 (SIP-216, the non-additive-totals fix), the Pivot Table chart
exposed an "Aggregation function" control with 18 choices, including
`Median`, `Sample Standard Deviation`, `Sample Variance`, `First`, `Last`,
`Count Unique Values`, and `List Unique Values`. #41184 deleted that control
wholesale, and deliberately so: it re-aggregated already-aggregated cell
values to compute totals/subtotals, which is exactly the class of bug
SIP-216 fixed (summing per-group averages, averaging per-group medians, etc.
produces silently wrong totals). #42761 subsequently restored the one piece
of that control's functionality that was cleanly separable from the
correctness bug, the "show as % of row/column/total" display option,
redesigned as a decoupled, post-hoc-only `showValuesAs` control.

A user has since noticed that several of the other pre-#41184 options never
came back. Checking today's metric aggregate list (`AVG, COUNT,
COUNT_DISTINCT, MAX, MIN, SUM`, see
`superset-frontend/packages/superset-ui-core/src/query/types/Metric.ts`),
most of these have a reasonable equivalent already: `Count Unique Values`
maps to `COUNT_DISTINCT`; `Count`/`Average`/`Max`/`Min` are already standard
aggregates; the two "fraction of" variants are already covered by
`showValuesAs`. But `Median`, `Sample Standard Deviation`, and `Sample
Variance` have no equivalent today anywhere in Superset, not just in Pivot
Table, in any chart type, since the aggregate list is shared across the
whole app.

This is a real, currently-live gap, not a hypothetical one:
`superset/mcp_service/chart/chart_utils.py`, `schemas.py`, and
`prompts/create_chart_guided.py` already treat `STDDEV`, `VAR`, `MEDIAN`,
and `PERCENTILE` as valid aggregate values in their own validation and
documentation, but those values are never recognized by
`superset/connectors/sqla/models.py`'s `sqla_aggregations` dict (the actual
mapping from aggregate name to SQL), so an AI agent using the MCP tool to
build a chart with `"aggregate": "STDDEV"` today creates a chart that
**errors at query time** with "Adhoc metric aggregate is invalid." This SIP
proposes closing that gap for real, at the source, rather than patching
around it in MCP.

## Proposed change

Add `MEDIAN`, `STDDEV_SAMP`, and `VAR_SAMP` as first-class, system-wide
metric aggregates, available anywhere a metric aggregate is chosen (every
chart type, SQL Lab metric picker, MCP), not as a Pivot-Table-specific
control.

**Why this is safe with respect to SIP-216, and needs no Pivot-Table-specific
code at all:** Pivot Table's non-additive-totals machinery
(`superset-frontend/plugins/plugin-chart-pivot-table/src/plugin/utilities.ts`)
already classifies any metric aggregate not in `ADDITIVE_AGGREGATES = {SUM,
COUNT, MIN, MAX}` as non-additive, which routes totals/subtotals through the
correct DB-`GROUPING SETS`-rollup path rather than client-side
re-aggregation (`AVG` and `COUNT_DISTINCT` already go through this path
today). `MEDIAN`/`STDDEV_SAMP`/`VAR_SAMP` fall into that bucket
automatically, with zero changes needed to the additivity logic. So once
these are valid, buildable SQL aggregates, Pivot Table (and every other
chart) gets correct behavior for free. This is the version of "restore the
control" that does not reopen the bug that was just fixed.

**Where the actual change needs to land, and what this PR does:**

1. **Done.** `superset-frontend/packages/superset-ui-core/src/query/types/Metric.ts`,
   extended the `Aggregate` type.
2. **Done.** `superset-frontend/src/explore/constants.ts`, added to `AGGREGATES`
   (drives `AGGREGATES_OPTIONS`, the dropdown in `AdhocMetricEditPopover`).
3. **Done**, but not consolidated. `superset/connectors/sqla/models.py`
   (`sqla_aggregations`) and `superset/models/helpers.py`
   (`ExploreMixin.sqla_aggregations`) are both wired to consult the new
   `BaseEngineSpec.get_extended_aggregation_func`, in addition to their
   existing 6-aggregate dict, so neither's original, already-tested behavior
   changed. They remain two separate dicts, consolidating them into one
   source of truth is left as a follow-up (see Open questions).
4. **Done**, and it surfaced a second, smaller bug on top of the one this SIP
   opened with: MCP's own aggregate names (`STDDEV`, `VAR`) never matched any
   real Superset aggregate, before or after this PR, they were always going
   to error regardless of what this SIP does. `superset/mcp_service/chart/*`
   now accepts the old shorthand as an alias, normalized to the real,
   unambiguous names (`STDDEV_SAMP`, `VAR_SAMP`) this PR ships, and the guided
   prompt text points at the correct names going forward. `MEDIAN`/
   `PERCENTILE` were already spelled correctly in MCP; `PERCENTILE` remains
   unimplemented (it needs a parameter this schema has no field for) and is
   unchanged by this PR, out of scope here.

**The part that needs real engineering care, this must not be a blind
`sa.func.MEDIAN` / `sa.func.STDDEV_SAMP` / `sa.func.VAR_SAMP`:**

`sqla_aggregations` today is a flat, engine-unaware dict (`sa.func.AVG`,
etc., SQLAlchemy emits whatever function name it is given, with zero
validation that the target dialect actually has it). Superset already has
precedent for exactly this class of per-engine capability difference:
`BaseEngineSpec.supports_grouping_sets` and `_time_grain_expressions`, both
introduced by #41184 itself. This SIP proposes the same shape, a new
per-engine-overridable mechanism (for example
`BaseEngineSpec.get_aggregate_sql(aggregate, column)` with a sensible
default, overridden per engine spec where the default does not hold),
rather than a single hardcoded dict.

Verified findings so far (via `sqlglot.transpile`, cross-checked against
known engine docs; **not** exhaustively tested against live databases, that
is necessary follow-up work this SIP alone cannot complete):

| Engine | `MEDIAN(x)` | `STDDEV_SAMP(x)` | `VAR_SAMP(x)` |
|---|---|---|---|
| Postgres | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x)` | native | native |
| MySQL | no native equivalent, needs explicit "unsupported" handling, not a blind emit | native | MySQL's `VARIANCE()` is an alias for `VAR_POP` (population), not `VAR_SAMP` (sample); a naive dialect-name substitution would silently compute the wrong statistic and needs an explicit, verified expression instead |
| SQLite | only if the specific build was compiled with the (non-default) `SQLITE_ENABLE_PERCENTILE` extension (added in SQLite 3.43, 2023), cannot be assumed available | not available in core SQLite | not available in core SQLite |
| BigQuery / Snowflake / DuckDB / Redshift / Oracle / T-SQL / Databricks / Spark | native `MEDIAN(x)` | native | native on BigQuery/Snowflake/Databricks/Spark, where `VARIANCE` is correctly sample variance; T-SQL has no function named `VARIANCE` at all and needs `VAR(x)` instead |
| Trino / Presto / Hive | `PERCENTILE_CONT` / `approx_percentile` (dialect- and exactness-dependent) | native | `variance` is correctly sample variance per Trino/Presto docs |

This table is deliberately not exhaustive, Superset has roughly 75
`db_engine_specs` files. The proposed default (`BaseEngineSpec`) should be
the safe choice (mark unsupported, surface a clear user-facing error) rather
than an optimistic one, with individual engine specs opting in once
verified. Ship for the handful of engines above first, extend
opportunistically.

**`Count Unique Values`, `First`, `Last`, `List Unique Values`, explicitly
out of scope for this SIP:**

- `Count Unique Values` needs no work, it is already `COUNT_DISTINCT`.
- `First`/`Last` have no well-defined, unambiguous meaning as a plain
  `GROUP BY` aggregate without an explicit ordering; most engines only
  support this via window functions (`FIRST_VALUE`/`LAST_VALUE` `OVER
  (ORDER BY ...)`) or do not support it as a simple aggregate at all
  (Postgres has neither built in). Restoring this properly would mean
  designing an "order by" sub-control on the metric, a real, separate
  feature, not a one-line aggregate addition. Proposed as a follow-up SIP if
  there is demand.
- `List Unique Values` maps to the `STRING_AGG`/`GROUP_CONCAT`/`LISTAGG`/
  `ARRAY_AGG(DISTINCT ...)` family, real dialect differences, plus an open
  UX question (unbounded cell content for high-cardinality columns).
  Proposed as a follow-up SIP.

## New or changed public interfaces

- New `Aggregate` values (`MEDIAN`, `STDDEV_SAMP`, `VAR_SAMP`) selectable
  anywhere the standard metric control appears, every chart type, not just
  Pivot Table.
- New `BaseEngineSpec` extensibility point for per-engine aggregate SQL
  generation (exact shape TBD in implementation, likely mirrors
  `_time_grain_expressions`).
- No REST API surface changes beyond the existing metric aggregate field
  accepting new values.

## Migration plan and compatibility

No new tables/columns needed for the aggregate addition itself.

Restoring prior chart settings, the way #42761 restored `show_values_as` for
charts that had it before #41184, is murkier here than it was for that PR
and needs its own design pass: the old `aggregate_function` was a single
Pivot-Table-level setting applied uniformly to every metric on the chart,
not a per-metric property. A chart that had `aggregate_function: Median`
before #41184, with a metric of `SUM(sales)`, was already silently wrong
under the old architecture (that is the bug that was fixed); mechanically
rewriting its metric to `MEDIAN(sales)` on upgrade would change what the
chart's leaf cells display, not just its totals, which may not match user
intent. This SIP proposes a best-effort, flagged-for-review migration
(surface affected charts to admins rather than silently rewriting them)
rather than a fully automatic one-to-one restoration.

## Rejected alternatives

- **Restoring the old `aggregateFunction` Pivot-Table control as-is.**
  Rejected: this is the literal mechanism SIP-216 removed because it
  reintroduces incorrect totals for non-additive metrics. Any fix has to go
  through the metric's own aggregate, not a separate pivot-level override.
- **Routing all metric SQL generation through `sqlglot` expression-building
  instead of SQLAlchemy's `sa.func`.** More architecturally thorough (would
  give correct dialect syntax for free across more of the roughly 75 engine
  specs), but a much larger, more invasive change to a hot path used by
  every chart query. Noted as a possible future direction, not this SIP's
  scope; this SIP proposes the smaller, `supports_grouping_sets`-shaped
  extensibility point instead.

## Open questions

- **Resolved for this PR, worth confirming as the community's preferred
  shape:** implemented as `BaseEngineSpec._extended_aggregations` (a
  `{aggregate_name: sqla_column -> sqla_column}` dict) plus a
  `get_extended_aggregation_func` accessor, set on the concrete or shared
  base engine spec class per engine (e.g. on `PostgresBaseEngineSpec` so
  Redshift inherits it, but *not* on `PrestoBaseEngineSpec` so Hive/Spark/
  Databricks don't silently inherit unverified behavior, mirroring how
  `supports_grouping_sets` is opted into per-concrete-engine there today).
  Did not route through the `superset/sql/dialects/` sqlglot-based layer;
  that layer is for SQL Lab parsing, wiring it into chart-metric query
  building felt like a separate, larger change from this SIP's scope.
- **Still open, not addressed in this PR:** how aggressively should
  `MEDIAN` degrade on engines without a native or exact equivalent?
  Trino/Presto/Hive were left unimplemented (unsupported) specifically to
  avoid silently answering this with an approximate function
  (`approx_percentile`) that changes the semantics of what a user asked
  for. If someone wants `MEDIAN` on those engines, this needs a real
  decision: require explicit opt-in, show a UI warning, or keep it
  disallowed.
- **Resolved for this PR:** left the two `sqla_aggregations` dicts
  (`connectors/sqla/models.py` and `models/helpers.py`) unconsolidated,
  both now separately wired to the same new `get_extended_aggregation_func`
  hook. Consolidating them into one source of truth is real but unrelated
  cleanup, not bundled here to keep the diff reviewable.
- **New, from implementation:** only Postgres, MySQL (partial), DuckDB, and
  Redshift (by inheritance, unverified) ship enabled. BigQuery, Snowflake,
  Trino, Presto, Hive, Spark, Databricks, Oracle, and T-SQL all have
  documented (not live-verified) support per the table above but are not
  yet wired up, each needs the same live-instance verification treatment
  before being enabled, this PR intentionally didn't guess.
