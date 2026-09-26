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
"""Chart responses report the chart's live dataset, not its stored name.

``Slice.datasource_name`` is a denormalized column that is not refreshed when
a dataset is renamed or a chart is re-pointed. These tests persist charts whose
stored name disagrees with the dataset (or semantic view) they are joined to,
reload them from a cold identity map, and check that every MCP chart surface
reports the live id and name.
"""

from collections.abc import Iterator
from contextlib import nullcontext
from dataclasses import dataclass
from importlib import import_module
from types import SimpleNamespace
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Load, Session

from superset.connectors.sqla.models import SqlaTable
from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import (
    ChartInfo,
    resolve_chart_datasource_id,
    resolve_chart_datasource_name,
    serialize_chart_object,
)
from superset.mcp_service.chart.tool.get_chart_sql import _resolve_datasource_name
from superset.mcp_service.dashboard.schemas import serialize_chart_summary
from superset.mcp_service.privacy import redact_chart_data_model_fields
from superset.models.core import Database
from superset.models.slice import Slice
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.utils import json

get_chart_info_module = import_module("superset.mcp_service.chart.tool.get_chart_info")
list_charts_module = import_module("superset.mcp_service.chart.tool.list_charts")

STALE_TABLE_NAME = "superset_events_production.superset_events"
STALE_VIEW_NAME = "retired_view"


@dataclass(frozen=True)
class PersistedCharts:
    table_chart_id: int
    view_chart_id: int
    orphan_chart_id: int
    table_id: int
    view_id: int


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[None]:
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield


@pytest.fixture
def charts(session: Session) -> PersistedCharts:
    """Persist charts whose stored ``datasource_name`` is stale."""
    engine = session.get_bind()
    assert isinstance(engine, Engine)
    Slice.metadata.create_all(engine)

    database = Database(database_name="analytics", sqlalchemy_uri="sqlite://")
    table = SqlaTable(
        table_name="hs_flat_customer_events",
        schema="hubspot_customers",
        database=database,
    )
    layer = SemanticLayer(name="Jaffle Shop", type="test")
    session.add_all([database, table, layer])
    session.flush()
    view = SemanticView(name="Orders", semantic_layer_uuid=layer.uuid)
    session.add(view)
    session.flush()

    table_chart = Slice(
        slice_name="Customer events",
        viz_type="table",
        datasource_type="table",
        datasource_id=table.id,
        datasource_name=STALE_TABLE_NAME,
    )
    view_chart = Slice(
        slice_name="Orders by day",
        viz_type="table",
        datasource_type="semantic_view",
        datasource_id=view.id,
        datasource_name=STALE_VIEW_NAME,
    )
    orphan_chart = Slice(
        slice_name="Dataset deleted",
        viz_type="table",
        datasource_type="table",
        datasource_id=table.id + view.id + 100,
        datasource_name=STALE_TABLE_NAME,
    )
    session.add_all([table_chart, view_chart, orphan_chart])
    session.flush()
    persisted = PersistedCharts(
        table_chart_id=table_chart.id,
        view_chart_id=view_chart.id,
        orphan_chart_id=orphan_chart.id,
        table_id=table.id,
        view_id=view.id,
    )
    # The same id for a dataset and a semantic view checks that each chart is
    # resolved through the relationship matching its own datasource type.
    assert persisted.table_id == persisted.view_id
    session.expunge_all()
    return persisted


def _load(session: Session, chart_id: int) -> Slice:
    return session.query(Slice).filter(Slice.id == chart_id).one()


def test_serialize_chart_object_reports_live_dataset(
    session: Session, charts: PersistedCharts
) -> None:
    info = serialize_chart_object(_load(session, charts.table_chart_id))

    assert info is not None
    assert info.datasource_id == charts.table_id
    assert info.datasource_name == "hubspot_customers.hs_flat_customer_events"


def test_serialize_chart_object_reports_live_semantic_view(
    session: Session, charts: PersistedCharts
) -> None:
    info = serialize_chart_object(_load(session, charts.view_chart_id))

    assert info is not None
    assert info.datasource_id == charts.view_id
    assert info.datasource_name == "Orders"
    assert info.datasource_type == "semantic_view"


def test_missing_dataset_reports_no_name_rather_than_stale_one(
    session: Session, charts: PersistedCharts
) -> None:
    chart = _load(session, charts.orphan_chart_id)

    assert resolve_chart_datasource_name(chart) is None
    assert resolve_chart_datasource_id(chart) == chart.datasource_id


def test_get_chart_sql_names_the_live_dataset(
    session: Session, charts: PersistedCharts
) -> None:
    chart = _load(session, charts.table_chart_id)

    assert (
        _resolve_datasource_name({}, chart)
        == "hubspot_customers.hs_flat_customer_events"
    )


