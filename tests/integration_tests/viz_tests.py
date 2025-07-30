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
# isort:skip_file
from datetime import datetime
import logging
from unittest.mock import Mock, patch

import numpy as np
import pandas as pd
import pytest

import tests.integration_tests.test_app  # noqa: F401
import superset.viz as viz
from flask import current_app
from superset.exceptions import QueryObjectValidationError, SpatialException
from superset.utils.core import DTTM_ALIAS
from tests.conftest import with_config

from .base_tests import SupersetTestCase
from .utils import load_fixture

logger = logging.getLogger(__name__)


class TestBaseViz(SupersetTestCase):
    def test_constructor_exception_no_datasource(self):
        form_data = {}
        datasource = None
        with self.assertRaises(Exception):  # noqa: B017, PT027
            viz.BaseViz(datasource, form_data)

    def test_process_metrics(self):
        # test TimeTableViz metrics in correct order
        form_data = {
            "url_params": {},
            "row_limit": 500,
            "metric": "sum__SP_POP_TOTL",
            "entity": "country_code",
            "secondary_metric": "sum__SP_POP_TOTL",
            "granularity_sqla": "year",
            "page_length": 0,
            "all_columns": [],
            "viz_type": "time_table",
            "since": "2014-01-01",
            "until": "2014-01-02",
            "metrics": ["sum__SP_POP_TOTL", "SUM(SE_PRM_NENR_MA)", "SUM(SP_URB_TOTL)"],
            "country_fieldtype": "cca3",
            "percent_metrics": ["count"],
            "slice_id": 74,
            "time_grain_sqla": None,
            "order_by_cols": [],
            "groupby": ["country_name"],
            "compare_lag": "10",
            "limit": "25",
            "datasource": "2__table",
            "table_timestamp_format": "%Y-%m-%d %H:%M:%S",
            "markup_type": "markdown",
            "where": "",
            "compare_suffix": "o10Y",
        }
        datasource = Mock()
        datasource.type = "table"
        test_viz = viz.BaseViz(datasource, form_data)
        expect_metric_labels = [
            "sum__SP_POP_TOTL",
            "SUM(SE_PRM_NENR_MA)",
            "SUM(SP_URB_TOTL)",
            "count",
        ]
        assert test_viz.metric_labels == expect_metric_labels
        assert test_viz.all_metrics == expect_metric_labels

    def test_get_df_returns_empty_df(self):
        form_data = {"dummy": 123}
        query_obj = {"granularity": "day"}
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseViz(datasource, form_data)
        result = test_viz.get_df(query_obj)
        assert isinstance(result, pd.DataFrame)
        assert result.empty

    def test_get_df_handles_dttm_col(self):
        form_data = {"dummy": 123}
        query_obj = {"granularity": "day"}
        results = Mock()
        results.query = Mock()
        results.status = Mock()
        results.error_message = Mock()
        datasource = Mock()
        datasource.type = "table"
        datasource.query = Mock(return_value=results)
        mock_dttm_col = Mock()
        datasource.get_column = Mock(return_value=mock_dttm_col)

        test_viz = viz.BaseViz(datasource, form_data)
        test_viz.df_metrics_to_num = Mock()
        test_viz.get_fillna_for_columns = Mock(return_value=0)

        results.df = pd.DataFrame(data={DTTM_ALIAS: ["1960-01-01 05:00:00"]})
        datasource.offset = 0
        mock_dttm_col = Mock()
        datasource.get_column = Mock(return_value=mock_dttm_col)
        mock_dttm_col.python_date_format = "epoch_ms"
        result = test_viz.get_df(query_obj)
        import logging  # noqa: F401

        logger.info(result)
        pd.testing.assert_series_equal(
            result[DTTM_ALIAS], pd.Series([datetime(1960, 1, 1, 5, 0)], name=DTTM_ALIAS)
        )

        mock_dttm_col.python_date_format = None
        result = test_viz.get_df(query_obj)
        pd.testing.assert_series_equal(
            result[DTTM_ALIAS], pd.Series([datetime(1960, 1, 1, 5, 0)], name=DTTM_ALIAS)
        )

        datasource.offset = 1
        result = test_viz.get_df(query_obj)
        pd.testing.assert_series_equal(
            result[DTTM_ALIAS], pd.Series([datetime(1960, 1, 1, 6, 0)], name=DTTM_ALIAS)
        )

        datasource.offset = 0
        results.df = pd.DataFrame(data={DTTM_ALIAS: ["1960-01-01"]})
        mock_dttm_col.python_date_format = "%Y-%m-%d"
        result = test_viz.get_df(query_obj)
        pd.testing.assert_series_equal(
            result[DTTM_ALIAS], pd.Series([datetime(1960, 1, 1, 0, 0)], name=DTTM_ALIAS)
        )

    def test_cache_timeout(self):
        datasource = self.get_datasource_mock()
        datasource.cache_timeout = 0
        test_viz = viz.BaseViz(datasource, form_data={})
        assert 0 == test_viz.cache_timeout

        datasource.cache_timeout = 156
        test_viz = viz.BaseViz(datasource, form_data={})
        assert 156 == test_viz.cache_timeout

        datasource.cache_timeout = None
        datasource.database.cache_timeout = 0
        assert 0 == test_viz.cache_timeout

        datasource.database.cache_timeout = 1666
        assert 1666 == test_viz.cache_timeout

        datasource.database.cache_timeout = None
        test_viz = viz.BaseViz(datasource, form_data={})
        assert (
            current_app.config["DATA_CACHE_CONFIG"]["CACHE_DEFAULT_TIMEOUT"]
            == test_viz.cache_timeout
        )

        data_cache_timeout = current_app.config["DATA_CACHE_CONFIG"][
            "CACHE_DEFAULT_TIMEOUT"
        ]
        current_app.config["DATA_CACHE_CONFIG"]["CACHE_DEFAULT_TIMEOUT"] = None
        datasource.database.cache_timeout = None
        test_viz = viz.BaseViz(datasource, form_data={})
        assert current_app.config["CACHE_DEFAULT_TIMEOUT"] == test_viz.cache_timeout
        # restore DATA_CACHE_CONFIG timeout
        current_app.config["DATA_CACHE_CONFIG"]["CACHE_DEFAULT_TIMEOUT"] = (
            data_cache_timeout
        )


