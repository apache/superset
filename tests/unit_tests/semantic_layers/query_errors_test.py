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

import logging
from datetime import date
from typing import Any
from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.errors import SemanticQueryRejectedError
from superset_core.semantic_layers.types import Dimension, Metric, SemanticResult
from superset_core.semantic_layers.view import SemanticView as ProviderView
from werkzeug.test import TestResponse

from superset.semantic_layers.models import SemanticView


@pytest.fixture
def date_view(mocker: MockerFixture) -> MagicMock:
    """Expose Snowflake's raw DATE metadata through the real host model."""
    provider: MagicMock = MagicMock(spec=ProviderView)
    provider.features = frozenset()
    provider.selection_identity_version = None
    provider.uid.return_value = "date-grain-test"
    provider.get_dimensions.return_value = {
        Dimension(
            id="orders.ORDER_DATE",
            name="ORDER_DATE",
            type=pa.date32(),
            grain=None,
        )
    }
    provider.get_metrics.return_value = {
        Metric(
            id="orders.ORDER_COUNT",
            name="ORDER_COUNT",
            type=pa.int64(),
            definition="COUNT(*)",
        )
    }
    provider.get_table.return_value = SemanticResult(
        results=pa.table(
            {
                "ORDER_DATE": [date(2026, 1, 1), date(2026, 1, 2)],
                "ORDER_COUNT": [2, 3],
            }
        ),
        requests=[],
    )
    view: SemanticView = SemanticView(id=7, name="Orders", configuration="{}")
    view.__dict__["implementation"] = provider
    mocker.patch(
        "superset.common.query_context_factory.DatasourceDAO.get_datasource",
        return_value=view,
    )
    mocker.patch("superset.common.query_context.QueryContext.raise_for_access")
    mocker.patch("superset.security_manager.raise_for_unsupported_guest_rls")
    mocker.patch(
        "superset.common.query_context_processor.QueryContextProcessor.query_cache_key",
        return_value="date-grain-test",
    )
    mocker.patch(
        "superset.common.query_context_processor.QueryContextProcessor.get_cache_timeout",
        return_value=-1,
    )
    return provider


@pytest.mark.parametrize("guest", [False, True])
@pytest.mark.parametrize("failure,status", [("rejection", 400), ("fault", 500)])
def test_provider_execution_error_http(
    client: FlaskClient,
    full_api_access: None,
    date_view: MagicMock,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
    guest: bool,
    failure: str,
    status: int,
) -> None:
    """Exercise provider failures through the real chart execution pipeline."""
    mocker.patch("superset.security_manager.is_guest_user", return_value=guest)
    date_view.get_table.side_effect = (
        SemanticQueryRejectedError("INVALID_FILTER")
        if failure == "rejection"
        else ValueError("private-provider-SQL-and-credentials")
    )
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [
                {
                    "columns": ["ORDER_DATE"],
                    "metrics": ["ORDER_COUNT"],
                    "row_limit": 100,
                }
            ],
            "result_format": "json",
            "result_type": "full",
            "force": True,
        },
    )
    assert response.status_code == status
    assert "private-provider" not in response.get_data(as_text=True)
    assert (
        "An error occurred while fetching the data."
        if guest or failure == "fault"
        else (
            "A semantic query filter is invalid. "
            "Check its operator and values, then try again."
        )
    ) in response.get_data(as_text=True)
    if failure == "rejection":
        assert response.get_json()["message"] == (
            "An error occurred while fetching the data."
            if guest
            else (
                "A semantic query filter is invalid. "
                "Check its operator and values, then try again."
            )
        )
    if failure == "fault":
        records: list[logging.LogRecord] = [
            record
            for record in caplog.records
            if record.name == "superset.semantic_layers.exceptions"
            and record.levelno == logging.ERROR
        ]
        assert len(records) == 1
        assert records[0].getMessage() == "Semantic provider query execution failed"
        assert records[0].exc_info is not None
        assert records[0].exc_info[1] is date_view.get_table.side_effect
    date_view.get_table.assert_called_once()


@pytest.mark.parametrize(
    "code",
    [
        "UNSUPPORTED_QUERY",
        "UNSUPPORTED_OFFSET",
        "INVALID_FILTER",
        "INVALID_QUERY",
        "private-unknown-code",
    ],
)
def test_rejection_contract_does_not_retain_arbitrary_text(code: str) -> None:
    """The portable exception round-trips codes without storing diagnostics."""
    from superset_core.semantic_layers.errors import SemanticQueryErrorCode

    error: SemanticQueryRejectedError = SemanticQueryRejectedError(code)
    restored: SemanticQueryRejectedError = SemanticQueryRejectedError(*error.args)
    assert restored.code == error.code
    assert str(error) == "Semantic query rejected."
    assert "private" not in repr(error)
    assert error.code in SemanticQueryErrorCode


