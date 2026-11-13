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
A placement's data, queried on the server from its stored ``dataBinding``.

The binding always comes from the canvas (or draft) definition; a caller only
adds runtime filters, which narrow the binding's own dataset. The canvas page,
MCP tools and anything else reading a placement therefore run the same query.
This stands in for SIP-231's ``build_queries`` until widgets declare their own.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

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
    )
