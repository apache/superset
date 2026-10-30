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
"""An MCP tool reaches the gate only by going through a command.

The gate wraps named command classes. A tool that calls a command is
governed for free; a tool that assigns to the model and commits is not
governed at all, and nothing in the extension can see it happen.

Two dashboard tools did the latter. ``update_dashboard`` set the title,
CSS, layout, metadata, slug -- and ``published`` -- straight onto the
model, and ``manage_dashboard_markdown`` wrote ``position_json``. Both
then committed. An editor could put a dashboard in front of viewers on
their own say-so, which is the single act the review feature exists to
hold (S-02).

The fix is not a new seam, it is using the one that was already there:
every field those tools write is a field ``UpdateDashboardCommand``
already accepts. So these tests pin the route rather than the fields --
no direct commit, and an inventory check so the next tool that writes a
dashboard cannot quietly skip the command the way these two did.
"""

import ast
import inspect
from pathlib import Path

import pytest
from asset_approval import bindings

#: Tools that write a dashboard without a command, each for a stated
#: reason. Anything else that mutates has to reach a command, or the gate
#: cannot see it.
WRITES_WITHOUT_A_COMMAND = {
    # Writes only fields in EXEMPT_FIELDS, so it is ungoverned on every
    # path, REST included.
    "manage_dashboard_owners",
    "manage_dashboard_roles",
    "manage_dashboard_certification",
    # Creates. V1 gates no creates on any path (SOW 8).
    "generate_dashboard",
}

TOOL_DIR = (
    Path(__file__).resolve().parents[3]
    / "superset"
    / "mcp_service"
    / "dashboard"
    / "tool"
)


def _mutating_tool_modules() -> list[Path]:
    """Dashboard tool modules that declare themselves as mutating."""
    return sorted(
        path
        for path in TOOL_DIR.glob("*.py")
        if 'tags=["mutate"]' in path.read_text(encoding="utf-8")
    )


def test_there_are_mutating_dashboard_tools_to_check() -> None:
    # A guard on the guard: a rename of the tag or the directory would
    # otherwise make every test below vacuously true.
    assert len(_mutating_tool_modules()) > 5


@pytest.mark.parametrize(
    "module_path", _mutating_tool_modules(), ids=lambda path: path.stem
)
def test_a_mutating_tool_writes_through_a_command(module_path: Path) -> None:
    if module_path.stem in WRITES_WITHOUT_A_COMMAND:
        pytest.skip("writes only exempt fields, or creates")

    source = module_path.read_text(encoding="utf-8")
    assert "Command(" in source, (
        f"{module_path.stem} mutates a dashboard without reaching a command, "
        "so the review gate cannot see it. Route the write through the "
        "command the REST API uses, or add it to WRITES_WITHOUT_A_COMMAND "
        "with the reason it is ungoverned."
    )


@pytest.mark.parametrize(
    "module_name",
    ["update_dashboard", "manage_dashboard_markdown"],
)
def test_the_two_tools_that_bypassed_no_longer_commit(module_name: str) -> None:
    """The specific regression, named.

    A rollback is still theirs to do; a commit is the command's.
    """
    source = (TOOL_DIR / f"{module_name}.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    commits = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Attribute)
        and node.attr == "commit"
        and isinstance(node.value, ast.Attribute)
        and node.value.attr == "session"
    ]
    assert not commits, f"{module_name} still commits its own write"


def test_the_command_those_tools_now_use_is_gated() -> None:
    # The route is only worth anything if the far end is bound.
    source = inspect.getsource(bindings)
    assert "UpdateDashboardCommand" in source


def test_a_capture_is_not_swallowed_as_an_unexpected_error() -> None:
    """The catch-all has to let a capture past it.

    ``manage_dashboard_markdown`` ends in ``except Exception``, which
    logged a traceback at ERROR and fired MCP_ERROR_HOOK for a write that
    had been accepted and was waiting on a person (QA-13). Now that the
    tool reaches the gate at all, that path is live for the first time.
    """
    # Read the file: the @tool decorator replaces the function with a
    # worker wrapper, so inspect would show that instead.
    source = (TOOL_DIR / "manage_dashboard_markdown.py").read_text(
        encoding="utf-8"
    )

    assert "is_review_signal" in source
    assert source.index("is_review_signal") < source.index(
        "Unexpected error managing markdown"
    ), "the capture must be re-raised before the unexpected-error logging"
