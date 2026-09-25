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

"""Unit tests for the MCP get_dashboard_datasets tool."""

from importlib import import_module
from typing import Any
from unittest.mock import Mock, patch, PropertyMock

import pytest
from fastmcp import Client, FastMCP
from sqlalchemy import event
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Load, Session

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.app import mcp
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.semantic_layers.models import (
    ColumnMetadata,
    MetricMetadata,
    SemanticLayer,
    SemanticView,
)
from superset.utils import json

get_dashboard_datasets_module = import_module(
    "superset.mcp_service.dashboard.tool.get_dashboard_datasets"
)


def _wrapped(value: str) -> str:
    return value


def _build_view_slice(view_id: int = 2) -> Mock:
    """Build a semantic-view chart with no SQL datasource relationship."""
    view: Mock = Mock()
    view.id = view_id
    view.uuid = "view-uuid"
    view.name = "Orders"
    view.semantic_layer = Mock(uuid="6f0f1c2a-0000-4000-8000-000000000007")
    view.semantic_layer.name = "Jaffle Shop"
    view.columns = [ColumnMetadata("order_date", "TIMESTAMP", True, "Order date")]
    view.metrics = [MetricMetadata("revenue", "SUM(amount)", "Revenue")]
    view.raise_for_access = Mock(return_value=None)
    slc: Mock = Mock(datasource_id=view_id, datasource_type="semantic_view")
    slc.datasource = None
    slc.semantic_view = view
    return slc


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_datasets_view_only(
    mock_find: Mock,
    mcp_server: FastMCP,
) -> None:
    """A dashboard containing only a semantic-view chart exposes its source."""
    mock_find.return_value = _build_dashboard_mock(slices=[_build_view_slice()])
    async with Client(mcp_server) as client:
        data: dict[str, Any] = json.loads(
            (
                await client.call_tool(
                    "get_dashboard_datasets", {"request": {"identifier": 1}}
                )
            )
            .content[0]
            .text
        )
    assert data["dataset_count"] == 1


@pytest.mark.parametrize("view_id", [2, 1])
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_datasets_mixed_kinds(
    mock_find: Mock,
    mcp_server: FastMCP,
    view_id: int,
) -> None:
    """Tables and views remain distinct even when their IDs collide."""
    table: Mock = _build_datasource_mock(
        dataset_id=1, table_name="orders", database=_build_database_mock()
    )
    view_slice: Mock = _build_view_slice(view_id)
    mock_find.return_value = _build_dashboard_mock(
        slices=[view_slice, _build_slice_mock(table)]
    )
    async with Client(mcp_server) as client:
        data: dict[str, Any] = json.loads(
            (
                await client.call_tool(
                    "get_dashboard_datasets", {"request": {"identifier": 1}}
                )
            )
            .content[0]
            .text
        )
    assert data["dataset_count"] == 2
    assert data["inaccessible_dataset_count"] == 0
    assert [entry["id"] for entry in data["datasets"]] == [1, view_id]
    by_kind: dict[str, Any] = {
        entry["datasource_type"]: entry for entry in data["datasets"]
    }
    assert by_kind["table"]["table_name"] == by_kind["table"]["name"] == "orders"
    assert by_kind["table"]["database"]["name"] == "examples"
    assert by_kind["table"]["semantic_layer"] is None
    view: dict[str, Any] = by_kind["semantic_view"]
    assert view["name"] == "Orders"
    assert view["uuid"] == "view-uuid"
    assert view["semantic_layer"] == {
        "uuid": "6f0f1c2a-0000-4000-8000-000000000007",
        "name": "Jaffle Shop",
    }
    assert view["table_name"] is None
    assert view["schema"] is None
    assert view["database"] is None
    assert view["columns"] == [
        {
            "column_name": "order_date",
            "type": "TIMESTAMP",
            "is_dttm": True,
            "verbose_name": "Order date",
        }
    ]
    assert view["metrics"] == [
        {
            "metric_name": "revenue",
            "expression": "SUM(amount)",
            "verbose_name": "Revenue",
        }
    ]
    view_slice.semantic_view.raise_for_access.assert_called_once_with()


