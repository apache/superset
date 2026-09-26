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

"""Tests for the permission-filtered ``get_catalog`` MCP tool.

These run the real DAO ``base_filter`` implementations (DatabaseFilter,
DatasourceFilter, ChartFilter, DashboardAccessFilter) against an in-memory
database. Roles are simulated at the security-manager grant lookups those
filters consult (``can_access``, ``user_view_menu_names``, ...), so the grant
set can be changed between calls to model a revoked permission.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import ExitStack
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from flask import g
from pydantic import ValidationError
from sqlalchemy.orm.session import Session

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import MCPPermissionDeniedError
from superset.mcp_service.catalog.schemas import (
    CATALOG_MAX_RESPONSE_BYTES,
    CatalogItem,
    GetCatalogRequest,
)
from superset.mcp_service.catalog.tool.get_catalog import (
    build_catalog_page,
    decode_cursor,
    encode_cursor,
)
from superset.utils import json

# Values that must never appear in catalog output, planted in fields that the
# regular list/get serializers do expose (SQL, extra, params, metrics, ...).
MARKER_SQL = "SELECT secret_sql_marker FROM hidden"
MARKER_EXTRA = '{"secret_extra_marker": true}'
MARKER_TEMPLATE = '{"secret_template_marker": 1}'
MARKER_METRIC = "SUM(secret_metric_marker)"
MARKER_PARAMS = '{"secret_params_marker": "x"}'
MARKER_URI = "postgresql://secret_user:secret_password@db.internal/secret_db"
MARKER_JSON = '{"secret_position_marker": {}}'
FORBIDDEN_MARKERS = (
    "secret_sql_marker",
    "secret_extra_marker",
    "secret_template_marker",
    "secret_metric_marker",
    "secret_params_marker",
    "secret_password",
    "secret_position_marker",
)
FORBIDDEN_KEYS = {
    "sql",
    "extra",
    "template_params",
    "params",
    "metrics",
    "expression",
    "sqlalchemy_uri",
    "query_context",
    "form_data",
    "json_metadata",
    "position_json",
    "owners",
    "schema",
    "database_name",
    "datasource_name",
}
ALLOWED_ITEM_KEYS = set(CatalogItem.model_fields)

TABLE_A_PERM = "[examples].[table_a](id:1)"
TABLE_B_PERM = "[examples].[table_b](id:2)"
DATABASE_PERM = "[examples].(id:1)"


@dataclass
class Role:
    """A simulated principal: class permissions plus data-access grants."""

    name: str
    permissions: set[tuple[str, str]]
    all_datasource_access: bool = False
    all_database_access: bool = False
    is_admin: bool = False
    grants: dict[str, set[str]] = field(default_factory=dict)

    def can_access(self, permission_name: str, view_name: str) -> bool:
        return self.is_admin or (permission_name, view_name) in self.permissions

    def view_menu_names(self, permission_name: str) -> set[str]:
        return set(self.grants.get(permission_name, set()))


READ_ALL = {
    ("can_read", "Chart"),
    ("can_read", "Dashboard"),
    ("can_read", "Dataset"),
    ("can_read", "Database"),
}


def admin_role() -> Role:
    return Role(
        name="Admin",
        permissions=set(),
        all_datasource_access=True,
        all_database_access=True,
        is_admin=True,
    )


def gamma_with_table_a_grant() -> Role:
    """Gamma-like role with a datasource-level grant on table_a only."""
    return Role(
        name="Gamma+table_a",
        permissions=READ_ALL | {("can_get_drill_info", "Dataset")},
        grants={"datasource_access": {TABLE_A_PERM}},
    )


def viewer_without_data_model_access() -> Role:
    """Can read charts/dashboards on table_a, but has no data-model access."""
    return Role(
        name="Viewer",
        permissions=set(READ_ALL),
        grants={"datasource_access": {TABLE_A_PERM}},
    )


@pytest.fixture(autouse=True)
def enable_mcp_rbac(app: Any, disable_mcp_rbac: None) -> None:
    """Run with RBAC on: the package conftest turns it off for mock users."""
    app.config["MCP_RBAC_ENABLED"] = True


@pytest.fixture
def act_as() -> Iterator[Any]:
    """Return a function that makes ``role`` the current principal."""
    from superset import security_manager

    stack = ExitStack()
    current: dict[str, Role] = {}

    def _role() -> Role:
        return current["role"]

    stack.enter_context(
        patch.object(
            security_manager,
            "can_access",
            side_effect=lambda perm, view: _role().can_access(perm, view),
        )
    )
    stack.enter_context(
        patch.object(
            security_manager,
            "can_access_all_datasources",
            side_effect=lambda: _role().all_datasource_access,
        )
    )
    stack.enter_context(
        patch.object(
            security_manager,
            "can_access_all_databases",
            side_effect=lambda: _role().all_database_access,
        )
    )
    stack.enter_context(
        patch.object(security_manager, "is_admin", side_effect=lambda: _role().is_admin)
    )
    stack.enter_context(
        patch.object(
            security_manager,
            "user_view_menu_names",
            side_effect=lambda perm: _role().view_menu_names(perm),
        )
    )
    stack.enter_context(
        patch.object(security_manager, "get_accessible_databases", return_value=[])
    )
    stack.enter_context(
        patch.object(security_manager, "is_guest_user", return_value=False)
    )
    stack.enter_context(
        patch.object(
            security_manager, "get_current_guest_user_if_guest", return_value=None
        )
    )

    def _act_as(role: Role) -> Role:
        current["role"] = role
        g.user = SimpleNamespace(
            id=None, username=role.name, is_authenticated=True, roles=[]
        )
        return role

    with stack:
        yield _act_as


@pytest.fixture
def catalog_fixtures(session: Session) -> SimpleNamespace:
    """One database, two datasets, two charts and two dashboards.

    Every data-model field the catalog must never expose is populated with a
    recognizable marker.
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable, SqlMetric
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(
        id=1,
        database_name="examples",
        sqlalchemy_uri=MARKER_URI,
        extra=MARKER_EXTRA,
    )
    session.add(database)
    session.flush()

    table_a = SqlaTable(
        id=1,
        table_name="table_a",
        database_id=database.id,
        schema="secret_schema",
        sql=MARKER_SQL,
        extra=MARKER_EXTRA,
        template_params=MARKER_TEMPLATE,
        description="Orders fact table",
        perm=TABLE_A_PERM,
        metrics=[SqlMetric(metric_name="revenue", expression=MARKER_METRIC)],
    )
    table_b = SqlaTable(
        id=2,
        table_name="table_b",
        database_id=database.id,
        sql=MARKER_SQL,
        description="Payroll",
        perm=TABLE_B_PERM,
    )
    session.add_all([table_a, table_b])
    session.flush()

    chart_a = Slice(
        id=1,
        slice_name="Revenue by month",
        description="Monthly revenue",
        datasource_id=table_a.id,
        datasource_type="table",
        datasource_name="table_a",
        viz_type="table",
        params=MARKER_PARAMS,
        query_context=MARKER_PARAMS,
        perm=TABLE_A_PERM,
    )
    chart_b = Slice(
        id=2,
        slice_name="Salaries",
        datasource_id=table_b.id,
        datasource_type="table",
        datasource_name="table_b",
        viz_type="table",
        params=MARKER_PARAMS,
        perm=TABLE_B_PERM,
    )
    session.add_all([chart_a, chart_b])
    session.flush()
    # set_related_perm recomputes perms on flush; pin them for the filters.
    chart_a.perm = TABLE_A_PERM
    chart_b.perm = TABLE_B_PERM

    dashboard_a = Dashboard(
        id=1,
        dashboard_title="Sales",
        slug="sales",
        description="Sales overview",
        published=True,
        slices=[chart_a],
        json_metadata=MARKER_JSON,
        position_json=MARKER_JSON,
    )
    dashboard_b = Dashboard(
        id=2,
        dashboard_title="HR",
        published=True,
        slices=[chart_b],
        json_metadata=MARKER_JSON,
    )
    session.add_all([dashboard_a, dashboard_b])
    session.flush()

    return SimpleNamespace(
        session=session,
        database=database,
        table_a=table_a,
        table_b=table_b,
        chart_a=chart_a,
        chart_b=chart_b,
        dashboard_a=dashboard_a,
        dashboard_b=dashboard_b,
    )


