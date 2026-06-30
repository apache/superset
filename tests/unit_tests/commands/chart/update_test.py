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


def _editorship_exc() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
            message="User is not an editor of this chart",
            level=ErrorLevel.ERROR,
        )
    )


def _access_exc() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.CHART_SECURITY_ACCESS_ERROR,
            message="User does not have access to this chart",
            level=ErrorLevel.ERROR,
        )
    )


def test_update_chart_editorship_enforced_for_regular_update(
    mocker: MockerFixture,
) -> None:
    """Non-editors must not be able to update a chart via a regular payload."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(id=1, tags=[], dashboards=[])
    raise_for_editorship = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship",
        side_effect=_editorship_exc(),
    )

    with pytest.raises(ChartForbiddenError):
        UpdateChartCommand(1, {"slice_name": "My Chart"}).validate()

    find_by_id.assert_called_once_with(1)
    raise_for_editorship.assert_called_once()


def test_update_chart_query_context_skips_editorship_check(
    mocker: MockerFixture,
) -> None:
    """Query-context-only updates skip editorship but still require chart access."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(id=1, tags=[], dashboards=[])
    raise_for_editorship = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship",
        side_effect=_editorship_exc(),
    )
    raise_for_access = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_access",
    )

    UpdateChartCommand(
        1, {"query_context": "{}", "query_context_generation": True}
    ).validate()

    find_by_id.assert_called_once_with(1)
    raise_for_editorship.assert_not_called()
    raise_for_access.assert_called_once_with(chart=find_by_id.return_value)


def test_update_chart_query_context_requires_chart_access(
    mocker: MockerFixture,
) -> None:
    """A query-context-only update by someone without access to the chart is
    rejected, even though the editorship check is relaxed for this path."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(id=1, tags=[], dashboards=[])
    mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_access",
        side_effect=_access_exc(),
    )

    with pytest.raises(ChartForbiddenError):
        UpdateChartCommand(
            1, {"query_context": "{}", "query_context_generation": True}
        ).validate()


def test_update_chart_query_context_non_editor_with_access_allowed(
    mocker: MockerFixture,
) -> None:
    """A non-editor who has access to the chart (e.g. an alpha user with
    datasource access, or a report worker) can perform a query-context-only
    backfill: editorship is relaxed and ``raise_for_access`` does not deny."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(id=1, tags=[], dashboards=[])
    raise_for_editorship = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship",
        side_effect=_editorship_exc(),
    )
    # access check passes (no exception) -> the non-editor is permitted
    raise_for_access = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_access",
    )

    UpdateChartCommand(
        1, {"query_context": "{}", "query_context_generation": True}
    ).validate()

    raise_for_editorship.assert_not_called()
    raise_for_access.assert_called_once_with(chart=find_by_id.return_value)


def test_update_chart_editor_can_perform_regular_update(
    mocker: MockerFixture,
) -> None:
    """Chart editors can perform regular updates and pass editor changes."""
    editor = mocker.MagicMock(id=1)
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    chart = mocker.MagicMock(id=1, tags=[], dashboards=[], editors=[editor])
    find_by_id.return_value = chart
    raise_for_editorship = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship"
    )
    compute_subjects = mocker.patch("superset.commands.chart.update.compute_subjects")

    UpdateChartCommand(1, {"slice_name": "Renamed Chart", "editors": [2]}).validate()

    find_by_id.assert_called_once_with(1)
    raise_for_editorship.assert_called_once()
    compute_subjects.assert_called_once()
    properties = compute_subjects.call_args.args[1]
    exceptions = compute_subjects.call_args.args[2]
    assert properties["editors"] == [2]
    assert exceptions == []
