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

"""Tests for sidecar integration in report execution."""

from datetime import datetime
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from superset.commands.report.execute import BaseReportState
from superset.reports.models import ReportSchedule
from superset.utils.query_sidecar import QuerySidecarException


class TestReportExecutionSidecar:
    """Tests for sidecar service integration in report execution."""

    @patch("superset.commands.report.execute.app")
    @patch("superset.commands.report.execute.get_query_sidecar_client")
    @patch("superset.commands.report.execute.db")
    def test_generate_query_context_via_sidecar_success(
        self, mock_db, mock_get_client, mock_app
    ):
        """Test successful query context generation via sidecar."""
        # Setup mocks
        mock_app.config.get.return_value = True  # QUERY_SIDECAR_ENABLED
        mock_sidecar_client = MagicMock()
        mock_get_client.return_value = mock_sidecar_client
        mock_sidecar_client.build_query_object.return_value = {
            "metrics": ["count"],
            "columns": ["name"],
            "filters": [],
        }

        # Create test report schedule with chart
        mock_chart = MagicMock()
        mock_chart.id = 1
        mock_chart.form_data = {
            "datasource": "1__table",
            "viz_type": "table",
            "metrics": ["count"],
            "columns": ["name"],
        }
        mock_chart.query_context = None

        mock_report_schedule = MagicMock(spec=ReportSchedule)
        mock_report_schedule.chart = mock_chart

        # Create BaseReportState instance
        report_state = BaseReportState(mock_report_schedule, datetime.utcnow(), uuid4())

        # Test the method
        report_state._generate_query_context_via_sidecar()

        # Verify sidecar was called with correct form_data
        mock_sidecar_client.build_query_object.assert_called_once_with(
            mock_chart.form_data
        )

        # Verify query_context was updated
        assert mock_chart.query_context is not None
        mock_db.session.commit.assert_called_once()

    @patch("superset.commands.report.execute.app")
    def test_generate_query_context_via_sidecar_no_chart(self, mock_app):
        """Test error when no chart is associated with report schedule."""
        mock_app.config.get.return_value = True  # QUERY_SIDECAR_ENABLED

        mock_report_schedule = MagicMock(spec=ReportSchedule)
        mock_report_schedule.chart = None

        report_state = BaseReportState(mock_report_schedule, datetime.utcnow(), uuid4())

        with pytest.raises(
            QuerySidecarException, match="No chart associated with report schedule"
        ):
            report_state._generate_query_context_via_sidecar()

    @patch("superset.commands.report.execute.app")
    @patch("superset.commands.report.execute.get_query_sidecar_client")
    def test_generate_query_context_via_sidecar_client_error(
        self, mock_get_client, mock_app
    ):
        """Test handling of sidecar client errors."""
        mock_app.config.get.return_value = True  # QUERY_SIDECAR_ENABLED
        mock_sidecar_client = MagicMock()
        mock_get_client.return_value = mock_sidecar_client
        mock_sidecar_client.build_query_object.side_effect = Exception("Sidecar error")

        mock_chart = MagicMock()
        mock_chart.form_data = {"datasource": "1__table", "viz_type": "table"}
        mock_report_schedule = MagicMock(spec=ReportSchedule)
        mock_report_schedule.chart = mock_chart

        report_state = BaseReportState(mock_report_schedule, datetime.utcnow(), uuid4())

        with pytest.raises(
            QuerySidecarException, match="Failed to generate query context via sidecar"
        ):
            report_state._generate_query_context_via_sidecar()

    @patch("superset.commands.report.execute.app")
    @patch(
        "superset.commands.report.execute.BaseReportState._generate_query_context_via_sidecar"
    )
    def test_ensure_query_context_available_sidecar_enabled(
        self, mock_generate_sidecar, mock_app
    ):
        """Test _ensure_query_context_available when sidecar is enabled."""
        mock_app.config.get.return_value = True  # QUERY_SIDECAR_ENABLED

        mock_report_schedule = MagicMock(spec=ReportSchedule)
        report_state = BaseReportState(mock_report_schedule, datetime.utcnow(), uuid4())

        report_state._ensure_query_context_available()

        mock_generate_sidecar.assert_called_once()

    @patch("superset.commands.report.execute.app")
    @patch(
        "superset.commands.report.execute.BaseReportState._generate_query_context_via_sidecar"
    )
    @patch(
        "superset.commands.report.execute.BaseReportState._update_query_context_legacy"
    )
    def test_ensure_query_context_available_fallback(
        self, mock_legacy, mock_generate_sidecar, mock_app
    ):
        """Test fallback to legacy method when sidecar fails."""
        mock_app.config.get.return_value = True  # QUERY_SIDECAR_ENABLED
        mock_generate_sidecar.side_effect = QuerySidecarException("Sidecar failed")

        mock_chart = MagicMock()
        mock_chart.query_context = None
        mock_report_schedule = MagicMock(spec=ReportSchedule)
        mock_report_schedule.chart = mock_chart

        report_state = BaseReportState(mock_report_schedule, datetime.utcnow(), uuid4())

        report_state._ensure_query_context_available()

        mock_generate_sidecar.assert_called_once()
        mock_legacy.assert_called_once()

    @patch("superset.commands.report.execute.app")
    @patch(
        "superset.commands.report.execute.BaseReportState._update_query_context_legacy"
    )
    def test_ensure_query_context_available_sidecar_disabled(
        self, mock_legacy, mock_app
    ):
        """Test _ensure_query_context_available when sidecar is disabled."""
        mock_app.config.get.return_value = False  # QUERY_SIDECAR_ENABLED = False

        mock_chart = MagicMock()
        mock_chart.query_context = None
        mock_report_schedule = MagicMock(spec=ReportSchedule)
        mock_report_schedule.chart = mock_chart

        report_state = BaseReportState(mock_report_schedule, datetime.utcnow(), uuid4())

        report_state._ensure_query_context_available()

        mock_legacy.assert_called_once()

    @patch("superset.commands.report.execute.app")
    def test_ensure_query_context_available_existing_context(self, mock_app):
        """Test _ensure_query_context_available when query_context already exists."""
        mock_app.config.get.return_value = False  # QUERY_SIDECAR_ENABLED = False

        mock_chart = MagicMock()
        mock_chart.query_context = '{"queries": []}'  # Existing context
        mock_report_schedule = MagicMock(spec=ReportSchedule)
        mock_report_schedule.chart = mock_chart

        report_state = BaseReportState(mock_report_schedule, datetime.utcnow(), uuid4())

        # Should not raise any errors or call legacy method
        report_state._ensure_query_context_available()
