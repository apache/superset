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
from superset.common.form_data_query_context import (
    adhoc_filters_to_query_filters,
    build_query_context_from_form_data,
    columns_from_form_data,
)

DATASOURCE = {"id": 7, "type": "table"}


def test_adhoc_filters_converts_simple_and_drops_custom_sql() -> None:
    adhoc = [
        {"expressionType": "SIMPLE", "subject": "country", "operator": "==",
         "comparator": "US"},
        {"expressionType": "SQL", "sqlExpression": "1 = 1"},
    ]
    assert adhoc_filters_to_query_filters(adhoc) == [
        {"col": "country", "op": "==", "val": "US"}
    ]
    assert adhoc_filters_to_query_filters([]) == []


def test_columns_prefers_groupby_and_x_axis() -> None:
    form_data = {"groupby": ["region"], "x_axis": "ds"}
    assert columns_from_form_data(form_data) == ["ds", "region"]


def test_columns_raw_mode_uses_all_columns() -> None:
    form_data = {"query_mode": "raw", "all_columns": ["a", "b"]}
    assert columns_from_form_data(form_data) == ["a", "b"]


def test_build_context_maps_groupby_metrics_and_filters() -> None:
    form_data = {
        "groupby": ["country"],
        "metrics": ["count"],
        "adhoc_filters": [
            {"expressionType": "SIMPLE", "subject": "year", "operator": ">",
             "comparator": 2000},
        ],
        "time_range": "Last year",
        "row_limit": 500,
    }

    ctx = build_query_context_from_form_data(form_data, DATASOURCE)

    assert ctx["datasource"] == DATASOURCE
    assert ctx["form_data"] == form_data
    assert len(ctx["queries"]) == 1
    query = ctx["queries"][0]
    assert query["columns"] == ["country"]
    assert query["metrics"] == ["count"]
    assert query["filters"] == [{"col": "year", "op": ">", "val": 2000}]
    assert query["time_range"] == "Last year"
    assert query["row_limit"] == 500


def test_build_context_big_number_singular_metric_and_default_time_range() -> None:
    form_data = {"metric": "sum__sales"}

    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]

    assert query["metrics"] == ["sum__sales"]
    assert query["time_range"] == "No filter"
    # No row_limit in form data → not forced into the query.
    assert "row_limit" not in query
