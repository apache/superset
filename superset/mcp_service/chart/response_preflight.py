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

"""Schema-preserving final wire-size gates for MCP chart responses."""

from typing import Any, TypeVar

from pydantic import BaseModel, RootModel

from superset.mcp_service.chart.query_result import response_json_failure
from superset.mcp_service.chart.schemas import (
    ChartData,
    ChartError,
    GenerateChartResponse,
)
from superset.mcp_service.dataset.schemas import DatasetError, QueryDatasetResponse
from superset.mcp_service.semantic_layer.schemas import (
    GetTableResponse,
    SemanticLayerError,
)

_ResponseModel = TypeVar("_ResponseModel", bound=BaseModel)
_MAX_EXCEPTION_PARTS = 3
_MAX_EXCEPTION_TEXT_BYTES = 256


class UpdateChartPreviewResponse(RootModel[dict[str, Any]]):
    """Typed wire projection for the legacy dict-shaped preview response."""


def bounded_exception_message(exception: BaseException) -> str:  # noqa: C901
    """Extract bounded primitive exception arguments without formatting hooks."""
    try:
        args = object.__getattribute__(exception, "args")
    except Exception:  # pragma: no cover - BaseException provides args
        args = ()
    parts: list[str] = []
    used = 0
    if type(args) is tuple:
        for index in range(min(tuple.__len__(args), _MAX_EXCEPTION_PARTS)):
            value = tuple.__getitem__(args, index)
            if type(value) is str:
                text = value
            elif type(value) is bool:
                text = "True" if value else "False"
            elif type(value) is int and int.bit_length(value) <= 4_096:
                text = int.__str__(value)
            elif type(value) is float:
                text = float.__repr__(value)
            elif value is None:
                text = "None"
            else:
                continue
            remaining = _MAX_EXCEPTION_TEXT_BYTES - used - (2 if parts else 0)
            if remaining <= 0:
                break
            encoded = str.encode(text[:remaining], "utf-8", errors="replace")[
                :remaining
            ]
            bounded = bytes.decode(encoded, "utf-8", errors="ignore")
            if bounded:
                parts.append(bounded)
                used += bytes.__len__(encoded) + (2 if len(parts) > 1 else 0)
    if parts:
        return "; ".join(parts)
    return "request failed"


def finalize_chart_data_response(
    response: ChartData | ChartError,
) -> ChartData | ChartError:
    """Preflight every chart-data result while preserving its public union."""
    if response_json_failure(response) is None:
        return response
    return ChartError(
        error="Chart data response could not be returned safely.",
        error_type="InvalidQueryResult",
        details="The complete response exceeded its serialization safety limits.",
        suggestions=["Request fewer rows or use a narrower export."],
        error_code="CHART_DATA_RESPONSE_TOO_LARGE",
    )


def finalize_query_dataset_response(
    response: QueryDatasetResponse | DatasetError,
) -> QueryDatasetResponse | DatasetError:
    """Preflight every dataset-query result while preserving its public union."""
    if response_json_failure(response) is None:
        return response
    return DatasetError.create(
        error="Dataset response could not be returned safely.",
        error_type="InvalidQueryResult",
    )


def finalize_get_table_response(
    response: GetTableResponse | SemanticLayerError,
) -> GetTableResponse | SemanticLayerError:
    """Preflight every semantic-table result while preserving its public union."""
    if response_json_failure(response) is None:
        return response
    return SemanticLayerError.create(
        error="Semantic table response could not be returned safely.",
        error_type="InvalidQueryResult",
    )


def finalize_chart_response(
    response: _ResponseModel,
) -> _ResponseModel | ChartError:
    """Preserve a chart response schema or return a bounded structured error."""
    return response_json_failure(response) or response


def finalize_generate_chart_response(
    response: GenerateChartResponse,
) -> GenerateChartResponse:
    """Preflight generate/update responses and preserve their response schema."""
    failure = response_json_failure(response)
    if failure is None:
        return response
    return GenerateChartResponse.model_validate(
        {
            "chart": None,
            "success": False,
            "error": {
                "error_type": failure.error_type,
                "message": "Chart response could not be returned safely",
                "details": failure.error,
                "suggestions": [
                    "Request fewer preview formats or reduce result cardinality"
                ],
                "error_code": "CHART_RESPONSE_TOO_LARGE",
            },
            "schema_version": "2.0",
            "api_version": "v1",
        }
    )


def finalize_update_chart_preview_response(
    response: dict[str, Any],
) -> dict[str, Any]:
    """Preflight the complete dict-shaped update-preview response."""
    failure = response_json_failure(UpdateChartPreviewResponse(response))
    if failure is None:
        return response
    return {
        "chart": None,
        "error": {
            "error_type": failure.error_type,
            "message": "Chart preview response could not be returned safely",
            "details": failure.error,
            "suggestions": [
                "Request fewer preview formats or reduce result cardinality"
            ],
            "error_code": "CHART_RESPONSE_TOO_LARGE",
        },
        "success": False,
        "schema_version": "2.0",
        "api_version": "v1",
    }
