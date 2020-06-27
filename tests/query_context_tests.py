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
import tests.test_app
from superset import db
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.common.query_context import QueryContext
from superset.connectors.connector_registry import ConnectorRegistry
from superset.utils.core import (
    ChartDataResultFormat,
    ChartDataResultType,
    TimeRangeEndpoint,
)
from tests.base_tests import SupersetTestCase
from tests.fixtures.query_context import get_query_context


class TestQueryContext(SupersetTestCase):
    def test_schema_deserialization(self):
        """
        Ensure that the deserialized QueryContext contains all required fields.
        """

        table_name = "birth_names"
        table = self.get_table_by_name(table_name)
        payload = get_query_context(
            table.name, table.id, table.type, add_postprocessing_operations=True
        )
        query_context, errors = ChartDataQueryContextSchema().load(payload)
        self.assertDictEqual(errors, {})
        self.assertEqual(len(query_context.queries), len(payload["queries"]))
        for query_idx, query in enumerate(query_context.queries):
            payload_query = payload["queries"][query_idx]

            # check basic properies
            self.assertEqual(query.extras, payload_query["extras"])
            self.assertEqual(query.filter, payload_query["filters"])
            self.assertEqual(query.groupby, payload_query["groupby"])

            # metrics are mutated during creation
            for metric_idx, metric in enumerate(query.metrics):
                payload_metric = payload_query["metrics"][metric_idx]
                payload_metric = (
                    payload_metric
                    if "expressionType" in payload_metric
                    else payload_metric["label"]
                )
                self.assertEqual(metric, payload_metric)

            self.assertEqual(query.orderby, payload_query["orderby"])
            self.assertEqual(query.time_range, payload_query["time_range"])

            # check post processing operation properties
            for post_proc_idx, post_proc in enumerate(query.post_processing):
                payload_post_proc = payload_query["post_processing"][post_proc_idx]
                self.assertEqual(post_proc["operation"], payload_post_proc["operation"])
                self.assertEqual(post_proc["options"], payload_post_proc["options"])

    def test_cache_key_changes_when_datasource_is_updated(self):
        self.login(username="admin")
        table_name = "birth_names"
        table = self.get_table_by_name(table_name)
        payload = get_query_context(table.name, table.id, table.type)

        # construct baseline cache_key
        query_context = QueryContext(**payload)
        query_object = query_context.queries[0]
        cache_key_original = query_context.cache_key(query_object)

        # make temporary change and revert it to refresh the changed_on property
        datasource = ConnectorRegistry.get_datasource(
            datasource_type=payload["datasource"]["type"],
            datasource_id=payload["datasource"]["id"],
            session=db.session,
        )
        description_original = datasource.description
        datasource.description = "temporary description"
        db.session.commit()
        datasource.description = description_original
        db.session.commit()

        # create new QueryContext with unchanged attributes and extract new cache_key
        query_context = QueryContext(**payload)
        query_object = query_context.queries[0]
        cache_key_new = query_context.cache_key(query_object)

        # the new cache_key should be different due to updated datasource
        self.assertNotEqual(cache_key_original, cache_key_new)

    def test_query_context_time_range_endpoints(self):
        """
        Ensure that time_range_endpoints are populated automatically when missing
        from the payload
        """
        self.login(username="admin")
        table_name = "birth_names"
        table = self.get_table_by_name(table_name)
        payload = get_query_context(table.name, table.id, table.type)
        del payload["queries"][0]["extras"]["time_range_endpoints"]
        query_context = QueryContext(**payload)
        query_object = query_context.queries[0]
        extras = query_object.to_dict()["extras"]
        self.assertTrue("time_range_endpoints" in extras)

        self.assertEquals(
            extras["time_range_endpoints"],
            (TimeRangeEndpoint.INCLUSIVE, TimeRangeEndpoint.EXCLUSIVE),
        )

    def test_convert_deprecated_fields(self):
        """
        Ensure that deprecated fields are converted correctly
        """
        self.login(username="admin")
        table_name = "birth_names"
        table = self.get_table_by_name(table_name)
        payload = get_query_context(table.name, table.id, table.type)
        payload["queries"][0]["granularity_sqla"] = "timecol"
        payload["queries"][0]["having_filters"] = {"col": "a", "op": "==", "val": "b"}
        query_context = QueryContext(**payload)
        self.assertEqual(len(query_context.queries), 1)
        query_object = query_context.queries[0]
        self.assertEqual(query_object.granularity, "timecol")
        self.assertIn("having_druid", query_object.extras)

    def test_csv_response_format(self):
        """
        Ensure that CSV result format works
        """
        self.login(username="admin")
        table_name = "birth_names"
        table = self.get_table_by_name(table_name)
        payload = get_query_context(table.name, table.id, table.type)
        payload["result_format"] = ChartDataResultFormat.CSV.value
        payload["queries"][0]["row_limit"] = 10
        query_context = QueryContext(**payload)
        responses = query_context.get_payload()
        self.assertEqual(len(responses), 1)
        data = responses[0]["data"]
        self.assertIn("name,sum__num\n", data)
        self.assertEqual(len(data.split("\n")), 12)

    def test_samples_response_type(self):
        """
        Ensure that samples result type works
        """
        self.login(username="admin")
        table_name = "birth_names"
        table = self.get_table_by_name(table_name)
        payload = get_query_context(table.name, table.id, table.type)
        payload["result_type"] = ChartDataResultType.SAMPLES.value
        payload["queries"][0]["row_limit"] = 5
        query_context = QueryContext(**payload)
        responses = query_context.get_payload()
        self.assertEqual(len(responses), 1)
        data = responses[0]["data"]
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 5)
        self.assertNotIn("sum__num", data[0])

    def test_query_response_type(self):
        """
        Ensure that query result type works
        """
        self.login(username="admin")
        table_name = "birth_names"
        table = self.get_table_by_name(table_name)
        payload = get_query_context(table.name, table.id, table.type)
        payload["result_type"] = ChartDataResultType.QUERY.value
        query_context = QueryContext(**payload)
        responses = query_context.get_payload()
        self.assertEqual(len(responses), 1)
        response = responses[0]
        self.assertEqual(len(response), 2)
        self.assertEqual(response["language"], "sql")
        self.assertIn("SELECT", response["query"])
