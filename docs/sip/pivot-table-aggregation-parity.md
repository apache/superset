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

# Pivot Table aggregation-method parity (post-SIP-216 follow-up)

## [WORKING DOC — tracking notes for an in-progress effort, not a formal SIP]

This is a running plan/notes doc, not a polished proposal. It exists so we
don't lose track of what's been established across several research passes.
Update it as decisions land; don't let it drift from what's actually true.

## Background

- SIP-216 (#41184) fixed a real correctness bug: pre-#41184, pivot table
  totals/subtotals were computed by re-aggregating already-aggregated leaf
  cell values **client-side**, which is wrong for non-additive metrics. The
  fix moved to one DB query with `GROUPING SETS`, computing cells and
  totals from the same real aggregate.
- #41184's own migration stance: "No database (metadata) migration
  required" — old `aggregateFunction` values were left orphaned in
  `params`/`query_context`, silently ignored.
- #42761 restored the one piece that *was* safely auto-mappable: the 3
  "Sum as Fraction of..." values → the new `showValuesAs` control. This is
  a pure display-layer transform on already-correct numbers, never a
  metric/aggregate rewrite. `Count as Fraction of...` was deliberately
  excluded (count-vs-value semantics differ).
- #42895 restored `MEDIAN`/`STDDEV_SAMP`/`VAR_SAMP` as first-class metric
  SQL aggregates (`docs/sip/median-stddev-variance-aggregates.md`), usable
  by any chart type via the standard metric popover. Its own SIP doc
  explicitly says restoring old `aggregateFunction` values as a metric
  rewrite is **not** a safe mechanical migration the way #42761 was, and
  proposes a "flagged for review" (admin-surfaced) migration instead of an
  automatic one. Engine support at merge time: Postgres, MySQL (no native
  MEDIAN), DuckDB, Redshift only.
- A live customer need triggered this: they're on Databricks (priority)
  and Snowflake.
- Filed apache/superset#44625 to track a separate, unverified suspicion:
  `superset/charts/client_processing.py`'s `pivot_table_v2()` (used for
  reports/alerts/exports, not the live view) may still have the pre-SIP-216
  re-aggregation bug in non-percent display mode. Shelved for later,
  tracked separately from this doc.

## Old (6.0) "Aggregation function" full list, and current disposition

| Old value | Disposition | Why |
|---|---|---|
| Sum/Avg/Count/Min/Max as fraction of Total/Rows/Columns | Handled (#42761) | n/a |
| Count as Fraction of Total/Rows/Columns | Orphaned, left as-is | Count-vs-value semantics differ from `showValuesAs`; #42761 excluded these on purpose |
| First / Last / List Unique Values | Drop, no equivalent | Confirmed by Evan; no code action needed |
| Median / Sample Standard Deviation / Sample Variance / Count Unique Values | **Under discussion** | See "Open question" below — QA ticket assumed these were mechanically auto-mappable like #42761; #42895's own SIP doc says they are not, for a semantic reason independent of engine support |
| Sum / Average / Count / Min / Max (plain, non-fraction) | Believed inert, no action needed | Metric's own aggregate already reproduces old intent when it matches; needs final confirmation |

## Open question Evan raised (2026-09-24): was 6.0 actually wrong, or did SIP-216 paint us into a corner?

Investigating now (see task tracker / next update to this doc). Question:
in 6.0, did the query already pre-aggregate to one row per pivot cell
before `aggregateFunction` (e.g. Median) was applied — making it a
genuine re-aggregation-of-aggregates bug reaching leaf cells too, not just
totals — or did the old architecture send finer-grained rows so a real
Median over real matching rows was computed correctly at the leaf-cell
level, with the bug confined to subtotals/totals? This determines whether
"restore Median" has *any* faithful modern equivalent, or whether 6.0's
own leaf-cell numbers can't be trusted as the target to restore.

**Answer: pending — do not act on the QA ticket's "mechanically mappable" framing until this lands.**

## Engine support for MEDIAN / STDDEV_SAMP / VAR_SAMP

| Engine | MEDIAN | STDDEV_SAMP | VAR_SAMP | Status |
|---|---|---|---|---|
| Postgres | `percentile_cont(0.5).within_group(col)` | native | native | Done (#42895) |
| MySQL | not implemented | native | native | Done (#42895) |
| DuckDB | native | native | native | Done (#42895) |
| Redshift | native (`sa.func.median`) | inherited from Postgres | inherited from Postgres | Done (#42895) |
| Databricks | native (`median`) | native (`stddev_samp`) | native (`var_samp`) | **Done, this branch** — `DatabricksBaseEngineSpec` (covers Native/PythonConnector/ODBC) and `DatabricksHiveEngineSpec` (Interactive Cluster), confirmed via Databricks SQL function reference docs, not yet a live instance |
| Snowflake | native (`median`, overridden — Postgres's inherited `percentile_cont` form works but is needlessly complex) | inherited from Postgres | inherited from Postgres | **Done, this branch** — confirmed via Snowflake SQL function reference docs, not yet a live instance |
| BigQuery, Trino/Presto, Hive (non-Databricks), MSSQL, Oracle, SQLite, ClickHouse, CockroachDB, and others | TBD | TBD | TBD | Survey pending (fork investigation in flight) |

Tests: `tests/unit_tests/db_engine_specs/test_databricks.py` (new
`test_extended_aggregation_func_compiles_expected_sql`,
`test_databricks_hive_spec_shares_extended_aggregations`),
`tests/unit_tests/db_engine_specs/test_snowflake.py` (already had
`test_extended_aggregation_func_median_uses_native_snowflake_syntax`),
`tests/unit_tests/db_engine_specs/test_extended_aggregations_unverified.py`
updated to drop `SnowflakeEngineSpec` from the "must reject" negative-test
list now that it opts in (Databricks was never in that list — it isn't a
Postgres/MySQL-dialect-family spec, so it was never expected to inherit the
dict silently in the first place).

## Plan (phases)

1. **This branch (`feat/pivot-agg-engine-support`)**: add `_extended_aggregations` overrides for Databricks and Snowflake (assuming Snowflake support confirms), following the exact Postgres/DuckDB/Redshift pattern in `superset/db_engine_specs/*.py`. Tests for each.
2. Survey remaining engines for real dialect support; wire up whichever are confirmed, same pattern, likely as follow-up PRs per engine or a small batch.
3. Resolve the open question above, then decide the actual migration shape for orphaned Median/StdDev/Variance/CountUnique `aggregateFunction` values — likely the "flagged for review" approach #42895's SIP proposed (exact surfacing mechanism — Tag vs. report vs. in-product banner — still Evan's call, not yet decided).
4. Revisit apache/superset#44625 (reports/exports re-aggregation bug) once shelved time is up.
5. Out of scope for now: Table / Table v2 parity (confirmed not affected the same way — no pivot-style global aggregate control there) and AG Grid Interactive Pivot (separate viz, tracked as sc-118999 internally).
