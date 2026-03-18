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
Unit tests for dashboard schema serialization.

Tests that serialize_dashboard_object correctly handles slug and other fields.
"""

from typing import Any
from unittest.mock import MagicMock, patch

from superset.mcp_service.dashboard.schemas import serialize_dashboard_object


def _mock_dashboard(
    id: int = 1,
    title: str = "Test Dashboard",
    slug: str | None = None,
    owners: list[Any] | None = None,
    slices: list[Any] | None = None,
    tags: list[Any] | None = None,
    roles: list[Any] | None = None,
) -> MagicMock:
    """Create a mock Dashboard ORM object."""
    dashboard = MagicMock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = slug
    dashboard.published = True
    dashboard.changed_by_name = "admin"
    dashboard.changed_on = None
    dashboard.changed_on_humanized = "2 hours ago"
    dashboard.created_by_name = "admin"
    dashboard.created_on = None
    dashboard.created_on_humanized = "1 day ago"
    dashboard.description = "A test dashboard"
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.json_metadata = None
    dashboard.position_json = None
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.uuid = None
    dashboard.owners = owners or []
    dashboard.slices = slices or []
    dashboard.tags = tags or []
    dashboard.roles = roles or []
    return dashboard


class TestSerializeDashboardObject:
    """Tests for serialize_dashboard_object slug handling."""

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_slug_none_returns_empty_string(self, mock_base_url):
        """Dashboards with slug=None should return slug="" for consistency
        with dashboard_serializer."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=1, slug=None)
        result = serialize_dashboard_object(dashboard)

        assert result.slug == ""

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_slug_empty_string_returns_empty_string(self, mock_base_url):
        """Dashboards with slug="" should return slug=""."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=2, slug="")
        result = serialize_dashboard_object(dashboard)

        assert result.slug == ""

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_slug_with_value_preserved(self, mock_base_url):
        """Dashboards with a real slug should preserve it."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=3, slug="my-dashboard")
        result = serialize_dashboard_object(dashboard)

        assert result.slug == "my-dashboard"

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_url_uses_id_when_no_slug(self, mock_base_url):
        """URL should use dashboard id when slug is None."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=42, slug=None)
        result = serialize_dashboard_object(dashboard)

        assert result.url == "http://localhost:8088/superset/dashboard/42/"

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_url_uses_slug_when_available(self, mock_base_url):
        """URL should use slug when available."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=42, slug="my-dashboard")
        result = serialize_dashboard_object(dashboard)

        assert result.url == "http://localhost:8088/superset/dashboard/my-dashboard/"
