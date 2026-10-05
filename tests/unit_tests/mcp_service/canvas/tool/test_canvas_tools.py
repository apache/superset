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
        ops=[{"op": "add", "widget": "markdown", "id": "markdown"}],
        scopes={},
        render_context={},
    )
    with patch(COMMAND) as command:
        command.return_value.run.return_value = applied
        result = _apply_canvas_ops_impl(
            1, 3, [{"op": "add", "widget": "markdown", "props": {"content": "Hi"}}]
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
        dao.find_by_id.return_value = canvas
        dao.load.return_value = definition
        lean = _get_canvas_impl(1, include_resolved=False)
        full = _get_canvas_impl(1, include_resolved=True)

    assert set(lean) == {"id", "title", "url", "revision", "definition"}
    assert {"placements", "filterScopes", "widgetTypes"} <= set(full)


def test_get_canvas_hides_missing_or_inaccessible_canvases() -> None:
    with patch(DAO) as dao:
        dao.find_by_id.return_value = None
        assert "error" in _get_canvas_impl(9, include_resolved=False)


def test_apply_reports_unsupported_definition_versions() -> None:
    from superset.canvas.definition.versions import DefinitionVersionError

    with patch(COMMAND) as command:
        command.return_value.run.side_effect = DefinitionVersionError(2, 1)
        result = _apply_canvas_ops_impl(1, 3, [{"op": "remove", "id": "a"}])

    assert "Upgrade Superset" in result["error"]
