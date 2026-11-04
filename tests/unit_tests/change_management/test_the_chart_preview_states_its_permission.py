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
"""``get_chart_preview`` names its permission instead of inheriting one (A1).

The MCP tool decorator picks ``write`` for a tool tagged ``mutate`` and
``read`` for everything else. ``get_chart_preview`` carries no such tag, so
it was graded ``read`` by omission -- and when it turned out to rewrite a
chart, "graded by omission" was the first thing anyone had to rule out.

The grade itself is right and is kept: a preview renders a chart and writes
nothing, so it needs the same ``can_read Chart`` that opens the chart, and
asking a viewer for write access to look at a chart would lock every viewer
out of previews. What was wrong is that the tool could write at all (see
``test_a_chart_preview_does_not_change_the_chart``). What these tests hold is
that the grade is a decision written down, and that no read-only MCP tool
quietly takes over the commit.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from superset.mcp_service.auth import CLASS_PERMISSION_ATTR, METHOD_PERMISSION_ATTR

TOOL_ROOT = Path(__file__).resolve().parents[3] / "superset" / "mcp_service"
PREVIEW = TOOL_ROOT / "chart" / "tool" / "get_chart_preview.py"


def _tool_decorator_keywords(path: Path, function: str) -> dict[str, ast.expr]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == function:
            for decorator in node.decorator_list:
                if isinstance(decorator, ast.Call):
                    return {kw.arg: kw.value for kw in decorator.keywords if kw.arg}
    raise AssertionError(f"no decorated {function} in {path}")


def test_the_preview_states_its_permission_rather_than_defaulting() -> None:
    keywords = _tool_decorator_keywords(PREVIEW, "get_chart_preview")

    assert "method_permission_name" in keywords, (
        "get_chart_preview relies on the decorator's default grade. Say what it needs."
    )
    assert ast.literal_eval(keywords["method_permission_name"]) == "read"
    assert ast.literal_eval(keywords["class_permission_name"]) == "Chart"


def test_the_registered_preview_carries_that_permission(app: object) -> None:
    from superset.mcp_service.chart.tool.get_chart_preview import get_chart_preview

    func = get_chart_preview
    while hasattr(func, "__wrapped__"):
        func = func.__wrapped__

    assert getattr(func, CLASS_PERMISSION_ATTR) == "Chart"
    assert getattr(func, METHOD_PERMISSION_ATTR) == "read"


def _read_only_tool_modules() -> list[Path]:
    return sorted(
        path
        for path in TOOL_ROOT.glob("*/tool/*.py")
        if "readOnlyHint=True" in path.read_text(encoding="utf-8")
    )


def test_there_are_read_only_tools_to_check() -> None:
    # A guard on the guard: a rename of the hint or the directory would
    # otherwise make the test below vacuously true.
    assert len(_read_only_tool_modules()) > 20


@pytest.mark.parametrize(
    "module_path", _read_only_tool_modules(), ids=lambda path: path.stem
)
def test_a_read_only_tool_does_not_commit_or_add_to_the_session(
    module_path: Path,
) -> None:
    """The commit is what turns a stray dirty object into a saved edit."""
    tree = ast.parse(module_path.read_text(encoding="utf-8"))
    writes = [
        node.attr
        for node in ast.walk(tree)
        if isinstance(node, ast.Attribute)
        and node.attr in {"commit", "add", "add_all", "merge", "flush", "delete"}
        and isinstance(node.value, ast.Attribute)
        and node.value.attr == "session"
    ]
    assert not writes, (
        f"{module_path.stem} is declared read-only but calls session.{writes[0]}"
    )