@pytest.mark.parametrize("fault", [ValueError, RuntimeError, TimeoutError])
def test_provider_fault_is_not_validation(
    app_context: None, fault: type[Exception]
) -> None:
    """Unclassified failures stay server faults and never export their cause."""
    from superset_core.semantic_layers.types import SemanticQuery

    from superset.semantic_layers.exceptions import (
        execute_semantic_query,
        SemanticLayerExecutionError,
    )

    provider: MagicMock = MagicMock(side_effect=fault("private-provider-diagnostic"))
    captured: pytest.ExceptionInfo[SemanticLayerExecutionError]
    with pytest.raises(SemanticLayerExecutionError) as captured:
        execute_semantic_query(provider, SemanticQuery(dimensions=set(), metrics=set()))
    assert captured.value.status == 500
    assert "private" not in str(captured.value.to_dict())
    provider.assert_called_once()


@pytest.mark.parametrize("phase", ["count", "comparison"])
def test_required_secondary_query_rejection(
    client: FlaskClient,
    full_api_access: None,
    date_view: MagicMock,
    phase: str,
) -> None:
    """A required count or comparison cannot publish partial successful data."""
    rejection: SemanticQueryRejectedError = SemanticQueryRejectedError(
        "UNSUPPORTED_QUERY"
    )
    query: dict[str, Any] = {
        "columns": ["ORDER_DATE"],
        "metrics": ["ORDER_COUNT"],
        "row_limit": 100,
    }
    if phase == "count":
        date_view.get_row_count.side_effect = rejection
        query["is_rowcount"] = True
    else:
        date_view.get_table.side_effect = [date_view.get_table.return_value, rejection]
        query["time_offsets"] = ["1 week ago"]
        query["time_range"] = "2026-01-01 : 2026-01-03"
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [query],
            "result_format": "json",
            "result_type": "full",
            "force": True,
        },
    )
    assert response.status_code == 400
    assert "This semantic provider does not support this query." in response.get_data(
        as_text=True
    )
    assert "result" not in response.get_json()
    assert date_view.get_row_count.call_count == (1 if phase == "count" else 0)
    assert date_view.get_table.call_count == (0 if phase == "count" else 2)


@pytest.mark.parametrize("kind", ["oauth", "cancel", "worker_timeout", "security"])
def test_provider_control_signal_is_preserved(app_context: None, kind: str) -> None:
    """Do not turn authentication, cancellation or worker control into faults."""
    from billiard.exceptions import SoftTimeLimitExceeded
    from superset_core.semantic_layers.types import SemanticQuery

    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import (
        OAuth2TokenRefreshError,
        SupersetCancelQueryException,
        SupersetSecurityException,
    )
    from superset.semantic_layers.exceptions import execute_semantic_query

    control: Exception = {
        "security": SupersetSecurityException(
            SupersetError(
                message="Denied",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.WARNING,
            )
        ),
        "oauth": OAuth2TokenRefreshError(),
        "cancel": SupersetCancelQueryException(),
        "worker_timeout": SoftTimeLimitExceeded(),
    }[kind]
    dispatcher: MagicMock = MagicMock(side_effect=control)
    captured: pytest.ExceptionInfo[Exception]
    with pytest.raises(type(control)) as captured:
        execute_semantic_query(
            dispatcher, SemanticQuery(dimensions=set(), metrics=set())
        )
    assert captured.value is control
    dispatcher.assert_called_once()


@pytest.mark.parametrize("guest", [False, True])
@pytest.mark.parametrize(
    "kind",
    [
        "validation",
        "core_incomplete",
        "core_unverified",
        "host_incomplete",
        "host_unverified",
    ],
)
def test_host_validation_keeps_400(
    client: FlaskClient,
    full_api_access: None,
    date_view: MagicMock,
    mocker: MockerFixture,
    guest: bool,
    kind: str,
) -> None:
    """Provider dispatch must preserve explicit host validation classification."""
    from superset_core.semantic_layers import errors as core_errors

    from superset.exceptions import (
        QueryObjectValidationError,
        SemanticResultCompletenessError,
    )

    mocker.patch("superset.security_manager.is_guest_user", return_value=guest)
    failure: Exception = {
        "validation": QueryObjectValidationError("host-validation"),
        "core_incomplete": core_errors.SemanticResultCompletenessError("incomplete"),
        "core_unverified": core_errors.SemanticResultCompletenessError("unverified"),
        "host_incomplete": SemanticResultCompletenessError("incomplete"),
        "host_unverified": SemanticResultCompletenessError("unverified"),
    }[kind]
    date_view.get_table.side_effect = failure
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [{"columns": ["ORDER_DATE"], "metrics": ["ORDER_COUNT"]}],
            "result_format": "json",
            "result_type": "full",
            "force": True,
        },
    )
    assert response.status_code == 400
    message: str = response.get_json()["message"]
    if guest:
        assert message == "An error occurred while fetching the data."
    elif kind == "validation":
        assert message == "Error: host-validation"
    else:
        assert (
            message
            == SemanticResultCompletenessError(
                "incomplete" if kind.endswith("incomplete") else "unverified"
            ).message
        )
    date_view.get_table.assert_called_once()


