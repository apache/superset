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

"""
Unit tests for MCP get_embeddable_chart tool
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from superset.mcp_service.chart.schemas import (
    ColumnRef,
    FilterConfig,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.embedded_chart.schemas import (
    GetEmbeddableChartRequest,
    GetEmbeddableChartResponse,
)
from superset.mcp_service.embedded_chart.tool.get_embeddable_chart import (
    _ensure_guest_role_permissions,
)


class TestGetEmbeddableChartSchemas:
    """Tests for get_embeddable_chart schemas."""

    def test_request_with_xy_config(self):
        """Test request with XY chart config (same as generate_chart)."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="genre"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="bar",
        )
        request = GetEmbeddableChartRequest(
            datasource_id=22,
            config=config,
        )
        assert request.datasource_id == 22
        assert request.config.chart_type == "xy"
        assert request.config.x.name == "genre"
        assert request.config.y[0].aggregate == "SUM"
        assert request.config.kind == "bar"
        assert request.ttl_minutes == 60  # default
        assert request.height == 400  # default

    def test_request_with_table_config(self):
        """Test request with table chart config."""
        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="genre"),
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
            ],
        )
        request = GetEmbeddableChartRequest(
            datasource_id="dataset-uuid-here",
            config=config,
            ttl_minutes=120,
            height=600,
        )
        assert request.datasource_id == "dataset-uuid-here"
        assert request.config.chart_type == "table"
        assert len(request.config.columns) == 2
        assert request.ttl_minutes == 120
        assert request.height == 600

    def test_request_with_rls_rules(self):
        """Test request with row-level security rules."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="count", aggregate="COUNT")],
            kind="line",
        )
        request = GetEmbeddableChartRequest(
            datasource_id=123,
            config=config,
            rls_rules=[
                {"dataset": 123, "clause": "tenant_id = 42"},
                {"dataset": 123, "clause": "region = 'US'"},
            ],
        )
        assert len(request.rls_rules) == 2
        assert request.rls_rules[0]["clause"] == "tenant_id = 42"

    def test_request_with_allowed_domains(self):
        """Test request with allowed_domains for iframe security."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )
        request = GetEmbeddableChartRequest(
            datasource_id=1,
            config=config,
            allowed_domains=["https://example.com", "https://app.example.com"],
        )
        assert request.allowed_domains == [
            "https://example.com",
            "https://app.example.com",
        ]

    def test_request_ttl_validation(self):
        """Test TTL minutes validation bounds."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )
        # Valid min TTL
        request = GetEmbeddableChartRequest(
            datasource_id=1,
            config=config,
            ttl_minutes=1,
        )
        assert request.ttl_minutes == 1

        # Valid max TTL (1 week)
        request = GetEmbeddableChartRequest(
            datasource_id=1,
            config=config,
            ttl_minutes=10080,
        )
        assert request.ttl_minutes == 10080

        # Invalid TTL should raise
        with pytest.raises(ValueError, match="greater than or equal to 1"):
            GetEmbeddableChartRequest(
                datasource_id=1,
                config=config,
                ttl_minutes=0,  # below min
            )

        with pytest.raises(ValueError, match="less than or equal to 10080"):
            GetEmbeddableChartRequest(
                datasource_id=1,
                config=config,
                ttl_minutes=10081,  # above max
            )

    def test_request_height_validation(self):
        """Test height validation bounds."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )
        # Valid min height
        request = GetEmbeddableChartRequest(
            datasource_id=1,
            config=config,
            height=100,
        )
        assert request.height == 100

        # Valid max height
        request = GetEmbeddableChartRequest(
            datasource_id=1,
            config=config,
            height=2000,
        )
        assert request.height == 2000

        # Invalid heights should raise
        with pytest.raises(ValueError, match="greater than or equal to 100"):
            GetEmbeddableChartRequest(
                datasource_id=1,
                config=config,
                height=99,  # below min
            )

        with pytest.raises(ValueError, match="less than or equal to 2000"):
            GetEmbeddableChartRequest(
                datasource_id=1,
                config=config,
                height=2001,  # above max
            )

    def test_response_success(self):
        """Test successful response structure."""
        test_token = "jwt.token.here"  # noqa: S105
        response = GetEmbeddableChartResponse(
            success=True,
            iframe_url="http://localhost:9081/embedded/chart/?permalink_key=abc123",
            guest_token=test_token,
            iframe_html="<iframe src='...'></iframe>",
            permalink_key="abc123",
            expires_at=datetime.now(timezone.utc),
        )
        assert response.success is True
        assert response.iframe_url is not None
        assert response.guest_token is not None
        assert response.error is None

    def test_response_error(self):
        """Test error response structure."""
        response = GetEmbeddableChartResponse(
            success=False,
            error="Dataset not found: 999",
        )
        assert response.success is False
        assert response.error == "Dataset not found: 999"
        assert response.iframe_url is None
        assert response.guest_token is None

    def test_all_chart_kinds(self):
        """Test all supported chart kinds in XY config."""
        kinds = ["line", "bar", "area", "scatter"]
        for kind in kinds:
            config = XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x_col"),
                y=[ColumnRef(name="y_col", aggregate="SUM")],
                kind=kind,
            )
            request = GetEmbeddableChartRequest(
                datasource_id=1,
                config=config,
            )
            assert request.config.kind == kind

    def test_config_with_filters(self):
        """Test chart config with filters."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="bar",
            filters=[
                FilterConfig(column="region", op="=", value="US"),
                FilterConfig(column="year", op=">=", value="2020"),
            ],
        )
        request = GetEmbeddableChartRequest(
            datasource_id=1,
            config=config,
        )
        assert len(request.config.filters) == 2
        assert request.config.filters[0].column == "region"
        assert request.config.filters[1].op == ">="

    def test_config_with_group_by(self):
        """Test XY config with group_by for series breakdown."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="line",
            group_by=ColumnRef(name="category"),
        )
        request = GetEmbeddableChartRequest(
            datasource_id=1,
            config=config,
        )
        assert request.config.group_by.name == "category"


