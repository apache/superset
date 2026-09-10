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

"""Dataset routing is additive across roles and never grants data access."""

import inspect
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from fastmcp.exceptions import ToolError
from flask import Flask, g

from superset.mcp_service.dataset_scope import (
    enforce_call_dataset_scope,
    enforce_tool_dataset_scope,
    get_dataset_scope,
)

FIRST = UUID("00000000-0000-0000-0000-000000000001")
SECOND = UUID("00000000-0000-0000-0000-000000000002")
THIRD = UUID("00000000-0000-0000-0000-000000000003")


def test_role_union_uses_effective_roles_and_missing_roles_contribute_nothing(
    app: Flask,
) -> None:
    """The security manager resolves direct, group, and public roles."""
    with (
        app.app_context(),
        patch(
            "superset.mcp_service.dataset_scope.security_manager.get_user_roles",
            return_value=[
                SimpleNamespace(name="Readers"),
                SimpleNamespace(name="Analysts"),
                SimpleNamespace(name="Unconfigured"),
            ],
        ) as roles,
        patch.dict(
            app.config,
            MCP_DATASET_ROLE_ALLOWLIST={
                "Readers": [str(FIRST)],
                "Analysts": [str(FIRST), str(SECOND)],
                "Other": [str(THIRD)],
            },
        ),
    ):
        g.user = SimpleNamespace(id=1)
        assert get_dataset_scope() == {FIRST, SECOND}
        roles.assert_called_once_with()


@pytest.mark.parametrize("config", [None, {}, {"Other": [str(FIRST)]}])
def test_disabled_and_empty_scope(app: Flask, config: object) -> None:
    """Only None disables scoping; an empty mapping denies all datasets."""
    with (
        app.app_context(),
        patch.dict(app.config, MCP_DATASET_ROLE_ALLOWLIST=config),
        patch(
            "superset.mcp_service.dataset_scope.security_manager.get_user_roles",
            return_value=[SimpleNamespace(name="Admin")],
        ),
    ):
        g.user = SimpleNamespace(id=1)
        assert get_dataset_scope() == (None if config is None else frozenset())


@pytest.mark.parametrize("config", [[], {"Readers": "*"}, {"Readers": ["bad"]}])
def test_invalid_config_refuses(app: Flask, config: object) -> None:
    """Malformed config never disables the restriction."""
    with (
        app.app_context(),
        patch.dict(app.config, MCP_DATASET_ROLE_ALLOWLIST=config),
        pytest.raises(ToolError),
    ):
        get_dataset_scope()


@pytest.mark.parametrize("identifier", [1, "1", str(FIRST)])
def test_scope_lookup_retains_dao_access_filter(identifier: int | str) -> None:
    """An allowed UUID cannot grant access when the normal DAO denies lookup."""
    with (
        patch(
            "superset.mcp_service.dataset_scope.get_dataset_scope",
            return_value=frozenset({FIRST}),
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None) as find,
    ):
        with pytest.raises(ToolError, match="outside.*scope"):
            enforce_tool_dataset_scope(
                "query_dataset", {"request": SimpleNamespace(dataset_id=identifier)}
            )
        assert find.call_count == 1
        assert "skip_base_filter" not in find.call_args.kwargs


@pytest.mark.parametrize("dataset_uuid,allowed", [(FIRST, True), (THIRD, False)])
def test_role_union_intersects_actual_access(dataset_uuid: UUID, allowed: bool) -> None:
    """An accessible dataset must also be in the union; no alternative is selected."""
    with (
        patch(
            "superset.mcp_service.dataset_scope.get_dataset_scope",
            return_value=frozenset({FIRST, SECOND}),
        ),
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            return_value=SimpleNamespace(uuid=dataset_uuid),
        ) as find,
    ):
        if allowed:
            enforce_tool_dataset_scope("get_table", {"request": {"dataset_id": 1}})
        else:
            with pytest.raises(ToolError, match="Do not substitute"):
                enforce_tool_dataset_scope("get_table", {"request": {"dataset_id": 1}})
        find.assert_called_once_with(1, query_options=None)


@pytest.mark.parametrize(
    "tool_name,payload",
    [
        ("execute_sql", {"database_id": 1, "sql": "SELECT 1"}),
        ("get_chart_data", {"identifier": 1}),
        ("get_chart_preview", {"identifier": 1}),
        ("get_table", {"view_id": 1}),
        ("get_query_info", {"identifier": 1}),
        ("unrecognized_extension_tool", {}),
    ],
)
def test_unscopable_operations_refuse(
    tool_name: str, payload: dict[str, object]
) -> None:
    """Alternative execution and cached-result paths cannot evade routing mode."""
    with (
        patch(
            "superset.mcp_service.dataset_scope.get_dataset_scope",
            return_value=frozenset({FIRST}),
        ),
        pytest.raises(ToolError, match="No query was run"),
    ):
        enforce_tool_dataset_scope(tool_name, {"request": payload})


def _sig() -> inspect.Signature:
    def tool(request: object) -> None: ...

    return inspect.signature(tool)


def test_disabled_scope_never_binds_call_arguments() -> None:
    """Tools keep their unmodified argument handling while the feature is off."""
    signature = MagicMock(wraps=_sig())
    with patch(
        "superset.mcp_service.dataset_scope.get_dataset_scope", return_value=None
    ):
        enforce_call_dataset_scope("execute_sql", signature, (), {"nonexistent": 1})
    signature.bind_partial.assert_not_called()


def test_unbindable_arguments_defer_to_tool_validation() -> None:
    """A binding failure must not mask the tool's own argument error."""
    with (
        patch(
            "superset.mcp_service.dataset_scope.get_dataset_scope",
            return_value=frozenset({FIRST}),
        ),
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            return_value=SimpleNamespace(uuid=FIRST),
        ),
    ):
        # Extra keyword arguments make bind_partial raise; the scope decision
        # still falls back to the raw kwargs rather than surfacing a TypeError.
        enforce_call_dataset_scope(
            "query_dataset",
            _sig(),
            (),
            {"request": {"dataset_id": 1}, "unexpected": True},
        )


def test_allowlist_is_wired_into_the_mcp_config_defaults() -> None:
    """The standalone MCP app must carry the setting through its config overlay."""
    from superset.mcp_service.mcp_config import get_mcp_config

    assert get_mcp_config()["MCP_DATASET_ROLE_ALLOWLIST"] is None
    assert get_mcp_config({"MCP_DATASET_ROLE_ALLOWLIST": {"Readers": [str(FIRST)]}})[
        "MCP_DATASET_ROLE_ALLOWLIST"
    ] == {"Readers": [str(FIRST)]}
