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
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from superset.common.db_query_status import QueryStatus
from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import BaseDatasource, SqlaTable
from superset.exceptions import QueryObjectValidationError
from superset.models.helpers import ExploreMixin, QueryResult, QueryStringExtended
from superset.superset_typing import QueryObjectDict


def test_empty_series_limit_result_produces_false_predicate() -> None:
    datasource = ExploreMixin()

    predicate = datasource._get_top_groups(
        pd.DataFrame(),
        dimensions=[],
        groupby_exprs={},
        columns_by_name={},
    )

    assert str(predicate) == "false"


def test_extra_cache_key_rendering_defers_source_queries() -> None:
    datasource = SqlaTable(table_name="dataset", database=MagicMock())
    sqla_query = MagicMock(extra_cache_keys=["user-key"])
    query: QueryObjectDict = {
        "columns": ["region"],
        "metrics": ["sales"],
        "extras": {},
    }

    with (
        patch.object(BaseDatasource, "get_extra_cache_keys", return_value=[]),
        patch.object(datasource, "has_extra_cache_key_calls", return_value=True),
        patch.object(
            datasource, "get_sqla_query", return_value=sqla_query
        ) as get_sqla_query,
    ):
        result = datasource.get_extra_cache_keys(query)

    assert result == ["user-key"]
    assert get_sqla_query.call_args.kwargs["defer_source_queries"] is True


def test_extra_cache_key_deduplication_supports_unhashable_values() -> None:
    datasource = SqlaTable(table_name="dataset", database=MagicMock())
    sqla_query = MagicMock(
        extra_cache_keys=[
            ["tenant", 7],
            {"tenant": 7, "roles": ["alpha"]},
            ["tenant", 7],
            {"roles": ["alpha"], "tenant": 7},
        ]
    )
    query: QueryObjectDict = {
        "columns": ["region"],
        "metrics": ["sales"],
        "extras": {},
    }

    with (
        patch.object(BaseDatasource, "get_extra_cache_keys", return_value=[]),
        patch.object(datasource, "has_extra_cache_key_calls", return_value=True),
        patch.object(datasource, "get_sqla_query", return_value=sqla_query),
    ):
        result = datasource.get_extra_cache_keys(query)

    assert result == [
        ["tenant", 7],
        {"tenant": 7, "roles": ["alpha"]},
    ]


def test_query_preview_returns_prequeries_and_executable_main_query() -> None:
    datasource = ExploreMixin()
    query: QueryObjectDict = {"columns": ["region"], "metrics": ["sales"]}
    compiled = QueryStringExtended(
        applied_template_filters=[],
        applied_filter_columns=[],
        rejected_filter_columns=[],
        labels_expected=[],
        prequeries=["SELECT top_groups"],
        sql="SELECT main_query",
    )

    with patch.object(
        datasource,
        "get_query_str_extended",
        return_value=compiled,
    ) as get_query_str_extended:
        result = datasource.get_query_str(query)

    assert result == "SELECT top_groups;\n\nSELECT main_query;"
    get_query_str_extended.assert_called_once_with(query)


def test_failed_time_offset_query_is_not_converted_to_nan() -> None:
    datasource = MagicMock()
    datasource.processing_time_offsets = ExploreMixin.processing_time_offsets.__get__(
        datasource
    )
    datasource.is_valid_date_range.return_value = False
    datasource.is_valid_date.return_value = False
    datasource.get_time_grain.return_value = None
    datasource._get_temporal_column_for_filter.return_value = "ds"
    datasource.query.return_value = QueryResult(
        df=pd.DataFrame(),
        query="SELECT failed",
        duration=timedelta(),
        status=QueryStatus.FAILED,
        error_message="offset failed",
    )
    query = QueryObject(
        datasource=datasource,
        columns=["ds"],
        metrics=["metric"],
        filters=[],
        from_dttm=datetime(2024, 1, 1),
        to_dttm=datetime(2024, 1, 2),
        time_range="2024-01-01 : 2024-01-02",
        time_offsets=["1 day ago"],
    )
    dataframe = pd.DataFrame({"ds": pd.to_datetime(["2024-01-01"]), "metric": [1]})

    with patch(
        "superset.common.utils.query_cache_manager.QueryCacheManager.get"
    ) as cache_get:
        cache_get.return_value.is_loaded = False
        with pytest.raises(QueryObjectValidationError, match="offset failed"):
            datasource.processing_time_offsets(dataframe, query)