class TestPairedTTest(SupersetTestCase):
    def test_get_data_transforms_dataframe(self):
        form_data = {
            "groupby": ["groupA", "groupB", "groupC"],
            "metrics": ["metric1", "metric2", "metric3"],
        }
        datasource = self.get_datasource_mock()
        # Test data
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw["groupA"] = ["a1", "a1", "a1", "b1", "b1", "b1", "c1", "c1", "c1"]
        raw["groupB"] = ["a2", "a2", "a2", "b2", "b2", "b2", "c2", "c2", "c2"]
        raw["groupC"] = ["a3", "a3", "a3", "b3", "b3", "b3", "c3", "c3", "c3"]
        raw["metric1"] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw["metric2"] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw["metric3"] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        pairedTTestViz = viz.viz_types["paired_ttest"](datasource, form_data)  # noqa: N806
        data = pairedTTestViz.get_data(df)
        # Check method correctly transforms data
        expected = {
            "metric1": [
                {
                    "values": [
                        {"x": 100, "y": 1},
                        {"x": 200, "y": 2},
                        {"x": 300, "y": 3},
                    ],
                    "group": ("a1", "a2", "a3"),
                },
                {
                    "values": [
                        {"x": 100, "y": 4},
                        {"x": 200, "y": 5},
                        {"x": 300, "y": 6},
                    ],
                    "group": ("b1", "b2", "b3"),
                },
                {
                    "values": [
                        {"x": 100, "y": 7},
                        {"x": 200, "y": 8},
                        {"x": 300, "y": 9},
                    ],
                    "group": ("c1", "c2", "c3"),
                },
            ],
            "metric2": [
                {
                    "values": [
                        {"x": 100, "y": 10},
                        {"x": 200, "y": 20},
                        {"x": 300, "y": 30},
                    ],
                    "group": ("a1", "a2", "a3"),
                },
                {
                    "values": [
                        {"x": 100, "y": 40},
                        {"x": 200, "y": 50},
                        {"x": 300, "y": 60},
                    ],
                    "group": ("b1", "b2", "b3"),
                },
                {
                    "values": [
                        {"x": 100, "y": 70},
                        {"x": 200, "y": 80},
                        {"x": 300, "y": 90},
                    ],
                    "group": ("c1", "c2", "c3"),
                },
            ],
            "metric3": [
                {
                    "values": [
                        {"x": 100, "y": 100},
                        {"x": 200, "y": 200},
                        {"x": 300, "y": 300},
                    ],
                    "group": ("a1", "a2", "a3"),
                },
                {
                    "values": [
                        {"x": 100, "y": 400},
                        {"x": 200, "y": 500},
                        {"x": 300, "y": 600},
                    ],
                    "group": ("b1", "b2", "b3"),
                },
                {
                    "values": [
                        {"x": 100, "y": 700},
                        {"x": 200, "y": 800},
                        {"x": 300, "y": 900},
                    ],
                    "group": ("c1", "c2", "c3"),
                },
            ],
        }
        assert data == expected

    def test_get_data_empty_null_keys(self):
        form_data = {"groupby": [], "metrics": [""]}
        datasource = self.get_datasource_mock()
        # Test data
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300]
        raw[""] = [1, 2, 3]
        raw[None] = [10, 20, 30]

        df = pd.DataFrame(raw)
        pairedTTestViz = viz.viz_types["paired_ttest"](datasource, form_data)  # noqa: N806
        data = pairedTTestViz.get_data(df)
        # Check method correctly transforms data
        expected = {
            "N/A": [
                {
                    "values": [
                        {"x": 100, "y": 1},
                        {"x": 200, "y": 2},
                        {"x": 300, "y": 3},
                    ],
                    "group": "All",
                }
            ],
        }
        assert data == expected

        form_data = {"groupby": [], "metrics": [None]}
        with self.assertRaises(ValueError):  # noqa: PT027
            viz.viz_types["paired_ttest"](datasource, form_data)


