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
| `build_tab_name(raw: str, used: set[str], max_len: int) -> str` | Returns a sheet tab name within `max_len` that is unique case-insensitively. Pass one `used` set for the whole spreadsheet, empty or holding lowercased names. Each call adds the lowercased name it returns. A collision gets a `~N` suffix. |
| `can_export_data() -> bool` | Checks that the current user holds the export permission. |
| `can_export_dashboard(dashboard_id: int) -> bool` | Checks that the current user may export data and access the dashboard. |
| `as_user(user_id: int) -> AbstractContextManager[None]` | Runs the enclosed block as the given user. |

`active_data_mask` is the dashboard's active filter state, keyed by filter ID.

`run_query_context` always returns JSON rows and ignores the payload's `result_format`. Its `result_type` must be `full` (the default), `results`, `post_processed`, `samples` or `drill_detail`; types that return no rows, such as `query` or `columns`, raise a `ValueError`.

## Result types

Import them from `superset_core.exports.types`. All are frozen dataclasses except the enums.

- `ChartQueryResult`: `colnames`, `coltypes` (a list of `GenericDataType`) and `data` (a list of row dicts) for one query.
- `ChartResult`: `chart_id`, `chart_name`, `queries` (a list of `ChartQueryResult`) and `skipped_reason`.
- `GenericDataType`: `NUMERIC`, `STRING`, `TEMPORAL`, `BOOLEAN` or `MULTI_VALUE`.
- `SkipReason`: `no-query-context`, `unbounded-query` or `general-exception`.

`iter_dashboard_chart_results` does not raise when a single chart fails. It yields a `ChartResult` with `skipped_reason` set and an empty `queries` list, then continues with the next chart. A Celery soft timeout is the exception and propagates to the caller.

## Permissions

`run_query_context` and `iter_dashboard_chart_results` check data access: the datasource, row-level security and dashboard membership. They do not check the export permission. Your extension must check it:

- Call `can_export_data()` before `run_query_context`.
- Call `can_export_dashboard(dashboard_id)` before any dashboard export. It covers the export permission and dashboard access.

Return a 403 from your endpoint when the check fails.

## Background tasks

The [task framework](./tasks.md) does not set a user in background tasks. Wrap the work in `as_user` so queries run with the permissions of the user who started the export:

```python
from superset_core.exports.export import as_user, iter_dashboard_chart_results

with as_user(user_id):
    for chart in iter_dashboard_chart_results(dashboard_id, active_data_mask):
        ...
```

Check `can_export_dashboard` before queuing the task, and again inside `as_user` if the task may run long after the request.

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
