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
"""Integration tests for Phase 2 granular export controls.

These tests verify that the GRANULAR_EXPORT_CONTROLS feature flag gates
access to chart/dashboard screenshot endpoints (can_export_image) and
SQL Lab export endpoints (can_export_data).
"""

from unittest.mock import patch

import prison
import pytest

from superset.security import SupersetSecurityManager
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)


def _deny_can_export_image(perm: str, view: str) -> bool:
    """Return False only for can_export_image on Superset, allow everything else."""
    return perm != "can_export_image" or view != "Superset"


def _deny_can_export_data(perm: str, view: str) -> bool:
    """Return False only for can_export_data on Superset, allow everything else."""
    return perm != "can_export_data" or view != "Superset"


class TestGranularExportChartAPI(SupersetTestCase):
    """Test granular export controls on chart screenshot endpoints."""

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(GRANULAR_EXPORT_CONTROLS=True, THUMBNAILS=True)
    @patch.object(
        SupersetSecurityManager,
        "can_access",
        side_effect=_deny_can_export_image,
    )
    def test_chart_cache_screenshot_403_without_can_export_image(
        self, mock_can_access
    ) -> None:
        """When GRANULAR_EXPORT_CONTROLS is ON and user lacks can_export_image,
        cache_screenshot should return 403."""
        self.login(ADMIN_USERNAME)
        chart = self.get_slice("Girls")
        uri = f"api/v1/chart/{chart.id}/cache_screenshot/"
        rison_params = prison.dumps({"force": False})
        rv = self.client.get(f"{uri}?q={rison_params}")
        assert rv.status_code == 403

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(GRANULAR_EXPORT_CONTROLS=True, THUMBNAILS=True)
    @patch.object(
        SupersetSecurityManager,
        "can_access",
        side_effect=_deny_can_export_image,
    )
    def test_chart_screenshot_403_without_can_export_image(
        self, mock_can_access
    ) -> None:
        """When GRANULAR_EXPORT_CONTROLS is ON and user lacks can_export_image,
        screenshot should return 403."""
        self.login(ADMIN_USERNAME)
        chart = self.get_slice("Girls")
        uri = f"api/v1/chart/{chart.id}/screenshot/fake_digest/"
        rv = self.client.get(uri)
        assert rv.status_code == 403

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(GRANULAR_EXPORT_CONTROLS=True, THUMBNAILS=True)
    @patch.object(
        SupersetSecurityManager,
        "can_access",
        side_effect=_deny_can_export_image,
    )
    def test_chart_thumbnail_403_without_can_export_image(
        self, mock_can_access
    ) -> None:
        """When GRANULAR_EXPORT_CONTROLS is ON and user lacks can_export_image,
        thumbnail should return 403."""
        self.login(ADMIN_USERNAME)
        chart = self.get_slice("Girls")
        uri = f"api/v1/chart/{chart.id}/thumbnail/{chart.digest}/"
        rv = self.client.get(uri)
        assert rv.status_code == 403

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(GRANULAR_EXPORT_CONTROLS=False)
    def test_chart_cache_screenshot_allowed_when_flag_disabled(self) -> None:
        """When GRANULAR_EXPORT_CONTROLS is OFF, no permission check occurs
        and the request proceeds (may return 404/422 due to missing thumbnails
        config, but NOT 403)."""
        self.login(ADMIN_USERNAME)
        chart = self.get_slice("Girls")
        uri = f"api/v1/chart/{chart.id}/cache_screenshot/"
        rison_params = prison.dumps({"force": False})
        rv = self.client.get(f"{uri}?q={rison_params}")
        assert rv.status_code != 403

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(GRANULAR_EXPORT_CONTROLS=False)
    def test_chart_screenshot_allowed_when_flag_disabled(self) -> None:
        """When GRANULAR_EXPORT_CONTROLS is OFF, screenshot endpoint does
        not enforce granular permission."""
        self.login(ADMIN_USERNAME)
        chart = self.get_slice("Girls")
        uri = f"api/v1/chart/{chart.id}/screenshot/fake_digest/"
        rv = self.client.get(uri)
        assert rv.status_code != 403


