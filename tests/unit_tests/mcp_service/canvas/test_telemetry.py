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
"""Resolving the canvas an MCP tool call acted on."""

from __future__ import annotations

import pytest

from superset.mcp_service.canvas.telemetry import (
    canvas_id_from_params,
    canvas_id_from_result,
    CANVAS_TOOL_NAMES,
    is_canvas_tool,
)


def test_the_tool_names_match_the_registered_canvas_tools() -> None:
    """``middleware.py`` cannot import the tool package without pulling every
    canvas tool into its import graph, so the names are repeated. This is what
    keeps the copy honest when a tool is added or renamed.
    """
    from superset.mcp_service.canvas import tool

    assert CANVAS_TOOL_NAMES == set(tool.__all__)


def test_widget_tools_are_not_canvas_tools() -> None:
    """They are permissioned on Canvas but answer about widgets, and their
    responses can carry a bare ``id`` that is a widget's. Reading it as a
    canvas id would attribute a call to a canvas that does not exist.
    """
    for name in (
        "list_widget_types",
        "get_widget_control_schema",
        "get_widget_info",
        "list_widgets",
    ):
        assert not is_canvas_tool(name)


@pytest.mark.parametrize(
    "params,expected",
    [
        ({"canvas_id": 7}, 7),
        ({"canvas_id": "7"}, 7),
        # A canvas is addressable by uuid or slug too; resolving those would
        # mean a database round trip on the event loop, so the response is
        # left to supply the id.
        ({"canvas_id": "9f1c7e30-0000-0000-0000-000000000000"}, None),
        ({"canvas_id": "exec-overview"}, None),
        ({"canvas_id": None}, None),
        ({}, None),
        ({"canvas_id": True}, None),
        ("not a mapping", None),
        (None, None),
    ],
)
def test_a_canvas_id_is_read_from_params_only_when_it_is_one(
    params: object, expected: int | None
) -> None:
    assert canvas_id_from_params(params) == expected


@pytest.mark.parametrize(
    "data,expected",
    [
        # The draft tools name their canvas only here.
        ({"canvas_id": 42, "revision": 3}, 42),
        # get_canvas / create_canvas / update_canvas expose it as ``id``.
        ({"id": 42, "title": "Exec overview"}, 42),
        ({"canvas_id": 42, "id": 99}, 42),
        ({"id": None}, None),
        ({}, None),
        ([], None),
        (None, None),
    ],
)
def test_a_canvas_id_is_read_from_the_response(
    data: object, expected: int | None
) -> None:
    assert canvas_id_from_result(data) == expected


def test_only_an_integer_is_read_from_a_draft_response() -> None:
    """A draft response's ``url`` ends in ``#draft=<token>``. Returning any
    more of the body than the integer id would move a live token into ``logs``,
    so the reader's return type is itself the guarantee: widening it to pass
    through the body, the url, or the token fails here.
    """
    data = {
        "canvas_id": 42,
        "url": "/canvas/42/#draft=s3cret-token",
        "token": "s3cret-token",
    }

    result = canvas_id_from_result(data)

    assert result == 42
    assert isinstance(result, int)
    assert "s3cret-token" not in str(result)
