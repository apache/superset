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

"""Exact final-response bounds for preview-bearing chart schemas."""

from pydantic import RootModel

from superset.mcp_service.chart.query_result import MAX_QUERY_RESULT_VALUE_BYTES
from superset.mcp_service.chart.response_preflight import (
    preflight_chart_response,
    preflight_generate_chart_response,
    preflight_update_preview_response,
)
from superset.mcp_service.chart.schemas import (
    AccessibilityMetadata,
    ASCIIPreview,
    ChartError,
    ChartPreview,
    GenerateChartResponse,
    PerformanceMetadata,
)


def _chart_preview(content: str) -> ChartPreview:
    return ChartPreview(
        chart_id=1,
        chart_name="",
        chart_type="bullet",
        explore_url="",
        content=ASCIIPreview(ascii_content=content, width=80, height=20),
        chart_description="",
        accessibility=AccessibilityMetadata(
            color_blind_safe=True,
            alt_text="",
            high_contrast_available=False,
        ),
        performance=PerformanceMetadata(
            query_duration_ms=0,
            cache_status="miss",
            optimization_suggestions=[],
        ),
    )


def test_chart_preview_exact_16_mib_passes_and_one_byte_fails() -> None:
    empty = _chart_preview("")
    filler = "x" * (
        MAX_QUERY_RESULT_VALUE_BYTES - len(empty.model_dump_json().encode())
    )
    boundary = _chart_preview(filler)
    oversized = _chart_preview(filler + "x")

    assert len(boundary.model_dump_json().encode()) == MAX_QUERY_RESULT_VALUE_BYTES
    assert preflight_chart_response(boundary) is boundary
    failure = preflight_chart_response(oversized)
    assert isinstance(failure, ChartError)
    assert failure.error_type == "MalformedQueryResult"


def test_generate_response_exact_16_mib_maps_plus_one_to_its_error_schema() -> None:
    def response(warning: str) -> GenerateChartResponse:
        return GenerateChartResponse(success=True, warnings=[warning])

    empty = response("")
    filler = "x" * (
        MAX_QUERY_RESULT_VALUE_BYTES - len(empty.model_dump_json().encode())
    )
    boundary = response(filler)
    oversized = response(filler + "x")

    assert len(boundary.model_dump_json().encode()) == MAX_QUERY_RESULT_VALUE_BYTES
    assert preflight_generate_chart_response(boundary) is boundary
    failure = preflight_generate_chart_response(oversized)
    assert failure.success is False
    assert failure.error is not None
    assert failure.error.error_type == "MalformedQueryResult"
    assert failure.error.error_code == "CHART_RESPONSE_TOO_LARGE"
    assert len(failure.model_dump_json().encode()) < MAX_QUERY_RESULT_VALUE_BYTES


def test_dict_update_response_exact_16_mib_maps_plus_one_to_structured_error() -> None:
    def response(value: str) -> dict[str, object]:
        return {"success": True, "previews": {}, "warning": value}

    empty = response("")
    empty_size = len(RootModel[dict[str, object]](empty).model_dump_json().encode())
    filler = "x" * (MAX_QUERY_RESULT_VALUE_BYTES - empty_size)
    boundary = response(filler)
    oversized = response(filler + "x")

    assert (
        len(RootModel[dict[str, object]](boundary).model_dump_json().encode())
        == MAX_QUERY_RESULT_VALUE_BYTES
    )
    assert preflight_update_preview_response(boundary) is boundary
    failure = preflight_update_preview_response(oversized)
    assert failure["success"] is False
    error = failure["error"]
    assert isinstance(error, dict)
    assert error["error_type"] == "MalformedQueryResult"