def test_objects_without_live_resolver_fall_back_to_stored_name() -> None:
    row = SimpleNamespace(datasource_id=7, datasource_name="stored")

    assert resolve_chart_datasource_name(row) == "stored"
    assert resolve_chart_datasource_id(row) == 7


@pytest.mark.parametrize(
    ("chart_attr", "id_attr", "expected_name"),
    [
        ("table_chart_id", "table_id", "hubspot_customers.hs_flat_customer_events"),
        ("view_chart_id", "view_id", "Orders"),
    ],
)
def test_dashboard_chart_summary_reports_live_dataset(
    session: Session,
    charts: PersistedCharts,
    chart_attr: str,
    id_attr: str,
    expected_name: str,
) -> None:
    chart = _load(session, getattr(charts, chart_attr))

    summary = serialize_chart_summary(chart, include_data_model_metadata=True)
    redacted = serialize_chart_summary(chart, include_data_model_metadata=False)

    assert summary is not None
    assert summary.datasource_id == getattr(charts, id_attr)
    assert summary.datasource_name == expected_name
    assert redacted is not None
    assert redacted.datasource_id is None
    assert redacted.datasource_name is None


def test_redaction_clears_datasource_id() -> None:
    redacted = redact_chart_data_model_fields(
        ChartInfo(id=1, datasource_id=14, datasource_name="orders")
    )

    assert redacted.datasource_id is None
    assert redacted.datasource_name is None


def _find_by_id(session: Session) -> Any:
    def find(
        identifier: int, query_options: list[Load] | None = None, **_: Any
    ) -> Slice | None:
        return (
            session.query(Slice)
            .options(*(query_options or []))
            .filter(Slice.id == identifier)
            .one_or_none()
        )

    return find


async def _call_get_chart_info(
    session: Session, chart_id: int, *, can_view_data_model: bool
) -> dict[str, Any]:
    with (
        patch.object(
            get_chart_info_module.event_logger,
            "log_context",
            return_value=nullcontext(),
        ),
        patch.object(
            get_chart_info_module,
            "user_can_view_data_model_metadata",
            return_value=can_view_data_model,
        ),
        patch.object(
            get_chart_info_module,
            "validate_chart_dataset",
            return_value=SimpleNamespace(is_valid=True, warnings=[]),
        ),
        patch(
            "superset.daos.chart.ChartDAO.find_by_id",
            side_effect=_find_by_id(session),
        ),
        patch("superset.mcp_service.auth.check_tool_permission", return_value=True),
    ):
        async with Client(mcp) as client:
            response = await client.call_tool(
                "get_chart_info",
                {
                    "request": {
                        "identifier": chart_id,
                        "select_columns": [
                            "id",
                            "slice_name",
                            "datasource_id",
                            "datasource_name",
                        ],
                    }
                },
            )
    return json.loads(response.content[0].text)


@pytest.mark.asyncio
async def test_get_chart_info_returns_live_datasource_id_and_name(
    session: Session, charts: PersistedCharts
) -> None:
    result = await _call_get_chart_info(
        session, charts.table_chart_id, can_view_data_model=True
    )

    assert result == {
        "id": charts.table_chart_id,
        "slice_name": "Customer events",
        "datasource_id": charts.table_id,
        "datasource_name": "hubspot_customers.hs_flat_customer_events",
    }


@pytest.mark.asyncio
async def test_get_chart_info_redacts_datasource_id_without_data_model_access(
    session: Session, charts: PersistedCharts
) -> None:
    result = await _call_get_chart_info(
        session, charts.table_chart_id, can_view_data_model=False
    )

    assert result["datasource_id"] is None
    assert result["datasource_name"] is None


def _list_charts_dao(session: Session, calls: list[list[str]]) -> Any:
    def list_(*_: Any, columns: list[str] | None = None, **__: Any) -> Any:
        calls.append(list(columns or []))
        rows = session.query(Slice).order_by(Slice.id).all()
        return rows, len(rows)

    return list_


async def _call_list_charts(
    session: Session,
    select_columns: list[str],
    *,
    can_view_data_model: bool,
) -> tuple[dict[str, Any], list[list[str]]]:
    calls: list[list[str]] = []
    with (
        patch.object(
            list_charts_module,
            "user_can_view_data_model_metadata",
            return_value=can_view_data_model,
        ),
        patch(
            "superset.daos.chart.ChartDAO.list",
            side_effect=_list_charts_dao(session, calls),
        ),
    ):
        async with Client(mcp) as client:
            response = await client.call_tool(
                "list_charts",
                {"request": {"select_columns": select_columns}},
            )
    return json.loads(response.content[0].text), calls


