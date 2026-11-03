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
from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import text
from sqlalchemy.orm.session import Session

from superset.canvas.data import PlacementData, query_context_payload, RuntimeFilter
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.exceptions import SupersetSecurityException
from superset.models.canvas import Canvas
from superset.models.core import Database
from superset.utils import json
from superset.widgets.models import Widget
from tests.unit_tests.canvas.fixtures import FakeResolver

pytestmark = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": True}}], indirect=True
)

URL = "/api/v1/canvas/100/placement/{}/data"
BINDING = {"datasetId": 13, "metrics": ["count"], "dimensions": ["country"]}
DATA = PlacementData([{"country": "FR", "count": 3}], "SELECT country ...", "sql")


@pytest.fixture
def canvas(
    session: Session, mocker: MockerFixture, widget_types: FakeResolver
) -> Iterator[Any]:
    from superset.canvas.definition.schemas import empty_definition
    from superset.models.canvas import Canvas

    definition = empty_definition()
    definition["root"]["children"] = ["chart", "text"]
    # The chart's binding is saved with its widget, not on the canvas.
    widget_types.props["chart-1"] = {"dataBinding": BINDING}
    definition["nodes"] = {
        "chart": {"widgetId": "chart-1"},
        "text": {"widgetType": "markdown", "props": {}},
    }
    Canvas.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    canvas = Canvas(
        id=100,
        title="Exec overview",
        definition=json.dumps(definition),
        definition_version=1,
        revision=1,
    )
    session.add(canvas)
    session.commit()
    mocker.patch("superset.canvas.filters.security_manager.is_admin", return_value=True)
    yield canvas
    session.rollback()


@pytest.fixture
def run_binding(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "superset.commands.canvas.placement_data.run_binding", return_value=DATA
    )


@pytest.fixture
def can_view_query(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "superset.canvas.api.security_manager.can_access", return_value=True
    )


def test_returns_rows_and_the_query_that_ran(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    can_view_query: MagicMock,
) -> None:
    response = client.post(
        URL.format("chart"),
        json={
            "runtime_filters": [
                {"datasetId": 13, "column": "country", "values": ["FR"]}
            ]
        },
    )

    assert response.status_code == 200
    assert response.json["result"]["datasets"] == [
        {
            "name": "main",
            "row_count": 1,
            "inline_data": [{"country": "FR", "count": 3}],
            "query": "SELECT country ...",
            "language": "sql",
        }
    ]
    binding, filters = run_binding.call_args.args
    assert binding == BINDING
    assert filters == [RuntimeFilter(datasetId=13, column="country", values=["FR"])]
    can_view_query.assert_any_call("can_view_query", "Dashboard")


def test_the_query_needs_view_query(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    can_view_query: MagicMock,
) -> None:
    can_view_query.return_value = False

    response = client.post(URL.format("chart"), json={})

    dataset = response.json["result"]["datasets"][0]
    assert dataset["inline_data"] == [{"country": "FR", "count": 3}]
    assert "query" not in dataset


def test_unknown_and_unbound_placements(
    client: Any, full_api_access: None, canvas: Any, run_binding: MagicMock
) -> None:
    assert client.post(URL.format("missing"), json={}).status_code == 404
    assert client.post(URL.format("text"), json={}).status_code == 422
    run_binding.assert_not_called()


def test_without_dataset_access(
    client: Any, full_api_access: None, canvas: Any, run_binding: MagicMock
) -> None:
    run_binding.side_effect = SupersetSecurityException(MagicMock())

    assert client.post(URL.format("chart"), json={}).status_code == 403


def test_rejects_malformed_filters(
    client: Any, full_api_access: None, canvas: Any, run_binding: MagicMock
) -> None:
    response = client.post(
        URL.format("chart"),
        json={"runtime_filters": [{"datasetId": 13, "column": "", "values": "FR"}]},
    )

    assert response.status_code == 400
    run_binding.assert_not_called()


