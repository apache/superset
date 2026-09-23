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

"""Per-failure-class error classification for MCP tool calls.

Three unrelated failures used to reach MCP clients as one undifferentiated
message, because FastMCP re-raises everything a tool body throws as
``ToolError(f"Error calling tool {name!r}: {e}") from e`` *before* any
middleware error hook runs. ``GlobalErrorHandlerMiddleware`` then matched its
first branch, ``isinstance(error, ToolError)``, and re-raised — so its entire
per-type branch chain was unreachable for tool failures, and the client got
whatever ``str(exc)`` happened to say.

The rest of the suite exercises that chain by injecting *raw* exceptions into
``on_message``, which is why the gap went unnoticed: no test drove a tool
exception through FastMCP's wrapping first. These tests do, end to end.
"""

from typing import Any
from unittest.mock import patch

import pytest
from fastmcp import FastMCP
from fastmcp.client import Client
from fastmcp.exceptions import ToolError
from sqlalchemy.exc import IntegrityError, OperationalError

from superset.commands.exceptions import ForbiddenError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    DatabaseNotFound,
    QueryObjectValidationError,
    SupersetErrorException,
    SupersetErrorsException,
    SupersetException,
    SupersetGenericDBErrorException,
    SupersetSecurityException,
    SupersetTimeoutException,
)
from superset.mcp_service.auth import MCPPermissionDeniedError
from superset.mcp_service.constants import CONNECTION_ERROR_TYPES
from superset.mcp_service.middleware import (
    _datasource_error_is_user_error,
    _datasource_error_reason,
    _FASTMCP_WRAPPED_ERROR_PREFIX,
    _GENERIC_DATASOURCE_REASON,
    _is_datasource_error,
    _is_user_error,
    _unwrap_fastmcp_wrapped_error,
    _unwrap_tool_error,
    GlobalErrorHandlerMiddleware,
    ToolResultCompatibilityMiddleware,
)

# A connection string and an internal path, planted in the exception messages
# below to prove neither reaches the caller.
LEAKED_DSN = "postgresql://admin:hunter2@db.internal/prod"
LEAKED_PATH = "/srv/app/superset/mcp_service/chart/tool/get_chart_data.py"


def _dead_table_error() -> SupersetErrorException:
    """The upstream failure a chart over a dropped table produces."""
    return SupersetErrorException(
        SupersetError(
            message=f'relation "orders" does not exist ({LEAKED_DSN})',
            error_type=SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            level=ErrorLevel.ERROR,
        )
    )


def connection_denied(unused: int = 1) -> str:
    """A connection access denial remains a permission failure."""
    raise SupersetSecurityException(
        SupersetError(
            message="denied",
            error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            level=ErrorLevel.ERROR,
        )
    )


