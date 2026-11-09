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

"""Tests for the canvas MCP tools."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from superset.app import SupersetApp
from superset.canvas.data import PlacementData
from superset.mcp_service.canvas.tool.get_canvas import _get_canvas_impl

DAO = "superset.mcp_service.canvas.tool.get_canvas.CanvasDAO"
BASE_URL = "https://workspace.example/prefix"


@pytest.fixture(autouse=True)
def workspace_url(app: SupersetApp) -> None:
    app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = f"{BASE_URL}/"


def test_get_canvas_is_lean_unless_resolution_is_asked_for() -> None:
    canvas = MagicMock(id=1, title="Sales", url="/canvas/1/", revision=2)
    definition = {
        "version": 1,
        "root": {"layout": {"columns": 24}, "children": []},
        "nodes": {},
    }
    with patch(DAO) as dao:
        dao.find_by_id_or_uuid.return_value = canvas
        dao.load.return_value = definition
        lean = _get_canvas_impl(1, include_resolved=False)
        full = _get_canvas_impl(1, include_resolved=True)

    assert set(lean) == {"id", "title", "url", "revision", "definition"}
    assert {"placements", "filterScopes", "widgetTypes"} <= set(full)


def test_get_canvas_hides_missing_or_inaccessible_canvases() -> None:
    with patch(DAO) as dao:
        dao.find_by_id_or_uuid.return_value = None
        assert _get_canvas_impl(9, include_resolved=False) == {
            "error": "Canvas 9 not found, or no access to it",
            "error_type": "CanvasNotFoundError",
        }


CREATE = "superset.mcp_service.canvas.tool.create_canvas"
UPDATE = "superset.mcp_service.canvas.tool.update_canvas"


def test_list_canvases_returns_summaries() -> None:
    from superset.mcp_service.canvas.tool.list_canvases import _list_canvases_impl

    canvas = MagicMock(
        id=1,
        title="Sales",
        slug="sales",
        url="/canvas/sales/",
        revision=3,
        description=None,
        changed_on=None,
    )
    with patch("superset.mcp_service.canvas.tool.list_canvases.CanvasDAO") as dao:
        dao.list.return_value = ([canvas], 1)
        result = _list_canvases_impl("sal", page=1, page_size=500)

    assert dao.list.call_args.kwargs["search"] == "sal"
    assert dao.list.call_args.kwargs["page"] == 0
    assert dao.list.call_args.kwargs["page_size"] == 100
    assert result["count"] == 1
    assert result["canvases"][0]["url"] == f"{BASE_URL}/canvas/sales/"


def test_create_canvas_puts_initial_ops_in_a_draft() -> None:
    from superset.mcp_service.canvas.tool.create_canvas import _create_canvas_impl

    canvas = MagicMock(id=5, url="/canvas/demo/", revision=0)
    draft = MagicMock(token="tok", revision=0)  # noqa: S106
    with (
        patch(f"{CREATE}.CreateCanvasCommand") as create,
        patch(f"{CREATE}.CreateCanvasDraftCommand") as create_draft,
        patch(f"{CREATE}._apply_canvas_draft_ops_impl") as apply,
        patch(f"{CREATE}.draft_url", return_value=f"{BASE_URL}/canvas/demo/#draft=tok"),
    ):
        create.return_value.run.return_value = canvas
        create_draft.return_value.run.return_value = draft
        apply.return_value = {
            "draft_revision": 1,
            "ops": [{"op": "add", "id": "intro"}],
            "placements": {},
        }
        result = _create_canvas_impl("Demo", "demo", None, [{"op": "add"}])

    assert create.call_args.args[0] == {"title": "Demo", "slug": "demo"}
    create_draft.assert_called_once_with(5)
    apply.assert_called_once_with("tok", 0, [{"op": "add"}])
    assert result == {
        "id": 5,
        "url": f"{BASE_URL}/canvas/demo/",
        "revision": 0,
        "token": "tok",
        "draft_url": f"{BASE_URL}/canvas/demo/#draft=tok",
        "draft_revision": 1,
        "ops": [{"op": "add", "id": "intro"}],
    }


def test_create_canvas_rolls_back_when_initial_ops_fail() -> None:
    from superset.mcp_service.canvas.tool.create_canvas import _create_canvas_impl

    with (
        patch(f"{CREATE}.CreateCanvasCommand") as create,
        patch(f"{CREATE}.DeleteCanvasCommand") as delete,
        patch(f"{CREATE}.CreateCanvasDraftCommand") as create_draft,
        patch(f"{CREATE}.DeleteCanvasDraftCommand") as delete_draft,
        patch(f"{CREATE}._apply_canvas_draft_ops_impl") as apply,
    ):
        create.return_value.run.return_value = MagicMock(id=5, revision=0)
        create_draft.return_value.run.return_value = MagicMock(token="tok", revision=0)  # noqa: S106
        apply.return_value = {"error": "Invalid operations", "operation": 0}
        result = _create_canvas_impl("Demo", None, None, [{"op": "add"}])

    delete_draft.assert_called_once_with("tok")
    delete.assert_called_once_with([5])
    assert result == {"error": "Invalid operations", "operation": 0}


def test_create_canvas_reports_invalid_metadata() -> None:
    from superset.mcp_service.canvas.tool.create_canvas import _create_canvas_impl

    with patch(f"{CREATE}.CreateCanvasCommand") as create:
        result = _create_canvas_impl("", None, None, None)

    create.assert_not_called()
    assert result["error"] == "Invalid canvas"


def test_update_canvas_changes_only_given_fields() -> None:
    from superset.mcp_service.canvas.tool.update_canvas import _update_canvas_impl

    with (
        patch(f"{UPDATE}.CanvasDAO") as dao,
        patch(f"{UPDATE}.UpdateCanvasCommand") as update,
    ):
        dao.find_by_id_or_uuid.return_value = MagicMock(id=5)
        update.return_value.run.return_value = MagicMock(
            id=5, url="/canvas/5/", revision=4
        )
        result = _update_canvas_impl("5", {"title": "Renamed"})

    update.assert_called_once_with(5, {"title": "Renamed"})
    assert result == {"id": 5, "url": f"{BASE_URL}/canvas/5/", "revision": 4}


def test_update_canvas_needs_editorship() -> None:
    from superset.commands.canvas.exceptions import CanvasForbiddenError
    from superset.mcp_service.canvas.tool.update_canvas import _update_canvas_impl

    with (
        patch(f"{UPDATE}.CanvasDAO") as dao,
        patch(f"{UPDATE}.UpdateCanvasCommand") as update,
    ):
        dao.find_by_id_or_uuid.return_value = MagicMock(id=5)
        update.return_value.run.side_effect = CanvasForbiddenError()
        result = _update_canvas_impl("5", {"title": "Renamed"})

    assert "editors" in result["error"]
    assert result["error_type"] == "CanvasForbiddenError"


PREVIEW = "superset.mcp_service.canvas.tool.preview_widget"
REVENUE = {"expressionType": "SQL", "sqlExpression": "SUM(sales)", "label": "revenue"}


def _preview_canvas(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": 1,
        "root": {"layout": {"columns": 24}, "children": ["chart"]},
        "nodes": {"chart": {**node, "layout": {"colSpan": 12, "rowSpan": 8}}},
    }


def test_preview_query_matches_the_canvas_request() -> None:
    from superset.canvas.data import query_context_payload

    payload = query_context_payload(
        {
            "datasetId": 13,
            "metrics": [REVENUE],
            "dimensions": ["country"],
            "filters": [
                {"expressionType": "SQL", "sqlExpression": "territory IS NOT NULL"},
                {"subject": "deal_size", "operator": "IN", "comparator": ["Large"]},
            ],
            "orderBy": [{"field": "revenue", "descending": True}],
            "rowLimit": 5,
        }
    )

    query = payload["queries"][0]
    assert payload["datasource"] == {"id": 13, "type": "table"}
    assert query["columns"] == ["country"]
    assert query["filters"] == [{"col": "deal_size", "op": "IN", "val": ["Large"]}]
    assert query["extras"] == {"where": "(territory IS NOT NULL)"}
    assert query["orderby"] == [[REVENUE, False]]
    assert query["row_limit"] == 5


def test_preview_without_a_renderer_returns_rows_only() -> None:
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl

    node = {
        "widgetType": "echarts",
        "props": {"dataBinding": {"datasetId": 13, "metrics": [REVENUE]}},
    }
    rows = [{"revenue": float(i)} for i in range(12)]
    with (
        patch(f"{PREVIEW}.CanvasDAO") as dao,
        patch(f"{PREVIEW}.run_binding", return_value=PlacementData(rows, None, None)),
        patch(f"{PREVIEW}.current_app") as app,
        patch(f"{PREVIEW}._render") as render,
    ):
        dao.load.return_value = _preview_canvas(node)
        app.config = {"CANVAS_WIDGET_RENDERER_URL": None}
        result, image = _preview_widget_impl(1, "chart", dark=False)

    render.assert_not_called()
    assert image is None
    assert result["row_count"] == 12
    assert len(result["sample_rows"]) == 10
    assert result["columns"] == ["revenue"]


def test_preview_warns_about_an_option_with_nothing_to_draw() -> None:
    """Without a renderer the agent can't see empty axes, so say so."""
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl

    def preview(props: dict[str, Any]) -> list[str]:
        node = {"widgetType": "echarts", "props": props}
        with (
            patch(f"{PREVIEW}.CanvasDAO") as dao,
            patch(
                f"{PREVIEW}.run_binding",
                return_value=PlacementData([{"x": 1}], None, None),
            ),
            patch(f"{PREVIEW}.current_app") as app,
        ):
            dao.load.return_value = _preview_canvas(node)
            app.config = {"CANVAS_WIDGET_RENDERER_URL": None}
            result, _ = _preview_widget_impl(1, "chart", dark=False)
        return result.get("warnings", [])

    binding = {"datasetId": 13, "metrics": [REVENUE]}
    assert any(
        "no series" in warning
        for warning in preview({"dataBinding": binding, "echartsOptions": {}})
    )
    assert preview({"dataBinding": binding, "chartType": "line"}) == []
    assert (
        preview(
            {
                "dataBinding": binding,
                "echartsOptions": {"series": [{"type": "bar"}]},
            }
        )
        == []
    )


