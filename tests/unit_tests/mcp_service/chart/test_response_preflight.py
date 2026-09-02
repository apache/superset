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

"""Exact final wire-size gates for preview-bearing chart responses."""

import importlib
from collections.abc import Callable, Iterator
from types import SimpleNamespace
from typing import Any, TypeVar
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from pydantic import BaseModel, Field

from superset.exceptions import OAuth2Error
from superset.mcp_service.app import mcp
from superset.mcp_service.chart.query_result import MAX_QUERY_RESULT_VALUE_BYTES
from superset.mcp_service.chart.response_preflight import (
    finalize_chart_response,
    finalize_generate_chart_response,
    finalize_update_chart_preview_response,
    UpdateChartPreviewResponse,
)
from superset.mcp_service.chart.schemas import (
    AccessibilityMetadata,
    ASCIIPreview,
    ChartError,
    ChartPreview,
    GenerateChartResponse,
    PerformanceMetadata,
)
from superset.mcp_service.common.error_schemas import ChartGenerationError

_ResponseT = TypeVar("_ResponseT", bound=BaseModel)


@pytest.fixture
def mcp_server() -> Any:
    return mcp


@pytest.fixture
def mock_auth() -> Iterator[Mock]:
    """Provide an authenticated user for actual FastMCP entry calls."""
    with patch("superset.mcp_service.auth.get_user_from_request") as get_user:
        get_user.return_value = SimpleNamespace(
            id=1,
            username="admin",
            roles=[],
            groups=[],
        )
        yield get_user


