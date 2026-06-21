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
from typing import Any, cast
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.commands.chart.exceptions import ChartDataQueryFailedError
from superset.common.chart_data import ChartDataResultType
from superset.common.chart_data_timing import (
    finalize_timing_payload,
    RESULT_PROCESSING_START_KEY,
    TIMING_KEY,
    TIMING_START_KEY,
)
from superset.common.db_query_status import QueryStatus
from superset.common.query_actions import _get_full
from superset.common.query_context_processor import QueryContextProcessor


@pytest.fixture
def mock_query_obj() -> MagicMock:
    query_obj = MagicMock()
    query_obj.columns = ["col1"]
    query_obj.column_names = ["col1"]
    query_obj.metrics = []
    query_obj.metric_names = []
    query_obj.from_dttm = None
    query_obj.to_dttm = None
    query_obj.annotation_layers = []
    return query_obj


@pytest.fixture
def processor_with_cache() -> QueryContextProcessor:
    """Create a processor with a mocked cache that returns a loaded result."""
    mock_qc = MagicMock()
    mock_qc.force = False

    processor = QueryContextProcessor.__new__(QueryContextProcessor)
    processor._query_context = mock_qc
    processor._qc_datasource = MagicMock()
    processor._qc_datasource.uid = "test_uid"
    processor._qc_datasource.column_names = ["col1"]
    return processor


def finalize_payload(
    payload: dict[str, Any],
    include_timing: bool = True,
    slow_query_threshold_ms: int | None = None,
) -> None:
    with patch("superset.common.chart_data_timing.current_app") as mock_app:
        mock_app.config = {
            "STATS_LOGGER": MagicMock(),
            "CHART_DATA_INCLUDE_TIMING": include_timing,
            "CHART_DATA_SLOW_QUERY_THRESHOLD_MS": slow_query_threshold_ms,
        }
        finalize_timing_payload(payload)


