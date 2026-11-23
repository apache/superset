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
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
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
            "coltypes": {},
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


NAMED = {"datasetId": 14, "metrics": ["revenue"], "dimensions": ["region"]}
BY_REGION = PlacementData([{"region": "EMEA", "revenue": 12}], None, None)


def test_every_query_the_widget_type_builds_answers_as_a_named_dataset(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    can_view_query: MagicMock,
    mocker: MockerFixture,
) -> None:
    from superset_core.widgets import QueryRequest, WidgetQuery

    from superset.widgets.registry import registry

    build = MagicMock(
        return_value=[WidgetQuery("main", BINDING), WidgetQuery("by_region", NAMED)]
    )
    mocker.patch.object(registry["chart"], "build_queries", build)
    run_binding.side_effect = [DATA, BY_REGION]
    filters = [{"datasetId": 14, "column": "region", "values": ["EMEA"]}]

    response = client.post(URL.format("chart"), json={"runtime_filters": filters})

    assert response.status_code == 200
    datasets = response.json["result"]["datasets"]
    assert [(d["name"], d["inline_data"]) for d in datasets] == [
        ("main", DATA.rows),
        ("by_region", BY_REGION.rows),
    ]
    runtime = [RuntimeFilter.model_validate(f) for f in filters]
    assert [call.args for call in run_binding.call_args_list] == [
        (BINDING, runtime),
        (NAMED, runtime),
    ]
    build.assert_called_once_with(
        QueryRequest(
            canvas_id="100",
            placement_id="chart",
            props={"dataBinding": BINDING},
            widget_id="chart-1",
        )
    )


@pytest.mark.parametrize("binding", ["by_region", None])
def test_the_caller_cannot_pick_a_query(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    binding: Any,
) -> None:
    response = client.post(URL.format("chart"), json={"binding": binding})

    assert response.status_code == 400
    run_binding.assert_not_called()


@pytest.mark.parametrize(
    "unbound",
    [{"metrics": ["count"]}, {"datasetId": "13"}, ["datasetId", 13]],
    ids=["no-dataset", "dataset-not-an-id", "not-a-binding"],
)
def test_a_built_query_is_checked_like_one_from_the_props(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    can_view_query: MagicMock,
    mocker: MockerFixture,
    unbound: Any,
) -> None:
    from superset_core.widgets import WidgetQuery

    from superset.widgets.registry import registry

    build = MagicMock(return_value=[WidgetQuery("draft", unbound)])
    mocker.patch.object(registry["chart"], "build_queries", build)

    # A widget none of whose queries is bound has no data.
    assert client.post(URL.format("chart"), json={}).status_code == 422
    run_binding.assert_not_called()

    build.return_value = [WidgetQuery("draft", unbound), WidgetQuery("main", NAMED)]
    response = client.post(URL.format("chart"), json={})

    assert [d["name"] for d in response.json["result"]["datasets"]] == ["main"]
    assert run_binding.call_args.args[0] == NAMED


def test_a_widget_type_that_names_a_query_twice_fails(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    mocker: MockerFixture,
) -> None:
    from superset_core.widgets import WidgetQuery

    from superset.widgets.registry import registry

    mocker.patch.object(
        registry["chart"],
        "build_queries",
        MagicMock(return_value=[WidgetQuery("main", BINDING)] * 2),
    )

    assert client.post(URL.format("chart"), json={}).status_code == 500
    run_binding.assert_not_called()


