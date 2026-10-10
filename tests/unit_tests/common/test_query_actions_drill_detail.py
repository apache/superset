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
from typing import cast, TYPE_CHECKING
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