@pytest.mark.parametrize(
    "failure,status", [("fault", 500), ("rejection", 400), ("completeness", 400)]
)
def test_annotation_preserves_semantic_failure(
    app_context: None, mocker: MockerFixture, failure: str, status: int
) -> None:
    """Annotation wrapping must not turn provider outages into client failures."""
    from superset_core.semantic_layers.errors import SemanticQueryErrorCode

    from superset.common.query_context_processor import QueryContextProcessor
    from superset.exceptions import SemanticResultCompletenessError, SupersetException
    from superset.semantic_layers.exceptions import (
        SemanticLayerExecutionError,
        SemanticLayerQueryRejectedError,
    )

    error: SupersetException = {
        "fault": SemanticLayerExecutionError(),
        "rejection": SemanticLayerQueryRejectedError(
            SemanticQueryErrorCode.INVALID_QUERY
        ),
        "completeness": SemanticResultCompletenessError("incomplete"),
    }[failure]
    chart: MagicMock = MagicMock()
    chart.get_query_context.return_value.queries = []
    mocker.patch(
        "superset.common.query_context_processor.ChartDAO.find_by_id",
        return_value=chart,
    )
    command: MagicMock = mocker.patch(
        "superset.commands.chart.data.get_data_command.ChartDataCommand"
    ).return_value
    command.run.side_effect = error
    captured: pytest.ExceptionInfo[Exception]
    with pytest.raises(type(error)) as captured:
        QueryContextProcessor.get_viz_annotation_data(
            {"value": 42, "name": "Source"}, False
        )
    assert captured.value is error
    assert error.status == status
    command.run.assert_called_once()


@pytest.mark.parametrize("reason", ["incomplete", "unverified"])
def test_async_completeness_does_not_publish_success(
    app_context: None, date_view: MagicMock, mocker: MockerFixture, reason: str
) -> None:
    """Run the real processor from the async entry point and reject false success."""
    from superset_core.semantic_layers import errors as core_errors

    from superset.charts.schemas import ChartDataQueryContextSchema
    from superset.common.query_context import QueryContext
    from superset.common.query_serialization import serialize_query
    from superset.exceptions import SemanticResultCompletenessError
    from superset.tasks.async_queries import execute_chart_query

    date_view.get_table.side_effect = core_errors.SemanticResultCompletenessError(
        "incomplete" if reason == "incomplete" else "unverified"
    )
    context: QueryContext = ChartDataQueryContextSchema().load(
        {
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [{"columns": ["ORDER_DATE"], "metrics": ["ORDER_COUNT"]}],
            "result_format": "json",
            "result_type": "full",
            "force": True,
        }
    )
    task_context: MagicMock = mocker.patch(
        "superset.tasks.async_queries.get_context"
    ).return_value
    mocker.patch("superset.tasks.async_queries._resolve_user")
    mocker.patch("superset.tasks.async_queries.override_user")
    mocker.patch(
        "superset.tasks.async_queries.load_serialized_query", return_value=context
    )
    with pytest.raises(SemanticResultCompletenessError):
        execute_chart_query.func(serialize_query(context, 0), user_id=7)
    task_context.update_task.assert_not_called()
    date_view.get_table.assert_called_once()


@pytest.mark.parametrize(
    "code,expected",
    [
        (
            "UNSUPPORTED_QUERY",
            (
                "This semantic provider does not support this query. "
                "Remove unsupported filters or grouping and try again."
            ),
        ),
        (
            "UNSUPPORTED_OFFSET",
            (
                "This semantic provider cannot apply the requested offset. "
                "Turn off pagination or use a supported limit and offset."
            ),
        ),
        (
            "INVALID_FILTER",
            (
                "A semantic query filter is invalid. "
                "Check its operator and values, then try again."
            ),
        ),
        (
            "INVALID_QUERY",
            (
                "The semantic query is invalid. "
                "Check its fields and options, then try again."
            ),
        ),
        (
            "private-unknown-code",
            (
                "The semantic query is invalid. "
                "Check its fields and options, then try again."
            ),
        ),
    ],
)
def test_provider_rejection_uses_host_guidance(
    app_context: None, code: str, expected: str
) -> None:
    """Every SDK code selects host-owned text; unknown input cannot be echoed."""
    from superset_core.semantic_layers.types import SemanticQuery

    from superset.semantic_layers.exceptions import (
        execute_semantic_query,
        SemanticLayerQueryRejectedError,
    )

    dispatcher: MagicMock = MagicMock(side_effect=SemanticQueryRejectedError(code))
    captured: pytest.ExceptionInfo[SemanticLayerQueryRejectedError]
    with pytest.raises(SemanticLayerQueryRejectedError) as captured:
        execute_semantic_query(
            dispatcher, SemanticQuery(dimensions=set(), metrics=set())
        )
    assert captured.value.message == expected
    assert captured.value.status == 400
    assert "private" not in str(captured.value.to_dict())
    dispatcher.assert_called_once()
