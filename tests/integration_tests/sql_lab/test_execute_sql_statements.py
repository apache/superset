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
from superset import app
from superset.common.db_query_status import QueryStatus
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql_lab import execute_sql_statements
from superset.utils.dates import now_as_float


def test_non_async_execute(non_async_example_db: Database, example_query: Query):
    """Test query.tracking_url is attached for Presto and Hive queries"""
    result = execute_sql_statements(
        example_query.id,
        "select 1 as foo;",
        store_results=False,
        return_results=True,
        start_time=now_as_float(),
        expand_data=True,
        log_params=dict(),
    )
    assert result
    assert result["query_id"] == example_query.id
    assert result["status"] == QueryStatus.SUCCESS
    assert result["data"] == [{"foo": 1}]

    # should attach apply tracking URL for Presto & Hive
    if non_async_example_db.db_engine_spec.engine == "presto":
        assert example_query.tracking_url
        assert "/ui/query.html?" in example_query.tracking_url

        app.config["TRACKING_URL_TRANSFORMER"] = lambda url, query: url.replace(
            "/ui/query.html?", f"/{query.client_id}/"
        )
        assert f"/{example_query.client_id}/" in example_query.tracking_url

        app.config["TRACKING_URL_TRANSFORMER"] = lambda url: url + "&foo=bar"
        assert example_query.tracking_url.endswith("&foo=bar")

    if non_async_example_db.db_engine_spec.engine_name == "hive":
        assert example_query.tracking_url_raw
