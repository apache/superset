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
from collections.abc import Iterator
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch
from uuid import UUID

import pytest
from fastmcp.exceptions import ToolError
from flask import Flask, g

from superset.mcp_service.dataset_scope import (
    DATASET_IDENTIFIER_FIELDS,
    enforce_call_dataset_scope,
    get_dataset_scope,
    MCPDatasetScopeError,
    NO_DATASET_IDENTITY_ERROR,
    OUT_OF_SCOPE_ERROR,
    SCOPED_TOOLS,
    UNSUPPORTED_TOOL_ERROR,
)

FIRST = UUID("00000000-0000-0000-0000-000000000001")
SECOND = UUID("00000000-0000-0000-0000-000000000002")
THIRD = UUID("00000000-0000-0000-0000-000000000003")


def _sig() -> inspect.Signature:
    """Stand in for the single-``request`` signature every scoped tool has."""

    def tool(request: object) -> None: ...

    return inspect.signature(tool)


def _enforce(tool_name: str, **kwargs: object) -> None:
    """Invoke the production entry point the auth hook actually calls."""
    enforce_call_dataset_scope(tool_name, _sig(), (), kwargs)


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


def test_anonymous_caller_gets_no_datasets(app: Flask) -> None:
    """A request without a resolved user must not inherit any role's allowlist."""
    with (
        app.app_context(),
        patch.dict(app.config, MCP_DATASET_ROLE_ALLOWLIST={"Readers": [str(FIRST)]}),
    ):
        g.user = None
        assert get_dataset_scope() == frozenset()


def test_scope_is_unrestricted_without_an_app_context() -> None:
    """FastMCP internals such as tool discovery run outside a Flask context."""
    assert get_dataset_scope() is None


