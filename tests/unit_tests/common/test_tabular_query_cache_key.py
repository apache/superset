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
"""Cache-key coverage for a time range carried only by a TEMPORAL_RANGE filter."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import Mock

from superset.common.chart_data import ChartDataResultType
from superset.common.query_context_factory import (
    create_query_object_factory,
    QueryContextFactory,
)
from superset.common.query_object import QueryObject
from superset.common.tabular_query import build_query_dict

RANGE_A = "1965-01-01 : 1968-01-01"
RANGE_B = "1966-01-01 : 1967-01-01"


def _datasource() -> Mock:
    column = Mock()
    column.column_name = "ds"
    column.is_dttm = True
    datasource = Mock()
    datasource.columns = [column]
    datasource.main_dttm_col = "ds"
    datasource.uid = "1__table"
    # Skips the impersonation key, which needs a real Database.
    datasource.database = None
    return datasource


def _query_object(time_range: str, as_expression: bool = False) -> QueryObject:
    """Build the query object the datasource query endpoint produces.

    ``as_expression`` additionally sets ``time_range``, as the frontend does.
    """
    datasource = _datasource()
    query_dict = build_query_dict(
        metrics=["count"],
        time_column="ds",
        time_range=time_range,
        order_desc=True,
    )
    if as_expression:
        query_dict["time_range"] = time_range
    query_object = create_query_object_factory().create(
        ChartDataResultType.FULL,
        datasource_model_instance=datasource,
        **query_dict,
    )
    QueryContextFactory()._apply_granularity(query_object, {}, datasource)
    return query_object


def _cache_key(time_range: str, as_expression: bool = False) -> str:
    return _query_object(time_range, as_expression).cache_key(
        datasource="1__table",
        extra_cache_keys=[],
        rls=None,
        changed_on=None,
    )


def test_time_range_resolves_to_bounds(app_context: None) -> None:
    """The range reaches the query, so the SQL itself is correct."""
    query_object = _query_object(RANGE_A)

    assert (str(query_object.from_dttm), str(query_object.to_dttm)) == (
        "1965-01-01 00:00:00",
        "1968-01-01 00:00:00",
    )


def test_granularity_drops_the_temporal_filter(app_context: None) -> None:
    """``_apply_granularity`` removes the filter that carried the range."""
    query_object = _query_object(RANGE_A)

    assert [f for f in query_object.filter if f["op"] == "TEMPORAL_RANGE"] == []


def test_distinct_time_ranges_get_distinct_cache_keys(app_context: None) -> None:
    assert _cache_key(RANGE_A) != _cache_key(RANGE_B)


def test_time_range_expression_ignores_resolved_bounds(app_context: None) -> None:
    """With ``time_range`` set, moving the bounds leaves the key alone.

    That is what keeps a relative range on one key as its bounds advance.
    """
    keys = []
    for year in (1970, 1975):
        query_object = _query_object(RANGE_A, as_expression=True)
        query_object.from_dttm = datetime(year, 1, 1)
        keys.append(
            query_object.cache_key(
                datasource="1__table",
                extra_cache_keys=[],
                rls=None,
                changed_on=None,
            )
        )

    assert keys[0] == keys[1]