def _build_server() -> FastMCP:
    """A FastMCP server with one tool per failure class.

    ``LoggingMiddleware`` is deliberately omitted: it needs a Flask app
    context, and it does not participate in classifying the response.
    """
    mcp: FastMCP = FastMCP("error-classification")

    @mcp.tool
    def rbac_denied(unused: int = 1) -> str:
        """RBAC denial raised by the @tool permission decorator."""
        raise MCPPermissionDeniedError(
            permission_name="can_get",
            view_name="User",
            tool_name="rbac_denied",
        )

    @mcp.tool
    def forbidden(unused: int = 1) -> str:
        """Authorization refused below the MCP layer."""
        raise ForbiddenError()

    @mcp.tool
    def dead_table(unused: int = 1) -> str:
        """Well-formed call whose datasource is gone."""
        raise _dead_table_error()

    @mcp.tool
    def untyped_datasource(unused: int = 1) -> str:
        """Datasource failure carrying no recognised SupersetErrorType."""
        raise DatabaseNotFound("Database backing this chart is gone")

    @mcp.tool
    def unreachable_datasource(unused: int = 1) -> str:
        """The analytics database cannot be reached."""
        raise SupersetErrorException(
            SupersetError(
                message="could not connect to host",
                error_type=SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

    @mcp.tool
    def malformed_column(unused: int = 1) -> str:
        """Engine reports a bad adhoc column via the GENERIC_DB_ENGINE catch-all."""
        raise SupersetGenericDBErrorException("bad adhoc column expression")

    mcp.tool(connection_denied)

    @mcp.tool
    def bad_sql(unused: int = 1) -> str:
        """The caller's own SQL is malformed."""
        raise SupersetErrorException(
            SupersetError(
                message="syntax error at or near SELEC",
                error_type=SupersetErrorType.SYNTAX_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

    @mcp.tool
    def needs_id(id: int) -> str:  # noqa: A002
        """Schema mismatch: callers guess ``identifier`` for ``id``."""
        return "ok"

    @mcp.tool
    def internal_bug(unused: int = 1) -> str:
        """A genuine server-side defect."""
        raise RuntimeError(f"unexpected failure in {LEAKED_PATH}")

    mcp.add_middleware(
        ToolResultCompatibilityMiddleware(structured_output_enabled=False)
    )
    mcp.add_middleware(GlobalErrorHandlerMiddleware())
    return mcp


async def _call(tool: str, arguments: dict[str, Any] | None = None) -> str:
    """Return the client-facing text for a failing tool call."""
    async with Client(_build_server()) as client:
        result = await client.call_tool(tool, arguments or {}, raise_on_error=False)
    assert result.is_error, f"{tool} was expected to fail"
    return result.content[0].text


class TestFastMCPWrappingPrecondition:
    """Guard the assumption the classification fix is built on."""

    @pytest.mark.asyncio
    async def test_tool_exceptions_arrive_wrapped_in_tool_error(self) -> None:
        """FastMCP wraps tool exceptions before middleware sees them.

        If a FastMCP upgrade stops doing this, ``_unwrap_tool_error`` becomes
        a no-op and the branch chain keeps working — but this test failing is
        the signal that the comments explaining *why* it exists are stale.
        """
        seen: list[Exception] = []

        mcp: FastMCP = FastMCP("precondition")

        @mcp.tool
        def boom(unused: int = 1) -> str:
            raise PermissionError("denied")

        class Capture(ToolResultCompatibilityMiddleware):
            async def on_call_tool(self, context: Any, call_next: Any) -> Any:
                try:
                    return await call_next(context)
                except Exception as exc:  # noqa: BLE001
                    seen.append(exc)
                    raise

        mcp.add_middleware(Capture(structured_output_enabled=False))

        async with Client(mcp) as client:
            await client.call_tool("boom", {}, raise_on_error=False)

        assert len(seen) == 1
        assert isinstance(seen[0], ToolError)
        assert isinstance(seen[0].__cause__, PermissionError)
        # _unwrap_fastmcp_wrapped_error uses this prefix to identify the wrapper
        # apart from a ToolError tool code chained off another exception.
        assert str(seen[0]).startswith(_FASTMCP_WRAPPED_ERROR_PREFIX)


class TestUnwrapToolError:
    """``_unwrap_tool_error`` classifies by the underlying failure.

    Used for log severity, metrics, and error-tracker capture only — never to
    pick client-facing text — so it unwraps any chained ToolError, including
    GlobalErrorHandlerMiddleware's own re-raise, which LoggingMiddleware (the
    outer middleware) is what actually sees.
    """

    def test_returns_cause_of_fastmcp_wrapped_error(self) -> None:
        cause = MCPPermissionDeniedError(permission_name="can_read", view_name="Chart")
        wrapped = ToolError("Error calling tool 'list_charts': denied")
        wrapped.__cause__ = cause

        assert _unwrap_tool_error(wrapped) is cause

    def test_returns_cause_of_our_own_handlers_reraise(self) -> None:
        """GlobalErrorHandlerMiddleware re-raises a classified message chained
        off the same cause, with no FastMCP prefix. LoggingMiddleware must
        still attribute the failure to OperationalError, not to ToolError."""
        cause = OperationalError("db error", {}, Exception())
        reraised = ToolError("Database error in execute_sql")
        reraised.__cause__ = cause

        assert _unwrap_tool_error(reraised) is cause

    def test_passes_through_unchained_tool_error(self) -> None:
        deliberate = ToolError("'search_tools' cannot be called via the proxy")

        assert _unwrap_tool_error(deliberate) is deliberate

    def test_passes_through_unwrapped_exception(self) -> None:
        error = ValueError("page must be positive")

        assert _unwrap_tool_error(error) is error


class TestUnwrapFastMCPWrappedError:
    """``_unwrap_fastmcp_wrapped_error`` decides client-facing text, so it
    must recover FastMCP's cause without eating a tool-authored message."""

    def test_returns_cause_of_fastmcp_wrapped_error(self) -> None:
        cause = MCPPermissionDeniedError(permission_name="can_read", view_name="Chart")
        wrapped = ToolError("Error calling tool 'list_charts': denied")
        wrapped.__cause__ = cause

        assert _unwrap_fastmcp_wrapped_error(wrapped) is cause

    def test_passes_through_deliberate_tool_error(self) -> None:
        """A ToolError raised by tool code is already formatted for MCP, so
        it must survive untouched."""
        deliberate = ToolError("'search_tools' cannot be called via the proxy")

        assert _unwrap_fastmcp_wrapped_error(deliberate) is deliberate

    def test_passes_through_deliberate_tool_error_chained_off_a_cause(
        self,
    ) -> None:
        """``raise ToolError(...) from exc`` in tool code is legitimate. Its
        author-written message must not be discarded in favour of cause-based
        handling just because a cause is attached."""
        deliberate = ToolError("dataset is missing a time column")
        deliberate.__cause__ = ValueError("no granularity")

        assert _unwrap_fastmcp_wrapped_error(deliberate) is deliberate

    def test_passes_through_unwrapped_exception(self) -> None:
        error = ValueError("page must be positive")

        assert _unwrap_fastmcp_wrapped_error(error) is error


class TestDatasourceErrorClassification:
    """Only genuine query/datasource failures take the datasource branch."""

    def test_classifies_missing_table(self) -> None:
        assert _is_datasource_error(_dead_table_error()) is True

    def test_reason_is_the_enumerated_error_type(self) -> None:
        assert (
            _datasource_error_reason(_dead_table_error())
            == SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR.value
        )

    def test_security_exception_is_not_a_datasource_error(self) -> None:
        """SupersetSecurityException subclasses SupersetErrorException, so the
        permission branch must win — a denied table is not a broken table."""
        error = SupersetSecurityException(
            SupersetError(
                message="denied",
                error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

        assert _is_datasource_error(error) is False

    def test_unrelated_superset_exception_is_not_a_datasource_error(self) -> None:
        assert _is_datasource_error(SupersetException("something else")) is False

    def test_connection_failures_are_datasource_errors(self) -> None:
        """Every canonical connection error type classifies, so an
        unreachable database is never reported as an internal error."""
        for error_type in CONNECTION_ERROR_TYPES:
            error = SupersetErrorException(
                SupersetError(
                    message="cannot connect",
                    error_type=error_type,
                    level=ErrorLevel.ERROR,
                )
            )

            assert _is_datasource_error(error) is True, error_type
            assert _datasource_error_reason(error) == error_type.value

    def test_metastore_failure_is_not_a_datasource_error(self) -> None:
        """SQLAlchemyError also covers Superset's own metadata database. A
        metastore failure must not be reported as a failed datasource query
        with the caller told their arguments were valid."""
        error = IntegrityError("INSERT INTO logs", {}, Exception("duplicate key"))

        assert _is_datasource_error(error) is False

    def test_generic_backend_timeout_is_not_a_datasource_error(self) -> None:
        """SigalrmTimeout/TimerTimeout raise SupersetTimeoutException with
        BACKEND_TIMEOUT_ERROR; that is not a datasource outage."""
        error = SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="Process timed out",
            level=ErrorLevel.ERROR,
        )

        assert _is_datasource_error(error) is False

    def test_query_object_validation_error_is_not_a_datasource_error(self) -> None:
        """Raised for missing/invalid query fields and invalid result types —
        a caller or configuration problem, not a broken datasource."""
        error = QueryObjectValidationError("Invalid result type: bogus")

        assert _is_datasource_error(error) is False

    def test_reason_scans_every_error_in_a_multi_error_exception(self) -> None:
        """A datasource error reported alongside others keeps its specific
        reason instead of falling back to the generic sentinel."""
        error = SupersetErrorsException(
            [
                SupersetError(
                    message="first",
                    error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                SupersetError(
                    message="second",
                    error_type=SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
                    level=ErrorLevel.ERROR,
                ),
            ]
        )

        assert (
            _datasource_error_reason(error)
            == SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR.value
        )

    def test_reason_is_none_for_unlisted_error_type(self) -> None:
        error = SupersetErrorException(
            SupersetError(
                message="nope",
                error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

        assert _datasource_error_reason(error) is None


class TestPerClassClientFacingErrors:
    """Each failure class reaches the caller as its own honest message."""

    @pytest.mark.asyncio
    async def test_rbac_denial_uses_permission_denied_shape(self) -> None:
        """An RBAC denial names the permission and the resource, and never
        tells the caller to go re-read the tool schema."""
        message = await _call("rbac_denied")

        assert "Permission denied: can_get on User" in message
        assert "Validation error" not in message
        assert "inputSchema" not in message
        assert "Internal error" not in message
        # Anchor on the *fixed* shape. A bare `in` check also passes on the
        # unfixed code, where FastMCP's wrapper message merely contains the
        # denial text -- the assertion above would give false confidence.
        assert _FASTMCP_WRAPPED_ERROR_PREFIX not in message

    @pytest.mark.asyncio
    async def test_non_rbac_authorization_failure_also_says_permission_denied(
        self,
    ) -> None:
        """Denials raised below the MCP RBAC decorator get the same shape, so
        a caller can recognise a denial regardless of which layer refused."""
        message = await _call("forbidden")

        assert "Permission denied" in message

    @pytest.mark.asyncio
    async def test_schema_mismatch_keeps_validation_guidance(self) -> None:
        """Wrong argument names still get the advice that actually fits:
        the offending fields, so the caller can match the inputSchema."""
        message = await _call("needs_id", {"identifier": 5})

        assert "Validation error in needs_id" in message
        assert "id" in message
        assert "identifier" in message
        assert "Permission denied" not in message

    @pytest.mark.asyncio
    async def test_datasource_failure_blames_the_query_not_the_caller(self) -> None:
        """A dropped table says the datasource failed and states the call was
        valid — the previous message implied a bad tool name or arguments."""
        message = await _call("dead_table")

        assert "Datasource error in dead_table" in message
        assert SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR.value in message
        assert "arguments were valid" in message
        assert "Permission denied" not in message
        assert "Validation error" not in message

    @pytest.mark.asyncio
    async def test_untyped_datasource_failure_uses_the_generic_sentinel(self) -> None:
        """The reason is part of the client-facing message, so it stays a
        closed vocabulary — never the Python exception class name."""
        message = await _call("untyped_datasource")

        assert "Datasource error in untyped_datasource" in message
        assert _GENERIC_DATASOURCE_REASON in message
        assert "DatabaseNotFound" not in message
        assert "Exception" not in message

    @pytest.mark.asyncio
    async def test_internal_error_is_opaque_and_carries_an_error_id(self) -> None:
        message = await _call("internal_bug")

        assert "Internal error in internal_bug" in message
        assert "Error ID:" in message

    @pytest.mark.asyncio
    async def test_the_four_classes_do_not_share_a_message(self) -> None:
        """The regression in one assertion: conflating these is the bug."""
        messages = [
            await _call("rbac_denied"),
            await _call("needs_id", {"identifier": 5}),
            await _call("dead_table"),
            await _call("internal_bug"),
        ]

        assert len(set(messages)) == len(messages)
        # Distinctness alone is not the property under test: the unfixed code
        # also produced four distinct strings, just four *unclassified* ones.
        # None may still carry FastMCP's wrapper.
        for message in messages:
            assert _FASTMCP_WRAPPED_ERROR_PREFIX not in message


class TestNoNewDisclosure:
    """Classification must not widen what a failure discloses."""

    @pytest.mark.asyncio
    async def test_datasource_error_does_not_echo_raw_driver_output(self) -> None:
        """Only the enumerated SupersetErrorType is surfaced; the driver
        message (which carried a DSN) is not."""
        message = await _call("dead_table")

        assert LEAKED_DSN not in message
        assert "hunter2" not in message
        assert "db.internal" not in message
        assert "orders" not in message

    @pytest.mark.asyncio
    async def test_internal_error_does_not_echo_server_paths(self) -> None:
        message = await _call("internal_bug")

        assert LEAKED_PATH not in message
        assert "mcp_service" not in message


class TestDatasourceErrorSeverity:
    """A datasource failure's severity must follow what actually broke.

    ``_is_user_error`` keys on ``SupersetException.status``, and a *bare*
    ``SupersetErrorException`` — the shape Superset raises for most datasource
    failures — inherits ``status = 500``. Without an override, a dropped table
    logs at ERROR with a traceback and pages through ``MCP_ERROR_HOOK``.
    """

    @pytest.mark.parametrize(
        "error_type",
        [
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            SupersetErrorType.SCHEMA_DOES_NOT_EXIST_ERROR,
        ],
    )
    def test_missing_object_is_a_user_error_despite_status_500(
        self, error_type: SupersetErrorType
    ) -> None:
        error = SupersetErrorException(
            SupersetError(message="gone", error_type=error_type, level=ErrorLevel.ERROR)
        )

        # The status this would otherwise be judged by.
        assert error.status == 500
        assert _is_user_error(error) is False
        # ...but a renamed table is routine MCP traffic, not a page.
        assert _datasource_error_is_user_error(error) is True

    def test_connection_failure_stays_a_system_error(self) -> None:
        """An unreachable database is an operational problem worth paging on.

        Genuine connection failures arrive as a *bare* ``SupersetErrorException``,
        which inherits ``status = 500`` — the shape the escalation applies to.
        """
        for error_type in CONNECTION_ERROR_TYPES:
            error = SupersetErrorException(
                SupersetError(
                    message="unreachable",
                    error_type=error_type,
                    level=ErrorLevel.ERROR,
                )
            )

            assert error.status == 500
            assert _datasource_error_is_user_error(error) is False, error_type

    def test_sub_500_exceptions_are_never_escalated(self) -> None:
        """The override only de-escalates.

        A sub-500 status is a deliberate judgement by the exception class that
        the caller is at fault. Escalating it would re-create the very
        false-paging this function exists to remove — just for a different
        error type.
        """
        # GENERIC_DB_ENGINE_ERROR is in CONNECTION_ERROR_TYPES (the catch-all
        # for engines without specific CONNECTION_* regexes), but engines also
        # report a malformed adhoc column through it, carried by a status-400
        # exception. Reachable via generate_chart -> _compile_chart.
        malformed_column = SupersetGenericDBErrorException("bad adhoc column")

        assert malformed_column.status == 400
        assert _is_user_error(malformed_column) is True
        assert _datasource_error_is_user_error(malformed_column) is True

    def test_security_exception_with_connection_reason_is_not_escalated(
        self,
    ) -> None:
        """A 403 denial must not page just because its reason happens to be a
        connection error type; the client is correctly told access was denied."""
        denial = SupersetSecurityException(
            SupersetError(
                message="denied",
                error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

        assert denial.status == 403
        assert _datasource_error_is_user_error(denial) is True

    def test_non_datasource_error_keeps_status_based_judgement(self) -> None:
        assert _datasource_error_is_user_error(ValueError("bad page")) is None
        assert _datasource_error_is_user_error(SupersetException("other")) is None

    @pytest.mark.asyncio
    async def test_missing_table_logs_warning_and_does_not_fire_error_hook(
        self,
    ) -> None:
        """End to end: the dropped-table shape must not page on-call."""
        hook_calls: list[Any] = []

        with (
            patch(
                "superset.mcp_service.middleware._invoke_error_hook",
                side_effect=lambda *a, **k: hook_calls.append(a),
            ),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
        ):
            await _call("dead_table")

        assert hook_calls == []
        mock_logger.warning.assert_called()
        mock_logger.error.assert_not_called()

    @pytest.mark.asyncio
    async def test_connection_failure_logs_error_and_fires_error_hook(self) -> None:
        """End to end: an unreachable datasource still reaches the tracker."""
        hook_calls: list[Any] = []

        with (
            patch(
                "superset.mcp_service.middleware._invoke_error_hook",
                side_effect=lambda *a, **k: hook_calls.append(a),
            ),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
        ):
            await _call("unreachable_datasource")

        assert len(hook_calls) == 1
        mock_logger.error.assert_called()

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("tool_name", "message_prefix"),
        [
            ("malformed_column", "Datasource error in malformed_column:"),
            ("connection_denied", "Permission denied"),
        ],
    )
    async def test_sub_500_connection_reason_logs_warning_without_error_hook(
        self, tool_name: str, message_prefix: str
    ) -> None:
        """Keep 400 engine errors and 403 denials non-paging through FastMCP."""
        hook_calls: list[Any] = []

        with (
            patch(
                "superset.mcp_service.middleware._invoke_error_hook",
                side_effect=lambda *a, **k: hook_calls.append(a),
            ),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
        ):
            message = await _call(tool_name)

        assert message.removeprefix("Error: ").startswith(message_prefix)
        assert hook_calls == []
        failure_logs = [
            call
            for call in mock_logger.warning.call_args_list
            if call.args[0].startswith("MCP tool call failed:")
        ]
        assert len(failure_logs) == 1
        assert failure_logs[0].kwargs["exc_info"] is False
        mock_logger.error.assert_not_called()


class TestQuerySyntaxErrors:
    """A malformed query is the caller's problem, not the datasource's."""

    @pytest.mark.asyncio
    async def test_syntax_error_blames_the_query_not_the_datasource(self) -> None:
        """For a SQL-authoring tool the query text *is* an argument, so
        "arguments were valid" would steer an agent away from the one thing
        it can fix."""
        message = await _call("bad_sql")

        assert "Query error in bad_sql" in message
        assert SupersetErrorType.SYNTAX_ERROR.value in message
        assert "Fix the query itself" in message
        assert "arguments were valid" not in message