def _page(asset_type: str, **kwargs: Any) -> Any:
    return build_catalog_page(GetCatalogRequest(asset_type=asset_type, **kwargs))


def _names(asset_type: str, **kwargs: Any) -> list[str]:
    return [item.name for item in _page(asset_type, **kwargs).items]


def _assert_allowlisted(payload: dict[str, Any]) -> None:
    text = json.dumps(payload)
    for marker in FORBIDDEN_MARKERS:
        assert marker not in text, marker
    assert "secret_schema" not in text
    for item in payload["items"]:
        assert set(item) <= ALLOWED_ITEM_KEYS
        assert not FORBIDDEN_KEYS & set(item)


# ---------------------------------------------------------------------------
# Role-based visibility (same DAO filters as the list tools)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("asset_type", "expected"),
    [
        ("databases", ["examples"]),
        ("datasets", ["table_a", "table_b"]),
        ("charts", ["Revenue by month", "Salaries"]),
        ("dashboards", ["Sales", "HR"]),
    ],
)
def test_admin_sees_every_asset(
    catalog_fixtures: SimpleNamespace, act_as: Any, asset_type: str, expected: list[str]
) -> None:
    act_as(admin_role())
    page = _page(asset_type)
    assert [item.name for item in page.items] == expected
    assert page.restricted is False
    assert page.next_cursor is None