def internal_timing(is_cached: bool = False) -> dict[str, Any]:
    return {
        TIMING_START_KEY: 1.0,
        RESULT_PROCESSING_START_KEY: 2.0,
        "validate_ms": 1.0,
        "cache_lookup_ms": 2.0,
        "db_execution_ms": None,
        "is_cached": is_cached,
    }


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
def test_timing_present_in_payload(
    mock_cache_cls: MagicMock,
    processor_with_cache: QueryContextProcessor,
    mock_query_obj: MagicMock,
) -> None:
    """Timing dict is included in finalized query result."""
    cache = MagicMock()
    cache.is_loaded = True
    cache.is_cached = True
    cache.df = pd.DataFrame({"col1": [1, 2]})
    cache.cache_dttm = None
    cache.queried_dttm = None
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = None
    cache.query = ""
    cache.status = "success"
    cache.stacktrace = None
    cache.sql_rowcount = 2
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0
    mock_cache_cls.get.return_value = cache

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            result = processor_with_cache.get_df_payload(mock_query_obj)

    finalize_payload(result)
    assert "timing" in result
    assert TIMING_KEY not in result
    timing = result["timing"]
    assert "validate_ms" in timing
    assert "cache_lookup_ms" in timing
    assert "result_processing_ms" in timing
    assert "total_ms" in timing
    assert "is_cached" in timing


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
def test_timing_omitted_when_config_disabled(
    mock_cache_cls: MagicMock,
    processor_with_cache: QueryContextProcessor,
    mock_query_obj: MagicMock,
) -> None:
    """Timing dict is excluded from response when CHART_DATA_INCLUDE_TIMING is False."""
    cache = MagicMock()
    cache.is_loaded = True
    cache.is_cached = True
    cache.df = pd.DataFrame({"col1": [1]})
    cache.cache_dttm = None
    cache.queried_dttm = None
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = None
    cache.query = ""
    cache.status = "success"
    cache.stacktrace = None
    cache.sql_rowcount = 1
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0
    mock_cache_cls.get.return_value = cache

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            result = processor_with_cache.get_df_payload(mock_query_obj)

    finalize_payload(result, include_timing=False)
    assert "timing" not in result
    assert TIMING_KEY not in result


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
def test_timing_values_are_non_negative(
    mock_cache_cls: MagicMock,
    processor_with_cache: QueryContextProcessor,
    mock_query_obj: MagicMock,
) -> None:
    """All timing values are non-negative numbers."""
    cache = MagicMock()
    cache.is_loaded = True
    cache.is_cached = True
    cache.df = pd.DataFrame({"col1": [1]})
    cache.cache_dttm = None
    cache.queried_dttm = None
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = None
    cache.query = ""
    cache.status = "success"
    cache.stacktrace = None
    cache.sql_rowcount = 1
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0
    mock_cache_cls.get.return_value = cache

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            result = processor_with_cache.get_df_payload(mock_query_obj)

    finalize_payload(result)
    timing = result["timing"]
    for key, value in timing.items():
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            assert value >= 0, f"timing[{key!r}] should be >= 0, got {value}"


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
def test_timing_no_db_execution_on_cache_hit(
    mock_cache_cls: MagicMock,
    processor_with_cache: QueryContextProcessor,
    mock_query_obj: MagicMock,
) -> None:
    """db_execution_ms is None when the result is served from cache."""
    cache = MagicMock()
    cache.is_loaded = True
    cache.is_cached = True
    cache.df = pd.DataFrame({"col1": [1]})
    cache.cache_dttm = None
    cache.queried_dttm = None
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = None
    cache.query = ""
    cache.status = "success"
    cache.stacktrace = None
    cache.sql_rowcount = 1
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0
    mock_cache_cls.get.return_value = cache

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            result = processor_with_cache.get_df_payload(mock_query_obj)

    finalize_payload(result)
    assert result["timing"]["db_execution_ms"] is None
    assert result["timing"]["is_cached"] is True


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
def test_timing_has_db_execution_on_cache_miss(
    mock_cache_cls: MagicMock,
    processor_with_cache: QueryContextProcessor,
    mock_query_obj: MagicMock,
) -> None:
    """db_execution_ms is present when the query is executed against the database."""
    cache = MagicMock()
    cache.is_loaded = False
    cache.is_cached = None
    cache.df = pd.DataFrame({"col1": [1]})
    cache.cache_dttm = None
    cache.queried_dttm = None
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = None
    cache.query = ""
    cache.status = "success"
    cache.stacktrace = None
    cache.sql_rowcount = 1
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0
    mock_cache_cls.get.return_value = cache

    processor = cast(Any, processor_with_cache)
    processor._qc_datasource.column_names = ["col1"]
    processor.get_query_result = MagicMock()
    processor.get_annotation_data = MagicMock(return_value={})

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            result = processor_with_cache.get_df_payload(mock_query_obj)

    finalize_payload(result)
    assert "db_execution_ms" in result["timing"]
    assert result["timing"]["db_execution_ms"] >= 0
    assert result["is_cached"] is None
    assert result["timing"]["is_cached"] is False


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
def test_timing_treats_invalidated_stale_cache_as_miss(
    mock_cache_cls: MagicMock,
    processor_with_cache: QueryContextProcessor,
    mock_query_obj: MagicMock,
) -> None:
    """A stale cached payload reloaded from source should not report a cache hit."""
    cache = MagicMock()
    cache.is_loaded = True
    cache.is_cached = True
    cache.df = pd.DataFrame({"col1": [1]})
    cache.cache_dttm = "2024-01-01T00:00:00"
    cache.queried_dttm = "2024-01-01T00:00:00"
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = None
    cache.query = ""
    cache.status = "success"
    cache.stacktrace = None
    cache.sql_rowcount = 1
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0
    mock_cache_cls.get.return_value = cache

    mock_query_obj.filter = [{"col": "col1", "op": "IN", "val": ["value1"]}]
    processor = cast(Any, processor_with_cache)
    processor._qc_datasource.column_names = ["col1"]
    processor.get_query_result = MagicMock()
    processor.get_annotation_data = MagicMock(return_value={})

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            result = processor_with_cache.get_df_payload(mock_query_obj)

    finalize_payload(result)
    assert cache.set_query_result.called
    assert result["cached_dttm"] is None
    assert result["is_cached"] is None
    assert result["timing"]["db_execution_ms"] is not None
    assert result["timing"]["is_cached"] is False


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
@patch("superset.common.chart_data_timing.logger")
def test_slow_query_logging(
    mock_logger: MagicMock,
    mock_cache_cls: MagicMock,
    processor_with_cache: QueryContextProcessor,
    mock_query_obj: MagicMock,
) -> None:
    """WARNING log is emitted when total_ms exceeds the configured threshold."""
    cache = MagicMock()
    cache.is_loaded = True
    cache.is_cached = True
    cache.df = pd.DataFrame({"col1": [1]})
    cache.cache_dttm = None
    cache.queried_dttm = None
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = None
    cache.query = ""
    cache.status = "success"
    cache.stacktrace = None
    cache.sql_rowcount = 1
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0
    mock_cache_cls.get.return_value = cache

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            result = processor_with_cache.get_df_payload(mock_query_obj)

    # Set threshold to 0 so any query triggers slow logging.
    finalize_payload(result, slow_query_threshold_ms=0)

    mock_logger.warning.assert_called_once()
    call_args = mock_logger.warning.call_args[0]
    assert "Slow chart query" in call_args[0]
    # On cache hit, db_execution should be "cached" not a number
    assert "cached" in call_args


