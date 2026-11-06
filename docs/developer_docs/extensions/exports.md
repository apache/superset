---
title: Exports
sidebar_position: 12
---

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

# Exports

The `superset_core.exports` module lets extensions read chart and dashboard data and write it somewhere else, such as a file or a spreadsheet service. The host runs the queries, so data access rules apply to every call.

## Functions

Import them from `superset_core.exports.export`.

| Signature | Purpose |
| --- | --- |
| `run_query_context(payload: dict[str, Any]) -> list[ChartQueryResult]` | Runs a chart query context, as sent to `/api/v1/chart/data`, as the current user. |
| `iter_dashboard_chart_results(dashboard_id: int, active_data_mask: dict[str, Any]) -> Iterator[ChartResult]` | Yields the result of each chart on a dashboard, with the active filters applied. |
| `describe_dashboard_export(dashboard_id: int, active_data_mask: dict[str, Any]) -> DashboardExportInfo` | Returns the title, links and applied filters that accompany a dashboard export. |
| `build_tab_name(raw: str, used: set[str], max_len: int) -> str` | Returns a sheet tab name within `max_len` that is unique case-insensitively. Pass one `used` set for the whole spreadsheet, empty or holding lowercased names. Each call adds the lowercased name it returns. A collision gets a `~N` suffix. `max_len` must be at least 4, or a `ValueError` is raised. |
| `can_export_data() -> bool` | Checks that the current user holds the export permission. |
| `can_export_dashboard(dashboard_id: int) -> bool` | Checks that the current user holds the dashboard export permission and can access the dashboard. It does not check the data export permission. |
| `as_user(user_id: int) -> AbstractContextManager[None]` | Runs the enclosed block as the given user. Pass the requester's ID, recorded server-side when the request is made, never a client-supplied value. |

`active_data_mask` is the dashboard's active filter state, keyed by filter ID.

`run_query_context` always returns JSON rows and ignores the payload's `result_format`. Its `result_type` must be `full` (the default), `results`, `post_processed`, `samples` or `drill_detail`; types that return no rows, such as `query` or `columns`, raise a `ValueError`. A malformed payload raises a `ValidationError`.

Each query can override `result_type`. A missing or null query-level type inherits the context's type. Client processing applies only to queries whose effective type is `post_processed`, and it leaves numbers unformatted, with empty pivot cells as `None`; raw query results in the same payload keep their original rows and column types. Results remain in query order.

While it runs, the payload is the form data that Jinja macros such as `url_param` and `filter_values` read. Inside an HTTP request those macros read the request instead, so call `run_query_context` from a background task.

With `post_processed`, the rows are the table the chart displays, such as a pivot table. Hierarchical column names are joined with spaces. A pivot with multiple row dimensions exports each dimension as a separate leading column, preserving its values even when joining them with spaces would produce identical labels. Named dimensions use their index names; unnamed dimensions use `row_1`, `row_2`, and so on. A single row dimension uses a blank (`""`) column name. Default positional indexes, such as those of Table charts, are omitted. Duplicate column names receive a ` (1)`, ` (2)`, and so on suffix so every value has a unique record key. `colnames` and `coltypes` describe the exported rows.

## Result types

Import them from `superset_core.exports.types`. All are frozen dataclasses except the enums.

- `ChartQueryResult`: `colnames`, `coltypes` (a list of `GenericDataType`) and `data` (a list of row dicts) for one query.
- `ChartResult`: `chart_id`, `chart_name`, `queries` (a list of `ChartQueryResult`) and `skipped_reason`.
- `DashboardExportInfo`: `title`, `permalink_url`, `applied_filters` and `chart_urls` (chart ID to URL).
- `AppliedFilter`: a filter `name` and its `display_value`.
- `GenericDataType`: `NUMERIC`, `STRING`, `TEMPORAL`, `BOOLEAN` or `MULTI_VALUE`.
- `SkipReason`: `no-query-context`, `unbounded-query` or `general-exception`. `iter_dashboard_chart_results` never returns `unbounded-query`; only Superset's own Excel export planning sets it.

`iter_dashboard_chart_results` does not raise when a single chart fails. It yields a `ChartResult` with `skipped_reason` set and an empty `queries` list, then continues with the next chart. A Celery soft timeout is the exception and propagates to the caller.

## Errors

The host raises its own exception classes, which extensions cannot import. Catch them by meaning:

| Function | Raises |
| --- | --- |
| `run_query_context` | A security exception (HTTP 403 semantics) when the user may not access the datasource. A marshmallow `ValidationError` for a malformed payload, and a `ValueError` for a result type without rows. A query-failure exception when the query is invalid, fails in the database or cannot be loaded from the cache. |
| `iter_dashboard_chart_results` | Nothing for a failing chart, which yields a skipped result instead. A missing dashboard, or one the user cannot access, yields no results. A Celery soft time limit propagates. |
| `describe_dashboard_export` | A not-found exception (HTTP 404 semantics) for a missing dashboard, and a security exception (HTTP 403 semantics) when the user cannot access it. |
| `as_user` | A `ValueError` on entry when no user has the given ID. |

`applied_filters` from `describe_dashboard_export` lists the dashboard's native filters only, by their configured names. Cross-filters are not included, because exports do not apply them. A filter is listed only when the export applies it, by the same rules as the query: an entry in `active_data_mask` needs non-empty `extraFormData`, and a filter with no entry is listed with its saved default.

URLs from `describe_dashboard_export` resolve inside Celery workers, so they are safe to use in background tasks.

## Permissions

`run_query_context` and `iter_dashboard_chart_results` check data access: the datasource, row-level security and dashboard membership. They do not check the export permission. Your extension must check it:

- Call `can_export_data()` before `run_query_context`.
- Call both `can_export_data()` and `can_export_dashboard(dashboard_id)` before any dashboard export. `can_export_dashboard` covers the dashboard export permission and dashboard access, not the data export permission.

Return a 403 from your endpoint when the check fails.

## Background tasks

The [task framework](./tasks.md) does not set a user in background tasks. Wrap the work in `as_user` so queries run with the permissions of the user who started the export:

```python
from superset_core.exports.export import as_user, iter_dashboard_chart_results

with as_user(user_id):
    for chart in iter_dashboard_chart_results(dashboard_id, active_data_mask):
        ...
```

Take `user_id` from the request's authenticated user and store it with the task; never accept it from the client. Check `can_export_data` and `can_export_dashboard` before queuing the task, and again inside `as_user` if the task may run long after the request.

## Example

An endpoint that exports the data of a single chart. See [REST API Endpoints](./contribution-types.md#rest-api-endpoints) for the registration pattern.

```python
from flask import request, Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from superset_core.exports.export import can_export_data, run_query_context
from superset_core.rest_api.api import RestApi
from superset_core.rest_api.decorators import api


@api(id="chart_export_api", name="Chart Export API", description="Exports chart data")
class ChartExportAPI(RestApi):
    class_permission_name = "chart_export_api"

    @expose("/export", methods=("POST",))
    @protect()
    @safe
    @permission_name("read")
    def export(self) -> Response:
        if not can_export_data():
            return self.response(403, message="Export not permitted")
        results = run_query_context(request.json["query_context"])
        rows = [result.data for result in results]
        return self.response(200, result={"rows": rows})
```
