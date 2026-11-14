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

"""Semantic source discovery reads authorized scalar projections, never providers."""

from __future__ import annotations

import importlib
import inspect
from unittest.mock import Mock, patch, PropertyMock
from uuid import UUID

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from pydantic import ValidationError
from sqlalchemy import Column, create_engine, event, MetaData, Table
from sqlalchemy.pool import StaticPool

from superset.daos.semantic_layer import SemanticViewDAO
from superset.mcp_service.app import mcp
from superset.mcp_service.dashboard_scope import DashboardScope
from superset.mcp_service.dataset_scope import (
    enforce_call_dataset_scope,
    MCPDatasetScopeError,
    SCOPED_TOOLS,
)
from superset.mcp_service.privacy import (
    DATA_MODEL_METADATA_ERROR_TYPE,
    tool_requires_data_model_metadata_access,
)
from superset.mcp_service.semantic_layer.schemas import ListSemanticViewsRequest
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.utils import json

module = importlib.import_module(
    "superset.mcp_service.semantic_layer.tool.list_semantic_views"
)


@pytest.mark.parametrize(
    "parameters",
    [
        {"page": 0},
        {"page_size": 101},
        {"page_size": True},
        {"search": "x" * 201},
        {"include_metrics": True},
    ],
)
def test_source_request_bounds(parameters):
    with pytest.raises(ValidationError):
        ListSemanticViewsRequest(**parameters)


