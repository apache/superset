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

"""Tests for the shared MCP tool error helpers."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError
from superset_core.semantic_layers.errors import SemanticQueryErrorCode

from superset.commands.chart.exceptions import ChartDataQueryFailedError
from superset.commands.exceptions import CommandException
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2Error,
    QueryObjectValidationError,
    SupersetErrorException,
    SupersetSecurityException,
)
from superset.mcp_service.middleware import _mcp_call_id_var
from superset.mcp_service.utils.tool_errors import (
    DATABASE_ERROR_MESSAGE,
    internal_error_response,
    log_tool_exception,
    MAX_MESSAGE_BYTES,
    public_query_error,
    raised_by_host_validation,
    report_tool_error,
    safe_error,
    tool_error_message,
    UNEXPECTED_ERROR_MESSAGE,
)
from superset.semantic_layers.exceptions import (
    _PROVIDER_FAULT,
    rejection_message,
    SemanticLayerQueryRejectedError,
)
from superset.utils.error_sanitization import GENERIC_ERROR_MESSAGE

ENGINE_TEXT = 'relation "secret_schema.orders" does not exist'
DRIVER_TEXT = "postgresql://admin:hunter2@db.internal:5432/prod"


class _Error(BaseModel):
    error: str
    error_type: str
    success: bool = False


class _HostileError(Exception):
    def __str__(self) -> str:
        raise RuntimeError("no text")


def _principal(guest: bool) -> Iterator[None]:
    with patch(
        "superset.utils.error_sanitization.is_sanitization_required",
        return_value=guest,
    ):
        yield


@pytest.fixture
def signed_in() -> Iterator[None]:
    yield from _principal(guest=False)


@pytest.fixture
def guest() -> Iterator[None]:
    yield from _principal(guest=True)


@pytest.mark.usefixtures("signed_in")
def test_signed_in_user_gets_engine_text_of_a_failed_query() -> None:
    result = safe_error(ChartDataQueryFailedError(f"Error: {ENGINE_TEXT}"))

    assert result.code == SupersetErrorType.GENERIC_COMMAND_ERROR.value
    assert result.message == f"Error: {ENGINE_TEXT}"


@pytest.mark.usefixtures("signed_in")
def test_long_engine_text_is_bounded() -> None:
    result = safe_error(ChartDataQueryFailedError("é" * (MAX_MESSAGE_BYTES * 2)))

    assert len(result.message.encode()) <= MAX_MESSAGE_BYTES + len(b"...")
    assert result.message.endswith("...")


@pytest.mark.usefixtures("guest")
def test_guest_gets_generic_text_for_a_failed_query() -> None:
    result = safe_error(ChartDataQueryFailedError(f"Error: {ENGINE_TEXT}"))

    assert result.code == SupersetErrorType.GENERIC_BACKEND_ERROR.value
    assert result.message == str(GENERIC_ERROR_MESSAGE)


@pytest.mark.usefixtures("guest")
def test_guest_keeps_superset_written_security_text() -> None:
    error = SupersetError(
        message="You need access to the following tables: orders",
        error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
        level=ErrorLevel.ERROR,
    )

    result = safe_error(SupersetSecurityException(error))

    assert result.code == SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR.value
    assert result.message == error.message


@pytest.mark.usefixtures("signed_in")
def test_superset_error_exception_keeps_its_error_type() -> None:
    error = SupersetError(
        message=ENGINE_TEXT,
        error_type=SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
        level=ErrorLevel.ERROR,
    )

    result = safe_error(SupersetErrorException(error))

    assert result.code == SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR.value
    assert result.message == ENGINE_TEXT


@pytest.mark.usefixtures("signed_in")
def test_oauth2_error_drops_the_provider_response() -> None:
    result = safe_error(OAuth2Error(DRIVER_TEXT))

    assert "hunter2" not in result.message


@pytest.mark.parametrize("principal", ["signed_in", "guest"])
def test_query_failure_follows_the_chart_data_api_rule(
    request: pytest.FixtureRequest, principal: str
) -> None:
    request.getfixturevalue(principal)

    result = safe_error(ChartDataQueryFailedError(f"Error: {ENGINE_TEXT}"), query=True)

    assert result.code == SupersetErrorType.GENERIC_DB_ENGINE_ERROR.value
    if principal == "signed_in":
        assert result.message == f"Error: {ENGINE_TEXT}"
    else:
        assert result.message == str(GENERIC_ERROR_MESSAGE)


@pytest.mark.parametrize("principal", ["signed_in", "guest"])
def test_query_failure_without_a_superset_exception_gets_generic_text(
    request: pytest.FixtureRequest, principal: str
) -> None:
    request.getfixturevalue(principal)

    result = safe_error(RuntimeError(DRIVER_TEXT), query=True)

    assert result.code == SupersetErrorType.GENERIC_BACKEND_ERROR.value
    assert "hunter2" not in result.message
    if principal == "signed_in":
        assert result.message == UNEXPECTED_ERROR_MESSAGE
    else:
        assert result.message == str(GENERIC_ERROR_MESSAGE)


@pytest.mark.usefixtures("signed_in")
def test_query_rule_keeps_superset_text_it_does_not_classify() -> None:
    result = safe_error(CommandException("Dataset could not be found"), query=True)

    assert result.message == "Dataset could not be found"


@pytest.mark.parametrize("principal", ["signed_in", "guest"])
def test_query_rejection_carries_host_guidance_for_signed_in_users(
    request: pytest.FixtureRequest, principal: str
) -> None:
    request.getfixturevalue(principal)
    code = SemanticQueryErrorCode.UNSUPPORTED_QUERY

    result = safe_error(SemanticLayerQueryRejectedError(code), query=True)

    assert result.code == code.value
    if principal == "signed_in":
        assert result.message == rejection_message(code)
    else:
        assert result.message == str(GENERIC_ERROR_MESSAGE)


@pytest.mark.parametrize("principal", ["signed_in", "guest"])
def test_semantic_validation_text_is_redacted_for_guests(
    request: pytest.FixtureRequest, principal: str
) -> None:
    request.getfixturevalue(principal)

    result = safe_error(
        QueryObjectValidationError("Unknown metric secret_metric on view_x"),
        query=True,
        semantic=True,
    )

    if principal == "signed_in":
        assert result.message == "Unknown metric secret_metric on view_x"
    else:
        assert "secret_metric" not in result.message
        assert result.message == str(GENERIC_ERROR_MESSAGE)


@pytest.mark.usefixtures("guest")
def test_guest_keeps_security_text_on_the_query_path() -> None:
    error = SupersetError(
        message="You need access to the following tables: orders",
        error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
        level=ErrorLevel.ERROR,
    )

    result = safe_error(SupersetSecurityException(error), query=True, semantic=True)

    assert result.message == error.message


@pytest.mark.usefixtures("signed_in")
def test_semantic_provider_fault_never_reaches_the_client() -> None:
    exc = QueryObjectValidationError(DRIVER_TEXT)
    setattr(exc, _PROVIDER_FAULT, True)

    result = safe_error(exc, query=True, semantic=True)

    assert "hunter2" not in result.message
    assert result.message == str(GENERIC_ERROR_MESSAGE)


@pytest.mark.parametrize("query", [False, True])
@pytest.mark.usefixtures("signed_in")
def test_provider_fault_is_hidden_without_the_semantic_flag(query: bool) -> None:
    exc = QueryObjectValidationError(DRIVER_TEXT)
    setattr(exc, _PROVIDER_FAULT, True)

    result = safe_error(exc, query=query)

    assert "hunter2" not in result.message
    assert result.message == str(GENERIC_ERROR_MESSAGE)


@pytest.mark.usefixtures("signed_in")
def test_date_parser_guidance_survives_a_semantic_query() -> None:
    from superset.utils.date_parser import get_since_until

    with pytest.raises(ValueError, match="From date") as excinfo:
        get_since_until(time_range="2025-01-01 : 2024-01-01")

    result = safe_error(excinfo.value, query=True, semantic=True)

    assert result.message == "From date cannot be larger than to date"


@pytest.mark.usefixtures("signed_in")
def test_query_message_matches_public_query_error() -> None:
    exc = ChartDataQueryFailedError(f"Error: {ENGINE_TEXT}")
    code, message, _ = public_query_error(exc)

    assert tool_error_message("Query failed", exc, query=True) == (
        f"Query failed: {message}"
    )
    assert safe_error(exc, query=True).code == code


@pytest.mark.parametrize("principal", ["signed_in", "guest"])
@pytest.mark.parametrize(
    ("exc", "error_type", "message"),
    [
        (
            OperationalError("SELECT 1", {}, Exception(DRIVER_TEXT)),
            SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            DATABASE_ERROR_MESSAGE,
        ),
        (
            RuntimeError(DRIVER_TEXT),
            SupersetErrorType.GENERIC_BACKEND_ERROR,
            UNEXPECTED_ERROR_MESSAGE,
        ),
        (
            KeyError(DRIVER_TEXT),
            SupersetErrorType.GENERIC_BACKEND_ERROR,
            UNEXPECTED_ERROR_MESSAGE,
        ),
    ],
)
def test_other_exceptions_never_reach_the_client(
    request: pytest.FixtureRequest,
    principal: str,
    exc: Exception,
    error_type: SupersetErrorType,
    message: str,
) -> None:
    request.getfixturevalue(principal)

    result = safe_error(exc)

    assert "hunter2" not in result.message
    if principal == "signed_in":
        assert result.code == error_type.value
        assert result.message == message
    else:
        assert result.message == str(GENERIC_ERROR_MESSAGE)


@pytest.mark.parametrize("principal", ["signed_in", "guest"])
def test_date_parser_value_error_keeps_its_guidance(
    request: pytest.FixtureRequest, principal: str
) -> None:
    from superset.utils.date_parser import get_since_until

    request.getfixturevalue(principal)
    with pytest.raises(ValueError, match="From date") as excinfo:
        get_since_until(time_range="2025-01-01 : 2024-01-01")

    result = safe_error(excinfo.value)

    assert raised_by_host_validation(excinfo.value)
    if principal == "signed_in":
        assert result.message == "From date cannot be larger than to date"
    else:
        assert result.message == str(GENERIC_ERROR_MESSAGE)


@pytest.mark.usefixtures("signed_in")
def test_chart_mapper_value_error_keeps_its_guidance() -> None:
    from superset.mcp_service.chart.chart_utils import map_table_config
    from superset.mcp_service.chart.schemas import TableChartConfig

    with pytest.raises(ValueError, match="at least one column") as excinfo:
        map_table_config(
            TableChartConfig.model_construct(chart_type="table", columns=[])
        )

    assert safe_error(excinfo.value).message == (
        "Table chart must have at least one column"
    )


@pytest.mark.usefixtures("signed_in")
def test_value_error_raised_outside_host_validators_is_hidden() -> None:
    with pytest.raises(ValueError, match="invalid literal") as excinfo:
        int(DRIVER_TEXT)

    assert not raised_by_host_validation(excinfo.value)
    assert safe_error(excinfo.value).message == UNEXPECTED_ERROR_MESSAGE


@pytest.mark.usefixtures("signed_in")
def test_message_carries_the_mcp_call_id() -> None:
    token = _mcp_call_id_var.set("call-123")
    try:
        message = tool_error_message("Failed to do it", RuntimeError("x"))
    finally:
        _mcp_call_id_var.reset(token)
    assert (
        message == f"Failed to do it: {UNEXPECTED_ERROR_MESSAGE} (Error ID: call-123)"
    )


@pytest.mark.usefixtures("signed_in")
def test_internal_error_response_logs_detail_server_side(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.ERROR)

    response = internal_error_response(
        _Error, "Failed to get dataset info", RuntimeError(DRIVER_TEXT)
    )

    assert response.error == f"Failed to get dataset info: {UNEXPECTED_ERROR_MESSAGE}"
    assert response.error_type == SupersetErrorType.GENERIC_BACKEND_ERROR.value
    assert "hunter2" not in response.model_dump_json()
    assert "hunter2" in caplog.text


@pytest.mark.usefixtures("signed_in")
def test_internal_error_response_accepts_field_overrides(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.WARNING)

    response = internal_error_response(
        _Error,
        "Chart delete failed",
        CommandException("Charts could not be deleted."),
        log=False,
        error_type="InternalError",
        success=False,
    )

    assert response.error == "Chart delete failed: Charts could not be deleted."
    assert response.error_type == "InternalError"
    assert caplog.text == ""


@pytest.mark.asyncio
@pytest.mark.usefixtures("guest")
@pytest.mark.parametrize("level", ["error", "warning"])
async def test_report_tool_error_sends_safe_text_to_ctx(
    caplog: pytest.LogCaptureFixture, level: str
) -> None:
    caplog.set_level(logging.WARNING)
    ctx = MagicMock()
    ctx.error = AsyncMock()
    ctx.warning = AsyncMock()

    message = await report_tool_error(
        ctx,
        "Error retrieving chart data",
        ChartDataQueryFailedError(f"Error: {ENGINE_TEXT}"),
        level=level,  # type: ignore[arg-type]
        chart_id=7,
    )

    sent = getattr(ctx, level)
    sent.assert_awaited_once()
    notification = sent.await_args.args[0]
    assert notification == f"{message} (chart_id=7)"
    assert ENGINE_TEXT not in notification
    assert str(GENERIC_ERROR_MESSAGE) in notification
    assert ENGINE_TEXT in caplog.text
    unused = ctx.warning if level == "error" else ctx.error
    unused.assert_not_awaited()


def test_log_tool_exception_tolerates_failing_str(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.ERROR)

    log_tool_exception("Failed to get chart preview", _HostileError())

    assert "<unprintable exception>" in caplog.text
    assert "_HostileError" in caplog.text
