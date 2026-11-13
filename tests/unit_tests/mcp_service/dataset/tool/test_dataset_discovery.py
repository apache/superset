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

"""Progressive metadata enforces real SQL access filters before bounded reads."""

from __future__ import annotations

import importlib
from unittest.mock import Mock, patch
from uuid import UUID

import pytest
from fastmcp import Client
from pydantic import ValidationError
from sqlalchemy import Column, create_engine, event, MetaData, Table, text
from sqlalchemy.pool import StaticPool

from superset.connectors.sqla.models import Database, SqlaTable, SqlMetric, TableColumn
from superset.mcp_service.app import mcp
from superset.mcp_service.dataset.discovery import discover_dataset
from superset.mcp_service.dataset.schemas import GetDatasetInfoRequest
from superset.mcp_service.privacy import DATA_MODEL_METADATA_ERROR_TYPE
from superset.utils import json


@pytest.mark.parametrize(
    "discovery",
    [
        {"section": "columns", "page": 0},
        {"section": "metrics", "page_size": 101},
        {"section": "columns", "page_size": True},
        {"section": "columns", "search": "x" * 201},
        {"section": "columns", "unknown": True},
    ],
)
def test_discovery_rejects_invalid_parameters(discovery):
    with pytest.raises(ValidationError):
        GetDatasetInfoRequest(identifier=1, discovery=discovery)


@pytest.mark.parametrize("selector", ["select_columns", "columns", "column_fields"])
def test_discovery_rejects_explicit_legacy_selectors(selector):
    with pytest.raises(ValidationError, match="legacy field selectors"):
        GetDatasetInfoRequest.model_validate(
            {"identifier": 1, "discovery": {}, selector: ["column_name"]}
        )
    # Defaults do not count as explicit selection, and legacy requests still work.
    assert (
        GetDatasetInfoRequest(identifier=1, discovery={}).discovery.section == "summary"
    )
    assert (
        GetDatasetInfoRequest(identifier=1, **{selector: ["column_name"]}).discovery
        is None
    )


