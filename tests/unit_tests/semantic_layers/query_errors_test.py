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

from datetime import date
from typing import Any
from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.exceptions import SemanticQueryRejectedError
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
    from superset_core.semantic_layers.exceptions import SemanticQueryErrorCode

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


@pytest.mark.parametrize("kind", ["oauth", "cancel", "worker_timeout"])
def test_provider_control_signal_is_preserved(app_context: None, kind: str) -> None:
    """Do not turn authentication, cancellation or worker control into faults."""
    from billiard.exceptions import SoftTimeLimitExceeded
    from superset_core.semantic_layers.types import SemanticQuery

    from superset.exceptions import (
        OAuth2TokenRefreshError,
        SupersetCancelQueryException,
    )
    from superset.semantic_layers.exceptions import execute_semantic_query

    control: Exception = {
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
