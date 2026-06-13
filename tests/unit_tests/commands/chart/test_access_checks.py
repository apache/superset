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
"""Unit tests for per-object datasource access checks in chart create/update."""

from unittest.mock import MagicMock, patch

import pytest

from superset.commands.chart.exceptions import ChartForbiddenError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException


def _security_exception() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            message="Access denied",
            level=ErrorLevel.ERROR,
        )
    )


# ---------------------------------------------------------------------------
# CreateChartCommand
# ---------------------------------------------------------------------------


def test_create_chart_command_forbidden_when_no_datasource_access() -> None:
    """CreateChartCommand.validate() must raise ChartForbiddenError when the
    caller lacks access to the chart's datasource."""
    from superset.commands.chart.create import CreateChartCommand

    with patch(
        "superset.commands.chart.create.get_datasource_by_id",
        return_value=MagicMock(name="datasource"),
    ):
        with patch(
            "superset.commands.chart.create.security_manager.raise_for_access",
            side_effect=_security_exception(),
        ):
            with patch(
                "superset.commands.chart.create.CreateChartCommand.populate_owners",
                return_value=[],
            ):
                command = CreateChartCommand(
                    {
                        "slice_name": "test",
                        "viz_type": "bar",
                        "datasource_id": 1,
                        "datasource_type": "table",
                    }
                )
                with pytest.raises(ChartForbiddenError):
                    command.validate()


def test_create_chart_command_allowed_when_access_passes() -> None:
    """CreateChartCommand.validate() must not raise when the caller has access."""
    from superset.commands.chart.create import CreateChartCommand

    mock_datasource = MagicMock()
    mock_datasource.name = "test_table"

    with patch(
        "superset.commands.chart.create.get_datasource_by_id",
        return_value=mock_datasource,
    ):
        with patch("superset.commands.chart.create.security_manager.raise_for_access"):
            with patch(
                "superset.commands.chart.create.CreateChartCommand.populate_owners",
                return_value=[],
            ):
                with patch(
                    "superset.commands.chart.create.DashboardDAO.find_by_ids",
                    return_value=[],
                ):
                    command = CreateChartCommand(
                        {
                            "slice_name": "test",
                            "viz_type": "bar",
                            "datasource_id": 1,
                            "datasource_type": "table",
                        }
                    )
                    command.validate()  # should not raise


# ---------------------------------------------------------------------------
# UpdateChartCommand
# ---------------------------------------------------------------------------


def test_update_chart_command_forbidden_when_no_datasource_access() -> None:
    """UpdateChartCommand.validate() must raise ChartForbiddenError when the
    caller lacks access to the new datasource."""
    from superset.commands.chart.update import UpdateChartCommand

    mock_chart = MagicMock()
    mock_chart.id = 1
    mock_chart.owners = []
    mock_chart.dashboards = []
    mock_chart.tags = []

    with patch(
        "superset.commands.chart.update.ChartDAO.find_by_id",
        return_value=mock_chart,
    ):
        with patch(
            "superset.commands.chart.update.security_manager.raise_for_ownership"
        ):
            with patch(
                "superset.commands.chart.update.UpdateChartCommand.compute_owners",
                return_value=[],
            ):
                with patch("superset.commands.chart.update.validate_tags"):
                    with patch(
                        "superset.commands.chart.update.get_datasource_by_id",
                        return_value=MagicMock(name="datasource"),
                    ):
                        with patch(
                            "superset.commands.chart.update.security_manager.raise_for_access",
                            side_effect=_security_exception(),
                        ):
                            command = UpdateChartCommand(
                                1,
                                {
                                    "datasource_id": 2,
                                    "datasource_type": "table",
                                },
                            )
                            with pytest.raises(ChartForbiddenError):
                                command.validate()