class TestPartitionViz(SupersetTestCase):
    @patch("superset.viz.BaseViz.query_obj")
    def test_query_obj_time_series_option(self, super_query_obj):
        datasource = self.get_datasource_mock()
        form_data = {}
        test_viz = viz.PartitionViz(datasource, form_data)
        super_query_obj.return_value = {}
        query_obj = test_viz.query_obj()
        assert not query_obj["is_timeseries"]
        test_viz.form_data["time_series_option"] = "agg_sum"
        query_obj = test_viz.query_obj()
        assert query_obj["is_timeseries"]

    def test_levels_for_computes_levels(self):
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw["groupA"] = ["a1", "a1", "a1", "b1", "b1", "b1", "c1", "c1", "c1"]
        raw["groupB"] = ["a2", "a2", "a2", "b2", "b2", "b2", "c2", "c2", "c2"]
        raw["groupC"] = ["a3", "a3", "a3", "b3", "b3", "b3", "c3", "c3", "c3"]
        raw["metric1"] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw["metric2"] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw["metric3"] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        groups = ["groupA", "groupB", "groupC"]
        time_op = "agg_sum"
        test_viz = viz.PartitionViz(Mock(), {})
        levels = test_viz.levels_for(time_op, groups, df)
        assert 4 == len(levels)
        expected = {DTTM_ALIAS: 1800, "metric1": 45, "metric2": 450, "metric3": 4500}
        assert expected == levels[0].to_dict()
        expected = {
            DTTM_ALIAS: {"a1": 600, "b1": 600, "c1": 600},
            "metric1": {"a1": 6, "b1": 15, "c1": 24},
            "metric2": {"a1": 60, "b1": 150, "c1": 240},
            "metric3": {"a1": 600, "b1": 1500, "c1": 2400},
        }
        assert expected == levels[1].to_dict()
        assert ["groupA", "groupB"] == levels[2].index.names
        assert ["groupA", "groupB", "groupC"] == levels[3].index.names
        time_op = "agg_mean"
        levels = test_viz.levels_for(time_op, groups, df)
        assert 4 == len(levels)
        expected = {
            DTTM_ALIAS: 200.0,
            "metric1": 5.0,
            "metric2": 50.0,
            "metric3": 500.0,
        }
        assert expected == levels[0].to_dict()
        expected = {
            DTTM_ALIAS: {"a1": 200, "c1": 200, "b1": 200},
            "metric1": {"a1": 2, "b1": 5, "c1": 8},
            "metric2": {"a1": 20, "b1": 50, "c1": 80},
            "metric3": {"a1": 200, "b1": 500, "c1": 800},
        }
        assert expected == levels[1].to_dict()
        assert ["groupA", "groupB"] == levels[2].index.names
        assert ["groupA", "groupB", "groupC"] == levels[3].index.names

    def test_levels_for_diff_computes_difference(self):
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw["groupA"] = ["a1", "a1", "a1", "b1", "b1", "b1", "c1", "c1", "c1"]
        raw["groupB"] = ["a2", "a2", "a2", "b2", "b2", "b2", "c2", "c2", "c2"]
        raw["groupC"] = ["a3", "a3", "a3", "b3", "b3", "b3", "c3", "c3", "c3"]
        raw["metric1"] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw["metric2"] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw["metric3"] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        groups = ["groupA", "groupB", "groupC"]
        test_viz = viz.PartitionViz(Mock(), {})
        time_op = "point_diff"
        levels = test_viz.levels_for_diff(time_op, groups, df)
        expected = {"metric1": 6, "metric2": 60, "metric3": 600}
        assert expected == levels[0].to_dict()
        expected = {
            "metric1": {"a1": 2, "b1": 2, "c1": 2},
            "metric2": {"a1": 20, "b1": 20, "c1": 20},
            "metric3": {"a1": 200, "b1": 200, "c1": 200},
        }
        assert expected == levels[1].to_dict()
        assert 4 == len(levels)
        assert ["groupA", "groupB", "groupC"] == levels[3].index.names

    def test_levels_for_time_calls_process_data_and_drops_cols(self):
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw["groupA"] = ["a1", "a1", "a1", "b1", "b1", "b1", "c1", "c1", "c1"]
        raw["groupB"] = ["a2", "a2", "a2", "b2", "b2", "b2", "c2", "c2", "c2"]
        raw["groupC"] = ["a3", "a3", "a3", "b3", "b3", "b3", "c3", "c3", "c3"]
        raw["metric1"] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw["metric2"] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw["metric3"] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        groups = ["groupA", "groupB", "groupC"]
        test_viz = viz.PartitionViz(Mock(), {"groupby": groups})

        def return_args(df_drop, aggregate):
            return df_drop

        test_viz.process_data = Mock(side_effect=return_args)
        levels = test_viz.levels_for_time(groups, df)
        assert 4 == len(levels)
        cols = [DTTM_ALIAS, "metric1", "metric2", "metric3"]
        assert sorted(cols) == sorted(levels[0].columns.tolist())
        cols += ["groupA"]
        assert sorted(cols) == sorted(levels[1].columns.tolist())
        cols += ["groupB"]
        assert sorted(cols) == sorted(levels[2].columns.tolist())
        cols += ["groupC"]
        assert sorted(cols) == sorted(levels[3].columns.tolist())
        assert 4 == len(test_viz.process_data.mock_calls)

    def test_nest_values_returns_hierarchy(self):
        raw = {}
        raw["groupA"] = ["a1", "a1", "a1", "b1", "b1", "b1", "c1", "c1", "c1"]
        raw["groupB"] = ["a2", "a2", "a2", "b2", "b2", "b2", "c2", "c2", "c2"]
        raw["groupC"] = ["a3", "a3", "a3", "b3", "b3", "b3", "c3", "c3", "c3"]
        raw["metric1"] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw["metric2"] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw["metric3"] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        test_viz = viz.PartitionViz(Mock(), {})
        groups = ["groupA", "groupB", "groupC"]
        levels = test_viz.levels_for("agg_sum", groups, df)
        nest = test_viz.nest_values(levels)
        assert 3 == len(nest)
        for i in range(0, 3):
            assert "metric" + str(i + 1) == nest[i]["name"]
        assert 3 == len(nest[0]["children"])
        assert 1 == len(nest[0]["children"][0]["children"])
        assert 1 == len(nest[0]["children"][0]["children"][0]["children"])

    def test_nest_values_returns_hierarchy_when_more_dimensions(self):
        raw = {}
        raw["category"] = ["a", "a", "a"]
        raw["subcategory"] = ["a.2", "a.1", "a.2"]
        raw["sub_subcategory"] = ["a.2.1", "a.1.1", "a.2.2"]
        raw["metric1"] = [5, 10, 15]
        raw["metric2"] = [50, 100, 150]
        raw["metric3"] = [500, 1000, 1500]
        df = pd.DataFrame(raw)
        test_viz = viz.PartitionViz(Mock(), {})
        groups = ["category", "subcategory", "sub_subcategory"]
        levels = test_viz.levels_for("agg_sum", groups, df)
        nest = test_viz.nest_values(levels)
        assert 3 == len(nest)
        for i in range(0, 3):
            assert "metric" + str(i + 1) == nest[i]["name"]
        assert 1 == len(nest[0]["children"])
        assert 2 == len(nest[0]["children"][0]["children"])
        assert 1 == len(nest[0]["children"][0]["children"][0]["children"])
        assert 2 == len(nest[0]["children"][0]["children"][1]["children"])

    def test_nest_procs_returns_hierarchy(self):
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw["groupA"] = ["a1", "a1", "a1", "b1", "b1", "b1", "c1", "c1", "c1"]
        raw["groupB"] = ["a2", "a2", "a2", "b2", "b2", "b2", "c2", "c2", "c2"]
        raw["groupC"] = ["a3", "a3", "a3", "b3", "b3", "b3", "c3", "c3", "c3"]
        raw["metric1"] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw["metric2"] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw["metric3"] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        test_viz = viz.PartitionViz(Mock(), {})
        groups = ["groupA", "groupB", "groupC"]
        metrics = ["metric1", "metric2", "metric3"]
        procs = {}
        for i in range(0, 4):
            df_drop = df.drop(groups[i:], axis=1)
            pivot = df_drop.pivot_table(
                index=DTTM_ALIAS, columns=groups[:i], values=metrics
            )
            procs[i] = pivot
        nest = test_viz.nest_procs(procs)
        assert 3 == len(nest)
        for i in range(0, 3):
            assert "metric" + str(i + 1) == nest[i]["name"]
            assert None is nest[i].get("val")
        assert 3 == len(nest[0]["children"])
        assert 3 == len(nest[0]["children"][0]["children"])
        assert 1 == len(nest[0]["children"][0]["children"][0]["children"])
        assert 1 == len(
            nest[0]["children"][0]["children"][0]["children"][0]["children"]
        )

    def test_get_data_calls_correct_method(self):
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw["groupA"] = ["a1", "a1", "a1", "b1", "b1", "b1", "c1", "c1", "c1"]
        raw["groupB"] = ["a2", "a2", "a2", "b2", "b2", "b2", "c2", "c2", "c2"]
        raw["groupC"] = ["a3", "a3", "a3", "b3", "b3", "b3", "c3", "c3", "c3"]
        raw["metric1"] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw["metric2"] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw["metric3"] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        test_viz = viz.PartitionViz(Mock(), {})
        with self.assertRaises(ValueError):  # noqa: PT027
            test_viz.get_data(df)
        test_viz.levels_for = Mock(return_value=1)
        test_viz.nest_values = Mock(return_value=1)
        test_viz.form_data["groupby"] = ["groups"]
        test_viz.form_data["time_series_option"] = "not_time"
        test_viz.get_data(df)
        assert "agg_sum" == test_viz.levels_for.mock_calls[0][1][0]
        test_viz.form_data["time_series_option"] = "agg_sum"
        test_viz.get_data(df)
        assert "agg_sum" == test_viz.levels_for.mock_calls[1][1][0]
        test_viz.form_data["time_series_option"] = "agg_mean"
        test_viz.get_data(df)
        assert "agg_mean" == test_viz.levels_for.mock_calls[2][1][0]
        test_viz.form_data["time_series_option"] = "point_diff"
        test_viz.levels_for_diff = Mock(return_value=1)
        test_viz.get_data(df)
        assert "point_diff" == test_viz.levels_for_diff.mock_calls[0][1][0]
        test_viz.form_data["time_series_option"] = "point_percent"
        test_viz.get_data(df)
        assert "point_percent" == test_viz.levels_for_diff.mock_calls[1][1][0]
        test_viz.form_data["time_series_option"] = "point_factor"
        test_viz.get_data(df)
        assert "point_factor" == test_viz.levels_for_diff.mock_calls[2][1][0]
        test_viz.levels_for_time = Mock(return_value=1)
        test_viz.nest_procs = Mock(return_value=1)
        test_viz.form_data["time_series_option"] = "adv_anal"
        test_viz.get_data(df)
        assert 1 == len(test_viz.levels_for_time.mock_calls)
        assert 1 == len(test_viz.nest_procs.mock_calls)
        test_viz.form_data["time_series_option"] = "time_series"
        test_viz.get_data(df)
        assert "agg_sum" == test_viz.levels_for.mock_calls[3][1][0]
        assert 7 == len(test_viz.nest_values.mock_calls)


