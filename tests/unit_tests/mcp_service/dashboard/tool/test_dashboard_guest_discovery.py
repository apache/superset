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

"""Guest identity survives the dashboard tool's request/permalink lifecycle."""

import base64
import zlib
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from importlib import import_module
from typing import Any, cast
from unittest.mock import AsyncMock

import pytest
from flask import current_app, g
from flask_caching import Cache
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool

from superset.common.query_context import QueryContext
from superset.common.utils import query_cache_manager
from superset.connectors.sqla.models import SqlaTable
from superset.constants import CacheRegion
from superset.extensions import appbuilder, cache_manager
from superset.mcp_service.dashboard.schemas import GetDashboardInfoRequest
from superset.models.core import Database
from superset.models.embedded_dashboard import EmbeddedDashboard
from superset.security.guest_token import GuestToken, GuestUser
from superset.security.manager import SupersetSecurityManager
from superset.utils import json
from tests.unit_tests.mcp_service.dashboard.tool import (
    test_get_dashboard_filter_values as native_cases,
)

get_info = import_module("superset.mcp_service.dashboard.tool.get_dashboard_info")
native_query = native_cases.native_query


@pytest.fixture(autouse=True)
def mock_auth() -> None:
    """Use real request authentication instead of the directory's mocked user."""


