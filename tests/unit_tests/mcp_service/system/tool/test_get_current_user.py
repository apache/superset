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

"""Tests for current_user in get_instance_info and created_by_fk filtering."""

from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import ChartFilter
from superset.mcp_service.dashboard.schemas import DashboardFilter
from superset.mcp_service.system.schemas import InstanceInfo, UserInfo
from superset.utils import json

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


# ---------------------------------------------------------------------------
# Helper to build a minimal InstanceInfo
# ---------------------------------------------------------------------------
def _make_instance_info(**kwargs):
    """Build a minimal InstanceInfo with defaults; override with kwargs."""
    from datetime import datetime, timezone

    from superset.mcp_service.system.schemas import (
        DashboardBreakdown,
        DatabaseBreakdown,
        InstanceSummary,
        PopularContent,
        RecentActivity,
    )

    defaults = {
        "instance_summary": InstanceSummary(
            total_dashboards=0,
            total_charts=0,
            total_datasets=0,
            total_databases=0,
            total_users=0,
            total_roles=0,
            total_tags=0,
            avg_charts_per_dashboard=0.0,
        ),
        "recent_activity": RecentActivity(
            dashboards_created_last_30_days=0,
            charts_created_last_30_days=0,
            datasets_created_last_30_days=0,
            dashboards_modified_last_7_days=0,
            charts_modified_last_7_days=0,
            datasets_modified_last_7_days=0,
        ),
        "dashboard_breakdown": DashboardBreakdown(
            published=0,
            unpublished=0,
            certified=0,
            with_charts=0,
            without_charts=0,
        ),
        "database_breakdown": DatabaseBreakdown(by_type={}),
        "popular_content": PopularContent(top_tags=[], top_creators=[]),
        "timestamp": datetime.now(timezone.utc),
    }
    defaults.update(kwargs)
    return InstanceInfo(**defaults)


# ---------------------------------------------------------------------------
# Schema-level tests: UserInfo
# ---------------------------------------------------------------------------


def test_user_info_all_fields():
    """Test UserInfo with all fields populated."""
    user = UserInfo(
        id=42,
        username="sophie",
        first_name="Sophie",
        last_name="Test",
        email="sophie@example.com",
    )
    assert user.id == 42
    assert user.username == "sophie"
    assert user.first_name == "Sophie"
    assert user.last_name == "Test"
    assert user.email == "sophie@example.com"


def test_user_info_with_minimal_fields():
    """Test UserInfo with only required fields (all optional)."""
    user = UserInfo(id=1, username="admin")
    assert user.id == 1
    assert user.username == "admin"
    assert user.first_name is None
    assert user.last_name is None
    assert user.email is None


def test_user_info_serialization_roundtrip():
    """Test UserInfo can be serialized to dict and back."""
    user = UserInfo(id=7, username="testuser", first_name="Test", email="t@example.com")
    data = user.model_dump()
    assert data["id"] == 7
    assert data["username"] == "testuser"
    assert data["first_name"] == "Test"
    assert data["last_name"] is None
    assert data["email"] == "t@example.com"

    # Reconstruct
    user2 = UserInfo(**data)
    assert user2 == user


# ---------------------------------------------------------------------------
# Schema-level tests: InstanceInfo.current_user
# ---------------------------------------------------------------------------


def test_instance_info_current_user_default_none():
    """Test that InstanceInfo.current_user defaults to None."""
    info = _make_instance_info()
    assert info.current_user is None


def test_instance_info_with_current_user():
    """Test that InstanceInfo accepts a current_user UserInfo."""
    user = UserInfo(
        id=42,
        username="sophie",
        first_name="Sophie",
        last_name="Test",
        email="sophie@example.com",
    )
    info = _make_instance_info(current_user=user)
    assert info.current_user is not None
    assert info.current_user.id == 42
    assert info.current_user.username == "sophie"
    assert info.current_user.first_name == "Sophie"
    assert info.current_user.last_name == "Test"
    assert info.current_user.email == "sophie@example.com"


def test_instance_info_current_user_in_serialized_output():
    """Test current_user appears when InstanceInfo is serialized to JSON."""
    user = UserInfo(id=1, username="admin", first_name="Admin")
    info = _make_instance_info(current_user=user)
    data = json.loads(info.model_dump_json())
    assert "current_user" in data
    assert data["current_user"]["id"] == 1
    assert data["current_user"]["username"] == "admin"
    assert data["current_user"]["first_name"] == "Admin"


def test_instance_info_none_current_user_in_serialized_output():
    """Test current_user is null when not set in serialized output."""
    info = _make_instance_info()
    data = json.loads(info.model_dump_json())
    assert "current_user" in data
    assert data["current_user"] is None


# ---------------------------------------------------------------------------
# Tool-level tests: get_instance_info via MCP Client
# ---------------------------------------------------------------------------