def results_payload() -> dict[str, Any]:
    """Build the minimal successful get_df_payload result used by RESULTS tests."""
    return {
        "df": pd.DataFrame({"col1": [1]}),
        "status": QueryStatus.SUCCESS,
        "rowcount": 1,
        "sql_rowcount": 1,
        "applied_filter_columns": [],
        "rejected_filter_columns": [],
    }


def test_results_payload_omits_timing_when_disabled() -> None:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.RESULTS
    query_context.result_format = "json"
    query_context.get_df_payload.return_value = {
        **results_payload(),
        TIMING_KEY: internal_timing(),
    }
    query_context.get_data.return_value = [{"col1": 1}]

    query_obj = MagicMock()
    query_obj.result_type = ChartDataResultType.RESULTS
    query_obj.applied_time_extras = {}

    with (
        patch(
            "superset.common.query_actions.extract_dataframe_dtypes", return_value=[0]
        ),
        patch(
            "superset.common.query_actions.get_time_filter_status",
            return_value=([], []),
        ),
        patch("superset.common.query_actions._detect_currency", return_value=None),
    ):
        result = _get_full(query_context, query_obj)

    with patch("superset.common.chart_data_timing.time.perf_counter", return_value=3.0):
        finalize_payload(result, include_timing=False)

    assert "timing" not in result
    assert TIMING_KEY not in result


def test_results_payload_finalizes_timing_when_enabled() -> None:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.RESULTS
    query_context.result_format = "json"
    query_context.get_df_payload.return_value = {
        **results_payload(),
        TIMING_KEY: internal_timing(is_cached=True),
        "is_cached": True,
    }
    query_context.get_data.return_value = [{"col1": 1}]

    query_obj = MagicMock()
    query_obj.result_type = ChartDataResultType.RESULTS
    query_obj.applied_time_extras = {}

    with (
        patch(
            "superset.common.query_actions.extract_dataframe_dtypes", return_value=[0]
        ),
        patch(
            "superset.common.query_actions.get_time_filter_status",
            return_value=([], []),
        ),
        patch("superset.common.query_actions._detect_currency", return_value=None),
    ):
        result = _get_full(query_context, query_obj)

    with patch("superset.common.chart_data_timing.time.perf_counter", return_value=3.0):
        finalize_payload(result)

    assert TIMING_KEY not in result
    assert result["timing"]["validate_ms"] == 1.0
    assert result["timing"]["cache_lookup_ms"] == 2.0
    assert result["timing"]["db_execution_ms"] is None
    assert result["timing"]["result_processing_ms"] == 1000.0
    assert result["timing"]["total_ms"] == 2000.0
    assert result["timing"]["is_cached"] is True


def test_chart_data_command_finalizes_timing_by_default() -> None:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.get_payload.return_value = {
        "queries": [
            {
                TIMING_KEY: internal_timing(is_cached=True),
                "is_cached": True,
            },
        ],
    }

    command = ChartDataCommand(query_context)

    with (
        patch("superset.common.chart_data_timing.time.perf_counter", return_value=3.0),
        patch("superset.common.chart_data_timing.current_app") as mock_app,
    ):
        mock_app.config = {
            "STATS_LOGGER": MagicMock(),
            "CHART_DATA_INCLUDE_TIMING": True,
            "CHART_DATA_SLOW_QUERY_THRESHOLD_MS": None,
        }
        result = command.run()

    query = result["queries"][0]
    assert TIMING_KEY not in query
    assert query["timing"]["result_processing_ms"] == 1000.0
    assert query["timing"]["total_ms"] == 2000.0
    assert query["timing"]["is_cached"] is True


def test_chart_data_command_can_defer_timing_finalization() -> None:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.POST_PROCESSED
    query_context.get_payload.return_value = {
        "queries": [
            {
                TIMING_KEY: internal_timing(),
                "is_cached": True,
            },
        ],
    }

    command = ChartDataCommand(query_context)
    result = command.run(defer_timing=True)

    query = result["queries"][0]
    assert TIMING_KEY in query
    assert "timing" not in query


def test_chart_data_command_finalizes_timing_before_raising_when_deferred() -> None:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.get_payload.return_value = {
        "queries": [
            {
                TIMING_KEY: internal_timing(),
                "error": "bad query",
                "is_cached": None,
            },
        ],
    }

    command = ChartDataCommand(query_context)

    with (
        patch("superset.common.chart_data_timing.time.perf_counter", return_value=3.0),
        patch("superset.common.chart_data_timing.current_app") as mock_app,
    ):
        mock_app.config = {
            "STATS_LOGGER": MagicMock(),
            "CHART_DATA_INCLUDE_TIMING": True,
            "CHART_DATA_SLOW_QUERY_THRESHOLD_MS": None,
        }
        with pytest.raises(ChartDataQueryFailedError):
            command.run(defer_timing=True)

    query = query_context.get_payload.return_value["queries"][0]
    assert TIMING_KEY not in query
    assert query["timing"]["is_cached"] is False