class TestRoseVis(SupersetTestCase):
    def test_rose_vis_get_data(self):
        raw = {}
        t1 = pd.Timestamp("2000")
        t2 = pd.Timestamp("2002")
        t3 = pd.Timestamp("2004")
        raw[DTTM_ALIAS] = [t1, t2, t3, t1, t2, t3, t1, t2, t3]
        raw["groupA"] = ["a1", "a1", "a1", "b1", "b1", "b1", "c1", "c1", "c1"]
        raw["groupB"] = ["a2", "a2", "a2", "b2", "b2", "b2", "c2", "c2", "c2"]
        raw["groupC"] = ["a3", "a3", "a3", "b3", "b3", "b3", "c3", "c3", "c3"]
        raw["metric1"] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        df = pd.DataFrame(raw)
        fd = {"metrics": ["metric1"], "groupby": ["groupA"]}
        test_viz = viz.RoseViz(Mock(), fd)
        test_viz.metrics = fd["metrics"]
        res = test_viz.get_data(df)
        expected = {
            946684800000000000: [
                {"time": t1, "value": 1, "key": ("a1",), "name": ("a1",)},
                {"time": t1, "value": 4, "key": ("b1",), "name": ("b1",)},
                {"time": t1, "value": 7, "key": ("c1",), "name": ("c1",)},
            ],
            1009843200000000000: [
                {"time": t2, "value": 2, "key": ("a1",), "name": ("a1",)},
                {"time": t2, "value": 5, "key": ("b1",), "name": ("b1",)},
                {"time": t2, "value": 8, "key": ("c1",), "name": ("c1",)},
            ],
            1072915200000000000: [
                {"time": t3, "value": 3, "key": ("a1",), "name": ("a1",)},
                {"time": t3, "value": 6, "key": ("b1",), "name": ("b1",)},
                {"time": t3, "value": 9, "key": ("c1",), "name": ("c1",)},
            ],
        }
        assert expected == res


class TestTimeSeriesTableViz(SupersetTestCase):
    def test_get_data_metrics(self):
        form_data = {"metrics": ["sum__A", "count"], "groupby": []}
        datasource = self.get_datasource_mock()
        raw = {}
        t1 = pd.Timestamp("2000")
        t2 = pd.Timestamp("2002")
        raw[DTTM_ALIAS] = [t1, t2]
        raw["sum__A"] = [15, 20]
        raw["count"] = [6, 7]
        df = pd.DataFrame(raw)
        test_viz = viz.TimeTableViz(datasource, form_data)
        data = test_viz.get_data(df)
        # Check method correctly transforms data
        assert {"count", "sum__A"} == set(data["columns"])
        time_format = "%Y-%m-%d %H:%M:%S"
        expected = {
            t1.strftime(time_format): {"sum__A": 15, "count": 6},
            t2.strftime(time_format): {"sum__A": 20, "count": 7},
        }
        assert expected == data["records"]

    def test_get_data_group_by(self):
        form_data = {"metrics": ["sum__A"], "groupby": ["groupby1"]}
        datasource = self.get_datasource_mock()
        raw = {}
        t1 = pd.Timestamp("2000")
        t2 = pd.Timestamp("2002")
        raw[DTTM_ALIAS] = [t1, t1, t1, t2, t2, t2]
        raw["sum__A"] = [15, 20, 25, 30, 35, 40]
        raw["groupby1"] = ["a1", "a2", "a3", "a1", "a2", "a3"]
        df = pd.DataFrame(raw)
        test_viz = viz.TimeTableViz(datasource, form_data)
        data = test_viz.get_data(df)
        # Check method correctly transforms data
        assert {"a1", "a2", "a3"} == set(data["columns"])
        time_format = "%Y-%m-%d %H:%M:%S"
        expected = {
            t1.strftime(time_format): {"a1": 15, "a2": 20, "a3": 25},
            t2.strftime(time_format): {"a1": 30, "a2": 35, "a3": 40},
        }
        assert expected == data["records"]

    @patch("superset.viz.BaseViz.query_obj")
    def test_query_obj_throws_metrics_and_groupby(self, super_query_obj):
        datasource = self.get_datasource_mock()
        form_data = {"groupby": ["a"]}
        super_query_obj.return_value = {}
        test_viz = viz.TimeTableViz(datasource, form_data)
        with self.assertRaises(Exception):  # noqa: B017, PT027
            test_viz.query_obj()
        form_data["metrics"] = ["x", "y"]
        test_viz = viz.TimeTableViz(datasource, form_data)
        with self.assertRaises(Exception):  # noqa: B017, PT027
            test_viz.query_obj()

    def test_query_obj_order_by(self):
        test_viz = viz.TimeTableViz(
            self.get_datasource_mock(), {"metrics": ["sum__A", "count"], "groupby": []}
        )
        query_obj = test_viz.query_obj()
        assert query_obj["orderby"] == [("sum__A", False)]