def test_preview_reads_the_widget_a_placement_holds() -> None:
    from superset_core.canvas import StoredWidget

    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl

    binding = {"datasetId": 13, "metrics": [REVENUE]}
    resolver = MagicMock()
    resolver.widgets.return_value = {
        "w1": StoredWidget("echarts", 1, "Revenue", {"dataBinding": binding})
    }
    with (
        patch(f"{PREVIEW}.CanvasDAO") as dao,
        patch(f"{PREVIEW}.get_widget_resolver", return_value=resolver),
        patch(
            f"{PREVIEW}.run_binding", return_value=PlacementData([], None, None)
        ) as run,
        patch(f"{PREVIEW}.current_app") as app,
    ):
        dao.load.return_value = _preview_canvas({"widgetId": "w1"})
        app.config = {"CANVAS_WIDGET_RENDERER_URL": None}
        result, _ = _preview_widget_impl(1, "chart", dark=False)

    assert result["widget_type"] == "echarts"
    assert run.call_args.args[0] == binding


def test_preview_merges_renderer_warnings_and_image() -> None:
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl

    node = {
        "widgetType": "echarts",
        "props": {
            "dataBinding": {"datasetId": 13, "metrics": [REVENUE]},
            "chartType": "bar",
        },
    }
    with (
        patch(f"{PREVIEW}.CanvasDAO") as dao,
        patch(f"{PREVIEW}.run_binding", return_value=PlacementData([], None, None)),
        patch(f"{PREVIEW}.current_app") as app,
        patch(f"{PREVIEW}._render") as render,
    ):
        dao.load.return_value = _preview_canvas(node)
        app.config = {"CANVAS_WIDGET_RENDERER_URL": "http://renderer"}
        render.return_value = {
            "png": "aGk=",
            "width": 672,
            "height": 600,
            "option": {"series": []},
            "warnings": ["Tooltip prints [object Object]"],
        }
        result, image = _preview_widget_impl(1, "chart", dark=True)

    assert image == "aGk="
    assert result["warnings"] == [
        "The widget's query returned no rows",
        "Tooltip prints [object Object]",
    ]
    assert result["image"] == "attached, 672x600 PNG"