@pytest.fixture
def session_engine():
    """Sequential MCP worker calls share this isolated in-memory database."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    yield engine
    engine.dispose()


@pytest.fixture
def catalog(session, monkeypatch):
    """Use mapped scalar columns with deliberately no relationship/config tables."""
    metadata = MetaData()
    specs = {
        Database: ["id"],
        SqlaTable: [
            "id",
            "uuid",
            "table_name",
            "description",
            "sql",
            "main_dttm_col",
            "deleted_at",
            "database_id",
            "perm",
            "schema_perm",
            "catalog_perm",
        ],
        TableColumn: [
            "id",
            "table_id",
            "column_name",
            "verbose_name",
            "description",
            "type",
            "filterable",
            "groupby",
            "is_dttm",
        ],
        SqlMetric: [
            "id",
            "table_id",
            "metric_name",
            "verbose_name",
            "description",
            "d3format",
        ],
    }
    tables = {}
    for model, names in specs.items():
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
    session.execute(tables[Database].insert(), {"id": 1})
    session.execute(
        tables[SqlaTable].insert(),
        [
            {
                "id": n,
                "uuid": UUID(int=n),
                "table_name": f"source{n}",
                "description": "Visible description",
                "sql": "SELECT secret FROM hidden" if n == 1 else None,
                "main_dttm_col": None,
                "deleted_at": None,
                "database_id": 1,
                "perm": f"source{n}",
                "schema_perm": "schema",
                "catalog_perm": "catalog",
            }
            for n in [1, 2]
        ],
    )
    session.execute(
        tables[TableColumn].insert(),
        [
            {
                "id": n,
                "table_id": 1,
                "column_name": f"column{n:03}",
                "verbose_name": None,
                "description": "literal_%" if n == 3 else "description",
                "type": "VARCHAR",
                "filterable": True,
                "groupby": True,
                "is_dttm": False,
            }
            for n in range(1, 111)
        ],
    )
    session.execute(
        tables[SqlMetric].insert(),
        [
            {
                "id": n,
                "table_id": 1,
                "metric_name": f"metric{n:03}",
                "verbose_name": None,
                "description": None,
                "d3format": ".2f",
            }
            for n in range(1, 31)
        ],
    )
    from superset import security_manager

    grants = {
        "datasource_access": {"source1"},
        "schema_access": set(),
        "catalog_access": set(),
    }
    monkeypatch.setattr(security_manager, "can_access_all_datasources", lambda: False)
    monkeypatch.setattr(security_manager, "get_accessible_databases", lambda: [])
    monkeypatch.setattr(
        security_manager, "user_view_menu_names", lambda kind: grants.get(kind, set())
    )
    monkeypatch.setattr("superset.utils.core.get_user_id", lambda: None)
    monkeypatch.setattr(
        "superset.mcp_service.dataset.discovery.get_dataset_scope", lambda: None
    )
    statements = []

    def record(_connection, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    event.listen(session.get_bind(), "before_cursor_execute", record)
    yield grants, statements
    event.remove(session.get_bind(), "before_cursor_execute", record)


@pytest.mark.parametrize(
    "discovery",
    [
        {},
        {"section": "summary", "search": None, "page": 1, "page_size": 25},
        {"section": "summary", "search": "not a match", "page": 3, "page_size": 10},
    ],
)
def test_summary_projects_no_members_or_sql(catalog, discovery):
    _, statements = catalog
    result = discover_dataset(
        GetDatasetInfoRequest(identifier=str(UUID(int=1)), discovery=discovery)
    )
    assert result.model_dump(mode="json") == {
        "source": {"type": "table", "id": 1, "uuid": str(UUID(int=1))},
        "section": "summary",
        "summary": {
            "uuid": str(UUID(int=1)),
            "name": "source1",
            "description": "Visible description",
            "is_virtual": True,
            "main_dttm_col": None,
        },
    }
    assert len(statements) == 1
    assert "table_columns" not in statements[0]
    assert "sql_metrics" not in statements[0]
    assert (
        "tables.sql AS" not in statements[0]
    )  # Only the is_virtual predicate is selected.
    assert "secret" not in str(result)


def test_member_pages_use_sql_limit_and_reauthorize(catalog):
    grants, statements = catalog
    first = discover_dataset(
        GetDatasetInfoRequest(identifier=1, discovery={"section": "columns"})
    )
    assert first.source.uuid == UUID(int=1)
    assert len(first.items) == 25
    assert first.next_page == 2
    assert first.has_more
    assert [item.column_name for item in first.items] == [
        f"column{n:03}" for n in range(1, 26)
    ]
    assert len(statements) == 2
    assert "LIMIT" in statements[-1]
    statements.clear()
    second = discover_dataset(
        GetDatasetInfoRequest(identifier=1, discovery={"section": "columns", "page": 2})
    )
    assert second.items[0].column_name == "column026"
    grants["datasource_access"].clear()
    statements.clear()
    denied = discover_dataset(
        GetDatasetInfoRequest(identifier=1, discovery={"section": "columns", "page": 3})
    )
    assert denied.error_type == "not_found"
    assert len(statements) == 1
    assert "table_columns" not in statements[0]


def test_search_is_literal_and_metrics_have_no_expressions(catalog):
    result = discover_dataset(
        GetDatasetInfoRequest(
            identifier=1, discovery={"section": "columns", "search": "_%"}
        )
    )
    assert [item.column_name for item in result.items] == ["column003"]
    assert result.next_page is None
    metrics = discover_dataset(
        GetDatasetInfoRequest(identifier=1, discovery={"section": "metrics", "page": 2})
    )
    assert metrics.source.uuid == UUID(int=1)
    assert len(metrics.items) == 5
    assert metrics.next_page is None
    assert all(
        set(item.model_dump())
        == {"metric_name", "verbose_name", "description", "d3format"}
        for item in metrics.items
    )


@pytest.mark.parametrize("kind", ["schema_access", "catalog_access"])
def test_dataset_schema_and_catalog_grants(catalog, kind):
    grants, _ = catalog
    grants["datasource_access"].clear()
    grants[kind].add("schema" if kind == "schema_access" else "catalog")
    assert (
        discover_dataset(GetDatasetInfoRequest(identifier=2, discovery={})).source.id
        == 2
    )


def test_inaccessible_missing_deleted_and_routing_sources(
    catalog, session, monkeypatch
):
    grants, _ = catalog
    for identifier in [2, 999, "not-an-id"]:
        assert (
            discover_dataset(
                GetDatasetInfoRequest(identifier=identifier, discovery={})
            ).error_type
            == "not_found"
        )
    session.execute(text("UPDATE tables SET deleted_at = '2026-01-01' WHERE id = 1"))
    assert (
        discover_dataset(GetDatasetInfoRequest(identifier=1, discovery={})).error_type
        == "not_found"
    )
    session.execute(text("UPDATE tables SET deleted_at = NULL WHERE id = 1"))
    monkeypatch.setattr(
        "superset.mcp_service.dataset.discovery.get_dataset_scope",
        lambda: frozenset({UUID(int=2)}),
    )
    assert (
        discover_dataset(GetDatasetInfoRequest(identifier=1, discovery={})).error_type
        == "not_found"
    )


@pytest.mark.asyncio
async def test_tool_discovery_does_not_enter_legacy_loader(catalog):
    module = importlib.import_module(
        "superset.mcp_service.dataset.tool.get_dataset_info"
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", is_guest_user=False),
        ),
        patch.object(module, "user_can_view_data_model_metadata", return_value=True),
        patch.object(
            module,
            "subqueryload",
            side_effect=AssertionError("legacy relationship load"),
        ),
        patch.object(
            module,
            "serialize_dataset_object",
            side_effect=AssertionError("legacy serializer"),
        ),
    ):
        async with Client(mcp) as client:
            response = await client.call_tool(
                "get_dataset_info", {"request": {"identifier": 1, "discovery": {}}}
            )
    assert json.loads(response.content[0].text)["section"] == "summary"


@pytest.mark.asyncio
async def test_discovery_privacy_denial_precedes_queries():
    module = importlib.import_module(
        "superset.mcp_service.dataset.tool.get_dataset_info"
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", is_guest_user=False),
        ),
        patch.object(module, "user_can_view_data_model_metadata", return_value=False),
        patch(
            "superset.mcp_service.dataset.discovery.discover_dataset",
            side_effect=AssertionError("must not query"),
        ),
    ):
        async with Client(mcp) as client:
            response = await client.call_tool(
                "get_dataset_info", {"request": {"identifier": 1, "discovery": {}}}
            )
    assert (
        json.loads(response.content[0].text)["error_type"]
        == DATA_MODEL_METADATA_ERROR_TYPE
    )


@pytest.mark.asyncio
async def test_discovery_backend_error_is_sanitized():
    module = importlib.import_module(
        "superset.mcp_service.dataset.tool.get_dataset_info"
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", is_guest_user=False),
        ),
        patch.object(module, "user_can_view_data_model_metadata", return_value=True),
        patch(
            "superset.mcp_service.dataset.discovery.discover_dataset",
            side_effect=RuntimeError("private database details"),
        ),
    ):
        async with Client(mcp) as client:
            response = await client.call_tool(
                "get_dataset_info", {"request": {"identifier": 1, "discovery": {}}}
            )
    result = json.loads(response.content[0].text)
    assert result["error_type"] == "InternalError"
    assert result["error"] == "Unable to retrieve dataset metadata."