@pytest.mark.parametrize("config", [[], {"Readers": "*"}, {"Readers": ["bad"]}])
def test_invalid_config_refuses(app: Flask, config: object) -> None:
    """Malformed config never disables the restriction."""
    with (
        app.app_context(),
        patch.dict(app.config, MCP_DATASET_ROLE_ALLOWLIST=config),
        pytest.raises(MCPDatasetScopeError, match="MCP_DATASET_ROLE_ALLOWLIST"),
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
        with pytest.raises(MCPDatasetScopeError, match=OUT_OF_SCOPE_ERROR):
            _enforce("query_dataset", request=SimpleNamespace(dataset_id=identifier))
        assert find.call_count == 1
        assert "skip_base_filter" not in find.call_args.kwargs


@pytest.mark.parametrize("dataset_uuid,allowed", [(FIRST, True), (THIRD, False)])
@pytest.mark.parametrize(
    "tool_name,field",
    [
        ("query_dataset", "dataset_id"),
        ("get_table", "dataset_id"),
        ("get_dataset_info", "identifier"),
    ],
)
def test_role_union_intersects_actual_access(
    tool_name: str, field: str, dataset_uuid: UUID, allowed: bool
) -> None:
    """Each scoped tool's own identifier field is read; no alternative is chosen.

    Parametrizing over the field names guards the silent-refusal failure mode: a
    misspelled field would make every scoped call fail the ``allowed`` case.
    """
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
            _enforce(tool_name, request={field: 1})
        else:
            with pytest.raises(MCPDatasetScopeError, match=OUT_OF_SCOPE_ERROR):
                _enforce(tool_name, request={field: 1})
        find.assert_called_once_with(1, query_options=None)


def test_missing_dataset_identity_is_refused_distinctly() -> None:
    """A semantic view carries no registered dataset UUID to check."""
    with (
        patch(
            "superset.mcp_service.dataset_scope.get_dataset_scope",
            return_value=frozenset({FIRST}),
        ),
        pytest.raises(MCPDatasetScopeError, match=NO_DATASET_IDENTITY_ERROR),
    ):
        _enforce("get_table", request={"view_id": 1})


@pytest.mark.parametrize(
    "tool_name,payload",
    [
        ("execute_sql", {"database_id": 1, "sql": "SELECT 1"}),
        ("get_chart_data", {"identifier": 1}),
        ("get_chart_preview", {"identifier": 1}),
        ("get_query_info", {"identifier": 1}),
        ("extensions.acme.demo.query_dataset", {"dataset_id": 1}),
        ("unrecognized_extension_tool", {}),
    ],
)
def test_unscopable_operations_refuse(
    tool_name: str, payload: dict[str, object]
) -> None:
    """Alternative execution and cached-result paths cannot evade routing mode.

    An extension tool that reuses a scoped tool's base name registers under its
    prefixed name and must not inherit the built-in tool's handling.
    """
    with (
        patch(
            "superset.mcp_service.dataset_scope.get_dataset_scope",
            return_value=frozenset({FIRST}),
        ),
        pytest.raises(MCPDatasetScopeError, match=UNSUPPORTED_TOOL_ERROR),
    ):
        _enforce(tool_name, request=payload)


@pytest.mark.parametrize(
    "tool_name", sorted(SCOPED_TOOLS - set(DATASET_IDENTIFIER_FIELDS))
)
def test_scoped_tools_without_a_dataset_argument_pass_through(tool_name: str) -> None:
    """Discovery and health tools are not asked for a dataset identity."""
    with patch(
        "superset.mcp_service.dataset_scope.get_dataset_scope",
        return_value=frozenset({FIRST}),
    ):
        _enforce(tool_name, request={})


def test_disabled_scope_never_binds_call_arguments() -> None:
    """Tools keep their unmodified argument handling while the feature is off."""
    signature = MagicMock(wraps=_sig())
    with patch(
        "superset.mcp_service.dataset_scope.get_dataset_scope", return_value=None
    ):
        enforce_call_dataset_scope("execute_sql", signature, (), {"nonexistent": 1})
    signature.bind_partial.assert_not_called()


@pytest.mark.parametrize("dataset_uuid,allowed", [(FIRST, True), (THIRD, False)])
def test_unbindable_arguments_still_enforce_the_scope(
    dataset_uuid: UUID, allowed: bool
) -> None:
    """A binding failure must not mask the tool's own error — or skip the check.

    Extra keyword arguments make ``bind_partial`` raise. Falling back to the raw
    kwargs keeps the refusal decision intact; simply returning on ``TypeError``
    would turn a malformed call into a scope bypass, which the disallowed case
    below is what catches.
    """
    with (
        patch(
            "superset.mcp_service.dataset_scope.get_dataset_scope",
            return_value=frozenset({FIRST}),
        ),
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            return_value=SimpleNamespace(uuid=dataset_uuid),
        ) as find,
    ):
        kwargs = {"request": {"dataset_id": 1}, "unexpected": True}
        if allowed:
            enforce_call_dataset_scope("query_dataset", _sig(), (), kwargs)
        else:
            with pytest.raises(MCPDatasetScopeError, match=OUT_OF_SCOPE_ERROR):
                enforce_call_dataset_scope("query_dataset", _sig(), (), kwargs)
        find.assert_called_once_with(1, query_options=None)


def test_allowlist_is_wired_into_the_mcp_config_defaults() -> None:
    """The standalone MCP app must carry the setting through its config overlay."""
    from superset.mcp_service.mcp_config import get_mcp_config

    assert get_mcp_config()["MCP_DATASET_ROLE_ALLOWLIST"] is None
    assert get_mcp_config({"MCP_DATASET_ROLE_ALLOWLIST": {"Readers": [str(FIRST)]}})[
        "MCP_DATASET_ROLE_ALLOWLIST"
    ] == {"Readers": [str(FIRST)]}


@pytest.fixture
def mock_auth() -> Iterator[Mock]:
    """Resolve a user so the auth hook reaches the scope check."""
    with patch("superset.mcp_service.auth.get_user_from_request") as get_user:
        user = Mock()
        user.id = 1
        user.username = "admin"
        get_user.return_value = user
        yield get_user


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "kind,name",
    [
        ("resource", "superset://schema/dataset"),
        ("resource", "superset://schema/all"),
        ("prompt", "quickstart"),
    ],
)
async def test_resources_and_prompts_are_unaffected_by_the_scope(
    kind: str, name: str, mock_auth: Mock
) -> None:
    """Scoped mode restricts tools; it must not break schema/metadata surfaces.

    Resources and prompts share ``mcp_auth_hook`` with tools but expose no
    dataset rows, so gating them on a tool allowlist would only produce a
    nonsensical "no query was run" error for a schema lookup.
    """
    from fastmcp import Client

    from superset.mcp_service.app import mcp

    with patch(
        "superset.mcp_service.dataset_scope.get_dataset_scope",
        return_value=frozenset({FIRST}),
    ):
        async with Client(mcp) as client:
            if kind == "resource":
                assert await client.read_resource(name)
            else:
                assert await client.get_prompt(name)