@pytest.mark.parametrize(
    ("asset_type", "expected"),
    [
        ("databases", ["examples"]),
        ("datasets", ["table_a"]),
        ("charts", ["Revenue by month"]),
        ("dashboards", ["Sales"]),
    ],
)
def test_datasource_grant_limits_visibility(
    catalog_fixtures: SimpleNamespace, act_as: Any, asset_type: str, expected: list[str]
) -> None:
    """A Gamma-like user with a grant on table_a sees only table_a assets."""
    act_as(gamma_with_table_a_grant())
    assert _names(asset_type) == expected


@pytest.mark.parametrize("asset_type", ["databases", "datasets"])
def test_user_without_data_model_access_gets_restricted_section(
    catalog_fixtures: SimpleNamespace, act_as: Any, asset_type: str
) -> None:
    """Data-model metadata is replaced by an explicit restricted marker."""
    act_as(viewer_without_data_model_access())
    page = _page(asset_type)
    assert page.restricted is True
    assert page.items == []
    assert page.next_cursor is None
    assert page.message


@pytest.mark.parametrize(
    ("asset_type", "expected"),
    [("charts", ["Revenue by month"]), ("dashboards", ["Sales"])],
)
def test_user_without_data_model_access_still_lists_content(
    catalog_fixtures: SimpleNamespace, act_as: Any, asset_type: str, expected: list[str]
) -> None:
    act_as(viewer_without_data_model_access())
    page = _page(asset_type)
    assert page.restricted is False
    assert [item.name for item in page.items] == expected


@pytest.mark.parametrize("asset_type", ["databases", "datasets", "charts"])
def test_missing_class_permission_is_denied(
    catalog_fixtures: SimpleNamespace, act_as: Any, asset_type: str
) -> None:
    """Without can_read on the asset class the generic denial is raised."""
    role = gamma_with_table_a_grant()
    view = {"databases": "Database", "datasets": "Dataset", "charts": "Chart"}[
        asset_type
    ]
    role.permissions.discard(("can_read", view))
    act_as(role)
    with pytest.raises(MCPPermissionDeniedError):
        _page(asset_type)


@pytest.mark.parametrize(
    ("asset_type", "before", "after"),
    [
        ("datasets", ["table_a"], []),
        ("charts", ["Revenue by month"], []),
        ("dashboards", ["Sales"], []),
        ("databases", ["examples"], []),
    ],
)
def test_revoked_grant_disappears_on_next_call(
    catalog_fixtures: SimpleNamespace,
    act_as: Any,
    asset_type: str,
    before: list[str],
    after: list[str],
) -> None:
    """Nothing is cached: the next read after a revocation reflects it."""
    role = act_as(gamma_with_table_a_grant())
    assert _names(asset_type) == before

    role.grants["datasource_access"].clear()

    assert _names(asset_type) == after


def test_revoked_data_model_access_becomes_restricted(
    catalog_fixtures: SimpleNamespace, act_as: Any
) -> None:
    role = act_as(gamma_with_table_a_grant())
    assert _page("datasets").restricted is False

    role.permissions.discard(("can_get_drill_info", "Dataset"))

    page = _page("datasets")
    assert page.restricted is True
    assert page.items == []


