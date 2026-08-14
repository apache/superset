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

from types import SimpleNamespace
from typing import Any

from flask import current_app, g

from superset.charts.data.form_data import (
    set_form_data,
    set_query_context_form_data,
)
from superset.common.query_object import QueryObject
from superset.jinja_context import ExtraCache, get_dataset_id_from_context


def _jinja_query_context(
    *,
    filters: list[dict[str, Any]] | None = None,
    time_range: str = "Last week",
    url_params: dict[str, str] | None = None,
) -> SimpleNamespace:
    """Build a QueryContext-shaped object from a real QueryObject."""
    query = QueryObject(
        filters=filters
        or [{"col": "region", "op": "IN", "val": ["North"]}],
        time_range=time_range,
    )
    return SimpleNamespace(
        queries=[query],
        form_data={"url_params": url_params or {"tenant": "acme"}},
    )


def assert_request_dependent_jinja_macros(
    *,
    expected_filter_col: str = "region",
    expected_filter_val: str = "North",
    expected_url_param: str | None = "tenant",
    expected_url_value: str = "acme",
    expected_time_range: str | None = "Last week",
    expected_dataset_id: int = 7,
) -> None:
    """Assert Jinja macros resolve the same inputs as a chart-data API request."""
    extra_cache = ExtraCache()
    assert extra_cache.filter_values(expected_filter_col) == [expected_filter_val]
    assert extra_cache.get_filters(expected_filter_col) == [
        {"col": expected_filter_col, "op": "IN", "val": [expected_filter_val]}
    ]
    if expected_url_param is not None:
        assert extra_cache.url_param(expected_url_param) == expected_url_value
    if expected_time_range is not None:
        assert extra_cache.get_time_filter().time_range == expected_time_range
    # metric() without an explicit dataset ID performs this lookup.
    assert get_dataset_id_from_context("count") == expected_dataset_id


def test_set_form_data_exposes_payload_on_flask_global() -> None:
    """The shared helper publishes form data for request-independent queries."""
    payload: dict[str, Any] = {"queries": [{"filters": []}]}

    with current_app.test_request_context():
        set_form_data(payload)

        assert g.form_data is payload


def test_query_context_form_data_supports_request_dependent_jinja_macros() -> None:
    """Chart queries expose filters, URL parameters, and the datasource to Jinja."""
    query_context = _jinja_query_context()

    with current_app.test_request_context():
        set_query_context_form_data(query_context, 7, "table")
        assert_request_dependent_jinja_macros()