@pytest.mark.asyncio
async def test_scope_does_not_hide_tools_from_listing(mock_auth: Mock) -> None:
    """Scoped mode gates execution, not discovery.

    Tool listings pass through the tool-search transform, which is enabled by
    default and synthesizes its own meta tools; filtering the listing on
    SCOPED_TOOLS left a stock deployment unable to reach the scoped tools at
    all. An unsupported tool must stay listed and refuse when called.
    """
    from fastmcp import Client

    from superset.mcp_service.app import mcp

    with patch(
        "superset.mcp_service.dataset_scope.get_dataset_scope",
        return_value=frozenset({FIRST}),
    ):
        async with Client(mcp) as client:
            listed = {tool.name for tool in await client.list_tools()}
            assert "execute_sql" in listed
            assert SCOPED_TOOLS <= listed

            with pytest.raises(ToolError, match="No query was run"):
                await client.call_tool(
                    "execute_sql", {"request": {"database_id": 1, "sql": "SELECT 1"}}
                )


@pytest.mark.parametrize(
    "value", [str(FIRST), [str(FIRST), str(SECOND)], FIRST.hex, str(FIRST).upper()]
)
def test_uuid_filter_accepts_uuid_values(value: object) -> None:
    """The uuid filter is the supported way to look a dataset up by UUID."""
    from superset.mcp_service.dataset.schemas import DatasetFilter

    assert DatasetFilter(col="uuid", opr="in", value=value)


@pytest.mark.parametrize("value", ["not-a-uuid", "0000-0000", 7, [str(FIRST), "nope"]])
def test_uuid_filter_rejects_malformed_values(value: object) -> None:
    """A truncated UUID is a caller mistake, not a system error to page on.

    Without this the value reaches the binary column and fails in the driver as
    a StatementError, which the error middleware classifies as a bug.
    """
    from pydantic import ValidationError

    from superset.mcp_service.dataset.schemas import DatasetFilter

    with pytest.raises(ValidationError, match="must be a UUID"):
        DatasetFilter(col="uuid", opr="in", value=value)


def test_non_uuid_filters_are_unvalidated() -> None:
    """Validation is scoped to the uuid column and changes nothing else."""
    from superset.mcp_service.dataset.schemas import DatasetFilter

    assert DatasetFilter(col="table_name", opr="eq", value="not-a-uuid")


@pytest.mark.parametrize("config", [[], {"Readers": "*"}, {"Readers": ["bad"]}])
def test_startup_validation_rejects_a_malformed_allowlist(config: object) -> None:
    """A typo surfaces at boot, not as a refusal on every subsequent call."""
    from superset.mcp_service.dataset_scope import parse_dataset_role_allowlist

    with pytest.raises(MCPDatasetScopeError, match="MCP_DATASET_ROLE_ALLOWLIST"):
        parse_dataset_role_allowlist(config)


def test_startup_validation_accepts_absent_and_valid_allowlists() -> None:
    """Parsing normalizes to UUIDs and leaves the unset case unrestricted."""
    from superset.mcp_service.dataset_scope import parse_dataset_role_allowlist

    assert parse_dataset_role_allowlist(None) is None
    assert parse_dataset_role_allowlist({}) == {}
    assert parse_dataset_role_allowlist({"Readers": [str(FIRST)]}) == {
        "Readers": {FIRST}
    }


@pytest.mark.parametrize("opr", ["is_null", "is_not_null"])
def test_uuid_null_checks_ignore_the_filter_value(opr: str) -> None:
    """get_schema advertises these operators for uuid, and value is required."""
    from superset.mcp_service.dataset.schemas import DatasetFilter

    assert DatasetFilter(col="uuid", opr=opr, value="")


def test_scoped_tools_cover_the_documented_discovery_workflow() -> None:
    """get_table's own workflow starts at list_metrics, so it must be reachable."""
    assert {
        "list_metrics",
        "get_compatible_dimensions",
        "get_compatible_metrics",
    } <= SCOPED_TOOLS
    assert all(
        tool in DATASET_IDENTIFIER_FIELDS
        for tool in SCOPED_TOOLS
        - {
            "health_check",
            "get_schema",
            "list_datasets",
        }
    )
