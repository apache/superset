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

"""Final wire-size gates for MCP chart responses."""

from typing import Any, TypeVar

from pydantic import BaseModel, RootModel

from superset.mcp_service.chart.query_result import response_json_failure
from superset.mcp_service.chart.schemas import (
    ChartError,
    GenerateChartResponse,
)

_ChartModel = TypeVar("_ChartModel", bound=BaseModel)


def _wire_size_error(failure: ChartError, message: str) -> dict[str, Any]:
    """Build the shared bounded error payload for chart response finalizers."""
    return {
        "error_type": failure.error_type,
        "message": message,
        "details": failure.error,
        "suggestions": ["Request fewer preview formats or reduce result cardinality"],
        "error_code": "CHART_RESPONSE_TOO_LARGE",
    }


def preflight_chart_response(
    response: _ChartModel,
) -> _ChartModel | ChartError:
    """Return a chart model only when its complete wire projection is bounded."""
    return response_json_failure(response) or response


def preflight_generate_chart_response(
    response: GenerateChartResponse,
    *,
    persisted_chart_id: int | None = None,
) -> GenerateChartResponse:
    """Map a wire-size failure into the generate/update response error schema."""
    failure = response_json_failure(response)
    if failure is None:
        return response
    if persisted_chart_id is not None:
        return GenerateChartResponse.model_validate(
            {
                "chart": {"id": persisted_chart_id},
                "success": False,
                "error": {
                    "error_type": failure.error_type,
                    "message": (
                        "Chart was created, but its full response could not be "
                        "returned safely"
                    ),
                    "details": (
                        f"Chart {persisted_chart_id} was created successfully. "
                        f"{failure.error}"
                    ),
                    "suggestions": [
                        "Do not retry creation; use the returned chart ID",
                        "Request fewer preview formats or reduce result cardinality",
                    ],
                    "error_code": "CHART_RESPONSE_TOO_LARGE",
                },
            }
        )
    return GenerateChartResponse.model_validate(
        {
            "chart": None,
            "success": False,
            "error": _wire_size_error(
                failure, "Chart response could not be returned safely"
            ),
        }
    )


def preflight_update_preview_response(response: dict[str, Any]) -> dict[str, Any]:
    """Preflight the dict-shaped update-preview tool response via Pydantic."""
    failure = response_json_failure(RootModel[dict[str, Any]](response))
    if failure is None:
        return response
    return {
        "chart": None,
        "error": _wire_size_error(
            failure, "Chart preview response could not be returned safely"
        ),
        "success": False,
        "schema_version": "2.0",
        "api_version": "v1",
    }
