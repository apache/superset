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
import traceback
import uuid
from collections.abc import Callable
from datetime import date, datetime
from typing import Any, cast
from unittest.mock import MagicMock, PropertyMock

import pyarrow as pa
import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.context import ExecutionMethod
from superset_core.semantic_layers.errors import SemanticQueryRejectedError
from superset_core.semantic_layers.types import Dimension, Metric, SemanticResult
from superset_core.semantic_layers.view import SemanticView as ProviderView
from werkzeug.test import TestResponse

from superset.charts.schemas import ChartDataQueryContextSchema
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.common.query_serialization import serialize_query
from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers.exceptions import SemanticLayerExecutionError
from superset.semantic_layers.mapper import (
    _coerce_scalar_filter_value,
    _get_adhoc_filters,
    _get_time_bounds,
    _normalize_column,
    get_results,
    SemanticQueryInputError,
    ValidatedQueryObject,
)
from superset.semantic_layers.models import (
    SemanticLayer as SemanticLayerModel,
    SemanticView,
)
from superset.tasks.async_queries import execute_chart_query


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
    mocker.patch.object(
        SemanticView, "implementation", new_callable=PropertyMock, return_value=provider
    )
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


@pytest.mark.parametrize(
    "selection,message",
    [
        (
            {"series_columns": ["ORDER_DATE"], "series_limit": 5},
            "Group limit is not supported in this Semantic View.",
        ),
        (
            {"filters": [{"col": "ORDER_DATE", "op": "==", "val": "not-a-date"}]},
            "Invalid date value",
        ),
    ],
)
def test_mapper_refusal_returns_400(
    client: FlaskClient,
    full_api_access: None,
    date_view: MagicMock,
    selection: dict[str, Any],
    message: str,
) -> None:
    """Real validation and mapping refusals are client errors before dispatch."""
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [
                {"columns": ["ORDER_DATE"], "metrics": ["ORDER_COUNT"], **selection}
            ],
            "result_format": "json",
            "result_type": "full",
            "force": True,
        },
    )
    assert response.status_code == 400
    assert message in response.get_data(as_text=True)
    date_view.get_table.assert_not_called()


@pytest.mark.parametrize("method", ["get_metrics", "get_dimensions"])
def test_mapper_metadata_fault_is_backend_error(
    app_context: None,
    date_view: MagicMock,
    caplog: pytest.LogCaptureFixture,
    method: str,
) -> None:
    """The mapper reports provider metadata faults as backend errors."""
    view: SemanticView = SemanticView(id=7, name="Orders", configuration="{}")
    view.__dict__["implementation"] = date_view
    query: QueryObject = QueryObject(columns=["ORDER_DATE"], metrics=["ORDER_COUNT"])
    query.datasource = view
    error: ValueError = ValueError("metadata fault")
    getattr(date_view, method).side_effect = error
    captured: pytest.ExceptionInfo[SemanticLayerExecutionError]
    with pytest.raises(SemanticLayerExecutionError) as captured:
        get_results(query)
    assert captured.value.status == 500
    assert captured.value.__cause__ is None
    assert "metadata fault" not in "".join(traceback.format_exception(captured.value))
    date_view.get_table.assert_not_called()
    assert f"operation={method} view_id=7 " in caplog.text