@pytest.mark.parametrize("unexpected_error", [False, True])
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_datasets_inaccessible_view(
    mock_find: Mock,
    mcp_server: FastMCP,
    unexpected_error: bool,
) -> None:
    """Denied or failed view access excludes the view but preserves the table."""
    view_slice: Mock = _build_view_slice()
    view_slice.semantic_view.raise_for_access.side_effect = (
        RuntimeError("Access backend unavailable")
        if unexpected_error
        else SupersetSecurityException(
            SupersetError(
                message="Denied",
                level=ErrorLevel.ERROR,
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            )
        )
    )
    mock_find.return_value = _build_dashboard_mock(
        slices=[
            _build_slice_mock(_build_datasource_mock(dataset_id=1)),
            view_slice,
        ]
    )
    async with Client(mcp_server) as client:
        data: dict[str, Any] = json.loads(
            (
                await client.call_tool(
                    "get_dashboard_datasets", {"request": {"identifier": 1}}
                )
            )
            .content[0]
            .text
        )
    assert data["dataset_count"] == 1
    assert data["inaccessible_dataset_count"] == 1
    assert data["datasets"][0]["datasource_type"] == "table"


@pytest.mark.parametrize("attribute", ["columns", "metrics"])
@pytest.mark.parametrize("failure", [KeyError("unregistered"), RuntimeError("offline")])
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_failed_provider_preserves_healthy_dashboard_datasets(
    mock_find: Mock,
    mcp_server: FastMCP,
    caplog: pytest.LogCaptureFixture,
    attribute: str,
    failure: Exception,
) -> None:
    """A failed view is counted once without losing healthy tables or views."""
    failed: Mock = _build_view_slice(1)
    healthy: Mock = _build_view_slice(3)
    table: Mock = _build_datasource_mock(dataset_id=1)
    mock_find.return_value = _build_dashboard_mock(
        slices=[failed, failed, _build_slice_mock(table), healthy]
    )
    with patch.object(
        type(failed.semantic_view),
        attribute,
        new_callable=PropertyMock,
        side_effect=failure,
        create=True,
    ):
        async with Client(mcp_server) as client:
            data: dict[str, Any] = json.loads(
                (
                    await client.call_tool(
                        "get_dashboard_datasets", {"request": {"identifier": 1}}
                    )
                )
                .content[0]
                .text
            )
    assert data["dataset_count"] == 2
    assert data["inaccessible_dataset_count"] == 1
    assert [(item["id"], item["datasource_type"]) for item in data["datasets"]] == [
        (1, "table"),
        (3, "semantic_view"),
    ]
    assert "Could not serialize semantic view" in caplog.text
    failed.semantic_view.raise_for_access.assert_called_once_with()


