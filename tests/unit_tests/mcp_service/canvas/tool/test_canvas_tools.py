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

from unittest.mock import MagicMock, patch

from superset.commands.canvas.apply_ops import ApplyResult
from superset.commands.canvas.exceptions import DefinitionConflictError
from superset.mcp_service.canvas.tool.apply_canvas_ops import _apply_canvas_ops_impl
from superset.mcp_service.canvas.tool.get_canvas import _get_canvas_impl

COMMAND = (
    "superset.mcp_service.canvas.tool.apply_canvas_ops.ApplyCanvasOperationsCommand"
)
DAO = "superset.mcp_service.canvas.tool.get_canvas.CanvasDAO"


def test_apply_reports_malformed_ops_without_running_the_command() -> None:
    with patch(COMMAND) as command:
        result = _apply_canvas_ops_impl(1, 0, [{"op": "add", "id": "Not A Slug"}])

    command.assert_not_called()
    assert result["error"] == "Invalid operations"
    assert result["errors"]


def test_apply_returns_the_new_revision_and_assigned_ids() -> None:
    applied = ApplyResult(
        revision=4,
        ops=[{"op": "add", "widgetType": "markdown", "id": "markdown"}],
        scopes={},
        render_context={},
    )
    with patch(COMMAND) as command:
        command.return_value.run.return_value = applied
        result = _apply_canvas_ops_impl(
            1, 3, [{"op": "add", "widgetType": "markdown", "props": {"content": "Hi"}}]
        )

    assert result == {"revision": 4, "ops": applied.ops}


def test_apply_returns_conflicts_as_data() -> None:
    with patch(COMMAND) as command:
        command.return_value.run.side_effect = DefinitionConflictError(
            7, ["revenue-trend"], stale=False
        )
        result = _apply_canvas_ops_impl(1, 3, [{"op": "remove", "id": "revenue-trend"}])

    assert result["revision"] == 7
    assert "error" in result


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
        assert "error" in _get_canvas_impl(9, include_resolved=False)


def test_apply_reports_unsupported_definition_versions() -> None:
    from superset.canvas.definition.versions import DefinitionVersionError

    with patch(COMMAND) as command:
        command.return_value.run.side_effect = DefinitionVersionError(2, 1)
        result = _apply_canvas_ops_impl(1, 3, [{"op": "remove", "id": "a"}])

    assert "Upgrade Superset" in result["error"]


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
    assert result["canvases"][0]["url"] == "/canvas/sales/"


def test_create_canvas_applies_initial_ops() -> None:
    from superset.mcp_service.canvas.tool.create_canvas import _create_canvas_impl

    canvas = MagicMock(id=5, url="/canvas/demo/", revision=1)
    with (
        patch(f"{CREATE}.CreateCanvasCommand") as create,
        patch(f"{CREATE}._apply_canvas_ops_impl") as apply,
    ):
        create.return_value.run.return_value = canvas
        apply.return_value = {"revision": 2, "ops": [{"op": "add", "id": "intro"}]}
        result = _create_canvas_impl("Demo", "demo", None, [{"op": "add"}])

    assert create.call_args.args[0] == {"title": "Demo", "slug": "demo"}
    apply.assert_called_once_with(5, 1, [{"op": "add"}])
    assert result == {
        "id": 5,
        "url": "/canvas/demo/",
        "revision": 2,
        "ops": [{"op": "add", "id": "intro"}],
    }


def test_create_canvas_rolls_back_when_initial_ops_fail() -> None:
    from superset.mcp_service.canvas.tool.create_canvas import _create_canvas_impl

    with (
        patch(f"{CREATE}.CreateCanvasCommand") as create,
        patch(f"{CREATE}.DeleteCanvasCommand") as delete,
        patch(f"{CREATE}._apply_canvas_ops_impl") as apply,
    ):
        create.return_value.run.return_value = MagicMock(id=5, revision=1)
        apply.return_value = {"error": "Invalid operations", "operation": 0}
        result = _create_canvas_impl("Demo", None, None, [{"op": "add"}])

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
    assert result == {"id": 5, "url": "/canvas/5/", "revision": 4}


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
    assert result["url"] == "/canvas/sales/#draft=tok"
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
            5, canvas_changed=True
        )
        result = _commit_canvas_draft_impl("tok", 1)

    assert result["canvas_changed"] is True
    assert result["revision"] == 5