@pytest.mark.asyncio
@pytest.mark.parametrize("scoped", [False, True])
async def test_guest_permalink_tool_preserves_rls_and_dataset_allowlist(
    native_query: dict[str, Any], mocker: MockerFixture, app: Any, scoped: bool
) -> None:
    """Guest token RLS and dataset restrictions govern native choice queries."""
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    with engine.begin() as connection:
        connection.execute(
            text("create table sales (region text, country text, amount integer)")
        )
        connection.execute(
            text(
                "insert into sales values ('EMEA', 'France', 1), "
                "('EMEA', 'Hidden', 0), ('Americas', 'US', 1)"
            )
        )
    dashboard = native_cases._dashboard(
        native_cases._filter(),
        native_cases._filter("country", cascadeParentIds=["region"]),
    )
    dashboard.created_on = dashboard.changed_on = datetime(2026, 1, 1)
    dashboard.embedded = [EmbeddedDashboard()]
    guest = GuestUser(
        cast(
            GuestToken,
            {
                "user": {"username": "embedded-viewer"},
                "resources": [{"type": "dashboard", "id": "1"}],
                "rls_rules": [{"dataset": "5", "clause": "amount > 0"}],
                "datasets": [5],
                "iat": 0,
                "exp": 9999999999,
            },
        ),
        [],
    )
    mocker.patch(
        "superset.is_feature_enabled",
        side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
    )
    mocker.patch(
        "superset.connectors.sqla.models.is_feature_enabled",
        side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
    )
    security = SupersetSecurityManager(appbuilder)

    def can_access(permission: str, resource: str) -> bool:
        """Supply the guest role's grants at the authorization metadata boundary."""
        return (permission, resource) == ("can_read", "Dashboard")

    mocker.patch.object(security, "can_access", side_effect=can_access)
    mocker.patch("superset.security_manager.can_access", side_effect=can_access)
    for name in ("can_access_schema", "is_editor"):
        mocker.patch.object(security, name, return_value=False)
    mocker.patch.object(security, "_semantic_layer_grant_allows", return_value=False)
    mocker.patch.object(security, "get_rls_filters", return_value=[])
    for name in (
        "get_rls_filters",
        "get_guest_rls_filters",
        "get_guest_rls_filters_str",
        "get_rls_cache_key",
    ):
        mocker.patch(
            f"superset.security_manager.{name}", side_effect=getattr(security, name)
        )
    native_query["authorize"].side_effect = security.raise_for_access
    mocker.stop(native_query["run"])
    query = mocker.patch("superset.db.session.query")
    query.return_value.filter.return_value.one_or_none.return_value = dashboard
    authorized_principals: list[Any] = []

    def authorized_dashboard(*args: Any, **kwargs: Any) -> Any:
        """Return fixture metadata only after the actual dashboard authorization."""
        authorized_principals.append(g.user)
        security.raise_for_access(dashboard=dashboard)
        return dashboard

    mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_id",
        side_effect=authorized_dashboard,
    )
    mocker.patch(
        "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug",
        side_effect=authorized_dashboard,
    )
    mocker.patch(
        "superset.commands.dashboard.permalink.get.decode_permalink_id", return_value=1
    )
    permalink_read = mocker.patch(
        "superset.daos.key_value.KeyValueDAO.get_value",
        return_value={
            "dashboardId": "1",
            "state": {
                "dataMask": {
                    "region": {"filterState": {"value": ["EMEA"]}, "extraFormData": {}}
                }
            },
        },
    )
    for module in ("schemas", "permalink", "tool.get_dashboard_info"):
        mocker.patch(
            f"superset.mcp_service.dashboard.{module}.user_can_view_data_model_metadata",
            return_value=False,
        )
    scope_header = base64.urlsafe_b64encode(
        zlib.compress(
            json.dumps({"version": 1, "dashboard_id": 1, "chart_filters": {}}).encode()
        )
    ).decode()
    mocker.patch(
        "superset.mcp_service.dashboard_scope._scope_header_values",
        return_value=[scope_header] if scoped else [],
    )
    mocker.patch.dict(app.config, {"MCP_RBAC_ENABLED": True, "MCP_DEV_USERNAME": None})

    @contextmanager
    def sqla_engine(*args: Any, **kwargs: Any) -> Iterator[Engine]:
        """Use the same populated SQLite database from the tool worker."""
        yield engine

    @contextmanager
    def raw_connection(*args: Any, **kwargs: Any) -> Iterator[Any]:
        """Retain actual DB-API execution and dataframe normalization."""
        with engine.connect() as connection:
            yield connection.connection

    mocker.patch.object(Database, "get_sqla_engine", side_effect=sqla_engine)
    mocker.patch.object(Database, "get_raw_connection", side_effect=raw_connection)
    mocker.patch.object(SqlaTable, "get_extra_cache_keys", return_value=[])
    data_cache = Cache(config={"CACHE_TYPE": "SimpleCache"})
    data_cache.init_app(current_app)
    mocker.patch.object(cache_manager, "_data_cache", data_cache)
    mocker.patch.dict(query_cache_manager._cache, {CacheRegion.DATA: data_cache})
    acquisition = mocker.spy(QueryContext, "get_df_payload")
    reads = mocker.spy(Database, "get_df")
    request = GetDashboardInfoRequest.model_validate(
        {
            "permalink_key": "guest-state",
            "include_filter_values": True,
            "filter_value_requests": [{"filter_id": "country"}],
            "select_columns": ["id", "native_filters"],
        }
    )
    with app.test_request_context("/mcp"):
        g.user = guest
        response = await get_info.get_dashboard_info(request=request, ctx=AsyncMock())
        assert isinstance(response, dict), response
        assert response["native_filters"][0]["available_values"]["values"] == ["France"]
        assert response["native_filters"][0]["targets"] == []
        assert response["filter_value_discovery"]["query_count"] == 1
        assert g.user is guest
        assert guest.rls == [{"dataset": "5", "clause": "amount > 0"}]
        assert guest.guest_token["datasets"] == [5]
        assert acquisition.call_count == 1
        assert reads.call_count == 1
        assert all(principal is guest for principal in authorized_principals)
        assert permalink_read.call_count >= 1

        # A warm query cache must not outlive a guest's dataset restrictions.
        guest.guest_token["datasets"] = [6]
        denied = await get_info.get_dashboard_info(request=request, ctx=AsyncMock())
        assert (
            denied["native_filters"][0]["available_values"]["reason"]
            == "permission_denied"
        )
        assert denied["filter_value_discovery"]["query_count"] == 0
        assert acquisition.call_count == 1
        assert reads.call_count == 1
    engine.dispose()