class TestGetEmbeddableChartTool:
    """Tests for get_embeddable_chart tool request/response structures."""

    def test_expected_response_fields_on_success(self):
        """Test that successful response has all expected fields."""
        test_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"  # noqa: S105
        response = GetEmbeddableChartResponse(
            success=True,
            iframe_url="http://localhost:9081/embedded/chart/?permalink_key=abc123",
            guest_token=test_token,
            iframe_html="<iframe src='...'></iframe><script>...</script>",
            permalink_key="abc123",
            expires_at=datetime.now(timezone.utc),
        )

        # All success fields should be populated
        assert response.success is True
        assert response.iframe_url is not None
        assert "permalink_key=" in response.iframe_url
        assert response.guest_token is not None
        assert response.iframe_html is not None
        assert response.permalink_key is not None
        assert response.expires_at is not None
        assert response.error is None

    def test_iframe_html_contains_required_elements(self):
        """Test that iframe_html contains security and communication elements."""
        test_token = "test_token_value"  # noqa: S105
        iframe_html = f"""<iframe
    src="http://localhost:9081/embedded/chart/?permalink_key=abc123"
    width="100%"
    height="400px"
    frameborder="0"
    data-guest-token="{test_token}"
    sandbox="allow-scripts allow-same-origin allow-popups"
></iframe>
<script>
    // Send guest token to embedded chart iframe on load
    (function() {{
        var iframe = document.currentScript.previousElementSibling;
        iframe.addEventListener('load', function() {{
            iframe.contentWindow.postMessage({{
                type: '__embedded_comms__',
                guestToken: '{test_token}'
            }}, 'http://localhost:9081');
        }});
    }})();
</script>"""

        response = GetEmbeddableChartResponse(
            success=True,
            iframe_url="http://localhost:9081/embedded/chart/?permalink_key=abc123",
            guest_token=test_token,
            iframe_html=iframe_html,
            permalink_key="abc123",
            expires_at=datetime.now(timezone.utc),
        )

        # Verify iframe HTML contains required elements
        assert "<iframe" in response.iframe_html
        assert "sandbox=" in response.iframe_html
        assert "allow-scripts" in response.iframe_html
        assert "data-guest-token=" in response.iframe_html
        assert "<script>" in response.iframe_html
        assert "__embedded_comms__" in response.iframe_html
        assert "guestToken" in response.iframe_html

    def test_response_with_only_error(self):
        """Test error response has minimal fields populated."""
        response = GetEmbeddableChartResponse(
            success=False,
            error="Access denied to dataset",
        )

        assert response.success is False
        assert response.error == "Access denied to dataset"
        assert response.iframe_url is None
        assert response.guest_token is None
        assert response.iframe_html is None
        assert response.permalink_key is None
        assert response.expires_at is None

    def test_datasource_id_accepts_string_uuid(self):
        """Test that datasource_id accepts UUID strings."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )
        request = GetEmbeddableChartRequest(
            datasource_id="a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            config=config,
        )
        assert request.datasource_id == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

    def test_datasource_id_accepts_integer(self):
        """Test that datasource_id accepts integers."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )
        request = GetEmbeddableChartRequest(
            datasource_id=42,
            config=config,
        )
        assert request.datasource_id == 42