def test_preview_reports_unknown_placements() -> None:
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl

    with patch(f"{PREVIEW}.CanvasDAO") as dao:
        dao.load.return_value = _preview_canvas({"widgetType": "markdown"})
        result, _ = _preview_widget_impl(1, "nope", dark=False)

    assert "No placement" in result["error"]


def test_create_canvas_draft_returns_a_token_and_a_fragment_url() -> None:
    from superset.commands.canvas.draft import CanvasDraft
    from superset.mcp_service.canvas.tool.create_canvas_draft import (
        _create_canvas_draft_impl,
    )

    draft = CanvasDraft(
        token="tok",  # noqa: S106
        owner_id=1,
        canvas_id=7,
        base_revision=3,
        revision=0,
        definition={"version": 1, "root": {}, "nodes": {}},
    )
    with (
        patch(
            "superset.mcp_service.canvas.tool.create_canvas_draft."
            "CreateCanvasDraftCommand"
        ) as command,
        patch("superset.mcp_service.canvas.tool.canvas_draft_common.CanvasDAO") as dao,
    ):
        command.return_value.run.return_value = draft
        dao.find_by_id.return_value = MagicMock(url="/canvas/sales/")
        result = _create_canvas_draft_impl(7)

    assert result["token"] == "tok"  # noqa: S105
    assert result["url"] == f"{BASE_URL}/canvas/sales/#draft=tok"
    assert (result["base_revision"], result["revision"]) == (3, 0)


