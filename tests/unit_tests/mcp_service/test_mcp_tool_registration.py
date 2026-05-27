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

"""Test MCP app imports and tool/prompt registration."""

import asyncio
import logging
from unittest.mock import MagicMock, patch

from superset.mcp_service.app import get_default_instructions, init_fastmcp_server, mcp


def _run(coro):
    """Run an async coroutine synchronously."""
    return asyncio.run(coro)


def test_mcp_app_imports_successfully():
    """Test that the MCP app can be imported without errors."""
    from superset.mcp_service.app import mcp

    assert mcp is not None

    tools = _run(mcp.list_tools())
    tool_names = [t.name for t in tools]
    assert len(tool_names) > 0
    assert "health_check" in tool_names
    assert "list_charts" in tool_names


def test_mcp_prompts_registered():
    """Test that MCP prompts are registered."""
    from superset.mcp_service.app import mcp

    prompts = _run(mcp.list_prompts())
    assert len(prompts) > 0


def test_mcp_resources_registered():
    """Test that MCP resources are registered.

    Resources are registered via @mcp.resource() decorators in resource files.
    They require __init__.py in parent packages for find_packages() to include
    them in distributions. This test ensures all expected resources are found.
    """
    from superset.mcp_service.app import mcp

    resources = _run(mcp.list_resources())
    assert len(resources) > 0, "No MCP resources registered"

    resource_uris = {str(r.uri) for r in resources}
    assert "chart://configs" in resource_uris, (
        "chart://configs resource not registered - "
        "check superset/mcp_service/chart/__init__.py exists"
    )
    assert "instance://metadata" in resource_uris, (
        "instance://metadata resource not registered - "
        "check superset/mcp_service/system/resources/ imports"
    )


def test_mcp_packages_discoverable_by_setuptools():
    """Test that all MCP sub-packages have __init__.py for setuptools.

    setuptools.find_packages() only discovers directories with __init__.py.
    Without __init__.py, sub-packages (tool, resources, prompts) are excluded
    from built distributions, causing missing module errors in deployments.
    """
    from pathlib import Path

    mcp_root = Path(__file__).parents[3] / "superset" / "mcp_service"
    assert mcp_root.is_dir(), f"MCP service root not found: {mcp_root}"

    # All immediate sub-directories that contain Python files should be packages
    missing = []
    for subdir in sorted(mcp_root.iterdir()):
        if not subdir.is_dir() or subdir.name.startswith(("_", ".")):
            continue
        # Check if it has any .py files in it or its subdirectories
        has_py = any(subdir.rglob("*.py"))
        if has_py and not (subdir / "__init__.py").exists():
            missing.append(subdir.name)

    assert not missing, (
        f"MCP sub-packages missing __init__.py (will be excluded from "
        f"setuptools distributions): {missing}"
    )


# ---------------------------------------------------------------------------
# MCP_DISABLED_TOOLS tests
# ---------------------------------------------------------------------------


def _make_flask_app_mock(
    disabled_tools: set[str],
    feature_flags: dict[str, object] | None = None,
    fab_security_views: bool = True,
    log_view: bool = True,
) -> MagicMock:
    """Return a minimal Flask app mock with MCP config set to safe defaults.

    Defaults enable all feature flags and logging so that tests focused on
    MCP_DISABLED_TOOLS are not affected by the config guards added for action-log
    and task tools.
    """
    _feature_flags: dict[str, object] = (
        {"GLOBAL_TASK_FRAMEWORK": True} if feature_flags is None else feature_flags
    )
    _config: dict[str, object] = {
        "MCP_DISABLED_TOOLS": disabled_tools,
        "FAB_ADD_SECURITY_VIEWS": fab_security_views,
        "SUPERSET_LOG_VIEW": log_view,
        "FEATURE_FLAGS": _feature_flags,
    }
    flask_app = MagicMock()
    flask_app.config.get.side_effect = lambda key, default=None: _config.get(
        key, default
    )
    return flask_app