class TestBaseDeckGLViz(SupersetTestCase):
    def test_get_metrics(self):
        form_data = load_fixture("deck_path_form_data.json")
        datasource = self.get_datasource_mock()
        test_viz_deckgl = viz.BaseDeckGLViz(datasource, form_data)
        result = test_viz_deckgl.get_metrics()
        assert result == [form_data.get("size")]

        form_data = {}
        test_viz_deckgl = viz.BaseDeckGLViz(datasource, form_data)
        result = test_viz_deckgl.get_metrics()
        assert result == []

    def test_scatterviz_get_metrics(self):
        form_data = load_fixture("deck_path_form_data.json")
        datasource = self.get_datasource_mock()

        form_data = {}
        test_viz_deckgl = viz.DeckScatterViz(datasource, form_data)
        test_viz_deckgl.point_radius_fixed = {"type": "metric", "value": "int"}
        result = test_viz_deckgl.get_metrics()
        assert result == ["int"]

        form_data = {}
        test_viz_deckgl = viz.DeckScatterViz(datasource, form_data)
        test_viz_deckgl.point_radius_fixed = {}
        result = test_viz_deckgl.get_metrics()
        assert result == []

    def test_get_js_columns(self):
        form_data = load_fixture("deck_path_form_data.json")
        datasource = self.get_datasource_mock()
        mock_d = {"a": "dummy1", "b": "dummy2", "c": "dummy3"}
        test_viz_deckgl = viz.BaseDeckGLViz(datasource, form_data)
        result = test_viz_deckgl.get_js_columns(mock_d)

        assert result == {"color": None}

    def test_get_properties(self):
        mock_d = {}
        form_data = load_fixture("deck_path_form_data.json")
        datasource = self.get_datasource_mock()
        test_viz_deckgl = viz.BaseDeckGLViz(datasource, form_data)

        with self.assertRaises(NotImplementedError) as context:  # noqa: PT027
            test_viz_deckgl.get_properties(mock_d)

        assert "" in str(context.exception)

    def test_process_spatial_query_obj(self):
        form_data = load_fixture("deck_path_form_data.json")
        datasource = self.get_datasource_mock()
        mock_key = "spatial_key"
        mock_gb = []
        test_viz_deckgl = viz.BaseDeckGLViz(datasource, form_data)

        with self.assertRaises(ValueError) as context:  # noqa: PT027
            test_viz_deckgl.process_spatial_query_obj(mock_key, mock_gb)

        assert "Bad spatial key" in str(context.exception)

        test_form_data = {
            "latlong_key": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
            "delimited_key": {"type": "delimited", "lonlatCol": "lonlat"},
            "geohash_key": {"type": "geohash", "geohashCol": "geo"},
        }

        datasource = self.get_datasource_mock()
        expected_results = {
            "latlong_key": ["lon", "lat"],
            "delimited_key": ["lonlat"],
            "geohash_key": ["geo"],
        }
        for mock_key in ["latlong_key", "delimited_key", "geohash_key"]:
            mock_gb = []
            test_viz_deckgl = viz.BaseDeckGLViz(datasource, test_form_data)
            test_viz_deckgl.process_spatial_query_obj(mock_key, mock_gb)
            assert expected_results.get(mock_key) == mock_gb

    def test_geojson_query_obj(self):
        form_data = load_fixture("deck_geojson_form_data.json")
        datasource = self.get_datasource_mock()
        test_viz_deckgl = viz.DeckGeoJson(datasource, form_data)
        results = test_viz_deckgl.query_obj()

        assert results["metrics"] == []
        assert results["groupby"] == []
        assert results["columns"] == ["test_col"]

    def test_parse_coordinates(self):
        form_data = load_fixture("deck_path_form_data.json")
        datasource = self.get_datasource_mock()
        viz_instance = viz.BaseDeckGLViz(datasource, form_data)

        coord = viz_instance.parse_coordinates("1.23, 3.21")
        assert coord == (1.23, 3.21)

        coord = viz_instance.parse_coordinates("1.23 3.21")
        assert coord == (1.23, 3.21)

        assert viz_instance.parse_coordinates(None) is None

        assert viz_instance.parse_coordinates("") is None

    def test_parse_coordinates_raises(self):
        form_data = load_fixture("deck_path_form_data.json")
        datasource = self.get_datasource_mock()
        test_viz_deckgl = viz.BaseDeckGLViz(datasource, form_data)

        with self.assertRaises(SpatialException):  # noqa: PT027
            test_viz_deckgl.parse_coordinates("NULL")

        with self.assertRaises(SpatialException):  # noqa: PT027
            test_viz_deckgl.parse_coordinates("fldkjsalkj,fdlaskjfjadlksj")

    def test_filter_nulls(self):
        test_form_data = {
            "latlong_key": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
            "delimited_key": {"type": "delimited", "lonlatCol": "lonlat"},
            "geohash_key": {"type": "geohash", "geohashCol": "geo"},
        }

        datasource = self.get_datasource_mock()
        expected_results = {
            "latlong_key": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "filterOptionName": "c7f171cf3204bcbf456acfeac5cd9afd",
                    "comparator": "",
                    "operator": "IS NOT NULL",
                    "subject": "lat",
                },
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "filterOptionName": "52634073fbb8ae0a3aa59ad48abac55e",
                    "comparator": "",
                    "operator": "IS NOT NULL",
                    "subject": "lon",
                },
            ],
            "delimited_key": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "filterOptionName": "cae5c925c140593743da08499e6fb207",
                    "comparator": "",
                    "operator": "IS NOT NULL",
                    "subject": "lonlat",
                }
            ],
            "geohash_key": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "filterOptionName": "d84f55222d8e414e888fa5f990b341d2",
                    "comparator": "",
                    "operator": "IS NOT NULL",
                    "subject": "geo",
                }
            ],
        }
        for mock_key in ["latlong_key", "delimited_key", "geohash_key"]:
            test_viz_deckgl = viz.BaseDeckGLViz(datasource, test_form_data.copy())
            test_viz_deckgl.spatial_control_keys = [mock_key]
            test_viz_deckgl.add_null_filters()
            adhoc_filters = test_viz_deckgl.form_data["adhoc_filters"]
            assert expected_results.get(mock_key) == adhoc_filters

    def test_init_with_layer_filtering_applied(self):
        """Test BaseDeckGLViz.__init__ applies layer filtering when conditions are
        met."""
        datasource = self.get_datasource_mock()
        form_data = {
            "slice_id": 123,
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "subject": "col1",
                    "operator": "==",
                    "comparator": "value1",
                    "layerFilterScope": [0, 1],
                    "deck_slices": [123, 456],
                },
                {
                    "clause": "WHERE",
                    "subject": "col2",
                    "operator": "!=",
                    "comparator": "value2",
                    "layerFilterScope": [1],
                    "deck_slices": [123, 456],
                },
            ],
        }

        test_viz = viz.BaseDeckGLViz(datasource, form_data)

        # Should only have the first filter (scoped to layer 0)
        assert len(test_viz.form_data["adhoc_filters"]) == 1
        assert test_viz.form_data["adhoc_filters"][0]["subject"] == "col1"

    def test_init_without_layer_filtering(self):
        """Test BaseDeckGLViz.__init__ doesn't apply filtering when conditions
        aren't met."""
        datasource = self.get_datasource_mock()
        form_data = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "subject": "col1",
                    "operator": "==",
                    "comparator": "value1",
                }
            ]
        }
        original_filters = form_data["adhoc_filters"].copy()

        test_viz = viz.BaseDeckGLViz(datasource, form_data)

        # Filters should remain unchanged
        assert test_viz.form_data["adhoc_filters"] == original_filters

    def test_should_apply_layer_filtering_true(self):
        """Test _should_apply_layer_filtering returns True when all conditions are
        met."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {"slice_id": 123, "adhoc_filters": [{"layerFilterScope": [0, 1]}]}

        result = test_viz._should_apply_layer_filtering(form_data)
        assert result is True

    def test_should_apply_layer_filtering_false_missing_slice_id(self):
        """Test _should_apply_layer_filtering returns False when slice_id is missing."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {"adhoc_filters": [{"layerFilterScope": [0, 1]}]}

        result = test_viz._should_apply_layer_filtering(form_data)
        assert result is False

    def test_should_apply_layer_filtering_false_missing_adhoc_filters(self):
        """Test _should_apply_layer_filtering returns False when adhoc_filters is
        missing."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {"slice_id": 123}

        result = test_viz._should_apply_layer_filtering(form_data)
        assert result is False

    def test_should_apply_layer_filtering_false_no_layer_scoped_filters(self):
        """Test _should_apply_layer_filtering returns False when no layer scoped
        filters exist."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {
            "slice_id": 123,
            "adhoc_filters": [{"clause": "WHERE", "subject": "col1"}],
        }

        result = test_viz._should_apply_layer_filtering(form_data)
        assert result is False

    def test_has_layer_scoped_filters_true_with_dict(self):
        """Test _has_layer_scoped_filters returns True when filter dict has
        layerFilterScope."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {
            "adhoc_filters": [{"layerFilterScope": [0, 1]}, {"clause": "WHERE"}]
        }

        result = test_viz._has_layer_scoped_filters(form_data)
        assert result is True

    def test_has_layer_scoped_filters_true_with_non_none_value(self):
        """Test _has_layer_scoped_filters returns True when layerFilterScope is not
        None."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {
            "adhoc_filters": [
                {"layerFilterScope": []},  # Empty list is not None
                {"clause": "WHERE"},
            ]
        }

        result = test_viz._has_layer_scoped_filters(form_data)
        assert result is True

    def test_has_layer_scoped_filters_false_none_value(self):
        """Test _has_layer_scoped_filters returns False when layerFilterScope is
        None."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {"adhoc_filters": [{"layerFilterScope": None}, {"clause": "WHERE"}]}

        result = test_viz._has_layer_scoped_filters(form_data)
        assert result is False

    def test_has_layer_scoped_filters_false_no_scoped_filters(self):
        """Test _has_layer_scoped_filters returns False when no filters have
        layerFilterScope."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {
            "adhoc_filters": [
                {"clause": "WHERE", "subject": "col1"},
                {"clause": "WHERE", "subject": "col2"},
            ]
        }

        result = test_viz._has_layer_scoped_filters(form_data)
        assert result is False

    def test_has_layer_scoped_filters_empty_filters(self):
        """Test _has_layer_scoped_filters returns False when adhoc_filters is empty."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {"adhoc_filters": []}

        result = test_viz._has_layer_scoped_filters(form_data)
        assert result is False

    def test_apply_multilayer_filtering_filters_by_layer_scope(self):
        """Test _apply_multilayer_filtering correctly filters by layer scope."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {
            "slice_id": 456,  # This is layer index 1
            "adhoc_filters": [
                {
                    "subject": "global_filter",
                    "deck_slices": [123, 456],
                    # No layerFilterScope = global filter
                },
                {
                    "subject": "layer_0_filter",
                    "layerFilterScope": [0],
                    "deck_slices": [123, 456],
                },
                {
                    "subject": "layer_1_filter",
                    "layerFilterScope": [1],
                    "deck_slices": [123, 456],
                },
                {
                    "subject": "layer_0_1_filter",
                    "layerFilterScope": [0, 1],
                    "deck_slices": [123, 456],
                },
            ],
        }

        result = test_viz._apply_multilayer_filtering(form_data)

        # Should include: global_filter, layer_1_filter, layer_0_1_filter
        assert len(result["adhoc_filters"]) == 3
        subjects = [f["subject"] for f in result["adhoc_filters"]]
        assert "global_filter" in subjects
        assert "layer_1_filter" in subjects
        assert "layer_0_1_filter" in subjects
        assert "layer_0_filter" not in subjects

    def test_apply_multilayer_filtering_no_deck_slices(self):
        """Test _apply_multilayer_filtering returns original form_data when no
        deck_slices."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {"slice_id": 123, "adhoc_filters": [{"subject": "filter1"}]}

        result = test_viz._apply_multilayer_filtering(form_data)

        # Should return original form_data unchanged
        assert result == form_data

    def test_apply_multilayer_filtering_slice_not_in_deck_slices(self):
        """Test _apply_multilayer_filtering returns original when slice_id not in
        deck_slices."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {
            "slice_id": 999,  # Not in deck_slices
            "adhoc_filters": [{"subject": "filter1", "deck_slices": [123, 456]}],
        }

        result = test_viz._apply_multilayer_filtering(form_data)

        # Should return original form_data unchanged
        assert result == form_data

    def test_get_deck_slices_from_filters_found(self):
        """Test _get_deck_slices_from_filters returns deck_slices when found."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {
            "adhoc_filters": [
                {"subject": "filter1"},
                {"subject": "filter2", "deck_slices": [123, 456, 789]},
                {"subject": "filter3"},
            ]
        }

        result = test_viz._get_deck_slices_from_filters(form_data)

        assert result == [123, 456, 789]

    def test_get_deck_slices_from_filters_not_found(self):
        """Test _get_deck_slices_from_filters returns None when not found."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {"adhoc_filters": [{"subject": "filter1"}, {"subject": "filter2"}]}

        result = test_viz._get_deck_slices_from_filters(form_data)

        assert result is None

    def test_get_deck_slices_from_filters_empty_filters(self):
        """Test _get_deck_slices_from_filters returns None when adhoc_filters is
        empty."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        form_data = {"adhoc_filters": []}

        result = test_viz._get_deck_slices_from_filters(form_data)

        assert result is None

    def test_get_filter_layer_scope_dict(self):
        """Test _get_filter_layer_scope with dict filter item."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        filter_item = {"layerFilterScope": [0, 1, 2]}
        result = test_viz._get_filter_layer_scope(filter_item)

        assert result == [0, 1, 2]

    def test_get_filter_layer_scope_dict_none(self):
        """Test _get_filter_layer_scope with dict that has None layerFilterScope."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        filter_item = {"layerFilterScope": None}
        result = test_viz._get_filter_layer_scope(filter_item)

        assert result is None

    def test_get_filter_layer_scope_dict_missing_key(self):
        """Test _get_filter_layer_scope with dict missing layerFilterScope."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        filter_item = {"subject": "col1"}
        result = test_viz._get_filter_layer_scope(filter_item)

        assert result is None

    def test_get_filter_layer_scope_object_with_attribute(self):
        """Test _get_filter_layer_scope with object having layerFilterScope
        attribute."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        from unittest.mock import Mock

        filter_item = Mock()
        filter_item.layerFilterScope = [1, 2]

        result = test_viz._get_filter_layer_scope(filter_item)

        assert result == [1, 2]

    def test_get_filter_layer_scope_object_without_attribute(self):
        """Test _get_filter_layer_scope with object missing layerFilterScope
        attribute."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        from unittest.mock import Mock

        filter_item = Mock()
        del filter_item.layerFilterScope  # Remove the attribute

        result = test_viz._get_filter_layer_scope(filter_item)

        assert result is None

    def test_get_filter_layer_scope_non_dict_non_object(self):
        """Test _get_filter_layer_scope with non-dict, non-object types."""
        datasource = self.get_datasource_mock()
        test_viz = viz.BaseDeckGLViz(datasource, {})

        # Test with string
        result = test_viz._get_filter_layer_scope("string_filter")
        assert result is None

        # Test with number
        result = test_viz._get_filter_layer_scope(123)
        assert result is None

        # Test with None
        result = test_viz._get_filter_layer_scope(None)
        assert result is None


