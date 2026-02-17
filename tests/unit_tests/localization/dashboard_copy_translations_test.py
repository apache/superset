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
Tests for Dashboard copy translations behavior.

When a dashboard is copied, its translations should carry over
to the new dashboard. If the copy request includes explicit
translations, those override the original's translations.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from superset.daos.dashboard import DashboardDAO
from superset.models.dashboard import Dashboard


@patch("superset.daos.dashboard.is_feature_enabled", return_value=False)
@patch("superset.daos.dashboard.db")
@patch("superset.daos.dashboard.g")
def test_copy_dashboard_inherits_translations_from_original(
    mock_g: MagicMock,
    mock_db: MagicMock,
    mock_feature: MagicMock,
) -> None:
    """
    Verify copy inherits translations when none are in the copy payload.

    Given an original dashboard with German title translation,
    when copy_dashboard is called without translations in data,
    then the new dashboard inherits the original's translations.
    """
    mock_g.user = MagicMock()
    mock_db.session.query.return_value.filter.return_value.all.return_value = []

    original = Dashboard(
        dashboard_title="Sales Dashboard",
        params=json.dumps({}),
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )
    original.slices = []

    data = {
        "dashboard_title": "Sales Dashboard [copy]",
        "json_metadata": json.dumps({"positions": {}}),
        "css": "",
        "duplicate_slices": False,
    }

    result = DashboardDAO.copy_dashboard(original, data)

    assert result.translations == {"dashboard_title": {"de": "Verkaufs-Dashboard"}}


@patch("superset.daos.dashboard.is_feature_enabled", return_value=False)
@patch("superset.daos.dashboard.db")
@patch("superset.daos.dashboard.g")
def test_copy_dashboard_uses_explicit_translations_from_data(
    mock_g: MagicMock,
    mock_db: MagicMock,
    mock_feature: MagicMock,
) -> None:
    """
    Verify copy uses explicit translations when provided in the copy payload.

    Given an original dashboard with German title translation,
    when copy_dashboard is called with French translations in data,
    then the new dashboard uses the provided French translations,
    not the original's German translations.
    """
    mock_g.user = MagicMock()
    mock_db.session.query.return_value.filter.return_value.all.return_value = []

    original = Dashboard(
        dashboard_title="Sales Dashboard",
        params=json.dumps({}),
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )
    original.slices = []

    explicit_translations = {
        "dashboard_title": {"fr": "Tableau de bord des ventes"}
    }
    data = {
        "dashboard_title": "Sales Dashboard [copy]",
        "json_metadata": json.dumps({"positions": {}}),
        "css": "",
        "duplicate_slices": False,
        "translations": explicit_translations,
    }

    result = DashboardDAO.copy_dashboard(original, data)

    assert result.translations == explicit_translations