def test_a_draft_of_another_canvas_is_not_found(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.commands.canvas.placement_data.load_draft",
        return_value=MagicMock(canvas_id=101),
    )

    response = client.post(
        URL.format("chart"), json={}, headers={"X-Canvas-Draft": "token"}
    )

    assert response.status_code == 404
    run_binding.assert_not_called()


def test_runtime_filters_narrow_only_the_bindings_dataset() -> None:
    payload = query_context_payload(
        BINDING,
        [
            RuntimeFilter(datasetId=13, column="country", values=["FR"]),
            RuntimeFilter(datasetId=14, column="country", values=["DE"]),
            RuntimeFilter(datasetId=13, column="deal_size", values=[]),
        ],
    )

    assert payload["queries"][0]["filters"] == [
        {"col": "country", "op": "IN", "val": ["FR"]}
    ]


ADHOC_SUM = {
    "expressionType": "SIMPLE",
    "aggregate": "SUM",
    "column": {"column_name": "amount"},
    "label": "total_amount",
}
AGGREGATE_ROWS = [
    ("E", 1),
    ("A", 7),
    ("G", 18),
    ("C", 3),
    ("B", 35),
    ("D", 27),
    ("F", 14),
    ("B", 29),
    ("C", 8),
    ("E", 4),
    ("F", 34),
    ("G", 23),
    ("A", 11),
    ("D", 12),
    ("G", 19),
    ("F", 42),
    ("D", 31),
    ("E", 5),
    ("B", 36),
    ("A", 22),
    ("C", 9),
]


@pytest.fixture
def aggregate_table(session: Session, tmp_path: Path) -> SqlaTable:
    """Persist shuffled input rows whose aggregate rank differs from row rank."""
    path = tmp_path / "canvas_aggregate_data.db"
    with sqlite3.connect(path) as connection:
        connection.execute(
            "CREATE TABLE amounts (category TEXT, alternate_category TEXT, amount INT)"
        )
        connection.executemany(
            "INSERT INTO amounts VALUES (?, ?, ?)",
            [
                (category, f"group_{category}", amount)
                for category, amount in AGGREGATE_ROWS
            ],
        )

    SqlaTable.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    table = SqlaTable(
        table_name="amounts",
        database=Database(
            database_name="canvas_aggregates", sqlalchemy_uri=f"sqlite:///{path}"
        ),
        columns=[
            TableColumn(column_name="category", type="TEXT", groupby=True),
            TableColumn(column_name="alternate_category", type="TEXT", groupby=True),
            TableColumn(column_name="amount", type="INTEGER"),
        ],
        metrics=[SqlMetric(metric_name="total_amount", expression="SUM(amount)")],
        cache_timeout=-1,
    )
    session.add(table)
    session.commit()
    return table


@pytest.fixture
def aggregate_canvas(
    aggregate_table: SqlaTable, session: Session, mocker: MockerFixture
) -> Canvas:
    """A persisted canvas and widget that use the real database widget resolver."""
    from superset.canvas.definition.schemas import empty_definition

    widget = Widget(
        widget_type="ag-grid-table",
        name="Aggregated amounts",
        props={
            "dataBinding": {
                "datasetId": aggregate_table.id,
                "metrics": ["total_amount"],
                "dimensions": ["category"],
                "orderBy": [{"field": "total_amount", "descending": True}],
                "rowLimit": 5,
            },
            "columnDefs": [{"field": "total_amount", "headerName": "Total amount"}],
        },
    )
    session.add(widget)
    session.flush()
    definition = empty_definition()
    definition["root"]["children"] = ["amounts"]
    definition["nodes"] = {"amounts": {"widgetId": str(widget.uuid), "layout": {}}}
    canvas = Canvas(
        title="Aggregate queries",
        slug="aggregate-queries",
        definition=json.dumps(definition),
        definition_version=1,
        revision=1,
    )
    session.add(canvas)
    session.commit()
    mocker.patch("superset.canvas.filters.security_manager.is_admin", return_value=True)
    mocker.patch("superset.commands.canvas.apply_ops.publish_realtime")
    return canvas