@pytest.mark.parametrize("view_count", [1, 3])
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_semantic_layers_are_loaded_before_serialization(
    mock_find: Mock,
    mcp_server: FastMCP,
    session: Session,
    view_count: int,
) -> None:
    """Distinct layers require no per-view SELECT after the eager load."""
    engine: Engine | Connection = session.get_bind()
    assert isinstance(engine, Engine)
    Dashboard.metadata.create_all(engine)
    dashboard: Dashboard = Dashboard(dashboard_title="Mixed layers")
    for index in range(view_count):
        layer: SemanticLayer = SemanticLayer(name=f"Layer {index}", type="test")
        session.add(layer)
        session.flush()
        view: SemanticView = SemanticView(
            name=f"View {index}", semantic_layer_uuid=layer.uuid
        )
        session.add(view)
        session.flush()
        chart: Slice = Slice(
            slice_name=f"Chart {index}",
            datasource_type="semantic_view",
            datasource_id=view.id,
        )
        dashboard.slices.append(chart)
    session.add(dashboard)
    session.flush()
    dashboard_id: int = dashboard.id
    session.expunge_all()
    statements: list[str] = []
    loaded_query_count: int = 0

    def record_query(
        conn: Connection,
        cursor: object,
        statement: str,
        parameters: object,
        context: object,
        executemany: bool,
    ) -> None:
        """Count real SQL, including implicit relationship loads."""
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    def find_dashboard(
        identifier: int, query_options: list[Load] | None = None
    ) -> Dashboard:
        """Use the tool's actual options against a cold ORM identity map."""
        nonlocal loaded_query_count
        found: Dashboard = (
            session.query(Dashboard)
            .options(*(query_options or []))
            .filter(Dashboard.id == identifier)
            .one()
        )
        loaded_query_count = len(statements)
        return found

    mock_find.side_effect = find_dashboard
    event.listen(engine, "before_cursor_execute", record_query)
    try:
        with (
            patch.object(SemanticView, "raise_for_access"),
            patch.object(
                SemanticView, "columns", new_callable=PropertyMock, return_value=[]
            ),
            patch.object(
                SemanticView, "metrics", new_callable=PropertyMock, return_value=[]
            ),
        ):
            async with Client(mcp_server) as client:
                data: dict[str, Any] = json.loads(
                    (
                        await client.call_tool(
                            "get_dashboard_datasets",
                            {"request": {"identifier": dashboard_id}},
                        )
                    )
                    .content[0]
                    .text
                )
        assert data["dataset_count"] == view_count
        assert {item["semantic_layer"]["name"] for item in data["datasets"]} == {
            f"Layer {index}" for index in range(view_count)
        }
        assert loaded_query_count > 0
        assert len(statements) == loaded_query_count
    finally:
        event.remove(engine, "before_cursor_execute", record_query)
        session.rollback()


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_sql_serialization_error_is_not_silently_excluded(
    mock_find: Mock, mcp_server: FastMCP
) -> None:
    """Provider isolation does not change the SQL serialization error contract."""
    table: Mock = _build_datasource_mock(dataset_id=1)
    mock_find.return_value = _build_dashboard_mock(slices=[_build_slice_mock(table)])
    with patch.object(
        type(table),
        "columns",
        new_callable=PropertyMock,
        side_effect=RuntimeError("broken"),
        create=True,
    ):
        async with Client(mcp_server) as client:
            data: dict[str, Any] = json.loads(
                (
                    await client.call_tool(
                        "get_dashboard_datasets", {"request": {"identifier": 1}}
                    )
                )
                .content[0]
                .text
            )
    assert "error" in data
    assert "datasets" not in data


def _build_column_mock(
    name: str,
    *,
    verbose_name: str | None = None,
    type_: str | None = "VARCHAR",
    is_dttm: bool = False,
) -> Mock:
    column = Mock()
    column.column_name = name
    column.verbose_name = verbose_name
    column.type = type_
    column.is_dttm = is_dttm
    return column


def _build_metric_mock(
    name: str,
    *,
    verbose_name: str | None = None,
    expression: str | None = None,
) -> Mock:
    metric = Mock()
    metric.metric_name = name
    metric.verbose_name = verbose_name
    metric.expression = expression
    return metric


def _build_database_mock(
    *, database_id: int = 7, name: str = "examples", backend: str = "postgresql"
) -> Mock:
    database = Mock()
    database.id = database_id
    database.database_name = name
    database.backend = backend
    return database


def _build_datasource_mock(
    *,
    dataset_id: int,
    uuid: str | None = None,
    table_name: str = "my_table",
    schema: str | None = "public",
    database: Mock | None = None,
    columns: list[Mock] | None = None,
    metrics: list[Mock] | None = None,
) -> Mock:
    datasource = Mock()
    datasource.id = dataset_id
    datasource.uuid = uuid
    datasource.table_name = table_name
    datasource.schema = schema
    datasource.database = database
    datasource.columns = columns or []
    datasource.metrics = metrics or []
    return datasource


