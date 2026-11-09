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

"""Tests for the Dashboard V2 widget-control MCP tools."""

from __future__ import annotations

from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from flask import g
from jsonschema import Draft202012Validator, ValidationError

from superset.canvas.definition.schemas import DEFINITION_VERSION
from superset.mcp_service.app import mcp
from superset.mcp_service.auth import check_tool_permission
from superset.mcp_service.widgets.tool.get_widget_control_schema import (
    _get_widget_control_schema_impl,
)
from superset.mcp_service.widgets.tool.list_widget_types import (
    _list_widget_types_impl,
)
from superset.utils import json
from superset.widgets.builtin import Balloons


def test_list_widget_types_impl() -> None:
    ids = {b["id"] for b in _list_widget_types_impl()}
    assert {"metric-tile", "ag-grid-table", "balloons"} <= ids


def test_list_widget_types_names_required_props_and_grid_columns() -> None:
    types = {b["id"]: b for b in _list_widget_types_impl()}

    assert types["markdown"]["requiredProps"] == ["content"]
    assert types["group"]["requiredProps"] is None
    assert types["group"]["canvas"]["gridColumns"] == 12


def test_get_widget_control_schema_is_minimal() -> None:
    result = _get_widget_control_schema_impl("balloons")
    assert result["x-disclosure"] == "minimal"
    assert result["properties"]["customize"]["x-collapsed"] is True
    # Mandatory leaves are surfaced inline.
    assert (
        result["properties"]["dataBinding"]["properties"]["datasetId"]["type"]
        == "integer"
    )


def test_get_widget_control_schema_unknown_type_error() -> None:
    result = _get_widget_control_schema_impl("does-not-exist")
    assert result["error"]["error_type"] == "invalid_widget_type"
    assert "balloons" in result["valid_widget_types"]


def test_get_widget_control_schema_drills_into_enriched_series() -> None:
    result = _get_widget_control_schema_impl(
        "balloons",
        paths=["customize/series"],
        control_values={
            "dataBinding": {"datasetId": 1, "metrics": ["count"], "dimensions": ["g"]}
        },
        series=["boy", "girl"],
    )
    series_schema = result["subtrees"]["customize/series"]
    assert set(series_schema["properties"]) == {"boy", "girl"}


def test_get_widget_control_schema_expands_multiple_paths_at_once() -> None:
    result = _get_widget_control_schema_impl(
        "balloons", paths=["dataBinding", "customize"]
    )
    # Both requested branches come back in one call, keyed by path.
    assert set(result["subtrees"]) == {"dataBinding", "customize"}
    assert "datasetId" in result["subtrees"]["dataBinding"]["properties"]
    assert "series" in result["subtrees"]["customize"]["properties"]


def test_get_widget_control_schema_bad_path_error() -> None:
    result = _get_widget_control_schema_impl("balloons", paths=["nope/nope"])
    assert result["error"]["error_type"] == "invalid_path"