def test_restricted_user_sees_different_page_than_admin_in_same_process(
    catalog_fixtures: SimpleNamespace, act_as: Any
) -> None:
    """An admin read never leaks into a following restricted read."""
    act_as(admin_role())
    assert _names("dashboards") == ["Sales", "HR"]
    act_as(gamma_with_table_a_grant())
    assert _names("dashboards") == ["Sales"]


# ---------------------------------------------------------------------------
# Field allowlist
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "asset_type", ["databases", "datasets", "charts", "dashboards"]
)
def test_output_is_allowlisted(
    catalog_fixtures: SimpleNamespace, act_as: Any, asset_type: str
) -> None:
    """SQL, extra, params, metrics and connection info are never present."""
    act_as(admin_role())
    payload = _page(asset_type).model_dump(mode="json")
    assert payload["items"]
    _assert_allowlisted(payload)


def test_item_fields_and_links(catalog_fixtures: SimpleNamespace, act_as: Any) -> None:
    act_as(admin_role())
    dataset = _page("datasets").items[0]
    assert dataset.id == catalog_fixtures.table_a.id
    assert dataset.uuid == str(catalog_fixtures.table_a.uuid)
    assert dataset.description == "Orders fact table"
    assert dataset.url is not None
    assert dataset.url.endswith("/explore/?datasource_type=table&datasource_id=1")

    chart = _page("charts").items[0]
    assert chart.url is not None
    assert chart.url.endswith("/explore/?slice_id=1")

    dashboards = _page("dashboards").items
    assert dashboards[0].url is not None
    assert dashboards[0].url.endswith("/dashboard/sales/")
    assert dashboards[1].url is not None
    assert dashboards[1].url.endswith("/dashboard/2/")

    database = _page("databases").items[0]
    assert database.url is None
    assert database.description is None


def test_item_schema_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        CatalogItem(id=1, name="x", sql=MARKER_SQL)


def test_search_matches_name(catalog_fixtures: SimpleNamespace, act_as: Any) -> None:
    act_as(admin_role())
    assert _names("charts", search="salar") == ["Salaries"]
    # Search is name-only: a description or SQL match does not count.
    assert _names("datasets", search="secret_sql_marker") == []
    assert _names("charts", search="%") == []


def test_soft_deleted_assets_are_excluded(
    catalog_fixtures: SimpleNamespace, act_as: Any
) -> None:
    from datetime import datetime

    act_as(admin_role())
    catalog_fixtures.chart_b.deleted_at = datetime(2026, 1, 1)
    catalog_fixtures.session.flush()
    assert _names("charts") == ["Revenue by month"]


# ---------------------------------------------------------------------------
# Bounds and pagination
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("page_size", [0, 101, 1000])
def test_page_size_is_capped(page_size: int) -> None:
    with pytest.raises(ValidationError):
        GetCatalogRequest(asset_type="charts", page_size=page_size)


def test_request_rejects_unknown_arguments() -> None:
    with pytest.raises(ValidationError):
        GetCatalogRequest(asset_type="charts", select_columns=["sql"])
    with pytest.raises(ValidationError):
        GetCatalogRequest(asset_type="queries")


def _add_datasets(session: Session, count: int, start_id: int, **kwargs: Any) -> None:
    from superset.connectors.sqla.models import SqlaTable

    session.add_all(
        [
            SqlaTable(
                id=start_id + offset,
                table_name=f"bulk_{start_id + offset:05d}",
                database_id=1,
                sql=MARKER_SQL,
                perm=f"[examples].[bulk_{start_id + offset}]",
                **kwargs,
            )
            for offset in range(count)
        ]
    )
    session.flush()


def _collect(asset_type: str, page_size: int, **kwargs: Any) -> list[list[int]]:
    pages: list[list[int]] = []
    cursor = None
    for _ in range(100):
        page = _page(asset_type, page_size=page_size, cursor=cursor, **kwargs)
        pages.append([item.id for item in page.items])
        cursor = page.next_cursor
        if cursor is None:
            break
    return pages