def test_discovery_preserves_host_validation(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A host validation error is not reclassified as a provider fault."""
    from superset.semantic_layers.exceptions import discover_metrics, DiscoveryTarget

    failure: QueryObjectValidationError = QueryObjectValidationError("invalid query")
    view: MagicMock = MagicMock(spec=ProviderView)
    view.get_metrics.side_effect = failure
    captured: pytest.ExceptionInfo[QueryObjectValidationError]
    with pytest.raises(QueryObjectValidationError) as captured:
        discover_metrics(lambda: view, DiscoveryTarget(view_id=7, layer_uuid=None))

    assert captured.value is failure
    view.get_metrics.assert_called_once_with()
    assert "Semantic provider metadata discovery failed" not in caplog.text


def test_malformed_provider_timezone_remains_500(
    client: FlaskClient,
    full_api_access: None,
    date_view: MagicMock,
) -> None:
    """A provider's malformed timezone is not a correctable query refusal."""
    date_view.get_dimensions.return_value = {
        Dimension("order_date", "ORDER_DATE", pa.timestamp("us", tz="/abs"))
    }
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [
                {
                    "columns": ["ORDER_DATE"],
                    "metrics": ["ORDER_COUNT"],
                    "filters": [{"col": "ORDER_DATE", "op": ">=", "val": "2026-01-01"}],
                }
            ],
            "result_format": "json",
            "result_type": "full",
            "force": True,
        },
    )
    assert response.status_code == 500
    assert "/abs" not in response.get_data(as_text=True)
    date_view.get_table.assert_not_called()


@pytest.mark.parametrize(
    "filters", [[], [{"col": "ORDER_DATE", "op": ">=", "val": "2026-01-01"}]]
)
@pytest.mark.parametrize("method", ["get_metrics", "get_dimensions"])
def test_metadata_discovery_fault_http(
    client: FlaskClient,
    full_api_access: None,
    date_view: MagicMock,
    caplog: pytest.LogCaptureFixture,
    method: str,
    filters: list[dict[str, str]],
) -> None:
    """Provider discovery faults are backend errors with no provider detail."""
    getattr(date_view, method).side_effect = ValueError("private-provider-metadata")
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [
                {
                    "columns": ["ORDER_DATE"],
                    "metrics": ["ORDER_COUNT"],
                    "filters": filters,
                }
            ],
            "result_format": "json",
            "result_type": "full",
            "force": True,
        },
    )
    assert response.status_code == 500
    body: str = response.get_data(as_text=True)
    assert "private-provider" not in body
    assert "An error occurred while fetching the data." in body
    date_view.get_table.assert_not_called()
    records: list[logging.LogRecord] = [
        record
        for record in caplog.records
        if record.name == "superset.semantic_layers.exceptions"
        and record.levelno == logging.ERROR
    ]
    assert len(records) == 1
    message: str = records[0].getMessage()
    assert message.startswith("Semantic provider metadata discovery failed:")
    assert f"operation={method}" in message
    assert "view_id=7" in message
    assert "error=ValueError" in message
    assert "private-provider" not in caplog.text
    assert records[0].exc_info is None


@pytest.mark.parametrize(
    "method,read",
    [
        ("get_metrics", lambda view: view.data),
        ("get_dimensions", lambda view: view.data),
        ("get_dimensions", lambda view: view.get_time_grains()),
        ("get_dimensions", lambda view: view.has_drill_by_columns(["ORDER_DATE"])),
        ("get_metrics", lambda view: view.get_compatible_metrics([], [])),
        ("get_dimensions", lambda view: view.get_compatible_dimensions([], [])),
    ],
)
def test_host_metadata_reads_classify_discovery_faults(
    app_context: None,
    date_view: MagicMock,
    caplog: pytest.LogCaptureFixture,
    method: str,
    read: Callable[[SemanticView], object],
) -> None:
    """Every host read of provider metadata reports faults the same way."""
    view: SemanticView = SemanticView(id=7, name="Orders", configuration="{}")
    view.__dict__["implementation"] = date_view
    error: ValueError = ValueError("private-provider-metadata")
    getattr(date_view, method).side_effect = error
    captured: pytest.ExceptionInfo[SemanticLayerExecutionError]
    with pytest.raises(SemanticLayerExecutionError) as captured:
        read(view)
    # Error handlers log with exc_info, which would print a retained cause.
    assert captured.value.__cause__ is None
    assert "private-provider" not in "".join(traceback.format_exception(captured.value))
    assert "private-provider" not in caplog.text


LAYER_UUID: uuid.UUID = uuid.UUID("87654321-4321-8765-4321-876543218765")

