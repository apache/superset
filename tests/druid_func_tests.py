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
import json
import unittest
from unittest.mock import Mock

import tests.test_app
import superset.connectors.druid.models as models
from superset.connectors.druid.models import DruidColumn, DruidDatasource, DruidMetric
from superset.exceptions import SupersetException

from .base_tests import SupersetTestCase

try:
    from pydruid.utils.dimensions import (
        MapLookupExtraction,
        RegexExtraction,
        RegisteredLookupExtraction,
        TimeFormatExtraction,
    )
    import pydruid.utils.postaggregator as postaggs
except ImportError:
    pass


def mock_metric(metric_name, is_postagg=False):
    metric = Mock()
    metric.metric_name = metric_name
    metric.metric_type = "postagg" if is_postagg else "metric"
    return metric


def emplace(metrics_dict, metric_name, is_postagg=False):
    metrics_dict[metric_name] = mock_metric(metric_name, is_postagg)


# Unit tests that can be run without initializing base tests
class TestDruidFunc(SupersetTestCase):
    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_extraction_fn_map(self):
        filters = [{"col": "deviceName", "val": ["iPhone X"], "op": "in"}]
        dimension_spec = {
            "type": "extraction",
            "dimension": "device",
            "outputName": "deviceName",
            "outputType": "STRING",
            "extractionFn": {
                "type": "lookup",
                "dimension": "dimensionName",
                "outputName": "dimensionOutputName",
                "replaceMissingValueWith": "missing_value",
                "retainMissingValue": False,
                "lookup": {
                    "type": "map",
                    "map": {
                        "iPhone10,1": "iPhone 8",
                        "iPhone10,4": "iPhone 8",
                        "iPhone10,2": "iPhone 8 Plus",
                        "iPhone10,5": "iPhone 8 Plus",
                        "iPhone10,3": "iPhone X",
                        "iPhone10,6": "iPhone X",
                    },
                    "isOneToOne": False,
                },
            },
        }
        spec_json = json.dumps(dimension_spec)
        col = DruidColumn(column_name="deviceName", dimension_spec_json=spec_json)
        column_dict = {"deviceName": col}
        f = DruidDatasource.get_filters(filters, [], column_dict)
        assert isinstance(f.extraction_function, MapLookupExtraction)
        dim_ext_fn = dimension_spec["extractionFn"]
        f_ext_fn = f.extraction_function
        self.assertEqual(dim_ext_fn["lookup"]["map"], f_ext_fn._mapping)
        self.assertEqual(dim_ext_fn["lookup"]["isOneToOne"], f_ext_fn._injective)
        self.assertEqual(
            dim_ext_fn["replaceMissingValueWith"], f_ext_fn._replace_missing_values
        )
        self.assertEqual(
            dim_ext_fn["retainMissingValue"], f_ext_fn._retain_missing_values
        )

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_extraction_fn_regex(self):
        filters = [{"col": "buildPrefix", "val": ["22B"], "op": "in"}]
        dimension_spec = {
            "type": "extraction",
            "dimension": "build",
            "outputName": "buildPrefix",
            "outputType": "STRING",
            "extractionFn": {"type": "regex", "expr": "(^[0-9A-Za-z]{3})"},
        }
        spec_json = json.dumps(dimension_spec)
        col = DruidColumn(column_name="buildPrefix", dimension_spec_json=spec_json)
        column_dict = {"buildPrefix": col}
        f = DruidDatasource.get_filters(filters, [], column_dict)
        assert isinstance(f.extraction_function, RegexExtraction)
        dim_ext_fn = dimension_spec["extractionFn"]
        f_ext_fn = f.extraction_function
        self.assertEqual(dim_ext_fn["expr"], f_ext_fn._expr)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_extraction_fn_registered_lookup_extraction(self):
        filters = [{"col": "country", "val": ["Spain"], "op": "in"}]
        dimension_spec = {
            "type": "extraction",
            "dimension": "country_name",
            "outputName": "country",
            "outputType": "STRING",
            "extractionFn": {"type": "registeredLookup", "lookup": "country_name"},
        }
        spec_json = json.dumps(dimension_spec)
        col = DruidColumn(column_name="country", dimension_spec_json=spec_json)
        column_dict = {"country": col}
        f = DruidDatasource.get_filters(filters, [], column_dict)
        assert isinstance(f.extraction_function, RegisteredLookupExtraction)
        dim_ext_fn = dimension_spec["extractionFn"]
        self.assertEqual(dim_ext_fn["type"], f.extraction_function.extraction_type)
        self.assertEqual(dim_ext_fn["lookup"], f.extraction_function._lookup)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_extraction_fn_time_format(self):
        filters = [{"col": "dayOfMonth", "val": ["1", "20"], "op": "in"}]
        dimension_spec = {
            "type": "extraction",
            "dimension": "__time",
            "outputName": "dayOfMonth",
            "extractionFn": {
                "type": "timeFormat",
                "format": "d",
                "timeZone": "Asia/Kolkata",
                "locale": "en",
            },
        }
        spec_json = json.dumps(dimension_spec)
        col = DruidColumn(column_name="dayOfMonth", dimension_spec_json=spec_json)
        column_dict = {"dayOfMonth": col}
        f = DruidDatasource.get_filters(filters, [], column_dict)
        assert isinstance(f.extraction_function, TimeFormatExtraction)
        dim_ext_fn = dimension_spec["extractionFn"]
        self.assertEqual(dim_ext_fn["type"], f.extraction_function.extraction_type)
        self.assertEqual(dim_ext_fn["format"], f.extraction_function._format)
        self.assertEqual(dim_ext_fn["timeZone"], f.extraction_function._time_zone)
        self.assertEqual(dim_ext_fn["locale"], f.extraction_function._locale)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_ignores_invalid_filter_objects(self):
        filtr = {"col": "col1", "op": "=="}
        filters = [filtr]
        col = DruidColumn(column_name="col1")
        column_dict = {"col1": col}
        self.assertIsNone(DruidDatasource.get_filters(filters, [], column_dict))

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_constructs_filter_in(self):
        filtr = {"col": "A", "op": "in", "val": ["a", "b", "c"]}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertIn("filter", res.filter)
        self.assertIn("fields", res.filter["filter"])
        self.assertEqual("or", res.filter["filter"]["type"])
        self.assertEqual(3, len(res.filter["filter"]["fields"]))

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_constructs_filter_not_in(self):
        filtr = {"col": "A", "op": "not in", "val": ["a", "b", "c"]}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertIn("filter", res.filter)
        self.assertIn("type", res.filter["filter"])
        self.assertEqual("not", res.filter["filter"]["type"])
        self.assertIn("field", res.filter["filter"])
        self.assertEqual(
            3, len(res.filter["filter"]["field"].filter["filter"]["fields"])
        )

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_constructs_filter_equals(self):
        filtr = {"col": "A", "op": "==", "val": "h"}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertEqual("selector", res.filter["filter"]["type"])
        self.assertEqual("A", res.filter["filter"]["dimension"])
        self.assertEqual("h", res.filter["filter"]["value"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_constructs_filter_not_equals(self):
        filtr = {"col": "A", "op": "!=", "val": "h"}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertEqual("not", res.filter["filter"]["type"])
        self.assertEqual("h", res.filter["filter"]["field"].filter["filter"]["value"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_constructs_bounds_filter(self):
        filtr = {"col": "A", "op": ">=", "val": "h"}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertFalse(res.filter["filter"]["lowerStrict"])
        self.assertEqual("A", res.filter["filter"]["dimension"])
        self.assertEqual("h", res.filter["filter"]["lower"])
        self.assertEqual("lexicographic", res.filter["filter"]["ordering"])
        filtr["op"] = ">"
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertTrue(res.filter["filter"]["lowerStrict"])
        filtr["op"] = "<="
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertFalse(res.filter["filter"]["upperStrict"])
        self.assertEqual("h", res.filter["filter"]["upper"])
        filtr["op"] = "<"
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertTrue(res.filter["filter"]["upperStrict"])
        filtr["val"] = 1
        res = DruidDatasource.get_filters([filtr], ["A"], column_dict)
        self.assertEqual("numeric", res.filter["filter"]["ordering"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_is_null_filter(self):
        filtr = {"col": "A", "op": "IS NULL"}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertEqual("selector", res.filter["filter"]["type"])
        self.assertEqual("", res.filter["filter"]["value"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_is_not_null_filter(self):
        filtr = {"col": "A", "op": "IS NOT NULL"}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertEqual("not", res.filter["filter"]["type"])
        self.assertIn("field", res.filter["filter"])
        self.assertEqual(
            "selector", res.filter["filter"]["field"].filter["filter"]["type"]
        )
        self.assertEqual("", res.filter["filter"]["field"].filter["filter"]["value"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_constructs_regex_filter(self):
        filtr = {"col": "A", "op": "regex", "val": "[abc]"}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertEqual("regex", res.filter["filter"]["type"])
        self.assertEqual("[abc]", res.filter["filter"]["pattern"])
        self.assertEqual("A", res.filter["filter"]["dimension"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_composes_multiple_filters(self):
        filtr1 = {"col": "A", "op": "!=", "val": "y"}
        filtr2 = {"col": "B", "op": "in", "val": ["a", "b", "c"]}
        cola = DruidColumn(column_name="A")
        colb = DruidColumn(column_name="B")
        column_dict = {"A": cola, "B": colb}
        res = DruidDatasource.get_filters([filtr1, filtr2], [], column_dict)
        self.assertEqual("and", res.filter["filter"]["type"])
        self.assertEqual(2, len(res.filter["filter"]["fields"]))

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_ignores_in_not_in_with_empty_value(self):
        filtr1 = {"col": "A", "op": "in", "val": []}
        filtr2 = {"col": "A", "op": "not in", "val": []}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr1, filtr2], [], column_dict)
        self.assertIsNone(res)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_constructs_equals_for_in_not_in_single_value(self):
        filtr = {"col": "A", "op": "in", "val": ["a"]}
        cola = DruidColumn(column_name="A")
        colb = DruidColumn(column_name="B")
        column_dict = {"A": cola, "B": colb}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertEqual("selector", res.filter["filter"]["type"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_handles_arrays_for_string_types(self):
        filtr = {"col": "A", "op": "==", "val": ["a", "b"]}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertEqual("a", res.filter["filter"]["value"])

        filtr = {"col": "A", "op": "==", "val": []}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertIsNone(res.filter["filter"]["value"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_handles_none_for_string_types(self):
        filtr = {"col": "A", "op": "==", "val": None}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertIsNone(res)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_extracts_values_in_quotes(self):
        filtr = {"col": "A", "op": "in", "val": ['"a"']}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertEqual("a", res.filter["filter"]["value"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_keeps_trailing_spaces(self):
        filtr = {"col": "A", "op": "in", "val": ["a "]}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], [], column_dict)
        self.assertEqual("a ", res.filter["filter"]["value"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_filters_converts_strings_to_num(self):
        filtr = {"col": "A", "op": "in", "val": ["6"]}
        col = DruidColumn(column_name="A")
        column_dict = {"A": col}
        res = DruidDatasource.get_filters([filtr], ["A"], column_dict)
        self.assertEqual(6, res.filter["filter"]["value"])
        filtr = {"col": "A", "op": "==", "val": "6"}
        res = DruidDatasource.get_filters([filtr], ["A"], column_dict)
        self.assertEqual(6, res.filter["filter"]["value"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_run_query_no_groupby(self):
        client = Mock()
        from_dttm = Mock()
        to_dttm = Mock()
        from_dttm.replace = Mock(return_value=from_dttm)
        to_dttm.replace = Mock(return_value=to_dttm)
        from_dttm.isoformat = Mock(return_value="from")
        to_dttm.isoformat = Mock(return_value="to")
        timezone = "timezone"
        from_dttm.tzname = Mock(return_value=timezone)
        ds = DruidDatasource(datasource_name="datasource")
        metric1 = DruidMetric(metric_name="metric1")
        metric2 = DruidMetric(metric_name="metric2")
        ds.metrics = [metric1, metric2]
        col1 = DruidColumn(column_name="col1")
        col2 = DruidColumn(column_name="col2")
        ds.columns = [col1, col2]
        aggs = []
        post_aggs = ["some_agg"]
        ds._metrics_and_post_aggs = Mock(return_value=(aggs, post_aggs))
        groupby = []
        metrics = ["metric1"]
        ds.get_having_filters = Mock(return_value=[])
        client.query_builder = Mock()
        client.query_builder.last_query = Mock()
        client.query_builder.last_query.query_dict = {"mock": 0}
        # no groupby calls client.timeseries
        ds.run_query(
            metrics,
            None,
            from_dttm,
            to_dttm,
            groupby=groupby,
            client=client,
            filter=[],
            row_limit=100,
        )
        self.assertEqual(0, len(client.topn.call_args_list))
        self.assertEqual(0, len(client.groupby.call_args_list))
        self.assertEqual(1, len(client.timeseries.call_args_list))
        # check that there is no dimensions entry
        called_args = client.timeseries.call_args_list[0][1]
        self.assertNotIn("dimensions", called_args)
        self.assertIn("post_aggregations", called_args)
        # restore functions

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_run_query_with_adhoc_metric(self):
        client = Mock()
        from_dttm = Mock()
        to_dttm = Mock()
        from_dttm.replace = Mock(return_value=from_dttm)
        to_dttm.replace = Mock(return_value=to_dttm)
        from_dttm.isoformat = Mock(return_value="from")
        to_dttm.isoformat = Mock(return_value="to")
        timezone = "timezone"
        from_dttm.tzname = Mock(return_value=timezone)
        ds = DruidDatasource(datasource_name="datasource")
        metric1 = DruidMetric(metric_name="metric1")
        metric2 = DruidMetric(metric_name="metric2")
        ds.metrics = [metric1, metric2]
        col1 = DruidColumn(column_name="col1")
        col2 = DruidColumn(column_name="col2")
        ds.columns = [col1, col2]
        all_metrics = []
        post_aggs = ["some_agg"]
        ds._metrics_and_post_aggs = Mock(return_value=(all_metrics, post_aggs))
        groupby = []
        metrics = [
            {
                "expressionType": "SIMPLE",
                "column": {"type": "DOUBLE", "column_name": "col1"},
                "aggregate": "SUM",
                "label": "My Adhoc Metric",
            }
        ]

        ds.get_having_filters = Mock(return_value=[])
        client.query_builder = Mock()
        client.query_builder.last_query = Mock()
        client.query_builder.last_query.query_dict = {"mock": 0}
        # no groupby calls client.timeseries
        ds.run_query(
            metrics,
            None,
            from_dttm,
            to_dttm,
            groupby=groupby,
            client=client,
            filter=[],
            row_limit=100,
        )
        self.assertEqual(0, len(client.topn.call_args_list))
        self.assertEqual(0, len(client.groupby.call_args_list))
        self.assertEqual(1, len(client.timeseries.call_args_list))
        # check that there is no dimensions entry
        called_args = client.timeseries.call_args_list[0][1]
        self.assertNotIn("dimensions", called_args)
        self.assertIn("post_aggregations", called_args)
        # restore functions

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_run_query_single_groupby(self):
        client = Mock()
        from_dttm = Mock()
        to_dttm = Mock()
        from_dttm.replace = Mock(return_value=from_dttm)
        to_dttm.replace = Mock(return_value=to_dttm)
        from_dttm.isoformat = Mock(return_value="from")
        to_dttm.isoformat = Mock(return_value="to")
        timezone = "timezone"
        from_dttm.tzname = Mock(return_value=timezone)
        ds = DruidDatasource(datasource_name="datasource")
        metric1 = DruidMetric(metric_name="metric1")
        metric2 = DruidMetric(metric_name="metric2")
        ds.metrics = [metric1, metric2]
        col1 = DruidColumn(column_name="col1")
        col2 = DruidColumn(column_name="col2")
        ds.columns = [col1, col2]
        aggs = ["metric1"]
        post_aggs = ["some_agg"]
        ds._metrics_and_post_aggs = Mock(return_value=(aggs, post_aggs))
        groupby = ["col1"]
        metrics = ["metric1"]
        ds.get_having_filters = Mock(return_value=[])
        client.query_builder.last_query.query_dict = {"mock": 0}
        # client.topn is called twice
        ds.run_query(
            metrics,
            None,
            from_dttm,
            to_dttm,
            groupby=groupby,
            timeseries_limit=100,
            client=client,
            order_desc=True,
            filter=[],
        )
        self.assertEqual(2, len(client.topn.call_args_list))
        self.assertEqual(0, len(client.groupby.call_args_list))
        self.assertEqual(0, len(client.timeseries.call_args_list))
        # check that there is no dimensions entry
        called_args_pre = client.topn.call_args_list[0][1]
        self.assertNotIn("dimensions", called_args_pre)
        self.assertIn("dimension", called_args_pre)
        called_args = client.topn.call_args_list[1][1]
        self.assertIn("dimension", called_args)
        self.assertEqual("col1", called_args["dimension"])
        # not order_desc
        client = Mock()
        client.query_builder.last_query.query_dict = {"mock": 0}
        ds.run_query(
            metrics,
            None,
            from_dttm,
            to_dttm,
            groupby=groupby,
            client=client,
            order_desc=False,
            filter=[],
            row_limit=100,
        )
        self.assertEqual(0, len(client.topn.call_args_list))
        self.assertEqual(1, len(client.groupby.call_args_list))
        self.assertEqual(0, len(client.timeseries.call_args_list))
        self.assertIn("dimensions", client.groupby.call_args_list[0][1])
        self.assertEqual(["col1"], client.groupby.call_args_list[0][1]["dimensions"])
        # order_desc but timeseries and dimension spec
        # calls topn with single dimension spec 'dimension'
        spec = {"outputName": "hello", "dimension": "matcho"}
        spec_json = json.dumps(spec)
        col3 = DruidColumn(column_name="col3", dimension_spec_json=spec_json)
        ds.columns.append(col3)
        groupby = ["col3"]
        client = Mock()
        client.query_builder.last_query.query_dict = {"mock": 0}
        ds.run_query(
            metrics,
            None,
            from_dttm,
            to_dttm,
            groupby=groupby,
            client=client,
            order_desc=True,
            timeseries_limit=5,
            filter=[],
            row_limit=100,
        )
        self.assertEqual(2, len(client.topn.call_args_list))
        self.assertEqual(0, len(client.groupby.call_args_list))
        self.assertEqual(0, len(client.timeseries.call_args_list))
        self.assertIn("dimension", client.topn.call_args_list[0][1])
        self.assertIn("dimension", client.topn.call_args_list[1][1])
        # uses dimension for pre query and full spec for final query
        self.assertEqual("matcho", client.topn.call_args_list[0][1]["dimension"])
        self.assertEqual(spec, client.topn.call_args_list[1][1]["dimension"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_run_query_multiple_groupby(self):
        client = Mock()
        from_dttm = Mock()
        to_dttm = Mock()
        from_dttm.replace = Mock(return_value=from_dttm)
        to_dttm.replace = Mock(return_value=to_dttm)
        from_dttm.isoformat = Mock(return_value="from")
        to_dttm.isoformat = Mock(return_value="to")
        timezone = "timezone"
        from_dttm.tzname = Mock(return_value=timezone)
        ds = DruidDatasource(datasource_name="datasource")
        metric1 = DruidMetric(metric_name="metric1")
        metric2 = DruidMetric(metric_name="metric2")
        ds.metrics = [metric1, metric2]
        col1 = DruidColumn(column_name="col1")
        col2 = DruidColumn(column_name="col2")
        ds.columns = [col1, col2]
        aggs = []
        post_aggs = ["some_agg"]
        ds._metrics_and_post_aggs = Mock(return_value=(aggs, post_aggs))
        groupby = ["col1", "col2"]
        metrics = ["metric1"]
        ds.get_having_filters = Mock(return_value=[])
        client.query_builder = Mock()
        client.query_builder.last_query = Mock()
        client.query_builder.last_query.query_dict = {"mock": 0}
        # no groupby calls client.timeseries
        ds.run_query(
            metrics,
            None,
            from_dttm,
            to_dttm,
            groupby=groupby,
            client=client,
            row_limit=100,
            filter=[],
        )
        self.assertEqual(0, len(client.topn.call_args_list))
        self.assertEqual(1, len(client.groupby.call_args_list))
        self.assertEqual(0, len(client.timeseries.call_args_list))
        # check that there is no dimensions entry
        called_args = client.groupby.call_args_list[0][1]
        self.assertIn("dimensions", called_args)
        self.assertEqual(["col1", "col2"], called_args["dimensions"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_post_agg_returns_correct_agg_type(self):
        get_post_agg = DruidDatasource.get_post_agg
        # javascript PostAggregators
        function = "function(field1, field2) { return field1 + field2; }"
        conf = {
            "type": "javascript",
            "name": "postagg_name",
            "fieldNames": ["field1", "field2"],
            "function": function,
        }
        postagg = get_post_agg(conf)
        self.assertTrue(isinstance(postagg, models.JavascriptPostAggregator))
        self.assertEqual(postagg.name, "postagg_name")
        self.assertEqual(postagg.post_aggregator["type"], "javascript")
        self.assertEqual(postagg.post_aggregator["fieldNames"], ["field1", "field2"])
        self.assertEqual(postagg.post_aggregator["name"], "postagg_name")
        self.assertEqual(postagg.post_aggregator["function"], function)
        # Quantile
        conf = {"type": "quantile", "name": "postagg_name", "probability": "0.5"}
        postagg = get_post_agg(conf)
        self.assertTrue(isinstance(postagg, postaggs.Quantile))
        self.assertEqual(postagg.name, "postagg_name")
        self.assertEqual(postagg.post_aggregator["probability"], "0.5")
        # Quantiles
        conf = {
            "type": "quantiles",
            "name": "postagg_name",
            "probabilities": "0.4,0.5,0.6",
        }
        postagg = get_post_agg(conf)
        self.assertTrue(isinstance(postagg, postaggs.Quantiles))
        self.assertEqual(postagg.name, "postagg_name")
        self.assertEqual(postagg.post_aggregator["probabilities"], "0.4,0.5,0.6")
        # FieldAccess
        conf = {"type": "fieldAccess", "name": "field_name"}
        postagg = get_post_agg(conf)
        self.assertTrue(isinstance(postagg, postaggs.Field))
        self.assertEqual(postagg.name, "field_name")
        # constant
        conf = {"type": "constant", "value": 1234, "name": "postagg_name"}
        postagg = get_post_agg(conf)
        self.assertTrue(isinstance(postagg, postaggs.Const))
        self.assertEqual(postagg.name, "postagg_name")
        self.assertEqual(postagg.post_aggregator["value"], 1234)
        # hyperUniqueCardinality
        conf = {"type": "hyperUniqueCardinality", "name": "unique_name"}
        postagg = get_post_agg(conf)
        self.assertTrue(isinstance(postagg, postaggs.HyperUniqueCardinality))
        self.assertEqual(postagg.name, "unique_name")
        # arithmetic
        conf = {
            "type": "arithmetic",
            "fn": "+",
            "fields": ["field1", "field2"],
            "name": "postagg_name",
        }
        postagg = get_post_agg(conf)
        self.assertTrue(isinstance(postagg, postaggs.Postaggregator))
        self.assertEqual(postagg.name, "postagg_name")
        self.assertEqual(postagg.post_aggregator["fn"], "+")
        self.assertEqual(postagg.post_aggregator["fields"], ["field1", "field2"])
        # custom post aggregator
        conf = {"type": "custom", "name": "custom_name", "stuff": "more_stuff"}
        postagg = get_post_agg(conf)
        self.assertTrue(isinstance(postagg, models.CustomPostAggregator))
        self.assertEqual(postagg.name, "custom_name")
        self.assertEqual(postagg.post_aggregator["stuff"], "more_stuff")

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_find_postaggs_for_returns_postaggs_and_removes(self):
        find_postaggs_for = DruidDatasource.find_postaggs_for
        postagg_names = set(["pa2", "pa3", "pa4", "m1", "m2", "m3", "m4"])

        metrics = {}
        for i in range(1, 6):
            emplace(metrics, "pa" + str(i), True)
            emplace(metrics, "m" + str(i), False)
        postagg_list = find_postaggs_for(postagg_names, metrics)
        self.assertEqual(3, len(postagg_list))
        self.assertEqual(4, len(postagg_names))
        expected_metrics = ["m1", "m2", "m3", "m4"]
        expected_postaggs = set(["pa2", "pa3", "pa4"])
        for postagg in postagg_list:
            expected_postaggs.remove(postagg.metric_name)
        for metric in expected_metrics:
            postagg_names.remove(metric)
        self.assertEqual(0, len(expected_postaggs))
        self.assertEqual(0, len(postagg_names))

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_recursive_get_fields(self):
        conf = {
            "type": "quantile",
            "fieldName": "f1",
            "field": {
                "type": "custom",
                "fields": [
                    {"type": "fieldAccess", "fieldName": "f2"},
                    {"type": "fieldAccess", "fieldName": "f3"},
                    {
                        "type": "quantiles",
                        "fieldName": "f4",
                        "field": {"type": "custom"},
                    },
                    {
                        "type": "custom",
                        "fields": [
                            {"type": "fieldAccess", "fieldName": "f5"},
                            {
                                "type": "fieldAccess",
                                "fieldName": "f2",
                                "fields": [
                                    {"type": "fieldAccess", "fieldName": "f3"},
                                    {"type": "fieldIgnoreMe", "fieldName": "f6"},
                                ],
                            },
                        ],
                    },
                ],
            },
        }
        fields = DruidDatasource.recursive_get_fields(conf)
        expected = set(["f1", "f2", "f3", "f4", "f5"])
        self.assertEqual(5, len(fields))
        for field in fields:
            expected.remove(field)
        self.assertEqual(0, len(expected))

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_metrics_and_post_aggs_tree(self):
        metrics = ["A", "B", "m1", "m2"]
        metrics_dict = {}
        for i in range(ord("A"), ord("K") + 1):
            emplace(metrics_dict, chr(i), True)
        for i in range(1, 10):
            emplace(metrics_dict, "m" + str(i), False)

        def depends_on(index, fields):
            dependents = fields if isinstance(fields, list) else [fields]
            metrics_dict[index].json_obj = {"fieldNames": dependents}

        depends_on("A", ["m1", "D", "C"])
        depends_on("B", ["B", "C", "E", "F", "m3"])
        depends_on("C", ["H", "I"])
        depends_on("D", ["m2", "m5", "G", "C"])
        depends_on("E", ["H", "I", "J"])
        depends_on("F", ["J", "m5"])
        depends_on("G", ["m4", "m7", "m6", "A"])
        depends_on("H", ["A", "m4", "I"])
        depends_on("I", ["H", "K"])
        depends_on("J", "K")
        depends_on("K", ["m8", "m9"])
        aggs, postaggs = DruidDatasource.metrics_and_post_aggs(metrics, metrics_dict)
        expected_metrics = set(aggs.keys())
        self.assertEqual(9, len(aggs))
        for i in range(1, 10):
            expected_metrics.remove("m" + str(i))
        self.assertEqual(0, len(expected_metrics))
        self.assertEqual(11, len(postaggs))
        for i in range(ord("A"), ord("K") + 1):
            del postaggs[chr(i)]
        self.assertEqual(0, len(postaggs))

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_metrics_and_post_aggs(self):
        """
        Test generation of metrics and post-aggregations from an initial list
        of superset metrics (which may include the results of either). This
        primarily tests that specifying a post-aggregator metric will also
        require the raw aggregation of the associated druid metric column.
        """
        metrics_dict = {
            "unused_count": DruidMetric(
                metric_name="unused_count",
                verbose_name="COUNT(*)",
                metric_type="count",
                json=json.dumps({"type": "count", "name": "unused_count"}),
            ),
            "some_sum": DruidMetric(
                metric_name="some_sum",
                verbose_name="SUM(*)",
                metric_type="sum",
                json=json.dumps({"type": "sum", "name": "sum"}),
            ),
            "a_histogram": DruidMetric(
                metric_name="a_histogram",
                verbose_name="APPROXIMATE_HISTOGRAM(*)",
                metric_type="approxHistogramFold",
                json=json.dumps({"type": "approxHistogramFold", "name": "a_histogram"}),
            ),
            "aCustomMetric": DruidMetric(
                metric_name="aCustomMetric",
                verbose_name="MY_AWESOME_METRIC(*)",
                metric_type="aCustomType",
                json=json.dumps({"type": "customMetric", "name": "aCustomMetric"}),
            ),
            "quantile_p95": DruidMetric(
                metric_name="quantile_p95",
                verbose_name="P95(*)",
                metric_type="postagg",
                json=json.dumps(
                    {
                        "type": "quantile",
                        "probability": 0.95,
                        "name": "p95",
                        "fieldName": "a_histogram",
                    }
                ),
            ),
            "aCustomPostAgg": DruidMetric(
                metric_name="aCustomPostAgg",
                verbose_name="CUSTOM_POST_AGG(*)",
                metric_type="postagg",
                json=json.dumps(
                    {
                        "type": "customPostAgg",
                        "name": "aCustomPostAgg",
                        "field": {"type": "fieldAccess", "fieldName": "aCustomMetric"},
                    }
                ),
            ),
        }

        adhoc_metric = {
            "expressionType": "SIMPLE",
            "column": {"type": "DOUBLE", "column_name": "value"},
            "aggregate": "SUM",
            "label": "My Adhoc Metric",
        }

        metrics = ["some_sum"]
        saved_metrics, post_aggs = DruidDatasource.metrics_and_post_aggs(
            metrics, metrics_dict
        )

        assert set(saved_metrics.keys()) == {"some_sum"}
        assert post_aggs == {}

        metrics = [adhoc_metric]
        saved_metrics, post_aggs = DruidDatasource.metrics_and_post_aggs(
            metrics, metrics_dict
        )

        assert set(saved_metrics.keys()) == set([adhoc_metric["label"]])
        assert post_aggs == {}

        metrics = ["some_sum", adhoc_metric]
        saved_metrics, post_aggs = DruidDatasource.metrics_and_post_aggs(
            metrics, metrics_dict
        )

        assert set(saved_metrics.keys()) == {"some_sum", adhoc_metric["label"]}
        assert post_aggs == {}

        metrics = ["quantile_p95"]
        saved_metrics, post_aggs = DruidDatasource.metrics_and_post_aggs(
            metrics, metrics_dict
        )

        result_postaggs = set(["quantile_p95"])
        assert set(saved_metrics.keys()) == {"a_histogram"}
        assert set(post_aggs.keys()) == result_postaggs

        metrics = ["aCustomPostAgg"]
        saved_metrics, post_aggs = DruidDatasource.metrics_and_post_aggs(
            metrics, metrics_dict
        )

        result_postaggs = set(["aCustomPostAgg"])
        assert set(saved_metrics.keys()) == {"aCustomMetric"}
        assert set(post_aggs.keys()) == result_postaggs

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_druid_type_from_adhoc_metric(self):

        druid_type = DruidDatasource.druid_type_from_adhoc_metric(
            {
                "column": {"type": "DOUBLE", "column_name": "value"},
                "aggregate": "SUM",
                "label": "My Adhoc Metric",
            }
        )
        assert druid_type == "doubleSum"

        druid_type = DruidDatasource.druid_type_from_adhoc_metric(
            {
                "column": {"type": "LONG", "column_name": "value"},
                "aggregate": "MAX",
                "label": "My Adhoc Metric",
            }
        )
        assert druid_type == "longMax"

        druid_type = DruidDatasource.druid_type_from_adhoc_metric(
            {
                "column": {"type": "VARCHAR(255)", "column_name": "value"},
                "aggregate": "COUNT",
                "label": "My Adhoc Metric",
            }
        )
        assert druid_type == "count"

        druid_type = DruidDatasource.druid_type_from_adhoc_metric(
            {
                "column": {"type": "VARCHAR(255)", "column_name": "value"},
                "aggregate": "COUNT_DISTINCT",
                "label": "My Adhoc Metric",
            }
        )
        assert druid_type == "cardinality"

        druid_type = DruidDatasource.druid_type_from_adhoc_metric(
            {
                "column": {"type": "hyperUnique", "column_name": "value"},
                "aggregate": "COUNT_DISTINCT",
                "label": "My Adhoc Metric",
            }
        )
        assert druid_type == "hyperUnique"

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_run_query_order_by_metrics(self):
        client = Mock()
        client.query_builder.last_query.query_dict = {"mock": 0}
        from_dttm = Mock()
        to_dttm = Mock()
        ds = DruidDatasource(datasource_name="datasource")
        ds.get_having_filters = Mock(return_value=[])
        dim1 = DruidColumn(column_name="dim1")
        dim2 = DruidColumn(column_name="dim2")
        metrics_dict = {
            "count1": DruidMetric(
                metric_name="count1",
                metric_type="count",
                json=json.dumps({"type": "count", "name": "count1"}),
            ),
            "sum1": DruidMetric(
                metric_name="sum1",
                metric_type="doubleSum",
                json=json.dumps({"type": "doubleSum", "name": "sum1"}),
            ),
            "sum2": DruidMetric(
                metric_name="sum2",
                metric_type="doubleSum",
                json=json.dumps({"type": "doubleSum", "name": "sum2"}),
            ),
            "div1": DruidMetric(
                metric_name="div1",
                metric_type="postagg",
                json=json.dumps(
                    {
                        "fn": "/",
                        "type": "arithmetic",
                        "name": "div1",
                        "fields": [
                            {"fieldName": "sum1", "type": "fieldAccess"},
                            {"fieldName": "sum2", "type": "fieldAccess"},
                        ],
                    }
                ),
            ),
        }
        ds.columns = [dim1, dim2]
        ds.metrics = list(metrics_dict.values())

        groupby = ["dim1"]
        metrics = ["count1"]
        granularity = "all"
        # get the counts of the top 5 'dim1's, order by 'sum1'
        ds.run_query(
            metrics,
            granularity,
            from_dttm,
            to_dttm,
            groupby=groupby,
            timeseries_limit=5,
            timeseries_limit_metric="sum1",
            client=client,
            order_desc=True,
            filter=[],
        )
        qry_obj = client.topn.call_args_list[0][1]
        self.assertEqual("dim1", qry_obj["dimension"])
        self.assertEqual("sum1", qry_obj["metric"])
        aggregations = qry_obj["aggregations"]
        post_aggregations = qry_obj["post_aggregations"]
        self.assertEqual({"count1", "sum1"}, set(aggregations.keys()))
        self.assertEqual(set(), set(post_aggregations.keys()))

        # get the counts of the top 5 'dim1's, order by 'div1'
        ds.run_query(
            metrics,
            granularity,
            from_dttm,
            to_dttm,
            groupby=groupby,
            timeseries_limit=5,
            timeseries_limit_metric="div1",
            client=client,
            order_desc=True,
            filter=[],
        )
        qry_obj = client.topn.call_args_list[1][1]
        self.assertEqual("dim1", qry_obj["dimension"])
        self.assertEqual("div1", qry_obj["metric"])
        aggregations = qry_obj["aggregations"]
        post_aggregations = qry_obj["post_aggregations"]
        self.assertEqual({"count1", "sum1", "sum2"}, set(aggregations.keys()))
        self.assertEqual({"div1"}, set(post_aggregations.keys()))

        groupby = ["dim1", "dim2"]
        # get the counts of the top 5 ['dim1', 'dim2']s, order by 'sum1'
        ds.run_query(
            metrics,
            granularity,
            from_dttm,
            to_dttm,
            groupby=groupby,
            timeseries_limit=5,
            timeseries_limit_metric="sum1",
            client=client,
            order_desc=True,
            filter=[],
        )
        qry_obj = client.groupby.call_args_list[0][1]
        self.assertEqual({"dim1", "dim2"}, set(qry_obj["dimensions"]))
        self.assertEqual("sum1", qry_obj["limit_spec"]["columns"][0]["dimension"])
        aggregations = qry_obj["aggregations"]
        post_aggregations = qry_obj["post_aggregations"]
        self.assertEqual({"count1", "sum1"}, set(aggregations.keys()))
        self.assertEqual(set(), set(post_aggregations.keys()))

        # get the counts of the top 5 ['dim1', 'dim2']s, order by 'div1'
        ds.run_query(
            metrics,
            granularity,
            from_dttm,
            to_dttm,
            groupby=groupby,
            timeseries_limit=5,
            timeseries_limit_metric="div1",
            client=client,
            order_desc=True,
            filter=[],
        )
        qry_obj = client.groupby.call_args_list[1][1]
        self.assertEqual({"dim1", "dim2"}, set(qry_obj["dimensions"]))
        self.assertEqual("div1", qry_obj["limit_spec"]["columns"][0]["dimension"])
        aggregations = qry_obj["aggregations"]
        post_aggregations = qry_obj["post_aggregations"]
        self.assertEqual({"count1", "sum1", "sum2"}, set(aggregations.keys()))
        self.assertEqual({"div1"}, set(post_aggregations.keys()))

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_get_aggregations(self):
        ds = DruidDatasource(datasource_name="datasource")
        metrics_dict = {
            "sum1": DruidMetric(
                metric_name="sum1",
                metric_type="doubleSum",
                json=json.dumps({"type": "doubleSum", "name": "sum1"}),
            ),
            "sum2": DruidMetric(
                metric_name="sum2",
                metric_type="doubleSum",
                json=json.dumps({"type": "doubleSum", "name": "sum2"}),
            ),
            "div1": DruidMetric(
                metric_name="div1",
                metric_type="postagg",
                json=json.dumps(
                    {
                        "fn": "/",
                        "type": "arithmetic",
                        "name": "div1",
                        "fields": [
                            {"fieldName": "sum1", "type": "fieldAccess"},
                            {"fieldName": "sum2", "type": "fieldAccess"},
                        ],
                    }
                ),
            ),
        }
        metric_names = ["sum1", "sum2"]
        aggs = ds.get_aggregations(metrics_dict, metric_names)
        expected_agg = {name: metrics_dict[name].json_obj for name in metric_names}
        self.assertEqual(expected_agg, aggs)

        metric_names = ["sum1", "col1"]
        self.assertRaises(
            SupersetException, ds.get_aggregations, metrics_dict, metric_names
        )

        metric_names = ["sum1", "div1"]
        self.assertRaises(
            SupersetException, ds.get_aggregations, metrics_dict, metric_names
        )
