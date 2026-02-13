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

import pytest
from pydantic import ValidationError

from superset.mcp_service.chart.schemas import ChartFilter
from superset.mcp_service.dashboard.schemas import DashboardFilter
from superset.mcp_service.system.schemas import InstanceInfo, UserInfo


def test_instance_info_current_user_default_none():
    """Test that InstanceInfo.current_user defaults to None."""
    from datetime import datetime, timezone

    from superset.mcp_service.system.schemas import (
        DashboardBreakdown,
        DatabaseBreakdown,
        InstanceSummary,
        PopularContent,
        RecentActivity,
    )

    info = InstanceInfo(
        instance_summary=InstanceSummary(
            total_dashboards=0,
            total_charts=0,
            total_datasets=0,
            total_databases=0,
            total_users=0,
            total_roles=0,
            total_tags=0,
            avg_charts_per_dashboard=0.0,
        ),
        recent_activity=RecentActivity(
            dashboards_created_last_30_days=0,
            charts_created_last_30_days=0,
            datasets_created_last_30_days=0,
            dashboards_modified_last_7_days=0,
            charts_modified_last_7_days=0,
            datasets_modified_last_7_days=0,
        ),
        dashboard_breakdown=DashboardBreakdown(
            published=0,
            unpublished=0,
            certified=0,
            with_charts=0,
            without_charts=0,
        ),
        database_breakdown=DatabaseBreakdown(by_type={}),
        popular_content=PopularContent(top_tags=[], top_creators=[]),
        timestamp=datetime.now(timezone.utc),
    )
    assert info.current_user is None


def test_instance_info_with_current_user():
    """Test that InstanceInfo accepts a current_user UserInfo."""
    from datetime import datetime, timezone

    from superset.mcp_service.system.schemas import (
        DashboardBreakdown,
        DatabaseBreakdown,
        InstanceSummary,
        PopularContent,
        RecentActivity,
    )

    user = UserInfo(
        id=42,
        username="sophie",
        first_name="Sophie",
        last_name="Test",
        email="sophie@example.com",
    )
    info = InstanceInfo(
        instance_summary=InstanceSummary(
            total_dashboards=0,
            total_charts=0,
            total_datasets=0,
            total_databases=0,
            total_users=0,
            total_roles=0,
            total_tags=0,
            avg_charts_per_dashboard=0.0,
        ),
        recent_activity=RecentActivity(
            dashboards_created_last_30_days=0,
            charts_created_last_30_days=0,
            datasets_created_last_30_days=0,
            dashboards_modified_last_7_days=0,
            charts_modified_last_7_days=0,
            datasets_modified_last_7_days=0,
        ),
        dashboard_breakdown=DashboardBreakdown(
            published=0,
            unpublished=0,
            certified=0,
            with_charts=0,
            without_charts=0,
        ),
        database_breakdown=DatabaseBreakdown(by_type={}),
        popular_content=PopularContent(top_tags=[], top_creators=[]),
        current_user=user,
        timestamp=datetime.now(timezone.utc),
    )
    assert info.current_user is not None
    assert info.current_user.id == 42
    assert info.current_user.username == "sophie"
    assert info.current_user.first_name == "Sophie"
    assert info.current_user.last_name == "Test"
    assert info.current_user.email == "sophie@example.com"


def test_user_info_with_minimal_fields():
    """Test UserInfo with only required fields (all optional)."""
    user = UserInfo(id=1, username="admin")
    assert user.id == 1
    assert user.username == "admin"
    assert user.first_name is None
    assert user.last_name is None
    assert user.email is None


def test_chart_filter_accepts_created_by_fk():
    """Test that ChartFilter accepts created_by_fk as a valid column."""
    f = ChartFilter(col="created_by_fk", opr="eq", value=42)
    assert f.col == "created_by_fk"
    assert f.opr == "eq"
    assert f.value == 42


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


def test_dashboard_filter_rejects_invalid_column():
    """Test that DashboardFilter rejects invalid column names."""
    with pytest.raises(ValidationError):
        DashboardFilter(col="nonexistent_column", opr="eq", value=42)
