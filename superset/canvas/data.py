# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
A widget's data, queried on the server from what is stored.

The bindings always come from the canvas (or draft) definition, or from the
saved widget; a caller only adds runtime filters, which narrow each binding's
own dataset. The canvas page, MCP tools and anything else reading a widget
therefore run the same queries. A data request runs every binding the widget
type builds (``Widget.build_bindings``, by default the props' ``dataBinding``
alone) and answers each as a dataset of its name. This stands in for SIP-231's
``QueryMixin.build_queries`` and ``SemanticQuery`` until widgets query through
them.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field

if TYPE_CHECKING:
    from flask import Response
    from flask_appbuilder.api import BaseApi

    from superset.canvas.query_errors import CanvasQueryFailedError

# Values a select filter publishes.
FilterScalar = str | int | float | bool


class RuntimeFilter(BaseModel):
    """A filter value reaching the placement, as the canvas filter bus has it."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    dataset_id: int = Field(alias="datasetId")
    column: str = Field(min_length=1)
    values: list[FilterScalar] = Field(max_length=10_000)


class PlacementDataRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    runtime_filters: list[RuntimeFilter] = Field(default_factory=list, max_length=100)


@dataclass(frozen=True)
class PlacementData:
    rows: list[dict[str, Any]]
    # The query that produced the rows, as the datasource ran it.
    query: str | None
    language: str | None
    # Each column's ``GenericDataType``, by name: rows carry temporal values as
    # epoch milliseconds, which only the type tells apart from a number.
    coltypes: dict[str, int] = field(default_factory=dict)


def datasets_payload(
    datasets: Mapping[str, PlacementData], *, with_query: bool
) -> dict[str, Any]:
    """
    A data request's answer: each dataset, by name, with its rows, and the
    query that produced them when the caller may view queries.
    """
    answered: list[dict[str, Any]] = []
    for name, data in datasets.items():
        dataset: dict[str, Any] = {
            "name": name,
            "row_count": len(data.rows),
            "inline_data": data.rows,
            "coltypes": data.coltypes,
        }
        if data.query and with_query:
            dataset["query"] = data.query
            dataset["language"] = data.language
        answered.append(dataset)
    return {"result": {"datasets": answered}}


def data_response(
    api: BaseApi,
    run: Callable[[], Mapping[str, PlacementData]],
    on_error: Callable[[CanvasQueryFailedError, int], None] | None = None,
) -> Response:
    """
    A data endpoint's answer to ``run``, which runs a widget's queries as
    ``run_binding`` does and raises ``CanvasQueryFailedError`` for one that
    fails: their datasets, or that failure as ``canvas_query_error`` classifies
    it for the caller. One failing query fails them all. ``on_error`` is told
    of each failure, with the status it is answered with.
    """
    # pylint: disable=import-outside-toplevel
    from flask import Response

    from superset.canvas.query_errors import CanvasQueryFailedError
    from superset.extensions import security_manager
    from superset.utils import json

    try:
        datasets = run()
    except CanvasQueryFailedError as ex:
        error = ex.error
        missing = error.reason == "missing_datasource"
        if on_error is not None:
            on_error(ex, 404 if missing else error.status)
        if missing:
            return api.response_404()
        return api.response(error.status, **error.rest_payload())
    # Classic charts gate "View query" on the same permission.
    payload = datasets_payload(
        datasets,
        with_query=security_manager.can_access("can_view_query", "Dashboard"),
    )
    return Response(
        json.dumps(payload, default=json.json_int_dttm_ser, ignore_nan=True),
        status=200,
        mimetype="application/json",
    )


def binding_dataset_id(props: dict[str, Any]) -> int | None:
    binding = props.get("dataBinding")
    if not isinstance(binding, dict):
        return None
    dataset_id = binding.get("datasetId")
    return dataset_id if isinstance(dataset_id, int) and dataset_id > 0 else None


def query_context_payload(
    binding: dict[str, Any],
    runtime_filters: list[RuntimeFilter] | None = None,
) -> dict[str, Any]:
    """A chart data query context for ``binding``, narrowed by the runtime
    filters on the binding's dataset."""
    metrics = [m for m in binding.get("metrics") or [] if m not in (None, "")]
    filters: list[dict[str, Any]] = []
    where: list[str] = []
    for adhoc in binding.get("filters") or []:
        if adhoc.get("expressionType") == "SQL":
            if adhoc.get("sqlExpression"):
                where.append(f"({adhoc['sqlExpression']})")
        elif adhoc.get("subject"):
            filters.append(
                {
                    "col": adhoc["subject"],
                    "op": adhoc.get("operator"),
                    "val": adhoc.get("comparator"),
                }
            )
    for runtime in runtime_filters or []:
        if runtime.dataset_id == binding["datasetId"] and runtime.values:
            filters.append({"col": runtime.column, "op": "IN", "val": runtime.values})

    def label(metric: Any) -> Any:
        return metric.get("label") if isinstance(metric, dict) else metric

    orderby = [
        [
            next((m for m in metrics if label(m) == key["field"]), key["field"]),
            not key.get("descending", False),
        ]
        for key in binding.get("orderBy") or []
    ]
    return {
        "datasource": {"id": binding["datasetId"], "type": "table"},
        "queries": [
            {
                "columns": [d for d in binding.get("dimensions") or [] if d],
                "metrics": metrics,
                "filters": filters,
                "extras": {"where": " AND ".join(where)} if where else {},
                "orderby": orderby,
                "row_limit": binding.get("rowLimit") or 1000,
            }
        ],
        "result_format": "json",
        "result_type": "full",
    }


def run_binding(
    binding: dict[str, Any],
    runtime_filters: list[RuntimeFilter] | None = None,
) -> PlacementData:
    """
    Run a binding's query as the caller, through the chart data pipeline:
    dataset access, row level security and caching apply as for any chart.

    Raises what ``ChartDataCommand`` raises: ``SupersetSecurityException``
    without dataset access, ``DatasourceNotFound``, ``QueryObjectValidationError``
    or ``ChartDataQueryFailedError``.
    """
    from superset.charts.schemas import ChartDataQueryContextSchema
    from superset.commands.chart.data.get_data_command import ChartDataCommand

    query_context = ChartDataQueryContextSchema().load(
        query_context_payload(binding, runtime_filters)
    )
    command = ChartDataCommand(query_context)
    command.validate()
    result = command.run()["queries"][0]
    return PlacementData(
        rows=result.get("data") or [],
        query=result.get("query") or None,
        language=getattr(query_context.datasource, "query_language", None),
        coltypes={
            name: int(coltype)
            for name, coltype in zip(
                result.get("colnames") or [],
                result.get("coltypes") or [],
                strict=False,
            )
        },
    )