def test_disabled_tools_are_removed_from_mcp_server() -> None:
    """Tools listed in MCP_DISABLED_TOOLS are removed before the server starts."""

    flask_app = _make_flask_app_mock({"health_check", "list_charts"})

    with (
        patch(
            "superset.mcp_service.flask_singleton.app",
            flask_app,
        ),
        patch.object(mcp.local_provider, "remove_tool") as mock_remove,
    ):
        init_fastmcp_server()

    removed = {call.args[0] for call in mock_remove.call_args_list}
    assert "health_check" in removed
    assert "list_charts" in removed


def test_unknown_disabled_tool_logs_warning_not_raises(caplog) -> None:
    """An unknown tool name in MCP_DISABLED_TOOLS logs a warning and does not crash."""

    flask_app = _make_flask_app_mock({"nonexistent_tool_xyz"})

    with (
        patch(
            "superset.mcp_service.flask_singleton.app",
            flask_app,
        ),
        patch.object(
            mcp.local_provider,
            "remove_tool",
            side_effect=KeyError("nonexistent_tool_xyz"),
        ),
        caplog.at_level(logging.WARNING, logger="superset.mcp_service.app"),
    ):
        # Must not raise
        init_fastmcp_server()

    assert "nonexistent_tool_xyz" in caplog.text
    assert "MCP_DISABLED_TOOLS" in caplog.text


def test_empty_disabled_tools_removes_nothing() -> None:
    """An empty MCP_DISABLED_TOOLS set leaves all tools registered."""

    flask_app = _make_flask_app_mock(set())

    with (
        patch(
            "superset.mcp_service.flask_singleton.app",
            flask_app,
        ),
        patch.object(mcp.local_provider, "remove_tool") as mock_remove,
    ):
        init_fastmcp_server()

    mock_remove.assert_not_called()


def test_disabled_tools_read_from_flask_app_config() -> None:
    """MCP_DISABLED_TOOLS is read from flask_app.config, matching the standard
    Superset pattern where users set overrides in superset_config.py, which
    create_app() loads into Flask config before any command runs."""
    from superset.mcp_service.app import init_fastmcp_server, mcp

    flask_app = _make_flask_app_mock({"health_check"})

    with (
        patch(
            "superset.mcp_service.flask_singleton.app",
            flask_app,
        ),
        patch.object(mcp.local_provider, "remove_tool") as mock_remove,
    ):
        init_fastmcp_server()

    removed = {call.args[0] for call in mock_remove.call_args_list}
    assert "health_check" in removed


# ---------------------------------------------------------------------------
# get_default_instructions disabled_tools filtering tests
# ---------------------------------------------------------------------------


def test_disabled_tools_absent_from_instructions() -> None:
    """Tools in disabled_tools must not appear as bullet lines in instructions."""
    instructions = get_default_instructions(
        disabled_tools={"execute_sql", "health_check"}
    )

    # The bullet-point entries for disabled tools must be gone
    assert "- execute_sql:" not in instructions
    assert "- health_check:" not in instructions
    # Non-disabled tools must still be present
    assert "- list_charts:" in instructions
    assert "- list_dashboards:" in instructions


def test_disabling_get_instance_info_removes_all_prose_references() -> None:
    """Disabling get_instance_info must remove ALL prose references to it,
    not only the bullet-point entry in the Available tools section."""
    instructions = get_default_instructions(disabled_tools={"get_instance_info"})

    # Bullet entry must be gone
    assert "- get_instance_info:" not in instructions
    # Prose directives that instruct the LLM to call the tool must also be gone
    assert "start with get_instance_info" not in instructions
    assert "call get_instance_info" not in instructions
    assert "check their accessible_menus in" not in instructions
    assert "Feature Availability" not in instructions
    # Instructions for other tools must be unaffected
    assert "- list_charts:" in instructions
    assert "- execute_sql:" in instructions


