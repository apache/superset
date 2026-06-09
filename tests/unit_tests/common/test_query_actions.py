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
"""Unit tests for superset.common.query_actions."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from superset.common import query_actions


def _make_query_obj(orderby: list) -> SimpleNamespace:
    """A minimal stand-in for QueryObject (so copy.copy behaves predictably)."""
    return SimpleNamespace(
        orderby=orderby,
        is_timeseries=True,
        metrics=["a_metric"],
        post_processing=["an_op"],
        columns=[],
    )


def _make_datasource(column_names: list[str]) -> SimpleNamespace:
    return SimpleNamespace(
        columns=[SimpleNamespace(column_name=name) for name in column_names]
    )


@patch("superset.common.query_actions._get_full")
@patch("superset.common.query_actions._get_datasource")
def test_get_drill_detail_preserves_supplied_orderby(
    mock_get_datasource: MagicMock,
    mock_get_full: MagicMock,
) -> None:
    """A caller-supplied orderby (e.g. column-header sort) must be preserved."""
    mock_get_datasource.return_value = _make_datasource(["order_date", "sales"])
    query_obj = _make_query_obj([("sales", False)])

    query_actions._get_drill_detail(MagicMock(), query_obj, force_cached=False)

    # _get_full(query_context, query_obj, force_cached) -> inspect the query_obj.
    passed_query_obj = mock_get_full.call_args.args[1]
    assert passed_query_obj.orderby == [("sales", False)]


@patch("superset.common.query_actions._get_full")
@patch("superset.common.query_actions._get_datasource")
def test_get_drill_detail_defaults_orderby_to_first_column(
    mock_get_datasource: MagicMock,
    mock_get_full: MagicMock,
) -> None:
    """With no orderby supplied, it falls back to the first column ascending."""
    mock_get_datasource.return_value = _make_datasource(["order_date", "sales"])
    query_obj = _make_query_obj([])

    query_actions._get_drill_detail(MagicMock(), query_obj, force_cached=False)

    passed_query_obj = mock_get_full.call_args.args[1]
    assert passed_query_obj.orderby == [("order_date", True)]