def test_one_failing_query_fails_the_request(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    mocker: MockerFixture,
) -> None:
    from superset_core.widgets import WidgetQuery

    from superset.widgets.registry import registry

    mocker.patch.object(
        registry["chart"],
        "build_queries",
        MagicMock(
            return_value=[WidgetQuery("main", BINDING), WidgetQuery("secret", NAMED)]
        ),
    )
    run_binding.side_effect = [
        DATA,
        SupersetSecurityException(
            SupersetError(
                message="no access to the dataset",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        ),
    ]

    assert client.post(URL.format("chart"), json={}).status_code == 403


@pytest.mark.parametrize("status", [409, 403])
def test_a_widget_type_refuses_with_its_code_and_message(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    mocker: MockerFixture,
    status: int,
) -> None:
    from superset_core.widgets import WidgetQueryRefusedError

    from superset.widgets.registry import registry

    mocker.patch.object(
        registry["chart"],
        "build_queries",
        MagicMock(
            side_effect=WidgetQueryRefusedError(
                "CONTENT_CHANGED", "This widget changed: reload it", status
            )
        ),
    )
    report = mocker.patch("superset.canvas.api._report_canvas_error")

    response = client.post(URL.format("chart"), json={})

    assert response.status_code == status
    assert response.json == {
        "message": "This widget changed: reload it",
        "error_type": "WidgetQueryRefused",
        "code": "CONTENT_CHANGED",
    }
    run_binding.assert_not_called()
    assert report.call_args.args[2] == status


def test_an_already_classified_failure_keeps_its_classification() -> None:
    from superset.canvas.query_errors import (
        canvas_query_error,
        CanvasQueryError,
        CanvasQueryFailedError,
    )

    error = CanvasQueryError(403, "DatasetNotAccessible", "No access")

    assert canvas_query_error(CanvasQueryFailedError(error)) is error


def test_a_widget_type_learns_the_placement_comes_from_the_callers_draft(
    client: Any,
    full_api_access: None,
    canvas: Any,
    widget_types: FakeResolver,
    run_binding: MagicMock,
    can_view_query: MagicMock,
    mocker: MockerFixture,
) -> None:
    from superset_core.widgets import Widget

    from superset.widgets.registry import registry

    build = MagicMock(side_effect=Widget.build_queries)
    mocker.patch.object(registry["chart"], "build_queries", build)
    mocker.patch(
        "superset.commands.canvas.placement_data.load_draft",
        return_value=MagicMock(
            canvas_id=100,
            definition={"nodes": {"chart": {"widgetId": "chart-1"}}},
            resolver=lambda: widget_types,
        ),
    )

    headers = {"X-Canvas-Draft": "token"}

    response = client.post(URL.format("chart"), json={}, headers=headers)

    assert response.status_code == 200
    [request] = [call.args[0] for call in build.call_args_list]
    assert request.draft_token == headers["X-Canvas-Draft"]
    assert request.widget_id == "chart-1"


@pytest.mark.parametrize(
    "caller, status",
    [("viewer", 200), ("stranger", 404), ("guest", 404)],
)
def test_data_follows_canvas_read_access(
    client: Any,
    full_api_access: None,
    canvas: Any,
    session: Session,
    run_binding: MagicMock,
    mocker: MockerFixture,
    caller: str,
    status: int,
) -> None:
    """The data endpoint walks the same access path as reading the canvas."""
    from superset.subjects.models import Subject

    viewer = Subject(id=1, label="viewer", type=1)
    canvas.viewers = [viewer]
    session.commit()
    mocker.patch(
        "superset.canvas.filters.security_manager.is_admin", return_value=False
    )
    mocker.patch(
        "superset.canvas.filters.security_manager.is_guest_user",
        return_value=caller == "guest",
    )
    mocker.patch("superset.subjects.filters.get_user_id", return_value=7)
    mocker.patch(
        "superset.subjects.utils.get_user_subject_ids_subquery",
        return_value=[1] if caller in {"viewer", "guest"} else [2],
    )

    response = client.post(URL.format("chart"), json={})

    assert response.status_code == status
    assert run_binding.called is (status == 200)


def test_without_dataset_access(
    client: Any, full_api_access: None, canvas: Any, run_binding: MagicMock
) -> None:
    run_binding.side_effect = SupersetSecurityException(
        SupersetError(
            message="Dataset access denied",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )

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


@pytest.mark.parametrize(
    "override",
    [
        pytest.param({"datasetId": 99}, id="dataset"),
        pytest.param({"dataBinding": {"datasetId": 99}}, id="binding"),
        pytest.param({"datasource": {"id": 99, "type": "table"}}, id="datasource"),
        pytest.param({"user_id": 1}, id="user"),
        pytest.param({"actor": {"id": 1}}, id="actor"),
        pytest.param({"async": True}, id="async"),
    ],
)
def test_placement_request_cannot_replace_source_or_actor(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    override: dict[str, Any],
) -> None:
    """Reject execution context supplied outside the stored placement binding."""
    response = client.post(URL.format("chart"), json=override)

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


def test_a_built_query_runs_as_the_caller_with_their_dataset_access(
    client: Any,
    full_api_access: None,
    aggregate_canvas: Canvas,
    aggregate_table: SqlaTable,
    session: Session,
    mocker: MockerFixture,
    can_view_query: MagicMock,
) -> None:
    """A widget type builds the query; the chart data pipeline still runs it as
    the caller, and checks their access to its dataset."""
    from superset_core.widgets import QueryRequest, WidgetQuery

    from superset.extensions import security_manager
    from superset.widgets.registry import registry

    top_two = {
        "datasetId": aggregate_table.id,
        "metrics": ["total_amount"],
        "dimensions": ["category"],
        "orderBy": [{"field": "total_amount", "descending": True}],
        "rowLimit": 2,
    }

    def build(request: QueryRequest) -> list[WidgetQuery]:
        return [WidgetQuery("top_two", top_two)]

    mocker.patch.object(registry["ag-grid-table"], "build_queries", build)
    url = f"/api/v1/canvas/{aggregate_canvas.id}/placement/amounts/data"
    before = published_state(session)

    response = client.post(url, json={})

    assert response.status_code == 200
    [dataset] = response.json["result"]["datasets"]
    assert dataset["name"] == "top_two"
    assert dataset["inline_data"] == [
        {"category": "B", "total_amount": 100},
        {"category": "F", "total_amount": 90},
    ]
    denied = mocker.patch.object(
        security_manager,
        "raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                message="no access to the dataset",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        ),
    )
    assert client.post(url, json={}).status_code == 403
    assert denied.call_args.kwargs["query_context"].datasource.id == aggregate_table.id
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
    mocker: MockerFixture,
) -> None:
    """Failed initial operations retain neither the new canvas nor staged widgets."""
    from cachelib import SimpleCache

    from superset.mcp_service.canvas.tool.create_canvas import _create_canvas_impl

    mocker.patch(
        "superset.commands.canvas.draft.cache_manager",
        SimpleNamespace(explore_form_data_cache=SimpleCache()),
    )
    mocker.patch("superset.commands.canvas.draft.get_user_id", return_value=5)
    mocker.patch("superset.security_manager.can_access_datasource", return_value=True)
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


@pytest.mark.parametrize("family", ["canvas", "future", "query-shaped", "unexpected"])
def test_command_does_not_classify_definition_validation_failures(
    mocker: MockerFixture,
    family: str,
) -> None:
    """Only query execution failures belong to the query transport contract."""
    from superset.commands.canvas.exceptions import CanvasInvalidError
    from superset.commands.canvas.placement_data import GetPlacementDataCommand
    from superset.exceptions import QueryObjectValidationError

    class FutureCanvasValidationError(CanvasInvalidError):
        """A later Canvas validation error must not require an API allowlist."""

    error = {
        "canvas": CanvasInvalidError(),
        "future": FutureCanvasValidationError(),
        "query-shaped": QueryObjectValidationError("Invalid definition field"),
        "unexpected": RuntimeError("Definition resolution failed"),
    }[family]
    mocker.patch.object(GetPlacementDataCommand, "validate", side_effect=error)
    query = mocker.patch("superset.commands.canvas.placement_data.run_binding")

    with pytest.raises(type(error)) as exc_info:
        GetPlacementDataCommand("100", "chart", []).run()

    assert exc_info.value is error
    query.assert_not_called()


def test_command_query_failure_retains_classification_and_original_traceback(
    mocker: MockerFixture,
) -> None:
    """A validated binding wraps only its query error, preserving the cause."""
    from superset.canvas.query_errors import CanvasQueryFailedError
    from superset.commands.canvas.placement_data import GetPlacementDataCommand
    from superset.exceptions import SupersetParseError

    mocker.patch("superset.security_manager.is_guest_user", return_value=False)
    validated = False

    def validate(command: GetPlacementDataCommand) -> None:
        nonlocal validated
        validated = True
        command._bindings = {"main": {"datasetId": 13}}

    error = SupersetParseError("SELECT broken", message="Repair the saved expression")

    def query(*args: Any) -> None:
        assert validated
        raise error

    mocker.patch.object(
        GetPlacementDataCommand, "validate", autospec=True, side_effect=validate
    )
    mocker.patch(
        "superset.commands.canvas.placement_data.run_binding", side_effect=query
    )
    with pytest.raises(CanvasQueryFailedError) as exc_info:
        GetPlacementDataCommand("100", "chart", []).run()

    assert exc_info.value.__cause__ is error
    assert exc_info.value.error.status == 422
    assert exc_info.value.error.error_type == "QueryError"
    assert (
        exc_info.value.error.errors[0].error_type == SupersetErrorType.INVALID_SQL_ERROR
    )