def _chart_preview(content: str) -> ChartPreview:
    return ChartPreview(
        chart_id=1,
        chart_name="",
        chart_type="sunburst_v2",
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


def _fill_model_to_limit(
    model_factory: Callable[[str], _ResponseT],
) -> _ResponseT:
    empty = model_factory("")
    filler_size = MAX_QUERY_RESULT_VALUE_BYTES - len(empty.model_dump_json().encode())
    result = model_factory("x" * filler_size)
    assert len(result.model_dump_json().encode()) == MAX_QUERY_RESULT_VALUE_BYTES
    return result


def test_chart_preview_and_error_exact_limit_pass_and_plus_one_fails() -> None:
    preview = _fill_model_to_limit(_chart_preview)
    assert isinstance(preview, ChartPreview)
    assert finalize_chart_response(preview) is preview

    assert isinstance(preview.content, ASCIIPreview)
    preview.content.ascii_content += "x"
    failure = finalize_chart_response(preview)
    assert isinstance(failure, ChartError)
    assert failure.error_type == "InvalidQueryResult"
    assert len(failure.model_dump_json().encode()) < 1_000

    empty_error = ChartError(message="", error_type="")
    remaining = MAX_QUERY_RESULT_VALUE_BYTES - len(
        empty_error.model_dump_json().encode()
    )
    boundary_error = ChartError(
        message="x" * (remaining // 2),
        error_type="x" * (remaining % 2),
    )
    assert (
        len(boundary_error.model_dump_json().encode()) == MAX_QUERY_RESULT_VALUE_BYTES
    )
    assert finalize_chart_response(boundary_error) is boundary_error
    boundary_error.error_type += "x"
    error_failure = finalize_chart_response(boundary_error)
    assert error_failure is not boundary_error
    assert isinstance(error_failure, ChartError)
    assert error_failure.error_type == "InvalidQueryResult"


def test_generate_response_counts_nested_previews_and_complete_form_data() -> None:
    """Shared content is charged for every place serialized on the wire."""
    amplified = "z" * (2 * 1024 * 1024)

    def response(warning: str) -> GenerateChartResponse:
        return GenerateChartResponse(
            success=True,
            previews={
                "ascii": ASCIIPreview(
                    ascii_content=amplified,
                    width=80,
                    height=20,
                )
            },
            form_data={
                "viz_type": "sunburst_v2",
                "standardizedFormData": amplified,
                "cached_payload": amplified,
            },
            warnings=[warning],
            form_data_key="cached-form-data-key",
        )

    boundary = _fill_model_to_limit(response)
    assert isinstance(boundary, GenerateChartResponse)
    assert finalize_generate_chart_response(boundary) is boundary

    boundary.warnings[0] += "x"
    failure = finalize_generate_chart_response(boundary)
    assert failure.success is False
    assert failure.error is not None
    assert failure.error.error_type == "InvalidQueryResult"
    assert failure.error.error_code == "CHART_RESPONSE_TOO_LARGE"
    assert len(failure.model_dump_json().encode()) < 1_000


def test_update_preview_root_model_exact_limit_passes_and_plus_one_fails() -> None:
    def response(warning: str) -> dict[str, Any]:
        return {
            "success": True,
            "previews": {"nested": {"content": "cached"}},
            "form_data": {"viz_type": "sunburst_v2"},
            "warning": warning,
        }

    empty = response("")
    empty_size = len(UpdateChartPreviewResponse(empty).model_dump_json().encode())
    filler = "x" * (MAX_QUERY_RESULT_VALUE_BYTES - empty_size)
    boundary = response(filler)
    assert (
        len(UpdateChartPreviewResponse(boundary).model_dump_json().encode())
        == MAX_QUERY_RESULT_VALUE_BYTES
    )
    assert finalize_update_chart_preview_response(boundary) is boundary

    boundary["warning"] += "x"
    failure = finalize_update_chart_preview_response(boundary)
    assert failure["success"] is False
    assert failure["error"]["error_type"] == "InvalidQueryResult"
    assert len(UpdateChartPreviewResponse(failure).model_dump_json().encode()) < 1_000


def test_generic_finalizer_uses_serialization_alias_wire_size() -> None:
    class AliasedResponse(BaseModel):
        internal_name: str = Field(serialization_alias="longWireAlias")

    response = _fill_model_to_limit(lambda value: AliasedResponse(internal_name=value))
    assert finalize_chart_response(response) is response
    response.internal_name += "x"
    assert isinstance(finalize_chart_response(response), ChartError)


@pytest.mark.asyncio
@pytest.mark.parametrize("extra_byte", [False, True], ids=["exact", "plus-one"])
async def test_generate_chart_mcp_entry_preflights_complete_response(
    mcp_server: Any,
    mock_auth: Any,
    monkeypatch: pytest.MonkeyPatch,
    extra_byte: bool,
) -> None:
    module = importlib.import_module("superset.mcp_service.chart.tool.generate_chart")

    def response(details: str) -> GenerateChartResponse:
        error = ChartGenerationError(
            error_type="BoundaryError",
            message="boundary",
            details=details,
            suggestions=[],
            error_code="BOUNDARY",
        )
        return GenerateChartResponse(
            chart=None,
            error=error,
            performance=PerformanceMetadata(
                query_duration_ms=0,
                cache_status="error",
                optimization_suggestions=[],
            ),
            success=False,
            schema_version="2.0",
            api_version="v1",
        )

    boundary = _fill_model_to_limit(response)
    assert boundary.error is not None
    details = boundary.error.details or ""
    if extra_byte:
        details += "x"
    validation_result = SimpleNamespace(
        is_valid=False,
        request=None,
        warnings={},
        error=ChartGenerationError(
            error_type="BoundaryError",
            message="boundary",
            details=details,
            suggestions=[],
            error_code="BOUNDARY",
        ),
    )
    monkeypatch.setattr(module.time, "time", lambda: 0.0)
    monkeypatch.setattr(
        "superset.mcp_service.chart.validation.ValidationPipeline."
        "validate_request_with_warnings",
        lambda _request: validation_result,
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "generate_chart",
            {
                "request": {
                    "dataset_id": 1,
                    "config": {
                        "chart_type": "table",
                        "columns": [{"name": "region"}],
                    },
                }
            },
        )

    error = result.structured_content["error"]
    assert error["error_code"] == (
        "CHART_RESPONSE_TOO_LARGE" if extra_byte else "BOUNDARY"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("extra_byte", [False, True], ids=["exact", "plus-one"])
async def test_update_chart_mcp_entry_preflights_helper_response(
    mcp_server: Any,
    mock_auth: Any,
    monkeypatch: pytest.MonkeyPatch,
    extra_byte: bool,
) -> None:
    module = importlib.import_module("superset.mcp_service.chart.tool.update_chart")

    def response(warning: str) -> GenerateChartResponse:
        return GenerateChartResponse(success=True, warnings=[warning])

    boundary = _fill_model_to_limit(response)
    if extra_byte:
        boundary.warnings[0] += "x"
    monkeypatch.setattr(
        module,
        "find_chart_by_identifier",
        lambda _identifier: SimpleNamespace(id=1, datasource_id=1, params="{}"),
    )
    monkeypatch.setattr(
        "superset.mcp_service.auth.check_chart_data_access",
        lambda _chart: SimpleNamespace(is_valid=True, error=None),
    )
    monkeypatch.setattr(module, "_build_update_payload", lambda *_args: boundary)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "update_chart",
            {
                "request": {
                    "identifier": 1,
                    "chart_name": "Boundary",
                    "generate_preview": False,
                }
            },
        )

    payload = result.structured_content.get("result", result.structured_content)
    if extra_byte:
        assert payload["error"]["error_code"] == "CHART_RESPONSE_TOO_LARGE"
    else:
        assert payload["success"] is True
        assert len(payload["warnings"][0]) == len(boundary.warnings[0])


@pytest.mark.asyncio
@pytest.mark.parametrize("extra_byte", [False, True], ids=["exact", "plus-one"])
async def test_get_chart_preview_mcp_entry_preflights_strategy_result(
    mcp_server: Any,
    mock_auth: Any,
    monkeypatch: pytest.MonkeyPatch,
    extra_byte: bool,
) -> None:
    module = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_preview"
    )
    boundary = _fill_model_to_limit(_chart_preview)
    if extra_byte:
        assert isinstance(boundary.content, ASCIIPreview)
        boundary.content.ascii_content += "x"

    async def preview_result(*_args: Any, **_kwargs: Any) -> ChartPreview:
        return boundary

    monkeypatch.setattr(module, "_get_chart_preview_internal", preview_result)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_chart_preview",
            {"request": {"identifier": 1, "format": "ascii"}},
        )

    payload = result.structured_content.get("result", result.structured_content)
    if extra_byte:
        assert payload["error_type"] == "InvalidQueryResult"
    else:
        assert payload["chart_type"] == "sunburst_v2"


