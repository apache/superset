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

# SIP: Source-data freshness ("Data as of") on dashboards and charts

## [DRAFT — proposal for discussion]

This document is the detailed design behind
[SIP issue #46623](https://github.com/apache/superset/issues/46623), which grew
out of [discussion #46027](https://github.com/apache/superset/discussions/46027).
Discussion and the vote happen on the issue and the dev@ mailing list; this file
is kept in step with it. The code is complete and tested, behind a config key
that defaults to `False`, and changes nothing for existing deployments until it
is turned on.

## Motivation

Superset tells users when a query last ran ("Cached 5 minutes ago", and "Last
queried at" when a dashboard has `show_chart_timestamps` on). It does not tell
them how old the data behind that query is. When warehouse tables are rebuilt
every hour or two, a chart queried two minutes ago can still show six-hour-old
data, and users can't tell the two apart.

Pipelines usually record the answer already: a `_loaded_at` column, a run log,
or dbt source freshness. Superset has no place to say where that timestamp lives
and nowhere to show it. The common workaround, a Big Number or Handlebars chart
reading a freshness table, is built per dashboard by hand, sits in the grid
rather than the header, and breaks for embedded users when the freshness table
is itself a dataset that a global guest RLS rule applies to.

## Proposed change

Make freshness a **dataset setting**, roll it up to the **dashboard** (the
oldest input wins), and show it beside the existing timestamps.

### 1. Configuration

Config keys rather than a feature flag, following the #44512 / SIP-230
discussion (feature flags are for rollout, config for settings of permanent
features):

```python
DATA_FRESHNESS_ENABLED = False          # master switch
DATA_FRESHNESS_CACHE_TIMEOUT = 900      # seconds an answer is cached
DATA_FRESHNESS_DISPLAY_TIMEZONE = None  # None = the viewer's browser zone
```

`DATA_FRESHNESS_ENABLED` and `DATA_FRESHNESS_DISPLAY_TIMEZONE` reach the
frontend through `FRONTEND_CONF_KEYS`.

### 2. Dataset setting

Stored in the dataset's existing `extra` JSON, beside `certification` and
`warning_markdown`, with exactly one of `column` or `sql`:

```json
{ "freshness": { "column": "_loaded_at", "warn_after_minutes": 120 } }
```

```json
{ "freshness": {
    "sql": "SELECT MAX(finished_at) FROM ops.load_log WHERE table_name = 'invoices'",
    "warn_after_minutes": 120 } }
```

- `column`: Superset runs `SELECT MAX(column)` over the dataset (wrapping a
  virtual dataset's SQL), with the viewer's row level security applied exactly
  as for their charts. It must be a time column: marked temporal (`is_dttm`) or
  given a `python_date_format`, which is also how string and number values are
  read (`epoch_s`, `epoch_ms`, or a `strftime` pattern). Saving any other
  column is refused, and the editor only lists time columns.
- `sql`: one read-only `SELECT` returning exactly one row with one column,
  holding a timestamp, a date or an ISO 8601 string, run on the dataset's
  database. Jinja renders with the dataset's template processor. Numbers are
  not read as times (a `COUNT(*)` would otherwise show as 1970); epochs are
  converted in the query.
- `warn_after_minutes` (optional): past this age the label turns into a
  warning, like dbt's `warn_after`.

Naive timestamps are read as UTC. Whether the answer is a time is only known
when the query runs, so a result that is empty, isn't a time, isn't one row with
one column, or fails hides the label instead of showing a wrong time or an
error. Each case but "empty" is logged as a warning with the dataset id and the
reason, without SQL or data.

### 3. Security of `sql` mode

`sql` lets a dataset editor make Superset run SQL for every viewer of the
dataset. Gamma and Alpha have no "Execute SQL" capability without `sql_lab`;
the closest sanctioned path is authoring a virtual dataset, whose SQL is
re-authorized whenever it changes. `freshness.sql` is held to the same bar.

**When it is stored.** The SQL must parse as a single read-only `SELECT`
without functions in `DISALLOWED_SQL_FUNCTIONS`, and the author needs real data
access to every table it reads (`raise_for_access(..., allow_editorship=False)`,
the check virtual-dataset SQL gets). It is re-checked whenever it changes or the
database, catalog, schema or template params it resolves against change. The
check runs on every path that writes `extra`:

- `PUT /api/v1/dataset/<pk>` (`UpdateDatasetCommand`);
- dataset import (v1);
- the legacy `/datasource/save/` endpoint;
- dataset duplication, which copies `extra` to a new owner.

**When it runs.** The rendered SQL is re-checked (still one read-only
statement), then the viewer's RLS is injected with `apply_rls`, the helper SQL
Lab uses. `apply_rls` only injects predicates for tables registered as
datasets, so:

- if the freshness table is *not* a dataset (the normal setup this enables), no
  RLS applies, global guest rules included, which avoids the embedded breakage
  described in the discussion;
- if it *is* a dataset, its rules apply, global guest rules included. A rule on
  a column the table lacks fails the query and the label hides (fail closed).

### 4. Caching

Answers are cached in the data cache for `DATA_FRESHNESS_CACHE_TIMEOUT`. The key
is the database, catalog, schema and the **final SQL** (after Jinja and RLS),
plus the per-user key when the connection impersonates users or caches per
user. Two viewers share an answer only when they would run identical SQL, which
also covers user-dependent Jinja such as `{{ current_username() }}`. Editing the
setting changes the SQL, so the cache needs no explicit invalidation.

### 5. API

`GET /api/v1/dashboard/<id_or_slug>/freshness` (dashboard read permission;
guest tokens allowed; 404 while `DATA_FRESHNESS_ENABLED` is off):

```json
{
  "result": {
    "data_as_of": "2026-11-26T09:30:00+00:00",
    "stale": false,
    "datasets": [
      { "id": 12, "name": "invoices", "data_as_of": "2026-11-26T09:30:00+00:00",
        "warn_after_minutes": 120, "stale": false }
    ]
  }
}
```

A dataset appears only if it has a setting and the caller may load its charts
on this dashboard: access to the dataset, or (for embedded guests and listed
viewers in promiscuous mode) access through the dashboard. `data_as_of` is the
oldest answer; `stale` is true if any dataset is past its threshold. Datasets
are queried one after another through the cache, so a dashboard with many cold
datasets is slower on its first load.

### 6. UI

- **Dashboard properties → Styling:** a "Show data freshness" switch storing
  `json_metadata.show_data_freshness`, next to "Show chart query timestamps".
- **Dashboard header:** a "Data as of <time>" label; the tooltip lists each
  dataset with its time and age. It uses the warning style when stale.
- **Chart menu:** a "Data as of <time>" line under "Cached …/Fetched …",
  matched by the chart's dataset from the same response (no extra request per
  chart).
- **Dataset editor → Settings:** a "Data freshness" section to pick the mode,
  the column or SQL, and the warning threshold.

The header label is a standalone label rather than a new `MetadataBar` type
because the metadata bar is hidden on embedded dashboards.

### 7. Embedded SDK

`dashboardUiConfig.showDataFreshness` (bit 64 of `uiConfig`). Embedded
dashboards hide the label unless the host opts in, since hosts often draw their
own header; hosts can also call the REST endpoint with the guest token.

## New or changed public interfaces

- Config: `DATA_FRESHNESS_ENABLED`, `DATA_FRESHNESS_CACHE_TIMEOUT`,
  `DATA_FRESHNESS_DISPLAY_TIMEZONE`.
- Dataset: `extra.freshness` (`column` | `sql`, `warn_after_minutes`).
- Dashboard: `json_metadata.show_data_freshness`.
- REST: `GET /api/v1/dashboard/<id_or_slug>/freshness`.
- Embedded SDK: `dashboardUiConfig.showDataFreshness`.

## Migration plan and compatibility

No database migration: everything lives in existing JSON columns. Off by
default, and opt-in per dataset and per dashboard. Exports stay importable on
older versions: dataset `extra` is free-form, and the dashboard import schema
doesn't check `json_metadata` keys. One caveat: on an older version, saving
dashboard properties while `show_data_freshness` is still in the JSON is
refused as an unknown field until the key is removed (as with any newer
`json_metadata` key).

## Rejected alternatives

- **`data_as_of` in the chart-data response.** Chart data is cached per query,
  not per dataset, so every chart would repeat or carry a stale copy of the
  lookup, and the dashboard roll-up would still merge N responses client-side.
- **A feature flag.** This is a permanent setting, not a rollout toggle.
- **A Big Number / Handlebars chart per dashboard.** Manual, lives in the grid,
  and breaks under global guest RLS.
- **Reusing "Last queried at".** It answers a different question; the two are
  complementary.

## Design decisions

- **All RLS rules apply to `sql` freshness queries, global guest rules
  included.** There is no operator switch to skip them. If a rule can't be
  applied (for example, it names a column the freshness table lacks), the query
  fails and the label is hidden. Failing closed keeps a freshness query from
  ever seeing more than the viewer's charts can. Pointing the query at a table
  that isn't a registered dataset, the usual setup, avoids the problem entirely.
- **Timestamps without a time zone are read as UTC.** There is no per-dataset
  `timezone` override. Pipelines usually record load times in UTC, and how
  times are *displayed* is already configurable with
  `DATA_FRESHNESS_DISPLAY_TIMEZONE`. A dataset whose timestamps are in local
  time can convert them in a `sql` freshness query.
- **Embedded dashboards are opt-in.** The label shows only when the host sets
  `dashboardUiConfig.showDataFreshness: true`, even when the dashboard has
  "Show data freshness" turned on. Hosts often draw their own header, so a new
  element shouldn't appear in their product unasked. Hosts that want the data
  without the label can call the REST endpoint with the guest token.

## Open questions

1. Should virtual datasets inherit freshness from the physical datasets their
   SQL reads? `superset.utils.rls.find_datasets` already resolves those tables,
   so a virtual dataset with no setting of its own could report the oldest of
   its inputs.
2. On a cold cache, a dashboard with many datasets runs the freshness lookups
   one after another. Is that acceptable for a first version, or should they go
   through `GLOBAL_ASYNC_QUERIES` or the cache warm-up task?
3. Should the dataset editor get a **Test** button that runs the freshness
   setting once and shows the answer or the reason there is none? A `sql`
   setting can only be checked for being a timestamp by running it, so without
   one, a mistake shows up only as a label that never appears (and a warning in
   the server logs). It would need a new endpoint, run as the editor with their
   RLS, so it is left out of this proposal's first version.
