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

"""Tests for system-level utility functions."""

from unittest.mock import MagicMock, patch

from superset.mcp_service.system.system_utils import calculate_feature_availability


def test_calculate_feature_availability_returns_menus():
    """Test that accessible menus are returned."""
    mock_sm = MagicMock()
    mock_sm.user_view_menu_names.return_value = {
        "SQL Lab",
        "Dashboards",
        "Charts",
    }

    with patch("superset.security_manager", mock_sm):
        result = calculate_feature_availability({}, {}, {})

    assert result.accessible_menus == ["Charts", "Dashboards", "SQL Lab"]
    mock_sm.user_view_menu_names.assert_called_once_with("menu_access")


def test_calculate_feature_availability_empty_when_no_context():
    """Test graceful fallback when security manager is unavailable."""
    broken_sm = MagicMock()
    broken_sm.user_view_menu_names.side_effect = RuntimeError("no ctx")

    with patch("superset.security_manager", broken_sm):
        result = calculate_feature_availability({}, {}, {})

    assert result.accessible_menus == []


def test_calculate_feature_availability_menus_sorted():
    """Test that accessible menus are returned in sorted order."""
    mock_sm = MagicMock()
    mock_sm.user_view_menu_names.return_value = {"Zzz", "Aaa", "Mmm"}

    with patch("superset.security_manager", mock_sm):
        result = calculate_feature_availability({}, {}, {})

    assert result.accessible_menus == ["Aaa", "Mmm", "Zzz"]
