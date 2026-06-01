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
import pytest
from pytest_mock import MockerFixture

from superset.commands.chart.exceptions import ChartForbiddenError
from superset.commands.chart.update import UpdateChartCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException


def _ownership_exc() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
            message="User does not own this chart",
            level=ErrorLevel.ERROR,
        )
    )


def test_update_chart_ownership_enforced_for_regular_update(
    mocker: MockerFixture,
) -> None:
    """Non-owners must not be able to update a chart via a regular payload."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(id=1, tags=[], dashboards=[])
    raise_for_ownership = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_ownership",
        side_effect=_ownership_exc(),
    )

    with pytest.raises(ChartForbiddenError):
        UpdateChartCommand(1, {"slice_name": "My Chart"}).validate()

    find_by_id.assert_called_once_with(1)
    raise_for_ownership.assert_called_once()


def test_update_chart_query_context_skips_ownership_check(
    mocker: MockerFixture,
) -> None:
    """Query-context-only updates skip ownership so report workers can save context."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(id=1, tags=[], dashboards=[])
    raise_for_ownership = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_ownership",
        side_effect=_ownership_exc(),
    )

    UpdateChartCommand(
        1, {"query_context": "{}", "query_context_generation": True}
    ).validate()

    find_by_id.assert_called_once_with(1)
    raise_for_ownership.assert_not_called()


def test_update_chart_owner_can_perform_regular_update(
    mocker: MockerFixture,
) -> None:
    """Chart owners can perform regular (non-query-context) updates."""
    owner = mocker.MagicMock(id=1)
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(
        id=1, tags=[], dashboards=[], owners=[owner]
    )
    raise_for_ownership = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_ownership"
    )
    mocker.patch(
        "superset.commands.chart.update.UpdateChartCommand.compute_owners",
        return_value=[owner],
    )

    UpdateChartCommand(1, {"slice_name": "Renamed Chart"}).validate()

    find_by_id.assert_called_once_with(1)
    raise_for_ownership.assert_called_once()
