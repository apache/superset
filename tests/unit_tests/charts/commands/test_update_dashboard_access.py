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
"""Datasource-access requirement when linking a chart to a new dashboard."""

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from superset.commands.chart.exceptions import ChartForbiddenError
from superset.commands.chart.update import UpdateChartCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException


def _denied() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            message="denied",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )


def _setup(
    security_manager: MagicMock,
    dashboard_dao: MagicMock,
    *,
    properties: dict[str, Any] | None = None,
) -> tuple[UpdateChartCommand, MagicMock, MagicMock]:
    """Wire the command + a single new, accessible, editable target dashboard.

    ``security_manager`` is patched without a spec, so its callables default to
    async children; pin the ones this path uses to plain sync mocks. The shared
    rule (admin / no-request-user / unresolvable-datasource) lives in
    ``raise_for_datasources_access`` and is exercised by the DAO-level tests.
    """
    chart = MagicMock()
    chart.dashboards = []  # no existing relationships
    dashboard = MagicMock()
    dashboard.id = 5
    dashboard.is_managed_externally = False
    dashboard_dao.find_by_ids.return_value = [dashboard]
    security_manager.is_editor = MagicMock(return_value=True)
    security_manager.raise_for_datasources_access = MagicMock()
    command = UpdateChartCommand(1, properties or {})
    command._model = chart
    return command, chart, dashboard


@patch("superset.commands.chart.update.DashboardDAO")
@patch("superset.commands.chart.update.security_manager")
def test_new_dashboard_link_requires_chart_datasource_access(
    security_manager: MagicMock, dashboard_dao: MagicMock
) -> None:
    """Linking a chart to a new dashboard requires access to its datasource."""
    command, chart, dashboard = _setup(security_manager, dashboard_dao)
    security_manager.raise_for_datasources_access.side_effect = _denied()

    with pytest.raises(ChartForbiddenError):
        command._validate_new_dashboard_access([dashboard], [])
    security_manager.raise_for_datasources_access.assert_called_once_with(
        [chart.resolved_datasource]
    )


@patch("superset.commands.chart.update.DashboardDAO")
@patch("superset.commands.chart.update.security_manager")
def test_new_dashboard_link_allowed_with_datasource_access(
    security_manager: MagicMock, dashboard_dao: MagicMock
) -> None:
    """With datasource access the link is permitted."""
    command, chart, dashboard = _setup(security_manager, dashboard_dao)

    command._validate_new_dashboard_access([dashboard], [])
    security_manager.raise_for_datasources_access.assert_called_once_with(
        [chart.resolved_datasource]
    )


@patch("superset.commands.chart.update.get_datasource_by_id")
@patch("superset.commands.chart.update.DashboardDAO")
@patch("superset.commands.chart.update.security_manager")
def test_new_dashboard_link_uses_effective_datasource_on_repoint(
    security_manager: MagicMock,
    dashboard_dao: MagicMock,
    get_datasource_by_id: MagicMock,
) -> None:
    """When the same request repoints the chart, the check uses the incoming
    (effective) datasource, not the stale stored one."""
    new_datasource = MagicMock(name="new_datasource")
    get_datasource_by_id.return_value = new_datasource
    command, chart, dashboard = _setup(
        security_manager,
        dashboard_dao,
        properties={"datasource_id": 9, "datasource_type": "table"},
    )

    command._validate_new_dashboard_access([dashboard], [])
    get_datasource_by_id.assert_called_once_with(9, "table")
    security_manager.raise_for_datasources_access.assert_called_once_with(
        [new_datasource]
    )
