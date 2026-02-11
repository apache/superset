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
Tests for feature flag check on PUT translations.

When ENABLE_CONTENT_LOCALIZATION is disabled, API should reject
any attempt to update translations field with 400 error.
When enabled, translations updates should be accepted.
"""

from unittest.mock import patch

import pytest
from marshmallow import ValidationError

from superset.charts.schemas import ChartPutSchema
from superset.dashboards.schemas import DashboardPutSchema

# =============================================================================
# Schema Tests - Verify translations field is accepted by PUT schemas
# =============================================================================


def test_dashboard_put_schema_accepts_translations_field(app_context: None) -> None:
    """
    Verify DashboardPutSchema accepts translations field in input.

    Given valid translations dict and ENABLE_CONTENT_LOCALIZATION=True,
    when DashboardPutSchema.load() is called,
    then translations field is included in result.
    """
    schema = DashboardPutSchema()
    data = {
        "dashboard_title": "Test Dashboard",
        "translations": {"dashboard_title": {"de": "Test-Dashboard"}},
    }

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert "translations" in result
    assert result["translations"] == {"dashboard_title": {"de": "Test-Dashboard"}}


def test_dashboard_put_schema_accepts_null_translations(app_context: None) -> None:
    """
    Verify DashboardPutSchema accepts translations=null to clear translations.

    Given translations=None and ENABLE_CONTENT_LOCALIZATION=True,
    when DashboardPutSchema.load() is called,
    then translations field equals None.
    """
    schema = DashboardPutSchema()
    data = {
        "dashboard_title": "Test Dashboard",
        "translations": None,
    }

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert "translations" in result
    assert result["translations"] is None


def test_chart_put_schema_accepts_translations_field(app_context: None) -> None:
    """
    Verify ChartPutSchema accepts translations field in input.

    Given valid translations dict and ENABLE_CONTENT_LOCALIZATION=True,
    when ChartPutSchema.load() is called,
    then translations field is included in result.
    """
    schema = ChartPutSchema()
    data = {
        "slice_name": "Test Chart",
        "translations": {"slice_name": {"de": "Test-Diagramm"}},
    }

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert "translations" in result
    assert result["translations"] == {"slice_name": {"de": "Test-Diagramm"}}


def test_chart_put_schema_accepts_null_translations(app_context: None) -> None:
    """
    Verify ChartPutSchema accepts translations=null to clear translations.

    Given translations=None and ENABLE_CONTENT_LOCALIZATION=True,
    when ChartPutSchema.load() is called,
    then translations field equals None.
    """
    schema = ChartPutSchema()
    data = {
        "slice_name": "Test Chart",
        "translations": None,
    }

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert "translations" in result
    assert result["translations"] is None


# =============================================================================
# Feature Flag Validation Tests
# =============================================================================


def test_dashboard_put_schema_rejects_translations_when_flag_off(
    app_context: None,
) -> None:
    """
    Verify DashboardPutSchema rejects translations when feature flag disabled.

    Given ENABLE_CONTENT_LOCALIZATION=False,
    when DashboardPutSchema.load() is called with translations,
    then ValidationError is raised with message about disabled feature.
    """
    schema = DashboardPutSchema()
    data = {
        "dashboard_title": "Test Dashboard",
        "translations": {"dashboard_title": {"de": "Test-Dashboard"}},
    }

    with patch(
        "superset.dashboards.schemas.is_feature_enabled", return_value=False
    ) as mock:
        mock.side_effect = lambda flag: flag != "ENABLE_CONTENT_LOCALIZATION"
        with pytest.raises(ValidationError, match=r"(?i)translations|localization"):
            schema.load(data)


def test_dashboard_put_schema_accepts_translations_when_flag_on(
    app_context: None,
) -> None:
    """
    Verify DashboardPutSchema accepts translations when feature flag enabled.

    Given ENABLE_CONTENT_LOCALIZATION=True,
    when DashboardPutSchema.load() is called with translations,
    then no error is raised and translations field is in result.
    """
    schema = DashboardPutSchema()
    data = {
        "dashboard_title": "Test Dashboard",
        "translations": {"dashboard_title": {"de": "Test-Dashboard"}},
    }

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert "translations" in result


def test_chart_put_schema_rejects_translations_when_flag_off(
    app_context: None,
) -> None:
    """
    Verify ChartPutSchema rejects translations when feature flag disabled.

    Given ENABLE_CONTENT_LOCALIZATION=False,
    when ChartPutSchema.load() is called with translations,
    then ValidationError is raised with message about disabled feature.
    """
    schema = ChartPutSchema()
    data = {
        "slice_name": "Test Chart",
        "translations": {"slice_name": {"de": "Test-Diagramm"}},
    }

    with patch(
        "superset.charts.schemas.is_feature_enabled", return_value=False
    ) as mock:
        mock.side_effect = lambda flag: flag != "ENABLE_CONTENT_LOCALIZATION"
        with pytest.raises(ValidationError, match=r"(?i)translations|localization"):
            schema.load(data)


def test_chart_put_schema_accepts_translations_when_flag_on(
    app_context: None,
) -> None:
    """
    Verify ChartPutSchema accepts translations when feature flag enabled.

    Given ENABLE_CONTENT_LOCALIZATION=True,
    when ChartPutSchema.load() is called with translations,
    then no error is raised and translations field is in result.
    """
    schema = ChartPutSchema()
    data = {
        "slice_name": "Test Chart",
        "translations": {"slice_name": {"de": "Test-Diagramm"}},
    }

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert "translations" in result


# =============================================================================
# Edge Cases
# =============================================================================


def test_dashboard_put_without_translations_works_regardless_of_flag(
    app_context: None,
) -> None:
    """
    Verify DashboardPutSchema works without translations field regardless of flag.

    Given no translations field in input,
    when DashboardPutSchema.load() is called (flag OFF),
    then no error is raised.
    """
    schema = DashboardPutSchema()
    data = {"dashboard_title": "Test Dashboard"}

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=False):
        result = schema.load(data)

    assert result["dashboard_title"] == "Test Dashboard"
    assert "translations" not in result


def test_chart_put_without_translations_works_regardless_of_flag(
    app_context: None,
) -> None:
    """
    Verify ChartPutSchema works without translations field regardless of flag.

    Given no translations field in input,
    when ChartPutSchema.load() is called (flag OFF),
    then no error is raised.
    """
    schema = ChartPutSchema()
    data = {"slice_name": "Test Chart"}

    with patch("superset.charts.schemas.is_feature_enabled", return_value=False):
        result = schema.load(data)

    assert result["slice_name"] == "Test Chart"
    assert "translations" not in result