def test_draft_errors_come_back_as_data() -> None:
    from superset.commands.canvas.exceptions import (
        CanvasDraftNotFoundError,
        DraftConflictError,
    )
    from superset.mcp_service.canvas.tool.commit_canvas_draft import (
        _commit_canvas_draft_impl,
    )

    module = "superset.mcp_service.canvas.tool.commit_canvas_draft"
    with patch(f"{module}.load_draft", side_effect=CanvasDraftNotFoundError()):
        assert "not found" in _commit_canvas_draft_impl("tok", 1)["error"]

    with (
        patch(f"{module}.load_draft"),
        patch(f"{module}.CommitCanvasDraftCommand") as command,
    ):
        command.return_value.run.side_effect = DraftConflictError(
            5, canvas_changed=True, draft_revision=1, current_canvas_revision=5
        )
        result = _commit_canvas_draft_impl("tok", 1)

    assert result["canvas_changed"] is True
    assert result["revision"] == result["current_canvas_revision"] == 5
    assert result["draft_revision"] == 1
    assert all(key.islower() for key in result)


def test_preview_returns_the_query_to_users_who_can_view_queries() -> None:
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl

    node = {
        "widgetType": "metric-tile",
        "props": {"dataBinding": {"datasetId": 13, "metrics": [REVENUE]}},
    }
    data = PlacementData([{"revenue": 1.0}], "SELECT SUM(price) FROM sales", "sql")
    for allowed, expected in ((True, data.query), (False, None)):
        with (
            patch(f"{PREVIEW}.CanvasDAO") as dao,
            patch(f"{PREVIEW}.run_binding", return_value=data),
            # A LocalProxy would otherwise be patched with an AsyncMock.
            patch(f"{PREVIEW}.security_manager", new_callable=MagicMock) as security,
        ):
            dao.load.return_value = _preview_canvas(node)
            security.can_access.return_value = allowed
            result, _ = _preview_widget_impl(1, "chart", dark=False)

        security.can_access.assert_called_with("can_view_query", "Dashboard")
        assert result.get("query") == expected


