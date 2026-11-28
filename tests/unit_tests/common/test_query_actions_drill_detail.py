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
from collections.abc import Callable
from types import SimpleNamespace
from typing import Any, cast, TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

from superset.common.query_actions import _prepare_drill_detail_query
from superset.exceptions import QueryObjectValidationError

if TYPE_CHECKING:
    from superset.common.query_object import QueryObject


def test_prepare_drill_detail_query_refuses_datasource_that_opts_out() -> None:
    """
    A datasource with ``supports_drill_to_detail = False`` (e.g. semantic
    views) must be hard-blocked on the server. Without this gate the request
    would fall through to dataframe acquisition and fail with an opaque error, and
    the flag would only be enforced by the frontend menu — leaving the
    chart-data API endpoint accepting drill-detail requests it shouldn't.
    """
    datasource = MagicMock()
    datasource.supports_drill_to_detail = False

    query_obj = MagicMock()
    query_obj.datasource = datasource

    query_context = MagicMock()

    with pytest.raises(
        QueryObjectValidationError,
        match="Drill to detail is not available",
    ):
        _prepare_drill_detail_query(query_context, query_obj)


def test_prepare_drill_detail_query_allows_datasource_without_flag() -> None:
    """
    Datasources that don't declare the flag (e.g. legacy ``SqlaTable``
    subclasses via ``getattr`` default) must continue to work — the gate
    only fires when the flag is explicitly ``False``.
    """
    datasource = SimpleNamespace(columns=[SimpleNamespace(column_name="id")])
    query_obj = SimpleNamespace(
        columns=[],
        datasource=datasource,
        is_timeseries=True,
        metrics=["count"],
        orderby=[("name", False)],
        post_processing=[{"operation": "pivot"}],
    )
    query_context = MagicMock()

    prepared_query = _prepare_drill_detail_query(
        query_context,
        cast("QueryObject", query_obj),
    )

    assert prepared_query is not query_obj
    assert prepared_query.is_timeseries is False
    assert prepared_query.metrics is None
    assert prepared_query.post_processing == []
    assert prepared_query.columns == ["id"]
    assert prepared_query.orderby == [("id", True)]
    assert query_obj.columns == []


def _dict_column(column_name: str, column_type: str) -> dict[str, str]:
    return {"column_name": column_name, "type": column_type}


def _orm_column(column_name: str, column_type: str) -> SimpleNamespace:
    return SimpleNamespace(column_name=column_name, type=column_type)


def _prepare_for_columns(columns: list[Any]) -> "QueryObject":
    datasource = SimpleNamespace(columns=columns)
    query_obj = SimpleNamespace(
        columns=[],
        datasource=datasource,
        is_timeseries=True,
        metrics=["count"],
        orderby=[],
        post_processing=[],
    )
    return _prepare_drill_detail_query(
        MagicMock(),
        cast("QueryObject", query_obj),
    )


@pytest.mark.parametrize(
    "column_factory",
    [_dict_column, _orm_column],
    ids=["dict-columns", "orm-columns"],
)
@pytest.mark.parametrize(
    "unorderable_type",
    [
        "JSON",
        "json",
        "ARRAY<STRING>",
        "STRUCT<a INT64>",
        "GEOGRAPHY",
        "RECORD",
        "MAP<string,int>",
        "map(varchar, integer)",
        "xml",
        "XMLTYPE",
        "xmltype",
    ],
)
def test_prepare_drill_detail_query_skips_unorderable_first_column(
    column_factory: Callable[[str, str], Any],
    unorderable_type: str,
) -> None:
    """
    The drill-detail query orders by a column so paging is deterministic, but
    engines reject ``ORDER BY`` on some types (e.g. BigQuery
    ``ORDER BY does not support expressions of type JSON``). A dataset whose
    first column has such a type must not be ordered by that column.
    """
    prepared = _prepare_for_columns(
        [
            column_factory("payload", unorderable_type),
            column_factory("campaign", "STRING"),
            column_factory("clicks", "INT64"),
        ]
    )

    # every dataset column is still selected...
    assert prepared.columns == ["payload", "campaign", "clicks"]
    # ...but the unorderable column is never used for ordering
    assert "payload" not in [column for column, _ in prepared.orderby]


def test_prepare_drill_detail_query_orders_by_first_orderable_column() -> None:
    """When the first column is unorderable, a later orderable one is used."""
    prepared = _prepare_for_columns(
        [
            _dict_column("payload", "JSON"),
            _dict_column("campaign", "STRING"),
            _dict_column("clicks", "INT64"),
        ]
    )

    assert prepared.orderby == [("campaign", True)]


def test_prepare_drill_detail_query_does_not_order_when_nothing_is_orderable() -> None:
    """With no orderable column at all, ordering is dropped instead of failing."""
    prepared = _prepare_for_columns(
        [
            _dict_column("payload", "JSON"),
            _dict_column("tags", "ARRAY<STRING>"),
        ]
    )

    assert prepared.orderby == []


@pytest.mark.parametrize(
    "column_factory",
    [_dict_column, _orm_column],
    ids=["dict-columns", "orm-columns"],
)
def test_prepare_drill_detail_query_keeps_ordering_by_orderable_first_column(
    column_factory: Callable[[str, str], Any],
) -> None:
    """Datasets with an orderable first column keep ordering by that column."""
    prepared = _prepare_for_columns(
        [
            column_factory("campaign", "STRING"),
            column_factory("payload", "JSON"),
            column_factory("clicks", "INT64"),
        ]
    )

    assert prepared.orderby == [("campaign", True)]


@pytest.mark.parametrize(
    "orderable_type",
    ["STRING", "INT64", "BYTES", "BIGNUMERIC", "TIMESTAMP", "varchar(255)", None],
)
def test_prepare_drill_detail_query_treats_regular_types_as_orderable(
    orderable_type: str | None,
) -> None:
    """Regular, unknown or missing types stay eligible for ordering."""
    prepared = _prepare_for_columns(
        [{"column_name": "first", "type": orderable_type}],
    )

    assert prepared.orderby == [("first", True)]


@pytest.mark.parametrize(
    "column_factory",
    [_dict_column, _orm_column],
    ids=["dict-columns", "orm-columns"],
)
@pytest.mark.parametrize(
    "orderable_type",
    ["JSONB", "jsonb", "INTEGER[]", "text[]", "bitmap"],
)
def test_prepare_drill_detail_query_keeps_ordering_for_lookalike_orderable_types(
    column_factory: Callable[[str, str], Any],
    orderable_type: str,
) -> None:
    """
    Orderable types whose names merely contain an unorderable family name
    (e.g. ``JSONB``, array-suffixed types) must not lose ordering.
    """
    prepared = _prepare_for_columns([column_factory("payload", orderable_type)])

    assert prepared.orderby == [("payload", True)]