class TestConfigToFormDataIntegration:
    """Tests for integration between ChartConfig and form_data mapping."""

    def test_xy_config_maps_to_form_data(self):
        """Test XY config is correctly mapped to Superset form_data."""
        from superset.mcp_service.chart.chart_utils import map_config_to_form_data

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="genre"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="bar",
        )

        form_data = map_config_to_form_data(config)

        assert form_data["viz_type"] == "echarts_timeseries_bar"
        assert form_data["x_axis"] == "genre"
        assert len(form_data["metrics"]) == 1
        assert form_data["metrics"][0]["aggregate"] == "SUM"
        assert form_data["metrics"][0]["column"]["column_name"] == "sales"

    def test_table_config_maps_to_form_data(self):
        """Test table config is correctly mapped to Superset form_data."""
        from superset.mcp_service.chart.chart_utils import map_config_to_form_data

        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="genre"),
                ColumnRef(name="sales", aggregate="SUM"),
            ],
        )

        form_data = map_config_to_form_data(config)

        assert form_data["viz_type"] == "table"
        # Should have both raw columns and aggregated metrics
        assert "genre" in form_data.get("all_columns", [])

    def test_line_chart_kind_maps_correctly(self):
        """Test line chart kind maps to echarts_timeseries_line."""
        from superset.mcp_service.chart.chart_utils import map_config_to_form_data

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="count", aggregate="COUNT")],
            kind="line",
        )

        form_data = map_config_to_form_data(config)

        assert form_data["viz_type"] == "echarts_timeseries_line"

    def test_scatter_chart_kind_maps_correctly(self):
        """Test scatter chart kind maps to echarts_timeseries_scatter."""
        from superset.mcp_service.chart.chart_utils import map_config_to_form_data

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="x_val"),
            y=[ColumnRef(name="y_val", aggregate="AVG")],
            kind="scatter",
        )

        form_data = map_config_to_form_data(config)

        assert form_data["viz_type"] == "echarts_timeseries_scatter"


class TestEnsureGuestRolePermissions:
    """Tests for _ensure_guest_role_permissions auto-configuration."""

    @patch("superset.extensions.security_manager", new_callable=MagicMock)
    @patch("superset.extensions.db", new_callable=MagicMock)
    @patch("flask.current_app", new_callable=MagicMock)
    def test_adds_missing_permissions(self, mock_app, mock_db, mock_sm):
        """Test that missing permissions are added to the guest role."""
        mock_app.config.get.return_value = "Public"
        mock_role = MagicMock()
        mock_role.permissions = []
        mock_sm.find_role.return_value = mock_role

        # All permission-view-menus exist but none are on the role
        mock_pv = MagicMock()
        mock_sm.find_permission_view_menu.return_value = mock_pv

        added = _ensure_guest_role_permissions()

        assert len(added) == 4
        assert "can_read on Chart" in added
        assert "can_read on Dataset" in added
        assert "can_read on CurrentUserRestApi" in added
        assert "can_read on ChartDataRestApi" in added
        assert mock_sm.add_permission_role.call_count == 4
        mock_db.session.commit.assert_called_once()

    @patch("superset.extensions.security_manager", new_callable=MagicMock)
    @patch("superset.extensions.db", new_callable=MagicMock)
    @patch("flask.current_app", new_callable=MagicMock)
    def test_skips_already_present_permissions(self, mock_app, mock_db, mock_sm):
        """Test that permissions already on the role are not re-added."""
        mock_app.config.get.return_value = "Public"

        # Create mock PVs that are already in role.permissions
        existing_pvs = [MagicMock() for _ in range(4)]
        mock_role = MagicMock()
        mock_role.permissions = existing_pvs
        mock_sm.find_role.return_value = mock_role

        # Return the same PVs that are already in the role
        mock_sm.find_permission_view_menu.side_effect = existing_pvs

        added = _ensure_guest_role_permissions()

        assert len(added) == 0
        mock_sm.add_permission_role.assert_not_called()
        mock_db.session.commit.assert_not_called()

    @patch("superset.extensions.security_manager", new_callable=MagicMock)
    @patch("superset.extensions.db", new_callable=MagicMock)
    @patch("flask.current_app", new_callable=MagicMock)
    def test_returns_empty_when_role_not_found(self, mock_app, mock_db, mock_sm):
        """Test that an empty list is returned when the guest role doesn't exist."""
        mock_app.config.get.return_value = "NonExistentRole"
        mock_sm.find_role.return_value = None

        added = _ensure_guest_role_permissions()

        assert added == []
        mock_sm.add_permission_role.assert_not_called()
        mock_db.session.commit.assert_not_called()

    @patch("superset.extensions.security_manager", new_callable=MagicMock)
    @patch("superset.extensions.db", new_callable=MagicMock)
    @patch("flask.current_app", new_callable=MagicMock)
    def test_creates_permission_view_menu_when_missing(
        self, mock_app, mock_db, mock_sm
    ):
        """Test that permission-view-menus are created if they don't exist."""
        mock_app.config.get.return_value = "Public"
        mock_role = MagicMock()
        mock_role.permissions = []
        mock_sm.find_role.return_value = mock_role

        new_pv = MagicMock()
        # First call returns None (not found), second call returns the created PV
        mock_sm.find_permission_view_menu.side_effect = [
            None,
            new_pv,
        ] * 4

        added = _ensure_guest_role_permissions()

        assert len(added) == 4
        assert mock_sm.add_permission_view_menu.call_count == 4
        assert mock_sm.add_permission_role.call_count == 4

    @patch("superset.extensions.security_manager", new_callable=MagicMock)
    @patch("superset.extensions.db", new_callable=MagicMock)
    @patch("flask.current_app", new_callable=MagicMock)
    def test_uses_configured_guest_role_name(self, mock_app, mock_db, mock_sm):
        """Test that GUEST_ROLE_NAME config is respected."""
        mock_app.config.get.return_value = "CustomGuestRole"
        mock_sm.find_role.return_value = None

        _ensure_guest_role_permissions()

        mock_sm.find_role.assert_called_once_with("CustomGuestRole")