def published_state(session: Session) -> dict[str, Any]:
    """Snapshot persisted Canvas/widget/dataset state around read or rejected calls."""
    return {
        "canvases": [
            (row.id, row.title, row.definition, row.revision)
            for row in session.query(Canvas).order_by(Canvas.id)
        ],
        "widgets": [
            (row.id, str(row.uuid), deepcopy(row.props), row.revision)
            for row in session.query(Widget).order_by(Widget.id)
        ],
        "datasets": [
            (row.id, row.table_name, row.sql, tuple(row.column_names))
            for row in session.query(SqlaTable).order_by(SqlaTable.id)
        ],
        "metrics": [
            (row.id, row.metric_name, row.expression)
            for row in session.query(SqlMetric).order_by(SqlMetric.id)
        ],
    }


@pytest.mark.parametrize("metric", ["total_amount", ADHOC_SUM], ids=["stored", "adhoc"])
@pytest.mark.parametrize(
    "descending, expected",
    [
        (True, [("B", 100), ("F", 90), ("D", 70), ("G", 60), ("A", 40)]),
        (False, [("E", 10), ("C", 20), ("A", 40), ("G", 60), ("D", 70)]),
        (None, None),
    ],
    ids=["top-five", "bottom-five", "limit-without-order"],
)
@pytest.mark.parametrize(
    "view_query", [True, False], ids=["query-visible", "query-hidden"]
)
def test_preview_and_page_execute_the_same_aggregate_query(
    client: Any,
    full_api_access: None,
    aggregate_canvas: Canvas,
    aggregate_table: SqlaTable,
    session: Session,
    mocker: MockerFixture,
    can_view_query: MagicMock,
    metric: str | dict[str, Any],
    descending: bool | None,
    expected: list[tuple[str, int]] | None,
    view_query: bool,
) -> None:
    """Execute both callers through real SQL without publishing changes."""
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl

    widget = session.query(Widget).one()
    props = deepcopy(widget.props)
    binding = props["dataBinding"]
    binding["metrics"] = [deepcopy(metric)]
    if descending is None:
        binding.pop("orderBy")
    else:
        binding["orderBy"] = [{"field": "total_amount", "descending": descending}]
    widget.props = props
    session.commit()
    before = published_state(session)
    can_view_query.return_value = view_query
    run = mocker.spy(ChartDataCommand, "run")
    query = query_context_payload(binding)["queries"][0]

    assert query["metrics"] == [metric]
    assert query["columns"] == ["category"]
    assert query["row_limit"] == 5
    assert query["orderby"] == (
        [] if descending is None else [[metric, not descending]]
    )

    response = client.post(
        f"/api/v1/canvas/{aggregate_canvas.id}/placement/amounts/data", json={}
    )
    assert response.status_code == 200
    page = response.json["result"]["datasets"][0]
    preview, image = _preview_widget_impl(aggregate_canvas.id, "amounts", False)

    assert "error" not in preview
    assert image is None
    assert run.call_count == 2
    assert preview["sample_rows"] == page["inline_data"]
    assert preview["row_count"] == page["row_count"] <= 5
    assert preview["columns"] == ["category", "total_amount"]
    if expected is not None:
        assert page["inline_data"] == [
            {"category": category, "total_amount": total}
            for category, total in expected
        ]
    if view_query:
        assert preview["query"] == page["query"]
        assert preview["query_language"] == page["language"] == "sql"
        sql = page["query"].upper()
        assert "SUM(AMOUNT)" in sql
        if descending is None:
            assert "ORDER BY" not in sql
        else:
            direction = "DESC" if descending else "ASC"
            assert f"ORDER BY TOTAL_AMOUNT {direction}" in sql
    else:
        assert "query" not in preview
        assert "query" not in page
    assert published_state(session) == before
    with aggregate_table.database.get_sqla_engine() as engine:
        with engine.connect() as connection:
            rows = connection.execute(text("SELECT category, amount FROM amounts"))
            assert list(rows) == AGGREGATE_ROWS


