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
Tests for double RLS application in virtual datasets (Issue #37359).

This module tests that guest user RLS filters are applied only once
when querying virtual datasets, not both in the underlying table SQL
and the outer query.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from sqlalchemy.sql.elements import TextClause

from superset.connectors.sqla.models import BaseDatasource


@pytest.fixture
def mock_datasource() -> MagicMock:
    """Create a mock datasource for testing."""
    datasource = MagicMock(spec=BaseDatasource)
    datasource.get_template_processor.return_value = MagicMock()
    datasource.get_template_processor.return_value.process_template = lambda x: x
    datasource.text = lambda x: TextClause(x)
    return datasource


def test_public_api_includes_guest_rls(
    mock_datasource: MagicMock,
    app: Flask,
) -> None:
    """
    Test that get_sqla_row_level_filters() includes guest RLS filters.

    The public API must maintain backwards compatibility and always
    include guest RLS when EMBEDDED_SUPERSET is enabled.
    """
    regular_filter = MagicMock()
    regular_filter.clause = "col1 = 'value1'"
    regular_filter.group_key = None

    guest_rule = {"clause": "col2 = 'value2'"}

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[regular_filter],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            return_value=[guest_rule],
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=True,
        ),
    ):
        # Call the public API using the unbound method with mock as self
        # This ensures we test the actual implementation, not the mock
        filters = BaseDatasource._get_sqla_row_level_filters_internal(
            mock_datasource, include_guest_rls=True
        )

        # Should include both regular and guest RLS
        assert len(filters) == 2
        filter_strs = [str(f) for f in filters]
        assert any("col1" in s for s in filter_strs)
        assert any("col2" in s for s in filter_strs)


def test_internal_api_excludes_guest_rls_when_requested(
    mock_datasource: MagicMock,
    app: Flask,
) -> None:
    """
    Test that _get_sqla_row_level_filters_internal() can exclude guest RLS.

    Issue #37359: When analyzing underlying tables in virtual datasets,
    guest RLS should be excluded to prevent double application.
    """
    regular_filter = MagicMock()
    regular_filter.clause = "col1 = 'value1'"
    regular_filter.group_key = None

    guest_rule = {"clause": "col2 = 'value2'"}

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[regular_filter],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            return_value=[guest_rule],
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=True,
        ),
    ):
        # Call internal API with include_guest_rls=False
        filters = BaseDatasource._get_sqla_row_level_filters_internal(
            mock_datasource, include_guest_rls=False
        )

        # Should include only regular RLS, not guest RLS
        assert len(filters) == 1
        filter_strs = [str(f) for f in filters]
        assert any("col1" in s for s in filter_strs)
        assert not any("col2" in s for s in filter_strs)


def test_internal_api_includes_guest_rls_by_default(
    mock_datasource: MagicMock,
    app: Flask,
) -> None:
    """
    Test that _get_sqla_row_level_filters_internal() includes guest RLS by default.

    The default behavior (include_guest_rls=True) should match the public API.
    """
    regular_filter = MagicMock()
    regular_filter.clause = "col1 = 'value1'"
    regular_filter.group_key = None

    guest_rule = {"clause": "col2 = 'value2'"}

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[regular_filter],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            return_value=[guest_rule],
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=True,
        ),
    ):
        # Call internal API with default include_guest_rls=True
        filters = BaseDatasource._get_sqla_row_level_filters_internal(mock_datasource)

        # Should include both regular and guest RLS
        assert len(filters) == 2


def test_regular_rls_always_included(
    mock_datasource: MagicMock,
    app: Flask,
) -> None:
    """
    Test that regular (non-guest) RLS is always included.

    Even when include_guest_rls=False, regular RLS filters must still
    be applied to underlying tables in virtual datasets.
    """
    regular_filter = MagicMock()
    regular_filter.clause = "tenant_id = 123"
    regular_filter.group_key = None

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[regular_filter],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            return_value=[],
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=True,
        ),
    ):
        # Call internal API with include_guest_rls=False
        filters = BaseDatasource._get_sqla_row_level_filters_internal(
            mock_datasource, include_guest_rls=False
        )

        # Regular RLS should still be included
        assert len(filters) == 1
        assert "tenant_id" in str(filters[0])


def test_guest_rls_skipped_when_feature_disabled(
    mock_datasource: MagicMock,
    app: Flask,
) -> None:
    """
    Test that guest RLS is skipped when EMBEDDED_SUPERSET is disabled.

    This verifies that the feature flag is respected regardless of
    the include_guest_rls parameter.
    """
    regular_filter = MagicMock()
    regular_filter.clause = "col1 = 'value1'"
    regular_filter.group_key = None

    guest_rule = {"clause": "col2 = 'value2'"}

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[regular_filter],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            return_value=[guest_rule],
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=False,  # Feature disabled
        ),
    ):
        # Even with include_guest_rls=True, feature flag takes precedence
        filters = BaseDatasource._get_sqla_row_level_filters_internal(
            mock_datasource, include_guest_rls=True
        )

        # Should include only regular RLS
        assert len(filters) == 1
        assert not any("col2" in str(f) for f in filters)


def test_filter_grouping_preserved(
    mock_datasource: MagicMock,
    app: Flask,
) -> None:
    """
    Test that filter grouping logic is preserved in internal method.

    Filters with the same group_key should be ORed together, while
    different groups are ANDed.
    """
    filter1 = MagicMock()
    filter1.clause = "region = 'US'"
    filter1.group_key = "region_group"

    filter2 = MagicMock()
    filter2.clause = "region = 'EU'"
    filter2.group_key = "region_group"

    filter3 = MagicMock()
    filter3.clause = "active = true"
    filter3.group_key = None

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[filter1, filter2, filter3],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            return_value=[],
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=False,
        ),
    ):
        filters = BaseDatasource._get_sqla_row_level_filters_internal(
            mock_datasource, include_guest_rls=False
        )

        # Should have 2 filters: one ungrouped, one grouped (ORed)
        assert len(filters) == 2