@pytest.fixture
def session_engine():
    """Sequential MCP worker calls share this isolated in-memory database."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    yield engine
    engine.dispose()


@pytest.fixture
def sources(session, monkeypatch):
    """Encrypted configuration columns are deliberately absent from this database."""
    metadata = MetaData()
    tables = {}
    for model, names in [
        (SemanticLayer, ["uuid", "type", "perm"]),
        (
            SemanticView,
            ["id", "uuid", "name", "description", "perm", "semantic_layer_uuid"],
        ),
    ]:
        tables[model] = Table(
            model.__tablename__,
            metadata,
            *[
                Column(
                    name,
                    model.__table__.c[name].type,
                    primary_key=model.__table__.c[name].primary_key,
                )
                for name in names
            ],
        )
    metadata.create_all(session.get_bind())
    session.execute(
        tables[SemanticLayer].insert(),
        [
            {
                "uuid": UUID(int=n),
                "type": "snowflake" if n == 1 else "metricflow",
                "perm": f"layer{n}",
            }
            for n in [1, 2]
        ],
    )
    session.execute(
        tables[SemanticView].insert(),
        [
            {
                "id": n,
                "uuid": UUID(int=n),
                "name": f"Source{n:03}",
                "description": "literal_%" if n == 3 else "description",
                "perm": f"view{n}",
                "semantic_layer_uuid": UUID(int=1 if n < 100 else 2),
            }
            for n in range(1, 111)
        ],
    )
    from superset import security_manager

    grants = {"layer1"}
    monkeypatch.setattr(security_manager, "can_access_all_datasources", lambda: False)
    monkeypatch.setattr(security_manager, "user_view_menu_names", lambda _kind: grants)
    monkeypatch.setattr(module, "user_can_view_data_model_metadata", lambda: True)
    monkeypatch.setattr(module, "is_semantic_layers_enabled", lambda: True)
    monkeypatch.setattr(module, "get_dataset_scope", lambda: None)
    statements = []

    def record(_connection, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    event.listen(session.get_bind(), "before_cursor_execute", record)
    yield grants, statements
    event.remove(session.get_bind(), "before_cursor_execute", record)


def test_scalar_index_filters_before_paging_and_never_loads_config(sources):
    grants, statements = sources
    with patch.object(
        SemanticLayer,
        "implementation",
        new_callable=PropertyMock,
        side_effect=AssertionError("provider called"),
    ):
        rows = SemanticViewDAO.find_accessible_summaries(
            search=None, offset=25, limit=26
        )
    assert len(rows) == 26
    assert rows[0].id == 26
    assert len(statements) == 1
    assert "LIMIT" in statements[0]
    assert "OFFSET" in statements[0]
    assert "configuration" not in statements[0]
    assert "semantic_layers.name" not in statements[0]
    grants.clear()
    grants.add("view110")
    rows = SemanticViewDAO.find_accessible_summaries(search=None, offset=0, limit=26)
    assert [row.id for row in rows] == [110]
    assert rows[0].provider == "metricflow"
    grants.clear()
    assert (
        SemanticViewDAO.find_accessible_summaries(search=None, offset=0, limit=26) == []
    )


def test_source_search_literal_substring(sources):
    rows = SemanticViewDAO.find_accessible_summaries(search="_%", offset=0, limit=26)
    assert [row.id for row in rows] == [3]
    rows = SemanticViewDAO.find_accessible_summaries(
        search="sOURCE003", offset=0, limit=26
    )
    assert [row.id for row in rows] == [3]


@pytest.mark.asyncio
async def test_tool_default_page_and_continuation(sources):
    with patch(
        "superset.mcp_service.auth.get_user_from_request",
        return_value=Mock(id=1, username="admin", is_guest_user=False),
    ):
        async with Client(mcp) as client:
            first = json.loads(
                (await client.call_tool("list_semantic_views", {})).content[0].text
            )
            second = json.loads(
                (
                    await client.call_tool(
                        "list_semantic_views", {"request": {"page": first["next_page"]}}
                    )
                )
                .content[0]
                .text
            )
    assert len(first["sources"]) == 25
    assert first["has_more"]
    assert first["next_page"] == 2
    assert second["sources"][0]["source"] == {"type": "semantic_view", "id": 26}
    assert set(first) == {"sources", "page", "page_size", "has_more", "next_page"}
    assert set(first["sources"][0]) == {"source", "uuid", "name", "provider"}


@pytest.mark.asyncio
@pytest.mark.parametrize("view_access", [False, True])
async def test_dashboard_filters_do_not_replace_source_grants(sources, view_access):
    grants, _ = sources
    grants.clear()
    if view_access:
        grants.add("view110")
    scope = DashboardScope(
        dashboard_id=7,
        chart_filters={11: {"filters": [{"col": "country", "op": "==", "val": "US"}]}},
    )
    with (
        patch(
            "superset.mcp_service.dashboard_scope.get_request_dashboard_scope",
            return_value=scope,
        ),
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="reader", is_guest_user=False),
        ),
        patch.object(
            SemanticViewDAO,
            "find_accessible_summaries",
            wraps=SemanticViewDAO.find_accessible_summaries,
        ) as discovery,
    ):
        async with Client(mcp) as client:
            response = json.loads(
                (await client.call_tool("list_semantic_views", {})).content[0].text
            )
    discovery.assert_called_once_with(search=None, offset=0, limit=26)
    assert [source["source"]["id"] for source in response["sources"]] == (
        [110] if view_access else []
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("gate", ["feature", "privacy", "routing"])
async def test_source_gate_precedes_dao(gate, monkeypatch):
    monkeypatch.setattr(module, "is_semantic_layers_enabled", lambda: gate != "feature")
    monkeypatch.setattr(
        module, "user_can_view_data_model_metadata", lambda: gate != "privacy"
    )
    monkeypatch.setattr(
        module, "get_dataset_scope", lambda: frozenset() if gate == "routing" else None
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", is_guest_user=False),
        ),
        patch.object(
            SemanticViewDAO,
            "find_accessible_summaries",
            side_effect=AssertionError("DAO called before gate"),
        ),
    ):
        async with Client(mcp) as client:
            if gate == "routing":
                with pytest.raises(ToolError, match="configured dataset scope"):
                    await client.call_tool("list_semantic_views", {})
            else:
                result = json.loads(
                    (await client.call_tool("list_semantic_views", {})).content[0].text
                )
                assert result["error_type"] == (
                    "SemanticLayersDisabledError"
                    if gate == "feature"
                    else DATA_MODEL_METADATA_ERROR_TYPE
                )


def test_index_remains_outside_dataset_routing_allowlist():
    assert "list_semantic_views" not in SCOPED_TOOLS
    assert tool_requires_data_model_metadata_access(module.list_semantic_views)


def test_routing_auth_hook_refuses_source_index(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.dataset_scope.get_dataset_scope", lambda: frozenset()
    )
    with pytest.raises(MCPDatasetScopeError, match="configured dataset scope"):
        enforce_call_dataset_scope("list_semantic_views", inspect.Signature(), (), {})