class TestGranularExportDashboardAPI(SupersetTestCase):
    """Test granular export controls on dashboard screenshot endpoints."""

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(
        GRANULAR_EXPORT_CONTROLS=True,
        THUMBNAILS=True,
        ENABLE_DASHBOARD_SCREENSHOT_ENDPOINTS=True,
    )
    @patch.object(
        SupersetSecurityManager,
        "can_access",
        side_effect=_deny_can_export_image,
    )
    def test_dashboard_cache_screenshot_403_without_can_export_image(
        self, mock_can_access
    ) -> None:
        """When GRANULAR_EXPORT_CONTROLS is ON and user lacks can_export_image,
        cache_dashboard_screenshot should return 403."""
        self.login(ADMIN_USERNAME)
        dashboard = self.get_dash_by_slug("births") or self.get_dash_by_slug(
            "birth_names"
        )
        uri = f"api/v1/dashboard/{dashboard.id}/cache_dashboard_screenshot/"
        rison_params = prison.dumps({"force": False})
        rv = self.client.post(
            f"{uri}?q={rison_params}",
            json={},
        )
        assert rv.status_code == 403

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(
        GRANULAR_EXPORT_CONTROLS=True,
        THUMBNAILS=True,
        ENABLE_DASHBOARD_SCREENSHOT_ENDPOINTS=True,
    )
    @patch.object(
        SupersetSecurityManager,
        "can_access",
        side_effect=_deny_can_export_image,
    )
    def test_dashboard_screenshot_403_without_can_export_image(
        self, mock_can_access
    ) -> None:
        """When GRANULAR_EXPORT_CONTROLS is ON and user lacks can_export_image,
        screenshot should return 403."""
        self.login(ADMIN_USERNAME)
        dashboard = self.get_dash_by_slug("births") or self.get_dash_by_slug(
            "birth_names"
        )
        uri = f"api/v1/dashboard/{dashboard.id}/screenshot/fake_digest/"
        rv = self.client.get(uri)
        assert rv.status_code == 403

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(
        GRANULAR_EXPORT_CONTROLS=False,
        THUMBNAILS=True,
        ENABLE_DASHBOARD_SCREENSHOT_ENDPOINTS=True,
    )
    @patch.object(
        SupersetSecurityManager,
        "can_access",
        side_effect=_deny_can_export_image,
    )
    def test_dashboard_cache_screenshot_allowed_when_flag_disabled(
        self, mock_can_access
    ) -> None:
        """When GRANULAR_EXPORT_CONTROLS is OFF, the granular permission check
        is skipped even if the user lacks can_export_image."""
        self.login(ADMIN_USERNAME)
        dashboard = self.get_dash_by_slug("births") or self.get_dash_by_slug(
            "birth_names"
        )
        uri = f"api/v1/dashboard/{dashboard.id}/cache_dashboard_screenshot/"
        rison_params = prison.dumps({"force": False})
        rv = self.client.post(f"{uri}?q={rison_params}", json={})
        assert rv.status_code == 202


class TestGranularExportSqlLabAPI(SupersetTestCase):
    """Test granular export controls on SQL Lab export endpoints."""

    @with_feature_flags(GRANULAR_EXPORT_CONTROLS=True)
    @patch.object(
        SupersetSecurityManager,
        "can_access",
        side_effect=_deny_can_export_data,
    )
    def test_export_csv_403_without_can_export_data(self, mock_can_access) -> None:
        """When GRANULAR_EXPORT_CONTROLS is ON and user lacks can_export_data,
        export_csv should return 403."""
        self.login(ADMIN_USERNAME)
        uri = "api/v1/sqllab/export/fake_client_id/"
        rv = self.client.get(uri)
        assert rv.status_code == 403

    @with_feature_flags(GRANULAR_EXPORT_CONTROLS=True)
    @patch.object(
        SupersetSecurityManager,
        "can_access",
        side_effect=_deny_can_export_data,
    )
    def test_export_streaming_csv_403_without_can_export_data(
        self, mock_can_access
    ) -> None:
        """When GRANULAR_EXPORT_CONTROLS is ON and user lacks can_export_data,
        export_streaming_csv should return 403."""
        self.login(ADMIN_USERNAME)
        uri = "api/v1/sqllab/export_streaming/"
        rv = self.client.post(uri, data={"client_id": "fake_client_id"})
        assert rv.status_code == 403

    @with_feature_flags(GRANULAR_EXPORT_CONTROLS=False)
    @patch.object(
        SupersetSecurityManager,
        "can_access",
        side_effect=_deny_can_export_data,
    )
    def test_export_csv_allowed_when_flag_disabled(self, mock_can_access) -> None:
        """When GRANULAR_EXPORT_CONTROLS is OFF, no granular permission check
        is enforced. The request may fail for other reasons (no query found),
        but must not return 403."""
        self.login(ADMIN_USERNAME)
        uri = "api/v1/sqllab/export/fake_client_id/"
        rv = self.client.get(uri)
        assert rv.status_code != 403

    @with_feature_flags(GRANULAR_EXPORT_CONTROLS=False)
    @patch.object(
        SupersetSecurityManager,
        "can_access",
        side_effect=_deny_can_export_data,
    )
    def test_export_streaming_csv_allowed_when_flag_disabled(
        self, mock_can_access
    ) -> None:
        """When GRANULAR_EXPORT_CONTROLS is OFF, the granular permission check
        is skipped even if the user lacks can_export_data."""
        self.login(ADMIN_USERNAME)
        uri = "api/v1/sqllab/export_streaming/"
        rv = self.client.post(uri, data={"client_id": "fake_client_id"})
        assert rv.status_code != 403