class TestDeckGLMultiLayer(SupersetTestCase):
    def test_filter_items_by_scope_with_filter_id(self):
        """Test _filter_items_by_scope method with items having filterId."""
        datasource = self.get_datasource_mock()
        form_data = {}
        test_viz = viz.DeckGLMultiLayer(datasource, form_data)

        filter_item_1 = Mock()
        filter_item_1.filterId = "filter_1"
        filter_item_2 = Mock()
        filter_item_2.filterId = "filter_2"
        filter_item_3 = Mock()
        filter_item_3.filterId = "filter_3"

        items = [filter_item_1, filter_item_2, filter_item_3]
        layer_index = 0
        layer_filter_scope = {"filter_1": [0, 1], "filter_2": [1], "filter_3": []}

        result = test_viz._filter_items_by_scope(items, layer_index, layer_filter_scope)

        assert len(result) == 2
        assert filter_item_1 in result
        assert filter_item_3 in result
        assert filter_item_2 not in result

    def test_filter_items_by_scope_without_filter_id(self):
        """Test _filter_items_by_scope method with items without filterId."""
        datasource = self.get_datasource_mock()
        form_data = {}
        test_viz = viz.DeckGLMultiLayer(datasource, form_data)

        filter_item_1 = Mock()
        del filter_item_1.filterId
        filter_item_2 = Mock()
        filter_item_2.filterId = None

        items = [filter_item_1, filter_item_2]
        layer_index = 0
        layer_filter_scope = {"filter_1": [1]}

        result = test_viz._filter_items_by_scope(items, layer_index, layer_filter_scope)

        assert len(result) == 2
        assert filter_item_1 in result
        assert filter_item_2 in result

    def test_process_extra_form_data_filters(self):
        """Test _process_extra_form_data_filters method."""
        datasource = self.get_datasource_mock()
        form_data = {}
        test_viz = viz.DeckGLMultiLayer(datasource, form_data)

        layer_index = 0
        layer_filter_scope = {"filter_1": [0, 1], "filter_2": [1], "filter_3": []}
        filter_data_mapping = {
            "filter_1": [{"column": "col1", "op": "==", "val": "value1"}],
            "filter_2": [{"column": "col2", "op": "!=", "val": "value2"}],
            "filter_3": [{"column": "col3", "op": ">", "val": 100}],
        }
        extra_form_data = {"existing_key": "existing_value"}

        result = test_viz._process_extra_form_data_filters(
            layer_index, layer_filter_scope, filter_data_mapping, extra_form_data
        )

        expected_filters = [
            {"column": "col1", "op": "==", "val": "value1"},
            {"column": "col3", "op": ">", "val": 100},
        ]
        assert result["filters"] == expected_filters
        assert result["existing_key"] == "existing_value"

    def test_process_extra_form_data_filters_empty_inputs(self):
        """Test _process_extra_form_data_filters with empty inputs."""
        datasource = self.get_datasource_mock()
        form_data = {}
        test_viz = viz.DeckGLMultiLayer(datasource, form_data)

        result = test_viz._process_extra_form_data_filters(0, {}, {}, {})
        assert result == {}

        extra_form_data = {"key": "value"}
        result = test_viz._process_extra_form_data_filters(0, {}, {}, extra_form_data)
        assert result == extra_form_data

    def test_apply_layer_filtering_without_layer_filter_scope(self):
        """Test _apply_layer_filtering when layer_filter_scope is empty."""
        datasource = self.get_datasource_mock()
        form_data = {
            "extra_filters": [Mock(), Mock()],
            "adhoc_filters": [Mock()],
            "extra_form_data": {"key": "value"},
        }
        test_viz = viz.DeckGLMultiLayer(datasource, form_data)

        layer_form_data = {"viz_type": "deck_scatter"}
        layer_index = 0

        result = test_viz._apply_layer_filtering(layer_form_data, layer_index)

        assert result["extra_filters"] == form_data["extra_filters"]
        assert result["adhoc_filters"] == form_data["adhoc_filters"]
        assert result["extra_form_data"] == form_data["extra_form_data"]

    def test_apply_layer_filtering_with_layer_filter_scope(self):
        """Test _apply_layer_filtering with layer_filter_scope."""
        datasource = self.get_datasource_mock()

        extra_filter_1 = Mock()
        extra_filter_1.filterId = "filter_1"
        extra_filter_2 = Mock()
        extra_filter_2.filterId = "filter_2"

        adhoc_filter_1 = Mock()
        adhoc_filter_1.filterId = "filter_1"

        form_data = {
            "layer_filter_scope": {"filter_1": [0], "filter_2": [1]},
            "filter_data_mapping": {
                "filter_1": [{"column": "col1", "op": "==", "val": "value1"}]
            },
            "extra_filters": [extra_filter_1, extra_filter_2],
            "adhoc_filters": [adhoc_filter_1],
            "extra_form_data": {"existing": "data"},
        }
        test_viz = viz.DeckGLMultiLayer(datasource, form_data)

        layer_form_data = {"viz_type": "deck_scatter"}
        layer_index = 0

        result = test_viz._apply_layer_filtering(layer_form_data, layer_index)

        assert len(result["extra_filters"]) == 1
        assert result["extra_filters"][0].filterId == "filter_1"
        assert len(result["adhoc_filters"]) == 1
        assert result["adhoc_filters"][0].filterId == "filter_1"
        assert result["extra_form_data"]["filters"] == [
            {"column": "col1", "op": "==", "val": "value1"}
        ]

    @with_config({"MAPBOX_API_KEY": "test_key"})
    @patch("superset.viz.viz_types")
    @patch("superset.db.session")
    def test_get_data_with_layer_filtering(self, mock_db_session, mock_viz_types):
        """Test get_data method with layer filtering enabled."""
        datasource = self.get_datasource_mock()

        slice_1 = Mock()
        slice_1.form_data = {"viz_type": "deck_scatter", "layer_name": "Layer 1"}
        slice_1.data = {"features": [{"type": "Feature"}]}
        slice_1.datasource = datasource

        slice_2 = Mock()
        slice_2.form_data = {"viz_type": "deck_path", "layer_name": "Layer 2"}
        slice_2.data = {"features": [{"type": "Feature"}]}
        slice_2.datasource = datasource

        # Mock the database query to return our slice objects
        mock_db_session.query.return_value.filter.return_value.all.return_value = [
            slice_1,
            slice_2,
        ]

        mock_scatter_viz_class = Mock()
        mock_scatter_viz_instance = Mock()
        mock_scatter_viz_instance.get_payload.return_value = {
            "data": {"features": [{"id": 1}]}
        }
        mock_scatter_viz_class.return_value = mock_scatter_viz_instance

        mock_path_viz_class = Mock()
        mock_path_viz_instance = Mock()
        mock_path_viz_instance.get_payload.return_value = {
            "data": {"features": [{"id": 2}]}
        }
        mock_path_viz_class.return_value = mock_path_viz_instance

        mock_viz_types.get.side_effect = lambda viz_type: {
            "deck_scatter": mock_scatter_viz_class,
            "deck_path": mock_path_viz_class,
        }.get(viz_type)

        form_data = {
            "layer_filter_scope": {"filter_1": [0], "filter_2": [1]},
            "filter_data_mapping": {
                "filter_1": [{"column": "col1", "op": "==", "val": "value1"}],
                "filter_2": [{"column": "col2", "op": "!=", "val": "value2"}],
            },
            "deck_slices": [1, 2],  # Use integer IDs instead of Mock objects
        }

        test_viz = viz.DeckGLMultiLayer(datasource, form_data)

        test_viz._apply_layer_filtering = Mock(
            side_effect=lambda form_data, idx: form_data
        )

        result = test_viz.get_data(pd.DataFrame())

        assert test_viz._apply_layer_filtering.call_count == 2
        test_viz._apply_layer_filtering.assert_any_call(slice_1.form_data, 0)
        test_viz._apply_layer_filtering.assert_any_call(slice_2.form_data, 1)

        assert isinstance(result, dict)
        assert "features" in result
        assert "mapboxApiKey" in result
        assert "slices" in result
        assert result["mapboxApiKey"] == "test_key"

    @with_config({"MAPBOX_API_KEY": "test_key"})
    @patch("superset.viz.viz_types")
    @patch("superset.db.session")
    def test_get_data_filters_none_data_slices(self, mock_db_session, mock_viz_types):
        """Test get_data method filters out slices with None data."""
        datasource = self.get_datasource_mock()

        slice_1 = Mock()
        slice_1.form_data = {"viz_type": "deck_scatter"}
        slice_1.data = {"features": [{"type": "Feature"}]}
        slice_1.datasource = datasource

        slice_2 = Mock()
        slice_2.form_data = {"viz_type": "deck_path"}
        slice_2.data = None
        slice_2.datasource = datasource

        # Mock the database query to return our slice objects
        mock_db_session.query.return_value.filter.return_value.all.return_value = [
            slice_1,
            slice_2,
        ]

        mock_viz_class = Mock()
        mock_viz_instance = Mock()
        mock_viz_instance.get_payload.return_value = {"data": {"features": []}}
        mock_viz_class.return_value = mock_viz_instance
        mock_viz_types.get.return_value = mock_viz_class

        form_data = {"deck_slices": [1, 2]}  # Use integer IDs instead of Mock objects

        test_viz = viz.DeckGLMultiLayer(datasource, form_data)
        result = test_viz.get_data(pd.DataFrame())

        assert isinstance(result, dict)
        assert len(result["slices"]) == 1
        assert result["slices"][0] == slice_1.data

    @with_config({"MAPBOX_API_KEY": "test_key"})
    def test_get_data_empty_deck_slices(self):
        """Test get_data method with empty deck_slices."""
        datasource = self.get_datasource_mock()
        form_data = {"deck_slices": []}

        test_viz = viz.DeckGLMultiLayer(datasource, form_data)
        result = test_viz.get_data(pd.DataFrame())

        assert isinstance(result, dict)
        assert result["features"] == {}
        assert result["slices"] == []
        assert result["mapboxApiKey"] == "test_key"


