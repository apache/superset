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
"""Tests for annotation layer time grain handling."""
from unittest.mock import MagicMock, patch

import pytest

from superset.common.query_context import QueryContext
from superset.common.query_context_processor import QueryContextProcessor
from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.utils.core import DatasourceType
from tests.integration_tests.base_tests import SupersetTestCase


class TestAnnotationTimeGrain(SupersetTestCase):
    """
    Test that annotation layers correctly handle time grain values (P1D, PT1H, etc.)
    and prevent them from being treated as physical column names.
    """

    def test_is_time_grain_value_identifies_valid_patterns(self):
        """Test _is_time_grain_value correctly identifies time grain patterns."""
        # Valid time grain patterns
        assert QueryContextProcessor._is_time_grain_value("P1D")
        assert QueryContextProcessor._is_time_grain_value("P1M")
        assert QueryContextProcessor._is_time_grain_value("P1Y")
        assert QueryContextProcessor._is_time_grain_value("P1W")
        assert QueryContextProcessor._is_time_grain_value("PT1H")
        assert QueryContextProcessor._is_time_grain_value("PT30M")
        assert QueryContextProcessor._is_time_grain_value("PT1S")
        assert QueryContextProcessor._is_time_grain_value("P3M")  # Quarter
        assert QueryContextProcessor._is_time_grain_value("PT0.5H")  # Half hour
        assert QueryContextProcessor._is_time_grain_value("P0.25Y")  # Quarter year

        # Week with epoch formats
        assert QueryContextProcessor._is_time_grain_value(
            "1969-12-28T00:00:00Z/P1W"
        )  # Week starting Sunday
        assert QueryContextProcessor._is_time_grain_value(
            "1969-12-29T00:00:00Z/P1W"
        )  # Week starting Monday
        assert QueryContextProcessor._is_time_grain_value(
            "P1W/1970-01-03T00:00:00Z"
        )  # Week ending Saturday
        assert QueryContextProcessor._is_time_grain_value(
            "P1W/1970-01-04T00:00:00Z"
        )  # Week ending Sunday

        # Invalid patterns (normal column names)
        assert not QueryContextProcessor._is_time_grain_value("country")
        assert not QueryContextProcessor._is_time_grain_value("__time")
        assert not QueryContextProcessor._is_time_grain_value("P")  # Incomplete
        assert not QueryContextProcessor._is_time_grain_value("1D")  # Missing P
        assert not QueryContextProcessor._is_time_grain_value("PD1")  # Wrong order
        assert not QueryContextProcessor._is_time_grain_value("")
        assert not QueryContextProcessor._is_time_grain_value(None)
        assert not QueryContextProcessor._is_time_grain_value(123)
        assert not QueryContextProcessor._is_time_grain_value(["P1D"])

    @patch("superset.common.query_context_processor.ChartDAO")
    @patch("superset.common.query_context_processor.ChartDataCommand")
    def test_annotation_time_grain_override_removes_time_grain_from_columns(
        self, mock_chart_data_command, mock_chart_dao
    ):
        """
        Test that when annotation overrides include time_grain_sqla, any time grain
        values in the columns list are removed to prevent column-not-found errors.
        """
        # Setup mock chart with form_data containing time grain in columns
        mock_chart = MagicMock()
        mock_chart.id = 1
        mock_chart.viz_type = "line"
        mock_chart.form_data = {
            "datasource": "1__table",
            "columns": ["country", "P1D"],  # Bad data: time grain in columns
        }
        mock_chart.datasource = MagicMock(spec=SqlaTable)
        mock_chart.datasource.type = DatasourceType.TABLE
        mock_chart.datasource.id = 1

        # Setup mock query_context
        mock_query_context = MagicMock()
        mock_query_object = MagicMock(spec=QueryObject)
        mock_query_object.columns = ["country", "P1D"]
        mock_query_object.extras = {}
        mock_query_context.queries = [mock_query_object]

        mock_chart.get_query_context.return_value = mock_query_context
        mock_chart_dao.find_by_id.return_value = mock_chart

        # Setup mock ChartDataCommand
        mock_command_instance = MagicMock()
        mock_command_instance.run.return_value = {"queries": [{"data": []}]}
        mock_chart_data_command.return_value = mock_command_instance

        # Create annotation layer with time grain override
        annotation_layer = {
            "name": "test_annotation",
            "value": 1,  # chart_id
            "sourceType": "line",
            "overrides": {"time_grain_sqla": "P1D"},
        }

        # Call the method
        result = QueryContextProcessor.get_viz_annotation_data(
            annotation_layer, force=False
        )

        # Verify that P1D was removed from columns
        assert mock_query_object.columns == [
            "country"
        ], "Time grain P1D should be removed from columns"
        assert (
            mock_query_object.extras["time_grain_sqla"] == "P1D"
        ), "Time grain should be in extras"

        # Verify command was called with cleaned query_object
        mock_command_instance.validate.assert_called_once()
        mock_command_instance.run.assert_called_once()

    @patch("superset.common.query_context_processor.ChartDAO")
    @patch("superset.common.query_context_processor.ChartDataCommand")
    def test_annotation_without_time_grain_override_preserves_columns(
        self, mock_chart_data_command, mock_chart_dao
    ):
        """
        Test that annotation queries without time_grain_sqla override do not modify
        the columns list, ensuring existing behavior is unchanged.
        """
        # Setup mock chart
        mock_chart = MagicMock()
        mock_chart.id = 1
        mock_chart.viz_type = "line"
        mock_chart.form_data = {"datasource": "1__table", "columns": ["country", "city"]}
        mock_chart.datasource = MagicMock(spec=SqlaTable)
        mock_chart.datasource.type = DatasourceType.TABLE
        mock_chart.datasource.id = 1

        # Setup mock query_context
        mock_query_context = MagicMock()
        mock_query_object = MagicMock(spec=QueryObject)
        mock_query_object.columns = ["country", "city"]
        mock_query_object.extras = {}
        mock_query_context.queries = [mock_query_object]

        mock_chart.get_query_context.return_value = mock_query_context
        mock_chart_dao.find_by_id.return_value = mock_chart

        # Setup mock ChartDataCommand
        mock_command_instance = MagicMock()
        mock_command_instance.run.return_value = {"queries": [{"data": []}]}
        mock_chart_data_command.return_value = mock_command_instance

        # Create annotation layer WITHOUT time grain override
        annotation_layer = {
            "name": "test_annotation",
            "value": 1,  # chart_id
            "sourceType": "line",
            "overrides": {},  # No time_grain_sqla
        }

        # Call the method
        result = QueryContextProcessor.get_viz_annotation_data(
            annotation_layer, force=False
        )

        # Verify that columns remain unchanged
        assert mock_query_object.columns == [
            "country",
            "city",
        ], "Columns should be unchanged when no time grain override"

    @patch("superset.common.query_context_processor.ChartDAO")
    @patch("superset.common.query_context_processor.ChartDataCommand")
    def test_annotation_with_multiple_time_grains_in_columns(
        self, mock_chart_data_command, mock_chart_dao
    ):
        """
        Test that multiple time grain values in columns list are all removed.
        """
        # Setup mock chart with multiple time grains in columns
        mock_chart = MagicMock()
        mock_chart.id = 1
        mock_chart.viz_type = "line"
        mock_chart.form_data = {
            "datasource": "1__table",
            "columns": ["country", "P1D", "PT1H", "city", "P1M"],
        }
        mock_chart.datasource = MagicMock(spec=SqlaTable)
        mock_chart.datasource.type = DatasourceType.TABLE
        mock_chart.datasource.id = 1

        # Setup mock query_context
        mock_query_context = MagicMock()
        mock_query_object = MagicMock(spec=QueryObject)
        mock_query_object.columns = ["country", "P1D", "PT1H", "city", "P1M"]
        mock_query_object.extras = {}
        mock_query_context.queries = [mock_query_object]

        mock_chart.get_query_context.return_value = mock_query_context
        mock_chart_dao.find_by_id.return_value = mock_chart

        # Setup mock ChartDataCommand
        mock_command_instance = MagicMock()
        mock_command_instance.run.return_value = {"queries": [{"data": []}]}
        mock_chart_data_command.return_value = mock_command_instance

        # Create annotation layer with time grain override
        annotation_layer = {
            "name": "test_annotation",
            "value": 1,
            "sourceType": "line",
            "overrides": {"time_grain_sqla": "P1D"},
        }

        # Call the method
        result = QueryContextProcessor.get_viz_annotation_data(
            annotation_layer, force=False
        )

        # Verify that all time grains were removed, only real columns remain
        assert mock_query_object.columns == [
            "country",
            "city",
        ], "All time grain values should be removed from columns"
        assert mock_query_object.extras["time_grain_sqla"] == "P1D"

    @patch("superset.common.query_context_processor.ChartDAO")
    @patch("superset.common.query_context_processor.ChartDataCommand")
    def test_annotation_with_adhoc_columns_preserved(
        self, mock_chart_data_command, mock_chart_dao
    ):
        """
        Test that adhoc columns (dicts) are preserved and not filtered.
        """
        # Setup mock chart with adhoc column
        mock_chart = MagicMock()
        mock_chart.id = 1
        mock_chart.viz_type = "line"
        adhoc_column = {
            "sqlExpression": "CASE WHEN country = 'US' THEN 'USA' ELSE country END",
            "label": "country_mapped",
        }
        mock_chart.form_data = {
            "datasource": "1__table",
            "columns": ["city", "P1D", adhoc_column],
        }
        mock_chart.datasource = MagicMock(spec=SqlaTable)
        mock_chart.datasource.type = DatasourceType.TABLE
        mock_chart.datasource.id = 1

        # Setup mock query_context
        mock_query_context = MagicMock()
        mock_query_object = MagicMock(spec=QueryObject)
        mock_query_object.columns = ["city", "P1D", adhoc_column]
        mock_query_object.extras = {}
        mock_query_context.queries = [mock_query_object]

        mock_chart.get_query_context.return_value = mock_query_context
        mock_chart_dao.find_by_id.return_value = mock_chart

        # Setup mock ChartDataCommand
        mock_command_instance = MagicMock()
        mock_command_instance.run.return_value = {"queries": [{"data": []}]}
        mock_chart_data_command.return_value = mock_command_instance

        # Create annotation layer with time grain override
        annotation_layer = {
            "name": "test_annotation",
            "value": 1,
            "sourceType": "line",
            "overrides": {"time_grain_sqla": "P1D"},
        }

        # Call the method
        result = QueryContextProcessor.get_viz_annotation_data(
            annotation_layer, force=False
        )

        # Verify: P1D removed, adhoc column preserved
        assert len(mock_query_object.columns) == 2
        assert "city" in mock_query_object.columns
        assert adhoc_column in mock_query_object.columns
        assert "P1D" not in mock_query_object.columns

    @patch("superset.common.query_context_processor.ChartDAO")
    @patch("superset.common.query_context_processor.ChartDataCommand")
    def test_annotation_with_week_epoch_time_grain_formats(
        self, mock_chart_data_command, mock_chart_dao
    ):
        """
        Test that complex week epoch formats are correctly identified and removed.
        """
        # Setup mock chart with week epoch format time grains
        mock_chart = MagicMock()
        mock_chart.id = 1
        mock_chart.viz_type = "line"
        mock_chart.form_data = {
            "datasource": "1__table",
            "columns": [
                "country",
                "1969-12-28T00:00:00Z/P1W",  # Week starting Sunday
                "P1W/1970-01-03T00:00:00Z",  # Week ending Saturday
            ],
        }
        mock_chart.datasource = MagicMock(spec=SqlaTable)
        mock_chart.datasource.type = DatasourceType.TABLE
        mock_chart.datasource.id = 1

        # Setup mock query_context
        mock_query_context = MagicMock()
        mock_query_object = MagicMock(spec=QueryObject)
        mock_query_object.columns = [
            "country",
            "1969-12-28T00:00:00Z/P1W",
            "P1W/1970-01-03T00:00:00Z",
        ]
        mock_query_object.extras = {}
        mock_query_context.queries = [mock_query_object]

        mock_chart.get_query_context.return_value = mock_query_context
        mock_chart_dao.find_by_id.return_value = mock_chart

        # Setup mock ChartDataCommand
        mock_command_instance = MagicMock()
        mock_command_instance.run.return_value = {"queries": [{"data": []}]}
        mock_chart_data_command.return_value = mock_command_instance

        # Create annotation layer with time grain override
        annotation_layer = {
            "name": "test_annotation",
            "value": 1,
            "sourceType": "line",
            "overrides": {"time_grain_sqla": "1969-12-28T00:00:00Z/P1W"},
        }

        # Call the method
        result = QueryContextProcessor.get_viz_annotation_data(
            annotation_layer, force=False
        )

        # Verify that complex week formats were removed
        assert mock_query_object.columns == [
            "country"
        ], "Week epoch formats should be removed from columns"
