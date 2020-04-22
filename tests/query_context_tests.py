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
from typing import Any, Dict, List, Optional

from superset import db
from superset.common.query_context import QueryContext
from superset.connectors.connector_registry import ConnectorRegistry
from superset.utils.core import TimeRangeEndpoint
from tests.base_tests import SupersetTestCase
from tests.fixtures.query_context import get_query_context
from tests.test_app import app


class QueryContextTests(SupersetTestCase):
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
