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
from typing import Any, cast

from flask import current_app, g

from superset.charts.data.form_data import (
    set_form_data,
    set_query_context_form_data,
)
from superset.common.query_object import QueryObject
from superset.constants import NO_TIME_RANGE
from superset.jinja_context import ExtraCache, get_dataset_id_from_context


def _jinja_query_context(
    *,
    filters: list[dict[str, Any]] | None = None,
    time_range: str = "Last week",
    url_params: dict[str, str] | None = None,
) -> SimpleNamespace:
    """Build a QueryContext-shaped object from a real QueryObject."""
    query = QueryObject(
        filters=cast(Any, filters or [{"col": "region", "op": "IN", "val": ["North"]}]),
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
        set_query_context_form_data(cast(Any, query_context), 7, "table")
        assert_request_dependent_jinja_macros()


def test_query_context_form_data_does_not_hoist_temporal_range_filter() -> None:
    """A TEMPORAL_RANGE filter alone is not a published time range.

    Chart-data API and async workers serialize QueryObject.to_dict(), which
    omits time_range. Inventing one from filters would make get_time_filter()
    diverge from the request-body path.
    """
    query = QueryObject(
        filters=cast(
            Any,
            [
                {
                    "col": "order_date",
                    "op": "TEMPORAL_RANGE",
                    "val": "Last week",
                }
            ],
        ),
        time_range=None,
    )
    query_context = SimpleNamespace(queries=[query], form_data={})

    with current_app.test_request_context():
        set_query_context_form_data(cast(Any, query_context), 7, "table")
        assert ExtraCache().get_time_filter().time_range == NO_TIME_RANGE


def test_query_context_form_data_accepts_explicit_time_range() -> None:
    """Tabular callers overlay the range without setting QueryObject.time_range."""
    query = QueryObject(
        filters=cast(Any, [{"col": "region", "op": "IN", "val": ["North"]}]),
        time_range=None,
    )
    query_context = SimpleNamespace(queries=[query], form_data={})

    with current_app.test_request_context():
        set_query_context_form_data(
            cast(Any, query_context), 7, "table", time_range="Last week"
        )
        assert ExtraCache().get_time_filter().time_range == "Last week"


def test_one_sided_comparison_on_other_column_is_not_time_range() -> None:
    """A >= filter on a non-granularity column is not a time range."""
    query = QueryObject(
        filters=cast(
            Any,
            [{"col": "amount", "op": ">=", "val": "1966-01-01 00:00:00"}],
        ),
        time_range=None,
        granularity="ds",
    )
    query_context = SimpleNamespace(queries=[query], form_data={})

    with current_app.test_request_context():
        set_query_context_form_data(cast(Any, query_context), 7, "table")
        assert ExtraCache().get_time_filter().time_range == NO_TIME_RANGE


def test_query_context_form_data_tolerates_incomplete_query_context() -> None:
    """Unit-test doubles without form_data/to_dict must not break Jinja wiring."""
    with current_app.test_request_context():
        set_query_context_form_data(cast(Any, object()), 7, "table")
        assert g.form_data["datasource"] == {"id": 7, "type": "table"}
        assert g.form_data["queries"] == []

        set_query_context_form_data(
            cast(
                Any,
                SimpleNamespace(
                    queries=[SimpleNamespace(metrics=["count"], columns=[])]
                ),
            ),
            7,
            "table",
        )
        assert g.form_data["queries"] == []
