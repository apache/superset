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
from unittest.mock import MagicMock, patch

import pytest

from superset.commands.chart.exceptions import ChartForbiddenError
from superset.commands.chart.update import UpdateChartCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException


def _make_ownership_exc() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
            message="User does not own this chart",
            level=ErrorLevel.ERROR,
        )
    )


@patch("superset.commands.chart.update.ChartDAO.find_by_id")
@patch("superset.commands.chart.update.security_manager")
def test_update_chart_ownership_enforced_for_regular_update(
    mock_sm: MagicMock,
    mock_find_by_id: MagicMock,
) -> None:
    """Non-owners must not be able to update a chart via a regular payload."""
    mock_find_by_id.return_value = MagicMock(id=1, tags=[], dashboards=[])
    mock_sm.raise_for_ownership = MagicMock(side_effect=_make_ownership_exc())

    command = UpdateChartCommand(1, {"slice_name": "My Chart"})

    with pytest.raises(ChartForbiddenError):
        command.validate()

    mock_find_by_id.assert_called_once_with(1)
    mock_sm.raise_for_ownership.assert_called_once()


@patch("superset.commands.chart.update.ChartDAO.find_by_id")
@patch("superset.commands.chart.update.security_manager")
def test_update_chart_query_context_skips_ownership_check(
    mock_sm: MagicMock,
    mock_find_by_id: MagicMock,
) -> None:
    """Query-context-only updates skip ownership so report workers can save context."""
    mock_find_by_id.return_value = MagicMock(id=1, tags=[], dashboards=[])
    mock_sm.raise_for_ownership = MagicMock(side_effect=_make_ownership_exc())

    command = UpdateChartCommand(
        1, {"query_context": "{}", "query_context_generation": True}
    )

    # Should not raise — report workers can update query_context without ownership
    command.validate()
    mock_find_by_id.assert_called_once_with(1)
    mock_sm.raise_for_ownership.assert_not_called()


@patch("superset.commands.chart.update.UpdateChartCommand.compute_owners")
@patch("superset.commands.chart.update.ChartDAO.find_by_id")
@patch("superset.commands.chart.update.security_manager")
def test_update_chart_owner_can_perform_regular_update(
    mock_sm: MagicMock,
    mock_find_by_id: MagicMock,
    mock_compute_owners: MagicMock,
) -> None:
    """Chart owners can perform regular (non-query-context) updates."""
    owner = MagicMock(id=1)
    mock_find_by_id.return_value = MagicMock(
        id=1, tags=[], dashboards=[], owners=[owner]
    )
    mock_sm.raise_for_ownership = MagicMock()  # no side_effect — ownership passes
    mock_compute_owners.return_value = [owner]

    command = UpdateChartCommand(1, {"slice_name": "Renamed Chart"})
    command.validate()

    mock_find_by_id.assert_called_once_with(1)
    mock_sm.raise_for_ownership.assert_called_once()
