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
Tests for dashboard export functionality
Issue #31158: URL-encoding of special characters in export filenames
"""

import io
import zipfile
from typing import Iterator

import pytest
from flask.testing import FlaskClient

from superset import db
from superset.models.dashboard import Dashboard
from tests.integration_tests.constants import ADMIN_USERNAME


class TestDashboardExport:
    """Test dashboard export endpoint with special characters."""

    @pytest.fixture
    def setup_dashboards(self) -> Iterator[tuple[Dashboard, Dashboard, Dashboard]]:
        """Create dashboards with special characters in names."""
        # Baseline dashboard (normal name)
        dashboard_normal = Dashboard(
            dashboard_title="Simple Dashboard",
            slug="simple-dashboard",
        )
        db.session.add(dashboard_normal)
        db.session.flush()

        # Dashboard with brackets
        dashboard_brackets = Dashboard(
            dashboard_title="Dashboard [2024] - Q4 Report",
            slug="dashboard-2024-q4",
        )
        db.session.add(dashboard_brackets)
        db.session.flush()

        # Dashboard with special chars
        dashboard_special = Dashboard(
            dashboard_title="Report/Q4 & Analysis™",
            slug="report-q4-analysis",
        )
        db.session.add(dashboard_special)
        db.session.flush()

        yield dashboard_normal, dashboard_brackets, dashboard_special

        db.session.delete(dashboard_normal)
        db.session.delete(dashboard_brackets)
        db.session.delete(dashboard_special)
        db.session.commit()

    def test_export_dashboard_with_normal_name(
        self,
        client: FlaskClient,
        setup_dashboards: tuple[Dashboard, Dashboard, Dashboard],
    ) -> None:
        """Test exporting dashboard with normal name (baseline)."""
        dashboard, _, _ = setup_dashboards

        response = client.get(
            f"/api/v1/dashboard/export?q=[{dashboard.id}]",
            headers={"Authorization": f"Bearer {ADMIN_USERNAME}"},
        )

        assert response.status_code == 200
        assert response.content_type == "application/zip"
        assert response.data  # Should have ZIP content

        # Verify it's a valid ZIP
        with zipfile.ZipFile(io.BytesIO(response.data)) as zf:
            assert len(zf.namelist()) > 0

    def test_export_dashboard_with_brackets(
        self,
        client: FlaskClient,
        setup_dashboards: tuple[Dashboard, Dashboard, Dashboard],
    ) -> None:
        """Test exporting dashboard with brackets in name."""
        _, dashboard_brackets, _ = setup_dashboards

        response = client.get(
            f"/api/v1/dashboard/export?q=[{dashboard_brackets.id}]",
            headers={"Authorization": f"Bearer {ADMIN_USERNAME}"},
        )

        assert response.status_code == 200
        assert response.content_type == "application/zip"

        # Check Content-Disposition header
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition
        assert "filename=" in content_disposition

        # Filename should NOT contain unencoded brackets
        assert "[" not in content_disposition or "%5B" in content_disposition
        assert "]" not in content_disposition or "%5D" in content_disposition

        # Verify it's a valid ZIP
        with zipfile.ZipFile(io.BytesIO(response.data)) as zf:
            assert len(zf.namelist()) > 0

    def test_export_dashboard_with_special_chars(
        self,
        client: FlaskClient,
        setup_dashboards: tuple[Dashboard, Dashboard, Dashboard],
    ) -> None:
        """Test exporting dashboard with special characters."""
        _, _, dashboard_special = setup_dashboards

        response = client.get(
            f"/api/v1/dashboard/export?q=[{dashboard_special.id}]",
            headers={"Authorization": f"Bearer {ADMIN_USERNAME}"},
        )

        assert response.status_code == 200
        assert response.content_type == "application/zip"

        # Check that special chars are encoded in header
        content_disposition = response.headers.get("Content-Disposition", "")

        # / should be encoded as %2F
        # & should be encoded as %26
        # ™ should be URL-encoded (could be %E2%84%A2 or other)
        assert "%" in content_disposition  # Should have URL encoding

        # Verify it's a valid ZIP
        with zipfile.ZipFile(io.BytesIO(response.data)) as zf:
            assert len(zf.namelist()) > 0

    def test_export_multiple_dashboards_with_special_chars(
        self,
        client: FlaskClient,
        setup_dashboards: tuple[Dashboard, Dashboard, Dashboard],
    ) -> None:
        """Test exporting multiple dashboards with special characters."""
        dashboard_normal, dashboard_brackets, dashboard_special = setup_dashboards

        # Export all three dashboards
        export_ids = [dashboard_normal.id, dashboard_brackets.id, dashboard_special.id]
        response = client.get(
            f"/api/v1/dashboard/export?q={export_ids}",
            headers={"Authorization": f"Bearer {ADMIN_USERNAME}"},
        )

        assert response.status_code == 200
        assert response.content_type == "application/zip"

        # Verify ZIP contains all dashboards
        with zipfile.ZipFile(io.BytesIO(response.data)) as zf:
            file_list = zf.namelist()
            # Should contain YAML files for each dashboard
            assert len(file_list) >= 3  # At least one YAML per dashboard
            assert any("dashboards" in f for f in file_list)