DISCOVERY_READS: list[Callable[[SemanticView], object]] = [
    lambda view: view.get_time_grains(),
    lambda view: view.has_drill_by_columns(["ORDER_DATE"]),
    lambda view: view.get_compatible_metrics([], []),
    lambda view: view.get_compatible_dimensions([], []),
]


def failing_provider_call(*args: Any, **kwargs: Any) -> None:
    """Stand in for provider code whose exception text must stay out of logs."""
    raise ValueError("private-provider-detail")


def discovery_records(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [
        record
        for record in caplog.records
        if record.name == "superset.semantic_layers.exceptions"
        and record.levelno == logging.ERROR
    ]


@pytest.fixture
def provider_class(app_context: None, mocker: MockerFixture) -> MagicMock:
    """Register a provider class so binding runs through the real host path."""
    mocker.patch(
        "superset.semantic_layers.execution.semantic_namespace", return_value="test"
    )
    provider: MagicMock = MagicMock(
        supported_execution_methods={ExecutionMethod.CONNECTION}
    )
    provider_view: MagicMock = (
        provider.from_configuration.return_value.get_semantic_view.return_value
    )
    provider_view.get_dimensions.return_value = set()
    provider_view.get_metrics.return_value = set()
    mocker.patch.dict("superset.semantic_layers.models.registry", {"fixture": provider})
    return provider


@pytest.fixture
def bound_view(provider_class: MagicMock) -> SemanticView:
    """A view whose implementation is bound by the host, not patched."""
    return SemanticView(
        id=7,
        name="Orders",
        configuration="{}",
        semantic_layer_uuid=LAYER_UUID,
        semantic_layer=SemanticLayerModel(
            uuid=LAYER_UUID, type="fixture", configuration="{}"
        ),
    )


@pytest.mark.parametrize("operation", ["get_metrics", "get_dimensions"])
def test_provider_discovery_fault_log_identifies_view(
    bound_view: SemanticView,
    provider_class: MagicMock,
    caplog: pytest.LogCaptureFixture,
    operation: str,
) -> None:
    """One record names the view, layer, operation and type, with frames only."""
    provider_view: MagicMock = (
        provider_class.from_configuration.return_value.get_semantic_view.return_value
    )
    getattr(provider_view, operation).side_effect = failing_provider_call
    with pytest.raises(SemanticLayerExecutionError):
        _ = bound_view.data
    records: list[logging.LogRecord] = discovery_records(caplog)
    assert len(records) == 1
    message: str = records[0].getMessage()
    assert message.startswith("Semantic provider metadata discovery failed:")
    assert f"operation={operation}" in message
    assert "view_id=7" in message
    assert f"layer_uuid={LAYER_UUID}" in message
    assert "error=ValueError" in message
    # The provider's frames are logged so the fault can be located.
    assert "failing_provider_call" in message
    # The entry point that read the metadata is named.
    assert "Called from:" in message
    assert "in data" in message
    assert "private-provider" not in caplog.text
    assert records[0].exc_info is None


@pytest.mark.parametrize("read", DISCOVERY_READS)
@pytest.mark.parametrize("stage", ["from_configuration", "get_semantic_view"])
def test_host_metadata_reads_classify_binding_faults(
    bound_view: SemanticView,
    provider_class: MagicMock,
    caplog: pytest.LogCaptureFixture,
    stage: str,
    read: Callable[[SemanticView], object],
) -> None:
    """Provider faults while binding are classified and logged as provider faults."""
    if stage == "from_configuration":
        provider_class.from_configuration.side_effect = failing_provider_call
    else:
        provider_class.from_configuration.return_value.get_semantic_view.side_effect = (
            failing_provider_call
        )
    captured: pytest.ExceptionInfo[SemanticLayerExecutionError]
    with pytest.raises(SemanticLayerExecutionError) as captured:
        read(bound_view)
    assert captured.value.__cause__ is None
    records: list[logging.LogRecord] = discovery_records(caplog)
    assert len(records) == 1
    message: str = records[0].getMessage()
    assert message.startswith("Semantic provider metadata discovery failed:")
    assert "view_id=7" in message
    assert "failing_provider_call" in message
    assert "private-provider" not in caplog.text


def corrupt_configuration(view: SemanticView) -> None:
    view.configuration = "{not json"


def unregistered_layer_type(view: SemanticView) -> None:
    view.semantic_layer.type = "not-registered"


@pytest.mark.parametrize(
    "corrupt,expected",
    [
        (corrupt_configuration, "JSONDecodeError"),
        (unregistered_layer_type, "KeyError"),
    ],
)
def test_host_fault_during_discovery_is_logged_as_host_fault(
    bound_view: SemanticView,
    caplog: pytest.LogCaptureFixture,
    corrupt: Callable[[SemanticView], None],
    expected: str,
) -> None:
    """Superset faults while binding keep their traceback and a distinct label."""
    corrupt(bound_view)
    captured: pytest.ExceptionInfo[SemanticLayerExecutionError]
    with pytest.raises(SemanticLayerExecutionError) as captured:
        bound_view.get_time_grains()
    # The client sees the same generic backend error as for a provider fault.
    assert captured.value.status == 500
    assert captured.value.__cause__ is None
    records: list[logging.LogRecord] = discovery_records(caplog)
    assert len(records) == 1
    message: str = records[0].getMessage()
    assert message.startswith(
        "Semantic view metadata discovery failed in Superset, not the provider:"
    )
    assert "view_id=7" in message
    assert f"layer_uuid={LAYER_UUID}" in message
    assert f"error={expected}" in message
    assert "superset/semantic_layers/" in message
    assert f"{expected}:" in message
    # The entry point that read the metadata is named.
    assert "in get_time_grains" in message


def test_host_fault_does_not_log_the_provider_fault_it_was_handling(
    bound_view: SemanticView,
    caplog: pytest.LogCaptureFixture,
    mocker: MockerFixture,
) -> None:
    """A Superset fault raised while handling a provider fault omits its text."""

    def fail_in_context(*args: Any, **kwargs: Any) -> None:
        try:
            failing_provider_call()
        except ValueError:
            raise RuntimeError("host fault")  # noqa: B904

    # Host code raising while it handles a provider exception (implicit context).
    mocker.patch.object(
        SemanticView, "_capture_metadata_generation", side_effect=fail_in_context
    )
    with pytest.raises(SemanticLayerExecutionError):
        bound_view.get_time_grains()
    message: str = discovery_records(caplog)[0].getMessage()
    assert message.startswith("Semantic view metadata discovery failed in Superset")
    assert "RuntimeError: host fault" in message
    assert "private-provider" not in caplog.text


class FrozenProviderError(Exception):
    """A provider exception that refuses new attributes."""

    def __setattr__(self, name: str, value: object) -> None:
        if not name.startswith("__"):
            raise AttributeError(name)
        super().__setattr__(name, value)


def test_provider_exception_refusing_attributes_is_not_replaced(
    provider_class: MagicMock,
) -> None:
    """Tagging never replaces the provider's own exception."""
    from superset.semantic_layers.exceptions import provider_code

    failure: FrozenProviderError = FrozenProviderError("private-provider-detail")
    captured: pytest.ExceptionInfo[FrozenProviderError]
    with pytest.raises(FrozenProviderError) as captured:
        with provider_code():
            raise failure
    assert captured.value is failure


@pytest.mark.parametrize(
    "target",
    ["_validate_metrics", "_get_filters_from_query_object"],
)
def test_unexpected_mapper_value_error_http(
    client: FlaskClient,
    full_api_access: None,
    date_view: MagicMock,
    mocker: MockerFixture,
    target: str,
) -> None:
    """A mapper bug raising ValueError is a backend error, not a user error."""
    mocker.patch(
        f"superset.semantic_layers.mapper.{target}",
        side_effect=ValueError("internal-mapper-detail"),
    )
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
    assert response.status_code == 500
    assert response.get_json()["errors"][0]["error_type"] == "GENERIC_BACKEND_ERROR"
    date_view.get_table.assert_not_called()


@pytest.mark.parametrize(
    "target",
    ["_validate_metrics", "_get_filters_from_query_object"],
)
def test_unexpected_mapper_value_error_is_not_converted(
    app_context: None,
    date_view: MagicMock,
    mocker: MockerFixture,
    target: str,
) -> None:
    """Only typed input refusals become QueryObjectValidationError."""
    view: SemanticView = SemanticView(id=7, name="Orders", configuration="{}")
    view.__dict__["implementation"] = date_view
    query: QueryObject = QueryObject(columns=["ORDER_DATE"], metrics=["ORDER_COUNT"])
    query.datasource = view
    error: ValueError = ValueError("internal-mapper-detail")
    mocker.patch(f"superset.semantic_layers.mapper.{target}", side_effect=error)
    captured: pytest.ExceptionInfo[ValueError]
    with pytest.raises(ValueError, match="internal-mapper-detail") as captured:
        get_results(query)
    assert captured.value is error
    date_view.get_table.assert_not_called()


@pytest.mark.parametrize(
    "selection,message",
    [
        ({"columns": ["MISSING"]}, "All dimensions must be defined"),
        (
            {
                "filters": [
                    {
                        "col": "ORDER_DATE",
                        "op": "TEMPORAL_RANGE",
                        "val": "2026-02-01 : 2026-01-01",
                    }
                ]
            },
            "From date cannot be larger than to date",
        ),
    ],
)
def test_mapper_input_error_is_typed(
    app_context: None,
    date_view: MagicMock,
    selection: dict[str, Any],
    message: str,
) -> None:
    """Invalid selections and time ranges reach callers as typed 400s."""
    view: SemanticView = SemanticView(id=7, name="Orders", configuration="{}")
    view.__dict__["implementation"] = date_view
    query: QueryObject = QueryObject(
        **{"columns": ["ORDER_DATE"], "metrics": ["ORDER_COUNT"], **selection}
    )
    query.datasource = view
    captured: pytest.ExceptionInfo[QueryObjectValidationError]
    with pytest.raises(QueryObjectValidationError, match=message) as captured:
        get_results(query)
    assert captured.value.status == 400
    assert isinstance(captured.value.__cause__, SemanticQueryInputError)
    date_view.get_table.assert_not_called()


@pytest.mark.parametrize(
    "parser,bounds",
    [
        ("get_since_until_from_query_object", None),
        ("get_past_or_future", (datetime(2026, 1, 1), datetime(2026, 2, 1))),
    ],
)
def test_time_offset_parser_error_is_typed(
    app_context: None,
    mocker: MockerFixture,
    parser: str,
    bounds: tuple[datetime, datetime] | None,
) -> None:
    """Time-offset bound parsing reports parser ValueErrors as input errors."""
    query: QueryObject = QueryObject(time_range="Last week")
    query.from_dttm, query.to_dttm = bounds or (None, None)
    mocker.patch(
        f"superset.semantic_layers.mapper.{parser}",
        side_effect=ValueError("bad time input"),
    )
    with pytest.raises(SemanticQueryInputError, match="bad time input"):
        _get_time_bounds(cast(ValidatedQueryObject, query), "1 year ago")


def test_axis_range_parser_error_is_typed(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """Axis-range replacement reports parser ValueErrors as input errors."""
    query: QueryObject = QueryObject(time_range="Last week")
    mocker.patch(
        "superset.semantic_layers.mapper.get_time_range_from_filters",
        side_effect=ValueError("bad time input"),
    )
    with pytest.raises(SemanticQueryInputError, match="bad time input"):
        _get_adhoc_filters(cast(ValidatedQueryObject, query), {}, "ORDER_DATE")


def test_input_error_contract() -> None:
    """Direct helpers raise a ValueError subclass so existing callers still match."""
    assert issubclass(SemanticQueryInputError, ValueError)
    with pytest.raises(SemanticQueryInputError, match="Adhoc dimensions"):
        _normalize_column({"sqlExpression": "1", "label": "x"}, {"ORDER_DATE"})
    with pytest.raises(SemanticQueryInputError, match="Invalid date value"):
        _coerce_scalar_filter_value(
            "not-a-date", Dimension("d", "ORDER_DATE", pa.date32())
        )


@pytest.mark.parametrize("is_totals_prerequisite", [False, True])
def test_async_validation_failure_does_not_publish_cache_key(
    app_context: None,
    date_view: MagicMock,
    mocker: MockerFixture,
    is_totals_prerequisite: bool,
) -> None:
    """Snowflake-shaped DATE refusals fail ordinary and totals workers as 400s."""
    context: QueryContext = ChartDataQueryContextSchema().load(
        {
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [
                {
                    "columns": ["ORDER_DATE"],
                    "metrics": ["ORDER_COUNT"],
                    "filters": [{"col": "ORDER_DATE", "op": ">=", "val": "not-a-date"}],
                }
            ],
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
    captured: pytest.ExceptionInfo[QueryObjectValidationError]
    with pytest.raises(QueryObjectValidationError) as captured:
        execute_chart_query.func(
            serialize_query(context, 0),
            user_id=7,
            is_totals_prerequisite=is_totals_prerequisite,
        )
    assert captured.value.status == 400
    assert str(captured.value) == (
        "Error: Invalid date value 'not-a-date' for filter column ORDER_DATE"
    )
    assert isinstance(captured.value.__cause__, QueryObjectValidationError)
    task_context.update_task.assert_not_called()
    date_view.get_table.assert_not_called()


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
        execute_semantic_query(provider, SemanticQuery(dimensions=[], metrics=[]))
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
        execute_semantic_query(dispatcher, SemanticQuery(dimensions=[], metrics=[]))
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
    "failure,status",
    [("fault", 500), ("rejection", 400), ("completeness", 400), ("refusal", 403)],
)
def test_annotation_preserves_semantic_failure(
    app_context: None, mocker: MockerFixture, failure: str, status: int
) -> None:
    """Annotation wrapping must not turn provider outages into client failures."""
    from superset_core.semantic_layers.errors import SemanticQueryErrorCode

    from superset.common.query_context_processor import QueryContextProcessor
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import (
        SemanticResultCompletenessError,
        SupersetException,
        SupersetSecurityException,
    )
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
        "refusal": SupersetSecurityException(
            SupersetError(
                message="This data source can't be queried in the current context.",
                error_type=SupersetErrorType.SEMANTIC_EXECUTION_REFUSED_ERROR,
                level=ErrorLevel.ERROR,
                extra={"reason": "method_not_supported"},
            )
        ),
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


def test_annotation_access_denial_is_validation_error(
    app_context: None, mocker: MockerFixture
) -> None:
    """An ordinary annotation datasource denial keeps the validation boundary."""
    from superset.common.query_context_processor import QueryContextProcessor
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import (
        QueryObjectValidationError,
        SupersetSecurityException,
    )

    denial: SupersetSecurityException = SupersetSecurityException(
        SupersetError(
            message="Annotation datasource access denied",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
    chart: MagicMock = MagicMock()
    chart.get_query_context.return_value.queries = []
    chart.get_query_context.return_value.raise_for_access.side_effect = denial
    mocker.patch(
        "superset.common.query_context_processor.ChartDAO.find_by_id",
        return_value=chart,
    )
    with pytest.raises(
        QueryObjectValidationError, match="Annotation datasource access denied"
    ):
        QueryContextProcessor.get_viz_annotation_data(
            {"value": 42, "name": "Source"}, False
        )
    chart.get_query_context.return_value.raise_for_access.assert_called_once()


@pytest.mark.parametrize("result_type", ["full", "query"])
def test_annotation_access_denial_http(
    client: FlaskClient,
    full_api_access: None,
    date_view: MagicMock,
    mocker: MockerFixture,
    result_type: str,
) -> None:
    """Ordinary source denial is a query failure, not a whole-request 403."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    chart: MagicMock = MagicMock()
    chart.get_query_context.return_value.queries = []
    chart.get_query_context.return_value.raise_for_access.side_effect = (
        SupersetSecurityException(
            SupersetError(
                message="Annotation datasource access denied",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        )
    )
    mocker.patch(
        "superset.common.query_context_processor.ChartDAO.find_by_id",
        return_value=chart,
    )
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [
                {
                    "columns": ["ORDER_DATE"],
                    "metrics": ["ORDER_COUNT"],
                    "annotation_layers": [
                        {
                            "annotationType": "EVENT",
                            "sourceType": "table",
                            "value": 42,
                            "name": "Source",
                            "show": True,
                            "showMarkers": False,
                        }
                    ],
                }
            ],
            "result_format": "json",
            "result_type": result_type,
            "force": True,
        },
    )
    if result_type == "full":
        assert response.status_code == 400
        assert "Annotation datasource access denied" in response.get_data(as_text=True)
        chart.get_query_context.return_value.raise_for_access.assert_called_once()
    else:
        # Query previews do not load annotations; their own validation error
        # remains in the successful response's per-query payload.
        assert response.status_code == 200
        assert "provider query" in response.json["result"][0]["error"]
        chart.get_query_context.return_value.raise_for_access.assert_not_called()


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
    task_context.update_task.assert_called_once_with(
        payload={"semantic_result_error": reason}, immediate=True
    )
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
        execute_semantic_query(dispatcher, SemanticQuery(dimensions=[], metrics=[]))
    assert captured.value.message == expected
    assert captured.value.status == 400
    assert "private" not in str(captured.value.to_dict())
    dispatcher.assert_called_once()


def test_unknown_rejection_code_is_logged_before_normalizing(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """An adapter typo stays visible in operator logs, not in the response."""
    from superset_core.semantic_layers.errors import SemanticQueryErrorCode

    with caplog.at_level(logging.WARNING):
        error: SemanticQueryRejectedError = SemanticQueryRejectedError("INVALID_FLITER")

    assert error.code == SemanticQueryErrorCode.INVALID_QUERY
    assert "'INVALID_FLITER'" in caplog.text
    assert str(error) == "Semantic query rejected."


@pytest.mark.parametrize("guest", [False, True])
@pytest.mark.parametrize(
    "code",
    [
        "UNSUPPORTED_QUERY",
        "UNSUPPORTED_OFFSET",
        "INVALID_FILTER",
        "INVALID_QUERY",
        "unknown-private-code",
        None,
    ],
)
def test_async_provider_error_matches_sync_chart_error(
    app_context: None,
    date_view: MagicMock,
    mocker: MockerFixture,
    guest: bool,
    code: str | None,
) -> None:
    """The real async processor preserves host classification and public text."""
    from superset.charts.schemas import ChartDataQueryContextSchema
    from superset.common.query_context import QueryContext
    from superset.common.query_serialization import serialize_query
    from superset.exceptions import SupersetErrorException
    from superset.semantic_layers.exceptions import (
        SemanticLayerExecutionError,
        SemanticLayerQueryRejectedError,
    )
    from superset.tasks.async_queries import execute_chart_query
    from superset.tasks.utils import error_update

    mocker.patch("superset.security_manager.is_guest_user", return_value=guest)
    failure: Exception = (
        SemanticQueryRejectedError(code)
        if code is not None
        else RuntimeError("private-provider-diagnostic")
    )
    expected: SupersetErrorException = (
        SemanticLayerQueryRejectedError(failure.code)
        if isinstance(failure, SemanticQueryRejectedError)
        else SemanticLayerExecutionError()
    )
    date_view.get_table.side_effect = failure
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
    captured: pytest.ExceptionInfo[SupersetErrorException]
    with pytest.raises(type(expected)) as captured:
        execute_chart_query.func(serialize_query(context, 0), user_id=7)

    assert captured.value.status == expected.status
    assert captured.value.message == expected.message
    assert error_update(captured.value)["error_message"] == expected.message
    assert "private" not in str(captured.value.to_dict())
    task_context.update_task.assert_not_called()
    date_view.get_table.assert_called_once()