class TestGetInstanceInfoCurrentUserViaMCP:
    """Test get_instance_info tool returns current_user via MCP client."""

    @pytest.mark.asyncio
    async def test_get_instance_info_returns_current_user(self, mcp_server):
        """Test that get_instance_info populates current_user from g.user."""
        # Patch run_tool on the CLASS so all instances (including the
        # module-level _instance_info_core) use the mock.  We avoid patching
        # via dotted module path because __init__.py re-exports
        # get_instance_info as a function, which shadows the submodule name
        # and breaks mock resolution on Python 3.10.
        from superset.mcp_service.mcp_core import InstanceInfoCore

        mock_g_user = Mock()
        mock_g_user.id = 5
        mock_g_user.username = "sophie"
        mock_g_user.first_name = "Sophie"
        mock_g_user.last_name = "Beaumont"
        mock_g_user.email = "sophie@preset.io"

        with (
            patch.object(
                InstanceInfoCore,
                "run_tool",
                return_value=_make_instance_info(),
            ),
            patch("flask.g") as mock_g,
        ):
            mock_g.user = mock_g_user

            async with Client(mcp_server) as client:
                result = await client.call_tool("get_instance_info", {"request": {}})

        data = json.loads(result.content[0].text)
        assert "current_user" in data
        cu = data["current_user"]
        assert cu["id"] == 5
        assert cu["username"] == "sophie"
        assert cu["first_name"] == "Sophie"
        assert cu["last_name"] == "Beaumont"
        assert cu["email"] == "sophie@preset.io"

    @pytest.mark.asyncio
    async def test_get_instance_info_no_user_returns_null(self, mcp_server):
        """Test that current_user is null when g.user is not set."""
        from superset.mcp_service.mcp_core import InstanceInfoCore

        with (
            patch.object(
                InstanceInfoCore,
                "run_tool",
                return_value=_make_instance_info(),
            ),
            patch("flask.g") as mock_g,
        ):
            # Simulate no user on g so getattr(g, "user", None) returns None
            mock_g.user = None

            async with Client(mcp_server) as client:
                result = await client.call_tool("get_instance_info", {"request": {}})

        data = json.loads(result.content[0].text)
        assert data["current_user"] is None

    @pytest.mark.asyncio
    async def test_get_instance_info_user_missing_optional_attrs(self, mcp_server):
        """Test current_user when g.user is missing optional attributes."""
        from superset.mcp_service.mcp_core import InstanceInfoCore

        # User object with only id and username (no first_name, etc.)
        mock_g_user = Mock(spec=["id", "username"])
        mock_g_user.id = 99
        mock_g_user.username = "bot"

        with (
            patch.object(
                InstanceInfoCore,
                "run_tool",
                return_value=_make_instance_info(),
            ),
            patch("flask.g") as mock_g,
        ):
            mock_g.user = mock_g_user

            async with Client(mcp_server) as client:
                result = await client.call_tool("get_instance_info", {"request": {}})

        data = json.loads(result.content[0].text)
        cu = data["current_user"]
        assert cu["id"] == 99
        assert cu["username"] == "bot"
        # Missing attrs should be None via getattr default
        assert cu["first_name"] is None
        assert cu["last_name"] is None
        assert cu["email"] is None


# ---------------------------------------------------------------------------
# Filter schema tests: created_by_fk
# ---------------------------------------------------------------------------


def test_chart_filter_accepts_created_by_fk():
    """Test that ChartFilter accepts created_by_fk as a valid column."""
    f = ChartFilter(col="created_by_fk", opr="eq", value=42)
    assert f.col == "created_by_fk"
    assert f.opr == "eq"
    assert f.value == 42


def test_chart_filter_created_by_fk_with_ne_operator():
    """Test created_by_fk with 'ne' (not equal) operator."""
    f = ChartFilter(col="created_by_fk", opr="ne", value=1)
    assert f.col == "created_by_fk"
    assert f.opr == "ne"
    assert f.value == 1


def test_chart_filter_rejects_invalid_column():
    """Test that ChartFilter rejects invalid column names."""
    with pytest.raises(ValidationError):
        ChartFilter(col="nonexistent_column", opr="eq", value=42)


def test_dashboard_filter_accepts_created_by_fk():
    """Test that DashboardFilter accepts created_by_fk as a valid column."""
    f = DashboardFilter(col="created_by_fk", opr="eq", value=42)
    assert f.col == "created_by_fk"
    assert f.opr == "eq"
    assert f.value == 42


def test_dashboard_filter_created_by_fk_with_ne_operator():
    """Test created_by_fk with 'ne' (not equal) operator on dashboards."""
    f = DashboardFilter(col="created_by_fk", opr="ne", value=1)
    assert f.col == "created_by_fk"
    assert f.opr == "ne"
    assert f.value == 1


def test_dashboard_filter_rejects_invalid_column():
    """Test that DashboardFilter rejects invalid column names."""
    with pytest.raises(ValidationError):
        DashboardFilter(col="nonexistent_column", opr="eq", value=42)


# ---------------------------------------------------------------------------
# Existing filter columns still work
# ---------------------------------------------------------------------------


def test_chart_filter_existing_columns_still_work():
    """Test that pre-existing chart filter columns are not broken."""
    for col in ("slice_name", "viz_type", "datasource_name"):
        f = ChartFilter(col=col, opr="eq", value="test")
        assert f.col == col


def test_dashboard_filter_existing_columns_still_work():
    """Test that pre-existing dashboard filter columns are not broken."""
    for col in ("dashboard_title", "published", "favorite"):
        f = DashboardFilter(col=col, opr="eq", value="test")
        assert f.col == col
