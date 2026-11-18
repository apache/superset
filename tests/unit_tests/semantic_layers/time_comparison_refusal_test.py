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

"""Refuse unsupported comparisons before cached or fresh results can escape."""

from datetime import datetime
from unittest.mock import MagicMock

import pandas as pd
import pyarrow as pa
import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import Dimension
from werkzeug.test import TestResponse

from superset.common.query_context import QueryContext
from superset.common.query_context_processor import QueryContextProcessor
from superset.common.query_object import QueryObject
from superset.semantic_layers.exceptions import SemanticLayerQueryRejectedError
from superset.semantic_layers.mapper import get_results
from superset.semantic_layers.models import SemanticView
from tests.unit_tests.semantic_layers.query_errors_test import date_view  # noqa: F401

MESSAGE: str = (
    "Time comparison is not yet supported on semantic views. Remove the time shift "
    "and try again."
)


@pytest.mark.parametrize("offset", ["1 year ago", "inherit", "2025-12-01"])
@pytest.mark.parametrize("provider_shape", ["snowflake", "metricflow"])
@pytest.mark.parametrize("async_mode", [False, True])
def test_time_comparison_refused_before_cache_and_provider(
    client: FlaskClient,
    full_api_access: None,
    date_view: MagicMock,  # noqa: F811 - shared pytest fixture imported above
    mocker: MockerFixture,
    offset: str,
    provider_shape: str,
    async_mode: bool,
) -> None:
    """Even a warm result cache cannot serve a saved comparison query."""
    mocker.stop(QueryContext.raise_for_access)
    mocker.patch(
        "superset.common.query_context_processor.security_manager.raise_for_access"
    )
    if provider_shape == "metricflow":
        date_view.get_dimensions.return_value = {
            Dimension("metric_time", "metric_time", pa.timestamp("ms", tz="UTC"))
        }
    column: str = "metric_time" if provider_shape == "metricflow" else "ORDER_DATE"
    cache_read: MagicMock = mocker.patch(
        "superset.common.query_context_processor.QueryContextProcessor._read_result_cache"
    )
    cache_read.return_value.is_loaded = True
    mocker.patch(
        "superset.charts.data.api.ChartDataRestApi._should_run_async",
        return_value=async_mode,
    )
    async_run: MagicMock = mocker.patch(
        "superset.charts.data.api.ChartDataRestApi._run_async",
        return_value=("scheduled", 202),
    )
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [
                {
                    "columns": [column],
                    "metrics": ["ORDER_COUNT"],
                    "time_range": "2026-01-01 : 2026-01-03",
                    "granularity": column,
                    "time_offsets": [offset],
                }
            ],
            "result_format": "json",
            "result_type": "full",
            "force": async_mode,
        },
    )
    cache_read.assert_not_called()
    async_run.assert_not_called()
    assert response.status_code == 400
    assert MESSAGE in response.get_data(as_text=True)
    date_view.get_table.assert_not_called()
    date_view.get_row_count.assert_not_called()


@pytest.mark.parametrize("offset", ["1 year ago", "inherit", "2025-12-01"])
@pytest.mark.parametrize("overlap", [False, True])
def test_direct_mapper_refuses_before_discovery(
    date_view: MagicMock,  # noqa: F811 - shared pytest fixture imported above
    offset: str,
    overlap: bool,
) -> None:
    """The assessment's disjoint/overlap and special-offset cases are refused."""
    query: QueryObject = QueryObject(
        datasource=SemanticView(id=7, name="Orders"),
        columns=["ORDER_DATE"],
        metrics=["ORDER_COUNT"],
        from_dttm=datetime(2025 if overlap else 2026, 1, 1),
        to_dttm=datetime(2027, 1, 1),
        time_offsets=[offset],
    )
    with pytest.raises(SemanticLayerQueryRejectedError, match=MESSAGE):
        get_results(query)
    date_view.get_dimensions.assert_not_called()
    date_view.get_table.assert_not_called()


def test_sql_dataset_time_comparison_remains_valid(mocker: MockerFixture) -> None:
    """The launch refusal must not disable SQL-dataset comparisons."""
    datasource: MagicMock = mocker.Mock(type="table")
    query: QueryObject = QueryObject(
        datasource=datasource, metrics=["count"], time_offsets=["1 year ago"]
    )
    assert query.validate() is None


@pytest.mark.parametrize("offset", ["1 year ago", "inherit", "2025-12-01"])
def test_query_validation_refuses_time_comparison(
    date_view: MagicMock,  # noqa: F811 - shared pytest fixture imported above
    offset: str,
) -> None:
    """The shared validator refuses before discovery, independently of commands."""
    query: QueryObject = QueryObject(
        datasource=SemanticView(id=7, name="Orders"),
        metrics=["ORDER_COUNT"],
        time_offsets=[offset],
    )
    with pytest.raises(SemanticLayerQueryRejectedError, match=MESSAGE):
        query.validate()
    date_view.get_table.assert_not_called()


def test_semantic_query_without_offsets_remains_valid(
    date_view: MagicMock,  # noqa: F811 - shared pytest fixture imported above
) -> None:
    """An ordinary semantic query still passes the complete validator."""
    query: QueryObject = QueryObject(
        datasource=SemanticView(id=7, name="Orders"), metrics=["ORDER_COUNT"]
    )
    assert query.validate() is None
    date_view.get_table.assert_not_called()


def test_processor_refuses_time_comparison_before_warm_cache(
    date_view: MagicMock,  # noqa: F811 - shared pytest fixture imported above
    mocker: MockerFixture,
) -> None:
    """Direct processor callers cannot bypass refusal with cached wrong results."""
    view: SemanticView = SemanticView(id=7, name="Orders")
    query: QueryObject = QueryObject(
        datasource=view, metrics=["ORDER_COUNT"], time_offsets=["1 year ago"]
    )
    processor: QueryContextProcessor = QueryContextProcessor(
        MagicMock(datasource=view, force=False, force_nonce=None)
    )
    mocker.patch.object(processor, "get_cache_timeout", return_value=60)
    mocker.patch(
        "superset.common.query_context_processor.QueryCacheManager.reads_backend",
        return_value=True,
    )
    cache_read: MagicMock = mocker.patch.object(
        processor,
        "_read_result_cache",
        return_value=MagicMock(
            is_loaded=True,
            is_cached=True,
            bq_memory_limited=False,
            df=pd.DataFrame({"ORDER_COUNT": [999]}),
        ),
    )
    with pytest.raises(SemanticLayerQueryRejectedError, match=MESSAGE):
        processor.get_df_payload_result(query, force_cached=True)
    cache_read.assert_not_called()
    date_view.get_table.assert_not_called()