@pytest.mark.asyncio
@pytest.mark.parametrize("extra_byte", [False, True], ids=["exact", "plus-one"])
async def test_update_chart_preview_mcp_entry_preflights_dict_response(
    mcp_server: Any,
    mock_auth: Any,
    monkeypatch: pytest.MonkeyPatch,
    extra_byte: bool,
) -> None:
    module = importlib.import_module(
        "superset.mcp_service.chart.tool.update_chart_preview"
    )

    def response(error: str) -> dict[str, Any]:
        return {"chart": None, "error": error, "success": False}

    empty_size = len(UpdateChartPreviewResponse(response("")).model_dump_json())
    error = "x" * (MAX_QUERY_RESULT_VALUE_BYTES - empty_size)
    if extra_byte:
        error += "x"
    monkeypatch.setattr(module, "OAUTH2_CONFIG_ERROR_MESSAGE", error)

    def oauth_failure(_dataset_id: int | str) -> None:
        raise OAuth2Error("boundary")

    monkeypatch.setattr(module, "_find_dataset", oauth_failure)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "update_chart_preview",
            {
                "request": {
                    "dataset_id": 1,
                    "config": {
                        "chart_type": "table",
                        "columns": [{"name": "region"}],
                    },
                }
            },
        )

    payload = result.structured_content
    if extra_byte:
        assert payload["error"]["error_code"] == "CHART_RESPONSE_TOO_LARGE"
    else:
        assert payload["error"] == error
