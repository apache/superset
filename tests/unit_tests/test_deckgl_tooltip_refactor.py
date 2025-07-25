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
Unit tests for the refactored deck.gl tooltip functionality.

These tests focus specifically on the new helper methods added to BaseDeckGLViz
and the refactored DeckScatterViz class.
"""

from unittest.mock import Mock, patch

import pandas as pd

import superset.viz as viz


class TestDeckGLTooltipRefactor:
    """Test suite for deck.gl tooltip refactoring"""

    def get_mock_datasource(self):
        """Create a mock datasource for testing"""
        datasource = Mock()
        datasource.type = "table"
        datasource.columns = []
        datasource.metrics = []
        return datasource

    def test_extract_tooltip_columns_string_list(self):
        """Test _extract_tooltip_columns with list of strings"""
        form_data = {"tooltip_contents": ["column1", "column2", "column3"]}
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)

        result = viz_instance._extract_tooltip_columns()

        assert result == ["column1", "column2", "column3"]

    def test_extract_tooltip_columns_dict_list(self):
        """Test _extract_tooltip_columns with list of dictionaries"""
        form_data = {
            "tooltip_contents": [
                {"item_type": "column", "column_name": "LAT"},
                {"item_type": "column", "column_name": "LON"},
                {"item_type": "metric", "metric_name": "count"},  # Should be ignored
                {"item_type": "column", "column_name": "CITY"},
                {"item_type": "column"},  # Missing column_name, should be ignored
            ]
        }
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)

        result = viz_instance._extract_tooltip_columns()

        assert result == ["LAT", "LON", "CITY"]

    def test_extract_tooltip_columns_mixed_types(self):
        """Test _extract_tooltip_columns with mixed string and dict items"""
        form_data = {
            "tooltip_contents": [
                "string_column",
                {"item_type": "column", "column_name": "dict_column"},
                {"item_type": "invalid"},  # Invalid type, should be ignored
            ]
        }
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)

        result = viz_instance._extract_tooltip_columns()

        assert result == ["string_column", "dict_column"]

    def test_extract_tooltip_columns_empty_cases(self):
        """Test _extract_tooltip_columns with empty or missing data"""
        # Empty list
        form_data = {"tooltip_contents": []}
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)

        result = viz_instance._extract_tooltip_columns()
        assert result == []

        # Missing key
        form_data = {}
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)

        result = viz_instance._extract_tooltip_columns()
        assert result == []

    def test_add_tooltip_columns_to_query_with_metrics(self):
        """Test _add_tooltip_columns_to_query when query has metrics"""
        form_data = {}
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)

        query_obj = {"metrics": ["count"], "groupby": ["existing_col"], "columns": []}
        tooltip_columns = ["new_col1", "new_col2", "existing_col"]

        viz_instance._add_tooltip_columns_to_query(query_obj, tooltip_columns)

        # Should add to groupby, avoiding duplicates
        assert "new_col1" in query_obj["groupby"]
        assert "new_col2" in query_obj["groupby"]
        assert query_obj["groupby"].count("existing_col") == 1

    def test_add_tooltip_columns_to_query_without_metrics(self):
        """Test _add_tooltip_columns_to_query when query has no metrics"""
        form_data = {}
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)

        query_obj = {"metrics": None, "groupby": [], "columns": ["existing_col"]}
        tooltip_columns = ["new_col1", "new_col2", "existing_col"]

        viz_instance._add_tooltip_columns_to_query(query_obj, tooltip_columns)

        # Should add to columns, avoiding duplicates
        assert "new_col1" in query_obj["columns"]
        assert "new_col2" in query_obj["columns"]
        assert query_obj["columns"].count("existing_col") == 1

    def test_add_tooltip_columns_to_query_empty_list(self):
        """Test _add_tooltip_columns_to_query with empty tooltip columns"""
        form_data = {}
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)

        query_obj = {"metrics": [], "groupby": [], "columns": []}
        original_obj = query_obj.copy()

        viz_instance._add_tooltip_columns_to_query(query_obj, [])

        # Should not modify the query object
        assert query_obj == original_obj

    def test_integrate_tooltip_columns(self):
        """Test _integrate_tooltip_columns helper method"""
        form_data = {"tooltip_contents": ["LON", "LAT"]}
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)

        query_obj = {"metrics": ["count"], "groupby": ["region"]}

        result = viz_instance._integrate_tooltip_columns(query_obj)

        assert "LON" in result["groupby"]
        assert "LAT" in result["groupby"]
        assert "region" in result["groupby"]
        assert result is query_obj  # Should return same object

    def test_add_tooltip_properties(self):
        """Test _add_tooltip_properties helper method"""
        form_data = {"tooltip_contents": ["CITY", "POP", "missing"]}
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)

        properties = {"position": [1, 2], "weight": 100}
        data = {"CITY": "NYC", "POP": 8000000, "other": "value"}

        result = viz_instance._add_tooltip_properties(properties, data)

        assert result["CITY"] == "NYC"
        assert result["POP"] == 8000000
        assert "missing" not in result
        assert "other" not in result
        assert result["position"] == [1, 2]  # Original props preserved
        assert result is properties  # Same object returned

    def test_get_base_properties(self):
        """Test _get_base_properties helper method"""
        form_data = {}
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)
        viz_instance.metric_label = "test_metric"

        data = {"spatial": [10.5, 20.3], "test_metric": 42}

        result = viz_instance._get_base_properties(data)

        assert result == {"position": [10.5, 20.3], "weight": 42}

    def test_get_base_properties_no_metric(self):
        """Test _get_base_properties when metric_label is None"""
        form_data = {}
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)
        viz_instance.metric_label = None

        data = {"spatial": [10.5, 20.3]}

        result = viz_instance._get_base_properties(data)

        assert result == {"position": [10.5, 20.3], "weight": 1}

    def test_setup_metric_label(self):
        """Test _setup_metric_label helper method"""
        form_data = {}
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)
        viz_instance.metric = "SUM(sales)"

        with patch("superset.utils.get_metric_name") as mock_get_name:
            mock_get_name.return_value = "sum__sales"

            viz_instance._setup_metric_label()

            assert viz_instance.metric_label == "sum__sales"
            mock_get_name.assert_called_once_with("SUM(sales)")

    def test_setup_metric_label_none(self):
        """Test _setup_metric_label when metric is None"""
        form_data = {}
        datasource = self.get_mock_datasource()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)
        viz_instance.metric = None

        viz_instance._setup_metric_label()

        assert viz_instance.metric_label is None


class TestDeckScatterVizRefactor:
    """Test suite for refactored DeckScatterViz class"""

    def get_mock_datasource(self):
        """Create a mock datasource for testing"""
        datasource = Mock()
        datasource.type = "table"
        datasource.columns = []
        datasource.metrics = []
        return datasource

    def test_query_obj_uses_integration_helper(self):
        """Test that query_obj uses the new _integrate_tooltip_columns helper"""
        form_data = {
            "tooltip_contents": ["CITY"],
            "time_grain_sqla": "P1D",
            "point_radius_fixed": {"type": "fix", "value": 500},
        }
        datasource = self.get_mock_datasource()
        viz_instance = viz.DeckScatterViz(datasource, form_data)

        with patch.object(viz_instance, "_integrate_tooltip_columns") as mock_integrate:
            mock_integrate.return_value = {"result": "data"}

            result = viz_instance.query_obj()

            mock_integrate.assert_called_once()
            assert result == {"result": "data"}
            # Should set instance variables
            assert viz_instance.is_timeseries is True
            assert viz_instance.point_radius_fixed == {"type": "fix", "value": 500}

    def test_get_properties_uses_tooltip_helper(self):
        """Test that get_properties uses the new _add_tooltip_properties helper"""
        form_data = {"tooltip_contents": ["CITY"]}
        datasource = self.get_mock_datasource()
        viz_instance = viz.DeckScatterViz(datasource, form_data)
        viz_instance.metric_label = "count"
        viz_instance.fixed_value = 10
        viz_instance.dim = "region"

        data = {
            "spatial": [40.7, -74.0],
            "count": 100,
            "region": "northeast",
            "CITY": "NYC",
            "__timestamp": "2023-01-01",
        }

        with patch.object(viz_instance, "_add_tooltip_properties") as mock_add:
            mock_add.return_value = {"result": "properties"}

            result = viz_instance.get_properties(data)

            expected_base = {
                "metric": 100,
                "radius": 10,
                "cat_color": "northeast",
                "position": [40.7, -74.0],
                "__timestamp": "2023-01-01",
            }
            mock_add.assert_called_once_with(expected_base, data)
            assert result == {"result": "properties"}

    def test_get_data_uses_setup_helper(self):
        """Test that get_data uses the new _setup_metric_label helper"""
        form_data = {
            "point_radius_fixed": {"type": "metric", "value": "sales"},
            "dimension": "category",
        }
        datasource = self.get_mock_datasource()
        viz_instance = viz.DeckScatterViz(datasource, form_data)
        test_df = pd.DataFrame({"col1": [1, 2]})

        with patch.object(viz_instance, "_setup_metric_label") as mock_setup:
            with patch("superset.viz.BaseDeckGLViz.get_data") as mock_super:
                mock_super.return_value = {"data": "result"}

                result = viz_instance.get_data(test_df)

                mock_setup.assert_called_once()
                mock_super.assert_called_once_with(test_df)
                assert result == {"data": "result"}

                # Should set instance variables
                assert viz_instance.point_radius_fixed == {
                    "type": "metric",
                    "value": "sales",
                }
                assert viz_instance.dim == "category"
                assert viz_instance.fixed_value is None  # metric type

    def test_get_data_fixed_radius_value(self):
        """Test get_data sets fixed_value correctly for non-metric radius"""
        form_data = {
            "point_radius_fixed": {"type": "fix", "value": 25},
            "dimension": "location",
        }
        datasource = self.get_mock_datasource()
        viz_instance = viz.DeckScatterViz(datasource, form_data)
        test_df = pd.DataFrame({"col1": [1]})

        with patch.object(viz_instance, "_setup_metric_label"):
            with patch("superset.viz.BaseDeckGLViz.get_data") as mock_super:
                mock_super.return_value = {}

                viz_instance.get_data(test_df)

                # Should set fixed_value for non-metric type
                assert viz_instance.fixed_value == 25


class TestTooltipIntegration:
    """Integration tests for the complete tooltip flow"""

    def get_mock_datasource(self):
        """Create a mock datasource for testing"""
        datasource = Mock()
        datasource.type = "table"
        datasource.columns = []
        datasource.metrics = []
        return datasource

    def test_end_to_end_tooltip_flow(self):
        """Test complete tooltip integration from query to properties"""
        form_data = {"tooltip_contents": ["CITY", "POPULATION"], "size": "count"}
        datasource = self.get_mock_datasource()
        viz_instance = viz.DeckScatterViz(datasource, form_data)

        # Test query integration
        with patch("superset.viz.BaseDeckGLViz.query_obj") as mock_super_query:
            mock_super_query.return_value = {
                "metrics": ["count"],
                "groupby": ["region"],
                "columns": [],
            }

            query_result = viz_instance.query_obj()

            # Tooltip columns should be added to groupby
            assert "CITY" in query_result["groupby"]
            assert "POPULATION" in query_result["groupby"]
            assert "region" in query_result["groupby"]

        # Test properties integration
        viz_instance.metric_label = "count"
        viz_instance.fixed_value = None
        viz_instance.dim = "region"

        data = {
            "spatial": [40.7, -74.0],
            "count": 5000,
            "region": "northeast",
            "CITY": "New York",
            "POPULATION": 8000000,
            "__timestamp": "2023-01-01",
        }

        properties_result = viz_instance.get_properties(data)

        # Should include both base and tooltip properties
        expected_properties = {
            "position": [40.7, -74.0],
            "metric": 5000,
            "radius": 5000,  # Uses metric_label when fixed_value is None
            "cat_color": "northeast",
            "__timestamp": "2023-01-01",
            "CITY": "New York",
            "POPULATION": 8000000,
        }

        for key, value in expected_properties.items():
            assert properties_result[key] == value