@pytest.mark.parametrize(
    "control_values", [None, {"datasetId": 13, "column": "country"}]
)
def test_filter_schema_accepts_discovered_values_without_loading_choices(
    control_values: dict[str, Any] | None,
) -> None:
    with (
        patch(
            "superset.widgets.builtin.FilterSelect.get_control_schema",
            side_effect=AssertionError("MCP must not run the dropdown enrichers"),
        ),
        patch(
            "superset.widgets.builtin.DatasetDAO.find_all",
            side_effect=AssertionError("MCP must not load the dataset catalog"),
        ),
        patch(
            "superset.widgets.builtin.DatasetDAO.find_by_id",
            side_effect=AssertionError("MCP must not load dataset columns"),
        ),
    ):
        schema = _get_widget_control_schema_impl(
            "filter.select", control_values=control_values
        )
        subtrees = _get_widget_control_schema_impl(
            "filter.select",
            paths=["datasetId", "column"],
            control_values=control_values,
        )["subtrees"]

    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    validator.validate({"datasetId": 13, "column": "country"})
    for name, value in (("datasetId", 13), ("column", "country")):
        for field in (schema["properties"][name], subtrees[name]):
            assert "enum" not in field
            assert "x-enumNames" not in field
            Draft202012Validator.check_schema(field)
            Draft202012Validator(field).validate(value)
    assert schema["properties"]["column"]["x-dependsOn"] == ["datasetId"]
    for invalid in (
        {"column": "country"},
        {"datasetId": "thirteen", "column": "country"},
        {"datasetId": 13, "column": ""},
    ):
        with pytest.raises(ValidationError):
            validator.validate(invalid)


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["list_widget_types", "get_widget_control_schema"])
@pytest.mark.parametrize("resource", ["Canvas", "Chart", None])
async def test_widget_discovery_requires_canvas_read(app, name, resource) -> None:
    tool = await mcp.get_tool(name)
    assert tool is not None
    security_manager = Mock()
    security_manager.can_access.side_effect = (
        lambda permission, view: permission == "can_read" and view == resource
    )
    with (
        app.test_request_context(),
        patch.dict(app.config, {"MCP_RBAC_ENABLED": True}),
        patch("superset.mcp_service.auth.security_manager", security_manager),
    ):
        g.user = Mock(id=1, username="reader")
        assert check_tool_permission(tool.fn) is (resource == "Canvas")
        security_manager.can_access.assert_called_once_with("can_read", "Canvas")


@pytest.mark.asyncio
async def test_discovery_versions_follow_the_canonical_contract() -> None:
    # A registered extension may have a different props version from the Canvas
    # definition format. Neither response may substitute a hard-coded version.
    with patch.object(Balloons, "schema_version", 7):
        async with Client(mcp) as client:
            result = await client.call_tool("list_widget_types", {})
            catalog = json.loads(result.content[0].text)
            assert catalog["definition_version"] == DEFINITION_VERSION
            types = {item["id"]: item for item in catalog["widget_types"]}
            assert types["balloons"]["schema_version"] == 7
            assert all("properties" not in item for item in types.values())
            for extra in ({}, {"paths": ["customize"]}, {"paths": ["invalid"]}):
                result = await client.call_tool(
                    "get_widget_control_schema", {"widget_type": "balloons", **extra}
                )
                detail = json.loads(result.content[0].text)
                assert detail["widget_type"] == "balloons"
                assert detail["schema_version"] == 7
                assert detail["definition_version"] == catalog["definition_version"]
            result = await client.call_tool(
                "get_widget_control_schema", {"widget_type": "does-not-exist"}
            )
            unknown = json.loads(result.content[0].text)
            assert unknown["widget_type"] == "does-not-exist"
            assert unknown["schema_version"] is None
            assert unknown["error"]["error_type"] == "invalid_widget_type"


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for client-based tool tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@pytest.mark.asyncio
async def test_tools_registered_and_callable() -> None:
    async with Client(mcp) as client:
        names = {t.name for t in await client.list_tools()}
        assert {"list_widget_types", "get_widget_control_schema"} <= names
        # The separate field-schema tool was folded into get_widget_control_schema.
        assert "get_widget_control_field_schema" not in names

        result = await client.call_tool(
            "get_widget_control_schema", {"widget_type": "metric-tile"}
        )
        data = json.loads(result.content[0].text)["control_schema"]
        assert data["x-disclosure"] == "minimal"
        assert "dataBinding" in data["properties"]

        # Passing paths returns the requested subtrees instead of the root.
        drilled = await client.call_tool(
            "get_widget_control_schema",
            {"widget_type": "balloons", "paths": ["dataBinding"]},
        )
        drilled_data = json.loads(drilled.content[0].text)
        assert "datasetId" in drilled_data["subtrees"]["dataBinding"]["properties"]