class TestTimeSeriesViz(SupersetTestCase):
    def test_timeseries_unicode_data(self):
        datasource = self.get_datasource_mock()
        form_data = {"groupby": ["name"], "metrics": ["sum__payout"]}
        raw = {}
        raw["name"] = [
            "Real Madrid C.F.🇺🇸🇬🇧",
            "Real Madrid C.F.🇺🇸🇬🇧",
            "Real Madrid Basket",
            "Real Madrid Basket",
        ]
        raw["__timestamp"] = [
            "2018-02-20T00:00:00",
            "2018-03-09T00:00:00",
            "2018-02-20T00:00:00",
            "2018-03-09T00:00:00",
        ]
        raw["sum__payout"] = [2, 2, 4, 4]
        df = pd.DataFrame(raw)

        test_viz = viz.NVD3TimeSeriesViz(datasource, form_data)
        viz_data = {}
        viz_data = test_viz.get_data(df)
        expected = [
            {
                "values": [
                    {"y": 4, "x": "2018-02-20T00:00:00"},
                    {"y": 4, "x": "2018-03-09T00:00:00"},
                ],
                "key": ("Real Madrid Basket",),
            },
            {
                "values": [
                    {"y": 2, "x": "2018-02-20T00:00:00"},
                    {"y": 2, "x": "2018-03-09T00:00:00"},
                ],
                "key": ("Real Madrid C.F.\U0001f1fa\U0001f1f8\U0001f1ec\U0001f1e7",),
            },
        ]
        assert expected == viz_data

    def test_process_data_resample(self):
        datasource = self.get_datasource_mock()

        df = pd.DataFrame(
            {
                "__timestamp": pd.to_datetime(
                    ["2019-01-01", "2019-01-02", "2019-01-05", "2019-01-07"]
                ),
                "y": [1.0, 2.0, 5.0, 7.0],
            }
        )

        assert viz.NVD3TimeSeriesViz(
            datasource,
            {"metrics": ["y"], "resample_method": "sum", "resample_rule": "1D"},
        ).process_data(df)["y"].tolist() == [1.0, 2.0, 0.0, 0.0, 5.0, 0.0, 7.0]

        np.testing.assert_equal(
            viz.NVD3TimeSeriesViz(
                datasource,
                {"metrics": ["y"], "resample_method": "asfreq", "resample_rule": "1D"},
            )
            .process_data(df)["y"]
            .tolist(),
            [1.0, 2.0, np.nan, np.nan, 5.0, np.nan, 7.0],
        )

    def test_apply_rolling(self):
        datasource = self.get_datasource_mock()
        df = pd.DataFrame(
            index=pd.to_datetime(
                ["2019-01-01", "2019-01-02", "2019-01-05", "2019-01-07"]
            ),
            data={"y": [1.0, 2.0, 3.0, 4.0]},
        )
        assert viz.NVD3TimeSeriesViz(
            datasource,
            {
                "metrics": ["y"],
                "rolling_type": "cumsum",
                "rolling_periods": 0,
                "min_periods": 0,
            },
        ).apply_rolling(df)["y"].tolist() == [1.0, 3.0, 6.0, 10.0]
        assert viz.NVD3TimeSeriesViz(
            datasource,
            {
                "metrics": ["y"],
                "rolling_type": "sum",
                "rolling_periods": 2,
                "min_periods": 0,
            },
        ).apply_rolling(df)["y"].tolist() == [1.0, 3.0, 5.0, 7.0]
        assert viz.NVD3TimeSeriesViz(
            datasource,
            {
                "metrics": ["y"],
                "rolling_type": "mean",
                "rolling_periods": 10,
                "min_periods": 0,
            },
        ).apply_rolling(df)["y"].tolist() == [1.0, 1.5, 2.0, 2.5]

    def test_apply_rolling_without_data(self):
        datasource = self.get_datasource_mock()
        df = pd.DataFrame(
            index=pd.to_datetime(
                ["2019-01-01", "2019-01-02", "2019-01-05", "2019-01-07"]
            ),
            data={"y": [1.0, 2.0, 3.0, 4.0]},
        )
        test_viz = viz.NVD3TimeSeriesViz(
            datasource,
            {
                "metrics": ["y"],
                "rolling_type": "cumsum",
                "rolling_periods": 4,
                "min_periods": 4,
            },
        )
        with pytest.raises(QueryObjectValidationError):
            test_viz.apply_rolling(df)
