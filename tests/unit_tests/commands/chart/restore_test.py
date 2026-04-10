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
"""Unit tests for RestoreChartCommand."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest


def test_restore_chart_clears_deleted_at(app_context: None) -> None:
    """RestoreChartCommand.run() restores a soft-deleted chart."""
    from superset.commands.chart.restore import RestoreChartCommand

    chart = MagicMock()
    chart.deleted_at = datetime(2026, 1, 1)
    chart.id = 1

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = chart

    with (
        patch("superset.commands.chart.restore.db") as mock_db,
        patch("superset.commands.chart.restore.security_manager") as mock_sec,
    ):
        mock_db.session.query.return_value = query_mock
        mock_sec.raise_for_ownership.return_value = None

        cmd = RestoreChartCommand(1)
        cmd.run()

    chart.restore.assert_called_once()


def test_restore_chart_not_found_raises(app_context: None) -> None:
    """RestoreChartCommand raises ChartNotFoundError for missing chart."""
    from superset.commands.chart.exceptions import ChartNotFoundError
    from superset.commands.chart.restore import RestoreChartCommand

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = None

    with patch("superset.commands.chart.restore.db") as mock_db:
        mock_db.session.query.return_value = query_mock

        cmd = RestoreChartCommand(999)
        with pytest.raises(ChartNotFoundError):
            cmd.run()


def test_restore_active_chart_raises_not_found(app_context: None) -> None:
    """RestoreChartCommand raises ChartNotFoundError for non-deleted chart."""
    from superset.commands.chart.exceptions import ChartNotFoundError
    from superset.commands.chart.restore import RestoreChartCommand

    chart = MagicMock()
    chart.deleted_at = None  # not soft-deleted

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = chart

    with patch("superset.commands.chart.restore.db") as mock_db:
        mock_db.session.query.return_value = query_mock

        cmd = RestoreChartCommand(1)
        with pytest.raises(ChartNotFoundError):
            cmd.run()


def test_restore_chart_forbidden_raises(app_context: None) -> None:
    """RestoreChartCommand raises ChartForbiddenError on permission check."""
    from superset.commands.chart.exceptions import ChartForbiddenError
    from superset.commands.chart.restore import RestoreChartCommand
    from superset.exceptions import SupersetSecurityException

    chart = MagicMock()
    chart.deleted_at = datetime(2026, 1, 1)

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = chart

    def raise_security(*args: object, **kwargs: object) -> None:
        raise SupersetSecurityException(MagicMock())

    with (
        patch("superset.commands.chart.restore.db") as mock_db,
        patch("superset.commands.chart.restore.security_manager") as mock_sec,
    ):
        mock_db.session.query.return_value = query_mock
        mock_sec.raise_for_ownership = raise_security

        cmd = RestoreChartCommand(1)
        with pytest.raises(ChartForbiddenError):
            cmd.run()