def test_preview_says_when_the_renderer_failed() -> None:
    import requests

    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl

    node = {
        "widgetType": "echarts",
        "props": {
            "dataBinding": {"datasetId": 13, "metrics": [REVENUE]},
            "chartType": "bar",
        },
    }
    with (
        patch(f"{PREVIEW}.CanvasDAO") as dao,
        patch(f"{PREVIEW}.run_binding", return_value=PlacementData([{}], None, None)),
        patch(f"{PREVIEW}.current_app") as app,
        patch(f"{PREVIEW}._render", side_effect=requests.ConnectionError("refused")),
    ):
        dao.load.return_value = _preview_canvas(node)
        app.config = {"CANVAS_WIDGET_RENDERER_URL": "http://renderer"}
        result, image = _preview_widget_impl(1, "chart", dark=False)

    assert image is None
    assert result["rendered"] is False
    assert "error_type" not in result
    assert "error" not in result
    assert "not checked visually" in result["warnings"][0]


DRAFT_TOOL = "superset.mcp_service.canvas.tool.apply_canvas_draft_ops"


def test_apply_draft_ops_returns_placements_and_what_got_pushed() -> None:
    from superset.commands.canvas.draft import CanvasDraft
    from superset.mcp_service.canvas.tool.apply_canvas_draft_ops import (
        _apply_canvas_draft_ops_impl,
    )

    draft = CanvasDraft(
        token="tok",  # noqa: S106
        owner_id=1,
        canvas_id=7,
        base_revision=3,
        revision=1,
        definition={},
    )
    a = {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 4}
    b = {"col": 13, "row": 1, "colSpan": 12, "rowSpan": 4}
    pushed = {**b, "row": 5}
    with (
        patch(f"{DRAFT_TOOL}.load_draft"),
        patch(f"{DRAFT_TOOL}.ApplyCanvasDraftOperationsCommand") as command,
        patch(
            f"{DRAFT_TOOL}.render_context",
            side_effect=[
                {"placements": {"a": a, "b": b}, "gridColumns": {}},
                {
                    "placements": {"a": {**a, "colSpan": 24}, "b": pushed},
                    "gridColumns": {},
                },
            ],
        ),
        patch("superset.mcp_service.canvas.tool.canvas_draft_common.CanvasDAO"),
    ):
        command.return_value.run.return_value = (
            draft,
            [{"op": "place", "id": "a", "layout": {**a, "colSpan": 24}}],
        )
        result = _apply_canvas_draft_ops_impl(
            "tok", 0, [{"op": "place", "id": "a", "layout": {**a, "colSpan": 24}}]
        )

    assert result["displaced"] == ["b"]
    assert result["placements"]["b"] == pushed
    assert result["revision"] == 1


def test_apply_draft_ops_echoes_ids_but_not_props() -> None:
    from superset.commands.canvas.draft import CanvasDraft
    from superset.mcp_service.canvas.tool.apply_canvas_draft_ops import (
        _apply_canvas_draft_ops_impl,
    )

    draft = CanvasDraft(
        token="tok",  # noqa: S106
        owner_id=1,
        canvas_id=7,
        base_revision=3,
        revision=1,
        definition={},
    )
    op = {"op": "add", "widgetType": "markdown", "props": {"content": "Hi"}}
    with (
        patch(f"{DRAFT_TOOL}.load_draft"),
        patch(f"{DRAFT_TOOL}.ApplyCanvasDraftOperationsCommand") as command,
        patch(
            f"{DRAFT_TOOL}.render_context",
            return_value={"placements": {}, "gridColumns": {}},
        ),
        patch("superset.mcp_service.canvas.tool.canvas_draft_common.CanvasDAO"),
    ):
        command.return_value.run.return_value = (draft, [{**op, "id": "markdown"}])
        result = _apply_canvas_draft_ops_impl("tok", 0, [op])

    assert result["ops"] == [{"op": "add", "widgetType": "markdown", "id": "markdown"}]