def _build_slice_mock(datasource: Mock, datasource_type: str = "table") -> Mock:
    slc = Mock()
    slc.datasource_id = datasource.id
    slc.datasource_type = datasource_type
    slc.datasource = datasource
    return slc


def _build_dashboard_mock(
    *,
    dashboard_id: int = 1,
    title: str = "Test Dashboard",
    uuid: str | None = "dashboard-uuid-1",
    slices: list[Mock] | None = None,
) -> Mock:
    dashboard = Mock()
    dashboard.id = dashboard_id
    dashboard.dashboard_title = title
    dashboard.uuid = uuid
    dashboard.slices = slices or []
    return dashboard


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@pytest.fixture(autouse=True)
def mock_dataset_access():
    with patch(
        "superset.mcp_service.auth.has_dataset_access", return_value=True
    ) as mock_access:
        yield mock_access


@pytest.fixture(autouse=True)
def allow_data_model_metadata():
    """Keep tests in the metadata-allowed path unless a test overrides it."""
    with patch.object(
        get_dashboard_datasets_module,
        "user_can_view_data_model_metadata",
        return_value=True,
    ) as mock_allow:
        yield mock_allow


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_datasets_multiple_datasets(mock_find, mcp_server):
    sales = _build_datasource_mock(
        dataset_id=10,
        uuid="dataset-uuid-10",
        table_name="sales",
        schema="public",
        database=_build_database_mock(),
        columns=[
            _build_column_mock("region", verbose_name="Region"),
            _build_column_mock("order_date", type_="TIMESTAMP", is_dttm=True),
        ],
        metrics=[
            _build_metric_mock(
                "total_revenue",
                verbose_name="Total Revenue",
                expression="SUM(revenue)",
            )
        ],
    )
    customers = _build_datasource_mock(
        dataset_id=20,
        uuid="dataset-uuid-20",
        table_name="customers",
        schema="crm",
        database=_build_database_mock(database_id=8, name="crm_db", backend="mysql"),
        columns=[_build_column_mock("customer_name")],
        metrics=[],
    )
    mock_find.return_value = _build_dashboard_mock(
        slices=[
            _build_slice_mock(sales),
            _build_slice_mock(sales),
            _build_slice_mock(customers),
        ]
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_datasets", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)

    assert data["id"] == 1
    assert data["dashboard_title"] == _wrapped("Test Dashboard")
    assert data["uuid"] == "dashboard-uuid-1"
    assert data["dataset_count"] == 2
    assert data["inaccessible_dataset_count"] == 0
    assert len(data["datasets"]) == 2

    datasets_by_id = {d["id"]: d for d in data["datasets"]}
    sales_data = datasets_by_id[10]
    assert sales_data["uuid"] == "dataset-uuid-10"
    assert sales_data["table_name"] == "sales"
    assert sales_data["schema"] == "public"
    assert sales_data["database"] == {
        "id": 7,
        "name": "examples",
        "backend": "postgresql",
    }
    assert sales_data["chart_count"] == 2
    assert sales_data["columns"] == [
        {
            "column_name": "region",
            "verbose_name": _wrapped("Region"),
            "type": "VARCHAR",
            "is_dttm": False,
        },
        {
            "column_name": "order_date",
            "verbose_name": None,
            "type": "TIMESTAMP",
            "is_dttm": True,
        },
    ]
    assert sales_data["metrics"] == [
        {
            "metric_name": "total_revenue",
            "verbose_name": _wrapped("Total Revenue"),
            "expression": _wrapped("SUM(revenue)"),
        }
    ]
    assert sales_data["total_column_count"] == 2
    assert sales_data["total_metric_count"] == 1
    assert sales_data["columns_truncated"] is False
    assert sales_data["metrics_truncated"] is False

    customers_data = datasets_by_id[20]
    assert customers_data["table_name"] == "customers"
    assert customers_data["schema"] == "crm"
    assert customers_data["chart_count"] == 1
    assert customers_data["metrics"] == []


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_datasets_by_slug(mock_find, mcp_server):
    datasource = _build_datasource_mock(
        dataset_id=10,
        table_name="sales",
        database=_build_database_mock(),
        columns=[_build_column_mock("region")],
    )
    dashboard = _build_dashboard_mock(slices=[_build_slice_mock(datasource)])

    def find_by_id(identifier, id_column=None, query_options=None):
        if id_column == "slug" and identifier == "sales-dash":
            return dashboard
        return None

    mock_find.side_effect = find_by_id

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_datasets", {"request": {"identifier": "sales-dash"}}
        )
        data = json.loads(result.content[0].text)

    assert data["id"] == 1
    assert data["dataset_count"] == 1
    assert data["datasets"][0]["table_name"] == "sales"


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_datasets_not_found(mock_find, mcp_server):
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_datasets", {"request": {"identifier": 999}}
        )
        data = json.loads(result.content[0].text)

    assert data["error_type"] == "not_found"


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_datasets_metadata_restricted(
    mock_find, mcp_server, allow_data_model_metadata
):
    """Users without data-model metadata permission get a structured denial."""
    from superset.mcp_service.privacy import DATA_MODEL_METADATA_ERROR_TYPE

    allow_data_model_metadata.return_value = False

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_datasets", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)

    assert data["error_type"] == DATA_MODEL_METADATA_ERROR_TYPE
    # The privacy gate short-circuits before any dashboard lookup.
    mock_find.assert_not_called()


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_datasets_empty_dashboard(mock_find, mcp_server):
    mock_find.return_value = _build_dashboard_mock(slices=[])

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_datasets", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)

    assert data["id"] == 1
    assert data["dataset_count"] == 0
    assert data["inaccessible_dataset_count"] == 0
    assert data["datasets"] == []


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_datasets_excludes_inaccessible(
    mock_find, mcp_server, mock_dataset_access
):
    allowed = _build_datasource_mock(dataset_id=10, table_name="sales")
    denied = _build_datasource_mock(dataset_id=20, table_name="secrets")
    mock_find.return_value = _build_dashboard_mock(
        slices=[_build_slice_mock(allowed), _build_slice_mock(denied)]
    )
    mock_dataset_access.side_effect = lambda datasource: datasource.id != 20

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_datasets", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)

    assert data["dataset_count"] == 1
    assert data["inaccessible_dataset_count"] == 1
    assert [d["id"] for d in data["datasets"]] == [10]


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_datasets_truncates_wide_datasets(mock_find, mcp_server):
    from superset.mcp_service.dashboard.schemas import (
        MAX_DASHBOARD_DATASET_COLUMNS,
        MAX_DASHBOARD_DATASET_METRICS,
    )

    datasource = _build_datasource_mock(
        dataset_id=10,
        table_name="wide_table",
        columns=[
            _build_column_mock(f"col_{i}")
            for i in range(MAX_DASHBOARD_DATASET_COLUMNS + 5)
        ],
        metrics=[
            _build_metric_mock(f"metric_{i}")
            for i in range(MAX_DASHBOARD_DATASET_METRICS + 3)
        ],
    )
    mock_find.return_value = _build_dashboard_mock(
        slices=[_build_slice_mock(datasource)]
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_datasets", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)

    dataset = data["datasets"][0]
    assert len(dataset["columns"]) == MAX_DASHBOARD_DATASET_COLUMNS
    assert len(dataset["metrics"]) == MAX_DASHBOARD_DATASET_METRICS
    assert dataset["columns_truncated"] is True
    assert dataset["metrics_truncated"] is True
    assert dataset["total_column_count"] == MAX_DASHBOARD_DATASET_COLUMNS + 5
    assert dataset["total_metric_count"] == MAX_DASHBOARD_DATASET_METRICS + 3