def test_cursor_pages_are_complete_and_stable(
    catalog_fixtures: SimpleNamespace, act_as: Any
) -> None:
    """Keyset pages cover every row exactly once, even when rows are added
    or removed between page reads."""
    act_as(admin_role())
    session = catalog_fixtures.session
    _add_datasets(session, 248, start_id=10)  # 250 datasets in total

    first = _page("datasets", page_size=100)
    assert len(first.items) == 100
    assert first.next_cursor is not None

    # Concurrent change: a row on an already-read page is deleted and a new
    # row is appended. Offset pagination would shift and duplicate/skip.
    session.delete(catalog_fixtures.table_b)
    _add_datasets(session, 1, start_id=5000)

    ids = [item.id for item in first.items]
    cursor = first.next_cursor
    while cursor:
        page = _page("datasets", page_size=100, cursor=cursor)
        assert len(page.items) <= 100
        ids.extend(item.id for item in page.items)
        cursor = page.next_cursor

    assert ids == sorted(ids)
    assert len(ids) == len(set(ids))
    assert ids[-1] == 5000
    assert len(ids) == 251  # 250 read + 1 appended; the deleted row was read


def test_pagination_is_restricted_per_page(
    catalog_fixtures: SimpleNamespace, act_as: Any
) -> None:
    """A cursor minted for an admin carries no authority for another user."""
    act_as(admin_role())
    first = _page("datasets", page_size=1)
    assert [item.name for item in first.items] == ["table_a"]
    act_as(gamma_with_table_a_grant())
    page = _page("datasets", page_size=1, cursor=first.next_cursor)
    assert page.items == []
    assert page.next_cursor is None


def test_response_size_is_bounded(
    catalog_fixtures: SimpleNamespace, act_as: Any
) -> None:
    """100 long entries are split across pages to stay under 32 KiB."""
    act_as(admin_role())
    session = catalog_fixtures.session
    _add_datasets(session, 150, start_id=10, description="d" * 5000)

    pages = []
    cursor = None
    while True:
        page = _page("datasets", page_size=100, cursor=cursor)
        payload = page.model_dump(mode="json")
        size = len(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        assert size <= CATALOG_MAX_RESPONSE_BYTES
        _assert_allowlisted(payload)
        pages.append(page)
        cursor = page.next_cursor
        if cursor is None:
            break

    assert pages[0].truncated is True
    assert len(pages[0].items) < 100
    assert all(
        item.description is None or len(item.description) <= 500
        for page in pages
        for item in page.items
    )
    ids = [item.id for page in pages for item in page.items]
    assert len(ids) == len(set(ids)) == 152


def test_cursor_is_bound_to_asset_type_and_search() -> None:
    cursor = encode_cursor("datasets", "sales", 42)
    assert decode_cursor(cursor, "datasets", "sales") == 42
    with pytest.raises(ValueError, match="Invalid cursor"):
        decode_cursor(cursor, "charts", "sales")
    with pytest.raises(ValueError, match="Invalid cursor"):
        decode_cursor(cursor, "datasets", None)
    for garbage in ("not-a-cursor", "!!!", "eyJ2IjoxfQ", encode_cursor("x", None, 1)):
        with pytest.raises(ValueError, match="Invalid cursor"):
            decode_cursor(garbage, "datasets", None)


# ---------------------------------------------------------------------------
# Tool registration and MCP round trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tool_is_registered_read_only() -> None:
    tool = await mcp.get_tool("get_catalog")
    assert tool is not None
    assert tool.annotations is not None
    assert tool.annotations.readOnlyHint is True
    assert tool.annotations.destructiveHint is False


@pytest.fixture
def mcp_user() -> Iterator[None]:
    with patch("superset.mcp_service.auth.get_user_from_request") as get_user:
        get_user.return_value = SimpleNamespace(
            id=None, username="gamma", is_authenticated=True, roles=[]
        )
        yield


@pytest.mark.asyncio
async def test_get_catalog_over_mcp(
    catalog_fixtures: SimpleNamespace, act_as: Any, mcp_user: None
) -> None:
    act_as(gamma_with_table_a_grant())
    async with Client(mcp) as client:
        result = await client.call_tool(
            "get_catalog", {"request": {"asset_type": "datasets", "page_size": 10}}
        )
    payload = json.loads(result.content[0].text)
    assert [item["name"] for item in payload["items"]] == ["table_a"]
    assert payload["restricted"] is False
    _assert_allowlisted(payload)


@pytest.mark.asyncio
async def test_get_catalog_over_mcp_rejects_oversized_page(mcp_user: None) -> None:
    async with Client(mcp) as client:
        with pytest.raises(ToolError):
            await client.call_tool(
                "get_catalog", {"request": {"asset_type": "charts", "page_size": 500}}
            )