def test_commit_returns_the_canvas_url_and_revision() -> None:
    from superset.mcp_service.canvas.tool.commit_canvas_draft import (
        _commit_canvas_draft_impl,
    )

    module = "superset.mcp_service.canvas.tool.commit_canvas_draft"
    with (
        patch(f"{module}.load_draft") as load,
        patch(f"{module}.CommitCanvasDraftCommand") as command,
        patch(f"{module}.CanvasDAO") as dao,
    ):
        load.return_value.canvas_id = 7
        load.return_value.base_revision = 3
        command.return_value.run.return_value = MagicMock(revision=9)
        # A later published write must not replace the commit's own revision.
        dao.find_by_id.return_value = MagicMock(url="/canvas/sales/", revision=10)
        result = _commit_canvas_draft_impl("tok", 1)

    assert result == {
        "canvas_id": 7,
        "url": f"{BASE_URL}/canvas/sales/",
        "canvas_revision": 9,
    }


def test_responses_leave_out_empty_fields() -> None:
    from superset.mcp_service.canvas.schemas import CanvasDraftResponse

    response = CanvasDraftResponse.model_validate({"canvas_id": 7, "revision": 2})

    assert response.model_dump() == {"canvas_id": 7, "revision": 2}


@pytest.mark.parametrize("slug", [None, "sales"])
def test_canvas_urls_follow_each_workspace_without_losing_prefixes(
    app: SupersetApp, slug: str | None
) -> None:
    from superset.mcp_service.canvas.tool.canvas_ops_common import absolute_url
    from superset.models.canvas import Canvas

    canvas = Canvas(id=7, slug=slug)
    for base in ("https://first.example/", "https://second.example/superset/"):
        app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = base
        expected = f"{base.rstrip('/')}/canvas/{slug or 7}/"
        assert absolute_url(canvas.url) == expected
        assert (
            absolute_url(f"{canvas.url}#draft=draft-token")
            == f"{expected}#draft=draft-token"
        )
        assert canvas.url == f"/canvas/{slug or 7}/"


def test_preview_resolves_the_drafts_authorized_canvas_once() -> None:
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl
    from superset.models.canvas import Canvas

    draft = MagicMock(canvas_id=7, token="tok")  # noqa: S106
    draft.definition = _preview_canvas({"widgetId": "saved"})
    draft.resolver.return_value.widgets.return_value = {
        "saved": MagicMock(widget_type="markdown", props={})
    }
    with (
        patch(f"{PREVIEW}.load_draft", return_value=draft) as load,
        patch(f"{PREVIEW}.CanvasDAO") as dao,
    ):
        dao.find_by_id.return_value = Canvas(id=7, slug="authorized")
        result, image = _preview_widget_impl(999, "chart", False, "tok")

    load.assert_called_once_with("tok")
    dao.find_by_id.assert_called_once_with(7)
    dao.find_by_id_or_uuid.assert_not_called()
    assert result["canvas_id"] == 7
    assert result["url"] == f"{BASE_URL}/canvas/authorized/#draft=tok"
    assert image is None


@pytest.mark.parametrize(
    "exception_name",
    [
        "CanvasDraftNotFoundError",
        "CanvasNotFoundError",
        "CanvasForbiddenError",
    ],
)
def test_preview_unavailable_drafts_never_return_canvas_identity(
    exception_name: str,
) -> None:
    from superset.commands.canvas import exceptions
    from superset.mcp_service.canvas.tool.canvas_draft_common import NOT_FOUND
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl

    with patch(
        f"{PREVIEW}.load_draft", side_effect=getattr(exceptions, exception_name)()
    ):
        result, image = _preview_widget_impl(999, "chart", False, "unknown")
    assert result == {"error": NOT_FOUND, "error_type": "DraftUnavailable"}
    assert image is None


