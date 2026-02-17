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
Tests for translations field on POST/Copy schemas.

Covers T-1 (ChartPostSchema), T-2 (DashboardPostSchema),
T-3 (DashboardCopySchema) — adding translations support
to create/copy endpoints.

All schemas use TranslatableSchemaMixin, so translations
validation and sanitization behavior is identical.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from marshmallow import Schema, ValidationError

from superset.charts.schemas import ChartPostSchema
from superset.dashboards.schemas import DashboardCopySchema, DashboardPostSchema

# Patch target: TranslatableSchemaMixin imports is_feature_enabled
MIXIN_FLAG = "superset.localization.schema_mixin.is_feature_enabled"

# Minimum valid base data for each schema (without translations)
CHART_POST_BASE: dict[str, Any] = {
    "slice_name": "Test Chart",
    "datasource_id": 1,
    "datasource_type": "table",
}

DASHBOARD_POST_BASE: dict[str, Any] = {
    "dashboard_title": "Test Dashboard",
}

DASHBOARD_COPY_BASE: dict[str, Any] = {
    "json_metadata": "{}",
}


SCHEMAS_AND_DATA: list[tuple[type[Schema], dict[str, Any]]] = [
    (ChartPostSchema, CHART_POST_BASE),
    (DashboardPostSchema, DASHBOARD_POST_BASE),
    (DashboardCopySchema, DASHBOARD_COPY_BASE),
]

VALID_TRANSLATIONS: dict[str, dict[str, str]] = {
    "title": {"de": "Titel", "fr": "Titre"},
}


# =============================================================================
# Feature flag: accept / reject translations
# =============================================================================


@pytest.mark.parametrize(
    "schema_cls,base_data",
    SCHEMAS_AND_DATA,
    ids=["ChartPost", "DashboardPost", "DashboardCopy"],
)
def test_accepts_translations_when_flag_on(
    schema_cls: type[Schema],
    base_data: dict[str, Any],
    app_context: None,
) -> None:
    """Schema accepts translations when ENABLE_CONTENT_LOCALIZATION=True."""
    schema = schema_cls()
    data = {**base_data, "translations": VALID_TRANSLATIONS}

    with patch(MIXIN_FLAG, return_value=True):
        result = schema.load(data)

    assert result["translations"] == VALID_TRANSLATIONS


@pytest.mark.parametrize(
    "schema_cls,base_data",
    SCHEMAS_AND_DATA,
    ids=["ChartPost", "DashboardPost", "DashboardCopy"],
)
def test_accepts_null_translations_when_flag_on(
    schema_cls: type[Schema],
    base_data: dict[str, Any],
    app_context: None,
) -> None:
    """Schema accepts translations=null to explicitly set no translations."""
    schema = schema_cls()
    data = {**base_data, "translations": None}

    with patch(MIXIN_FLAG, return_value=True):
        result = schema.load(data)

    assert "translations" in result
    assert result["translations"] is None


@pytest.mark.parametrize(
    "schema_cls,base_data",
    SCHEMAS_AND_DATA,
    ids=["ChartPost", "DashboardPost", "DashboardCopy"],
)
def test_rejects_translations_when_flag_off(
    schema_cls: type[Schema],
    base_data: dict[str, Any],
    app_context: None,
) -> None:
    """Schema rejects translations when ENABLE_CONTENT_LOCALIZATION=False."""
    schema = schema_cls()
    data = {**base_data, "translations": VALID_TRANSLATIONS}

    with patch(MIXIN_FLAG, return_value=False) as mock:
        mock.side_effect = lambda flag: flag != "ENABLE_CONTENT_LOCALIZATION"
        with pytest.raises(ValidationError, match=r"(?i)localization"):
            schema.load(data)


@pytest.mark.parametrize(
    "schema_cls,base_data",
    SCHEMAS_AND_DATA,
    ids=["ChartPost", "DashboardPost", "DashboardCopy"],
)
def test_works_without_translations_regardless_of_flag(
    schema_cls: type[Schema],
    base_data: dict[str, Any],
    app_context: None,
) -> None:
    """Schema works without translations field regardless of flag state."""
    schema = schema_cls()

    with patch(MIXIN_FLAG, return_value=False):
        result = schema.load(base_data)

    assert "translations" not in result


# =============================================================================
# Validation: structure checks
# =============================================================================


@pytest.mark.parametrize(
    "schema_cls,base_data",
    SCHEMAS_AND_DATA,
    ids=["ChartPost", "DashboardPost", "DashboardCopy"],
)
def test_rejects_invalid_translations_structure(
    schema_cls: type[Schema],
    base_data: dict[str, Any],
    app_context: None,
) -> None:
    """Schema rejects translations with invalid structure (value not a dict)."""
    schema = schema_cls()
    data = {**base_data, "translations": {"field": "not a dict"}}

    with patch(MIXIN_FLAG, return_value=True):
        with pytest.raises(ValidationError, match="must be dict"):
            schema.load(data)


@pytest.mark.parametrize(
    "schema_cls,base_data",
    SCHEMAS_AND_DATA,
    ids=["ChartPost", "DashboardPost", "DashboardCopy"],
)
def test_rejects_invalid_locale_code(
    schema_cls: type[Schema],
    base_data: dict[str, Any],
    app_context: None,
) -> None:
    """Schema rejects translations with invalid locale codes."""
    schema = schema_cls()
    data = {**base_data, "translations": {"field": {"INVALID": "value"}}}

    with patch(MIXIN_FLAG, return_value=True):
        with pytest.raises(ValidationError, match="Invalid locale code"):
            schema.load(data)


# =============================================================================
# XSS sanitization
# =============================================================================


@pytest.mark.parametrize(
    "schema_cls,base_data",
    SCHEMAS_AND_DATA,
    ids=["ChartPost", "DashboardPost", "DashboardCopy"],
)
def test_sanitizes_xss_in_translations(
    schema_cls: type[Schema],
    base_data: dict[str, Any],
    app_context: None,
) -> None:
    """Schema strips HTML from translation values to prevent XSS."""
    schema = schema_cls()
    data = {
        **base_data,
        "translations": {
            "title": {"de": "<script>evil</script>Titel"},
            "description": {"de": "<b>Beschreibung</b>"},
        },
    }

    with patch(MIXIN_FLAG, return_value=True):
        result = schema.load(data)

    assert result["translations"] == {
        "title": {"de": "Titel"},
        "description": {"de": "Beschreibung"},
    }