@pytest.mark.asyncio
async def test_list_charts_returns_live_datasource_id_and_name(
    session: Session, charts: PersistedCharts
) -> None:
    data, calls = await _call_list_charts(
        session,
        ["id", "datasource_id", "datasource_name", "params"],
        can_view_data_model=True,
    )

    # The live-datasource relationships are eager-loaded with the charts.
    assert {"table", "semantic_view"} <= set(calls[0])
    by_id = {chart["id"]: chart for chart in data["charts"]}
    assert by_id[charts.table_chart_id] == {
        "id": charts.table_chart_id,
        "datasource_id": charts.table_id,
        "datasource_name": "hubspot_customers.hs_flat_customer_events",
    }
    assert by_id[charts.view_chart_id] == {
        "id": charts.view_chart_id,
        "datasource_id": charts.view_id,
        "datasource_name": "Orders",
    }
    assert by_id[charts.orphan_chart_id]["datasource_name"] is None
    # ``params`` is a model column that ChartInfo does not expose.
    assert data["columns_loaded"] == ["id", "datasource_id", "datasource_name"]


@pytest.mark.asyncio
async def test_list_charts_omits_datasource_id_without_data_model_access(
    session: Session, charts: PersistedCharts
) -> None:
    data, _ = await _call_list_charts(
        session,
        ["id", "slice_name", "datasource_id", "datasource_name"],
        can_view_data_model=False,
    )

    assert data["columns_loaded"] == ["id", "slice_name"]
    for chart in data["charts"]:
        assert set(chart) == {"id", "slice_name"}


@pytest.mark.asyncio
async def test_list_charts_columns_loaded_excludes_computation_dependencies(
    session: Session, charts: PersistedCharts
) -> None:
    data, calls = await _call_list_charts(
        session, ["id", "changed_on_humanized"], can_view_data_model=True
    )

    assert "changed_on" in calls[0]
    assert data["columns_loaded"] == ["id", "changed_on_humanized"]
    assert "table" not in calls[0]


@pytest.mark.asyncio
async def test_list_charts_live_datasource_query_count_is_bounded(
    session: Session, charts: PersistedCharts
) -> None:
    """Real DAO queries must not lazy-load relationships for each chart."""
    from sqlalchemy import event

    from superset.daos.chart import ChartDAO

    statements: list[str] = []

    def record_statement(
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Count SELECTs during the tool call, excluding fixture setup."""
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    counts: list[int] = []
    with (
        patch.object(
            list_charts_module,
            "user_can_view_data_model_metadata",
            return_value=True,
        ),
        # Isolate authorization; keep the DAO's query construction and execution.
        patch.object(
            ChartDAO, "_apply_base_filter", side_effect=lambda query, **_: query
        ),
    ):
        async with Client(mcp) as client:
            for page_size in (1, 3):
                session.expunge_all()
                statements.clear()
                engine = session.get_bind()
                event.listen(engine, "before_cursor_execute", record_statement)
                try:
                    response = await client.call_tool(
                        "list_charts",
                        {
                            "request": {
                                "select_columns": [
                                    "id",
                                    "datasource_id",
                                    "datasource_name",
                                    "params",
                                ],
                                "order_column": "id",
                                "order_direction": "asc",
                                "page_size": page_size,
                            }
                        },
                    )
                finally:
                    event.remove(engine, "before_cursor_execute", record_statement)
                data = json.loads(response.content[0].text)
                assert len(data["charts"]) == page_size
                assert data["charts"][0]["datasource_id"] == charts.table_id
                assert data["charts"][0]["datasource_name"] == (
                    "hubspot_customers.hs_flat_customer_events"
                )
                counts.append(len(statements))

    assert counts == [2, 2], f"SELECT counts for 1 and 3 charts: {counts}"


@pytest.mark.parametrize(
    "select_columns", [None, ["tags"], ["editors"], ["tags", "editors"]]
)
def test_serialize_chart_preserves_requested_collections(
    select_columns: list[str] | None,
) -> None:
    """Full-object and explicit collection reads retain their existing shape."""
    from superset.subjects.models import Subject
    from superset.tags.models import Tag

    chart = Slice(
        tags=[Tag(id=7, name="sales")],
        editors=[Subject(id=9, label="Chart editor", active=True)],
    )
    info = serialize_chart_object(chart, select_columns=select_columns)

    assert info is not None
    assert [tag.model_dump() for tag in info.tags] == (
        [{"id": 7, "name": "sales", "type": None, "description": None}]
        if select_columns is None or "tags" in select_columns
        else []
    )
    assert [editor.model_dump() for editor in info.editors] == (
        [{"id": 9, "label": "Chart editor", "type": None, "active": True}]
        if select_columns is None or "editors" in select_columns
        else []
    )