@pytest.mark.parametrize(
    "failure,expected",
    [
        ("missing_canvas", "CanvasNotFoundError"),
        ("missing_placement", "CanvasPlacementNotFoundError"),
        ("missing_widget", "WidgetNotFoundError"),
        ("query", "QueryError"),
        ("renderer", "RendererError"),
    ],
)
def test_preview_failures_survive_the_response_schema(
    failure: str, expected: str
) -> None:
    from superset.mcp_service.canvas.schemas import PreviewWidgetResponse
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl
    from superset.models.canvas import Canvas

    node = {"widgetType": "echarts", "props": {"dataBinding": {"datasetId": 13}}}
    if failure == "missing_widget":
        node = {"widgetId": "missing"}
    with (
        patch(f"{PREVIEW}.CanvasDAO") as dao,
        patch(f"{PREVIEW}.get_widget_resolver") as resolver,
        patch(
            f"{PREVIEW}.run_binding", return_value=PlacementData([], None, None)
        ) as query,
        patch(f"{PREVIEW}.current_app") as app,
        patch(f"{PREVIEW}._render", return_value={"error": "Invalid chart"}),
    ):
        dao.find_by_id_or_uuid.return_value = (
            None if failure == "missing_canvas" else Canvas(id=7, slug="sales")
        )
        dao.load.return_value = _preview_canvas(node)
        resolver.return_value.widgets.return_value = {}
        app.config = {"CANVAS_WIDGET_RENDERER_URL": "http://renderer"}
        if failure == "query":
            query.side_effect = ValueError("Invalid query")
        result, _ = _preview_widget_impl(
            7, "absent" if failure == "missing_placement" else "chart", False
        )
    payload = PreviewWidgetResponse.model_validate(result).model_dump()
    assert payload["error_type"] == expected
    if failure == "missing_canvas":
        assert "url" not in payload
        assert "canvas_id" not in payload
    else:
        assert payload["url"] == f"{BASE_URL}/canvas/sales/"


def test_discard_returns_published_canvas_url_only_after_authorized_load() -> None:
    from superset.commands.canvas.exceptions import CanvasDraftNotFoundError
    from superset.mcp_service.canvas.tool.delete_canvas_draft import (
        _delete_canvas_draft_impl,
    )
    from superset.models.canvas import Canvas

    module = "superset.mcp_service.canvas.tool.delete_canvas_draft"
    with (
        patch(f"{module}.load_draft") as load,
        patch(f"{module}.DeleteCanvasDraftCommand") as command,
        patch(f"{module}.CanvasDAO") as dao,
    ):
        load.return_value.canvas_id = 7
        dao.find_by_id.return_value = Canvas(id=7, slug="sales")
        assert _delete_canvas_draft_impl("tok") == {
            "canvas_id": 7,
            "url": f"{BASE_URL}/canvas/sales/",
        }
        command.assert_called_once_with("tok")
        command.reset_mock()
        load.side_effect = CanvasDraftNotFoundError()
        result = _delete_canvas_draft_impl("tok")
        assert set(result) == {"error", "error_type"}
        assert result["error_type"] == "DraftUnavailable"
        command.assert_not_called()