def test_disabling_execute_sql_removes_all_prose_references() -> None:
    """Disabling execute_sql must remove all workflow and example lines that
    mention it, not only the bullet-point entry."""
    instructions = get_default_instructions(disabled_tools={"execute_sql"})

    # Bullet entry must be gone
    assert "- execute_sql:" not in instructions
    # Workflow steps and request wrapper examples must also be gone
    assert "execute_sql(" not in instructions
    assert "execute_sql" not in instructions
    # Instructions for unrelated tools must be unaffected
    assert "- list_charts:" in instructions
    assert "- get_instance_info:" in instructions


def test_no_disabled_tools_returns_full_instructions() -> None:
    """Passing no disabled_tools (or empty set) returns the full instructions."""
    full = get_default_instructions()
    also_full = get_default_instructions(disabled_tools=set())

    assert "- execute_sql:" in full
    assert "- health_check:" in full
    assert full == also_full


# ---------------------------------------------------------------------------
# Config-guard tests: action-log tools and task tools
# ---------------------------------------------------------------------------


def test_action_log_tools_removed_when_superset_log_view_disabled() -> None:
    """Action-log tools removed when SUPERSET_LOG_VIEW=False.

    Mirrors LogRestApi.is_enabled() which checks FAB_ADD_SECURITY_VIEWS and
    SUPERSET_LOG_VIEW.
    """
    flask_app = _make_flask_app_mock(set(), log_view=False)

    with (
        patch("superset.mcp_service.flask_singleton.app", flask_app),
        patch.object(mcp.local_provider, "remove_tool") as mock_remove,
    ):
        init_fastmcp_server()

    removed = {call.args[0] for call in mock_remove.call_args_list}
    assert "list_action_logs" in removed
    assert "get_action_log_info" in removed


def test_action_log_tools_removed_when_fab_security_views_disabled() -> None:
    """Action-log tools removed when FAB_ADD_SECURITY_VIEWS=False."""
    flask_app = _make_flask_app_mock(set(), fab_security_views=False)

    with (
        patch("superset.mcp_service.flask_singleton.app", flask_app),
        patch.object(mcp.local_provider, "remove_tool") as mock_remove,
    ):
        init_fastmcp_server()

    removed = {call.args[0] for call in mock_remove.call_args_list}
    assert "list_action_logs" in removed
    assert "get_action_log_info" in removed


def test_task_tools_removed_when_global_task_framework_disabled() -> None:
    """Task tools removed when GLOBAL_TASK_FRAMEWORK=False.

    Mirrors TaskRestApi conditional registration in initialization/__init__.py.
    """
    flask_app = _make_flask_app_mock(
        set(), feature_flags={"GLOBAL_TASK_FRAMEWORK": False}
    )

    with (
        patch("superset.mcp_service.flask_singleton.app", flask_app),
        patch.object(mcp.local_provider, "remove_tool") as mock_remove,
    ):
        init_fastmcp_server()

    removed = {call.args[0] for call in mock_remove.call_args_list}
    assert "list_tasks" in removed
    assert "get_task_info" in removed


def test_instructions_generated_after_disabled_tools_removed() -> None:
    """init_fastmcp_server generates instructions AFTER removing disabled tools,
    so the instructions never advertise tools that clients cannot call."""
    flask_app = _make_flask_app_mock({"execute_sql"})

    captured: list[str] = []

    def fake_get_instructions(
        branding: str = "Apache Superset",
        disabled_tools: set[str] | None = None,
    ) -> str:
        captured.append(str(disabled_tools))
        return f"instructions for {branding}"

    with (
        patch("superset.mcp_service.flask_singleton.app", flask_app),
        patch.object(mcp.local_provider, "remove_tool"),
        patch(
            "superset.mcp_service.app.get_default_instructions",
            fake_get_instructions,
        ),
    ):
        init_fastmcp_server()

    # get_default_instructions must have been called with the disabled set
    assert len(captured) == 1
    assert "execute_sql" in captured[0]
