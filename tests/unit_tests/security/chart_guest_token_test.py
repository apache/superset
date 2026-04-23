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
Unit tests for chart-scoped guest tokens.

Covers the ``CHART`` resource type added to ``GuestTokenResourceType`` and
the associated ``validate_guest_token_resources`` / ``has_guest_chart_access``
branches in the security manager.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from superset.commands.chart.exceptions import ChartNotFoundError
from superset.security.guest_token import GuestTokenResourceType
from superset.security.manager import SupersetSecurityManager


def test_chart_is_valid_guest_token_resource_type() -> None:
    """CHART should be an accepted guest token resource type."""
    assert GuestTokenResourceType("chart") is GuestTokenResourceType.CHART
    assert GuestTokenResourceType.CHART.value == "chart"


class TestValidateGuestTokenResources:
    """Coverage for validate_guest_token_resources CHART branch."""

    def test_accepts_chart_by_numeric_id(self) -> None:
        """A CHART resource referencing an existing numeric id should validate."""
        with patch(
            "superset.daos.chart.ChartDAO.find_by_id_or_uuid",
            return_value=MagicMock(id=7),
        ) as mock_find:
            SupersetSecurityManager.validate_guest_token_resources(
                [{"type": GuestTokenResourceType.CHART, "id": 7}]
            )
        mock_find.assert_called_once_with("7", skip_base_filter=True)

    def test_accepts_chart_by_uuid(self) -> None:
        """A CHART resource referencing an existing uuid should validate."""
        uuid = "12345678-90ab-cdef-1234-567890abcdef"
        with patch(
            "superset.daos.chart.ChartDAO.find_by_id_or_uuid",
            return_value=MagicMock(id=9, uuid=uuid),
        ) as mock_find:
            SupersetSecurityManager.validate_guest_token_resources(
                [{"type": GuestTokenResourceType.CHART, "id": uuid}]
            )
        mock_find.assert_called_once_with(uuid, skip_base_filter=True)

    def test_rejects_unknown_chart(self) -> None:
        """Unknown chart references should raise ChartNotFoundError."""
        with patch(
            "superset.daos.chart.ChartDAO.find_by_id_or_uuid", return_value=None
        ):
            with pytest.raises(ChartNotFoundError):
                SupersetSecurityManager.validate_guest_token_resources(
                    [{"type": GuestTokenResourceType.CHART, "id": 999}]
                )


class TestHasGuestChartAccess:
    """Coverage for has_guest_chart_access."""

    @staticmethod
    def _make_manager(guest_user) -> SupersetSecurityManager:
        """Build a security manager that returns the given guest user."""
        manager = SupersetSecurityManager.__new__(SupersetSecurityManager)
        manager.get_current_guest_user_if_guest = lambda: guest_user  # type: ignore[method-assign]
        return manager

    def test_returns_false_when_not_a_guest(self) -> None:
        manager = self._make_manager(None)
        chart = MagicMock(id=1, uuid="u1")
        assert manager.has_guest_chart_access(chart) is False

    def test_true_for_chart_in_token_by_id(self) -> None:
        guest = MagicMock()
        guest.resources = [{"type": GuestTokenResourceType.CHART, "id": 42}]
        manager = self._make_manager(guest)
        chart = MagicMock(id=42, uuid=None)
        assert manager.has_guest_chart_access(chart) is True

    def test_true_for_chart_in_token_by_uuid(self) -> None:
        guest = MagicMock()
        uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        guest.resources = [{"type": GuestTokenResourceType.CHART, "id": uuid}]
        manager = self._make_manager(guest)
        chart = MagicMock(id=1, uuid=uuid)
        assert manager.has_guest_chart_access(chart) is True

    def test_false_for_chart_not_in_token(self) -> None:
        guest = MagicMock()
        guest.resources = [{"type": GuestTokenResourceType.CHART, "id": 10}]
        manager = self._make_manager(guest)
        chart = MagicMock(id=11, uuid="other-uuid")
        assert manager.has_guest_chart_access(chart) is False

    def test_ignores_non_chart_resources(self) -> None:
        guest = MagicMock()
        guest.resources = [
            {"type": GuestTokenResourceType.DASHBOARD, "id": 1},
        ]
        manager = self._make_manager(guest)
        chart = MagicMock(id=1, uuid="some-uuid")
        assert manager.has_guest_chart_access(chart) is False