@pytest.mark.parametrize("preview", [False, True])
def test_unsupported_definition_errors_survive_response_validation(
    preview: bool,
) -> None:
    from superset.canvas.definition.versions import DefinitionVersionError
    from superset.mcp_service.canvas.schemas import (
        GetCanvasResponse,
        PreviewWidgetResponse,
    )
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl
    from superset.models.canvas import Canvas

    response: GetCanvasResponse | PreviewWidgetResponse
    module = "preview_widget" if preview else "get_canvas"
    with patch(f"superset.mcp_service.canvas.tool.{module}.CanvasDAO") as dao:
        dao.find_by_id_or_uuid.return_value = Canvas(id=1)
        dao.load.side_effect = DefinitionVersionError(999, 1)
        if preview:
            result, image = _preview_widget_impl(1, "chart", False)
            assert image is None
            response = PreviewWidgetResponse.model_validate(result)
        else:
            response = GetCanvasResponse.model_validate(_get_canvas_impl(1, False))
    assert response.error_type == "DefinitionVersionError"
    assert response.error is not None
    assert "999" in response.error


@pytest.mark.parametrize("failure", ["lookup", "command"])
def test_update_canvas_missing_results_preserve_concealment(failure: str) -> None:
    from superset.commands.canvas.exceptions import CanvasNotFoundError
    from superset.mcp_service.canvas.schemas import CanvasWriteResponse
    from superset.mcp_service.canvas.tool.update_canvas import _update_canvas_impl

    with (
        patch(f"{UPDATE}.CanvasDAO") as dao,
        patch(f"{UPDATE}.UpdateCanvasCommand") as update,
    ):
        dao.find_by_id_or_uuid.return_value = (
            None if failure == "lookup" else MagicMock(id=5)
        )
        update.return_value.run.side_effect = CanvasNotFoundError()
        response = CanvasWriteResponse.model_validate(
            _update_canvas_impl("5", {"title": "Renamed"})
        )
    assert response.model_dump() == {
        "error": "Canvas 5 not found, or no access to it",
        "error_type": "CanvasNotFoundError",
    }
    if failure == "lookup":
        update.assert_not_called()
    else:
        update.return_value.run.assert_called_once()


@pytest.mark.parametrize(
    "reason,expected",
    [
        ("DATASOURCE_SECURITY_ACCESS_ERROR", "DatasetNotAccessible"),
        ("TABLE_SECURITY_ACCESS_ERROR", "DatasetNotAccessible"),
        ("DATABASE_SECURITY_ACCESS_ERROR", "DatasetNotAccessible"),
        ("ADHOC_SUBQUERY_NOT_ALLOWED_ERROR", "QueryError"),
        ("GENERIC_DB_ENGINE_ERROR", "QueryError"),
    ],
)
def test_preview_security_errors_stop_before_query_and_render(
    reason: str, expected: str
) -> None:
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException
    from superset.mcp_service.canvas.schemas import PreviewWidgetResponse
    from superset.mcp_service.canvas.tool.preview_widget import _preview_widget_impl
    from superset.models.canvas import Canvas

    denied = SupersetSecurityException(
        SupersetError(
            message="You do not have access to this dataset",
            error_type=SupersetErrorType[reason],
            level=ErrorLevel.ERROR,
        )
    )
    node = {"widgetType": "echarts", "props": {"dataBinding": {"datasetId": 13}}}
    with (
        patch(f"{PREVIEW}.CanvasDAO") as dao,
        patch("superset.charts.schemas.ChartDataQueryContextSchema") as schema,
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
        patch(f"{PREVIEW}._render") as render,
    ):
        dao.find_by_id_or_uuid.return_value = Canvas(id=7, slug="sales")
        dao.load.return_value = _preview_canvas(node)
        command.return_value.validate.side_effect = denied
        result, image = _preview_widget_impl(7, "chart", False)
    schema.return_value.load.assert_called_once()
    command.return_value.validate.assert_called_once()
    command.return_value.run.assert_not_called()
    render.assert_not_called()
    assert image is None
    payload = PreviewWidgetResponse.model_validate(result).model_dump()
    assert payload["error_type"] == expected
    assert payload["error"] == f"The widget's query failed: {denied}"
    assert payload["url"] == f"{BASE_URL}/canvas/sales/"
    assert payload["canvas_id"] == 7
    assert not {"sample_rows", "row_count", "query", "image", "option"} & payload.keys()