def test_replaced_draft_dimension_queries_effective_widget_props(
    client: Any,
    full_api_access: None,
    aggregate_canvas: Canvas,
    session: Session,
    mocker: MockerFixture,
    can_view_query: MagicMock,
) -> None:
    """A complete props replacement uses the draft binding and preserves other props."""
    from cachelib import SimpleCache

    from superset.commands.canvas.draft import CreateCanvasDraftCommand
    from superset.mcp_service.canvas.tool.apply_canvas_draft_ops import (
        _apply_canvas_draft_ops_impl,
    )
    from superset.mcp_service.canvas.tool.canvas_draft_common import describe
    from superset.mcp_service.canvas.tool.get_canvas_draft import _get_canvas_draft_impl
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl

    mocker.patch(
        "superset.commands.canvas.draft.cache_manager",
        SimpleNamespace(explore_form_data_cache=SimpleCache()),
    )
    mocker.patch("superset.commands.canvas.draft.get_user_id", return_value=5)
    before = published_state(session)
    draft = CreateCanvasDraftCommand(aggregate_canvas.id).run()
    widget_id = draft.definition["nodes"]["amounts"]["widgetId"]
    props = deepcopy(
        describe(draft, include_definition=True)["widgets"][widget_id]["props"]
    )
    props["dataBinding"]["dimensions"] = ["alternate_category"]
    changed = _apply_canvas_draft_ops_impl(
        draft.token,
        draft.revision,
        [{"op": "set_props", "id": "amounts", "props": props}],
    )

    assert "error" not in changed
    assert changed["revision"] == draft.revision + 1
    effective = _get_canvas_draft_impl(draft.token, include_resolved=False)
    assert effective["widgets"][widget_id]["props"]["columnDefs"] == props["columnDefs"]
    response = client.post(
        f"/api/v1/canvas/{aggregate_canvas.id}/placement/amounts/data",
        json={},
        headers={"X-Canvas-Draft": draft.token},
    )
    assert response.status_code == 200
    page = response.json["result"]["datasets"][0]
    preview, _ = _preview_widget_impl(
        aggregate_canvas.id, "amounts", False, draft_token=draft.token
    )

    expected = [
        {"alternate_category": f"group_{category}", "total_amount": amount}
        for category, amount in [("B", 100), ("F", 90), ("D", 70), ("G", 60), ("A", 40)]
    ]
    assert page["inline_data"] == preview["sample_rows"] == expected
    assert page["query"] == preview["query"]
    assert published_state(session) == before


@pytest.mark.parametrize(
    "title, ops, error_path",
    [
        ("", None, None),
        (
            "Invalid canonical operation",
            [
                {"op": "add", "id": "first", "widgetType": "ag-grid-table"},
                {"op": "remove"},
                {"op": "add", "id": "last", "widgetType": "markdown"},
            ],
            "/ops/1/id",
        ),
        (
            "Invalid middle operation",
            [
                {"op": "add", "id": "first", "widgetType": "ag-grid-table"},
                {"op": "remove", "id": "missing"},
                {"op": "add", "id": "last", "widgetType": "markdown"},
            ],
            "/ops/1",
        ),
    ],
    ids=["metadata", "canonical-operations", "definition-operations"],
)
def test_initial_create_failure_leaves_no_persisted_objects(
    aggregate_canvas: Canvas,
    aggregate_table: SqlaTable,
    session: Session,
    title: str,
    ops: list[dict[str, Any]] | None,
    error_path: str | None,
) -> None:
    """Failed initial operations retain neither the new canvas nor staged widgets."""
    from superset.mcp_service.canvas.tool.create_canvas import _create_canvas_impl

    before = published_state(session)
    operations = deepcopy(ops)
    if operations:
        operations[0]["props"] = {
            "dataBinding": {
                "datasetId": aggregate_table.id,
                "metrics": ["total_amount"],
            }
        }
    result = _create_canvas_impl(title, None, None, operations)

    assert "error" in result
    if error_path is not None:
        assert any(error["path"] == error_path for error in result["errors"])
    assert published_state(session) == before
