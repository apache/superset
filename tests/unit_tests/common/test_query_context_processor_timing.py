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
import logging
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from superset.common.query_context_processor import QueryContextProcessor


@pytest.fixture
def mock_query_obj():
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
def processor_with_cache():
    """Create a processor with a mocked cache that returns a loaded result."""
    mock_qc = MagicMock()
    mock_qc.force = False

    processor = QueryContextProcessor.__new__(QueryContextProcessor)
    processor._query_context = mock_qc
    processor._qc_datasource = MagicMock()
    processor._qc_datasource.uid = "test_uid"
    processor._qc_datasource.column_names = ["col1"]
    return processor


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
def test_timing_present_in_payload(mock_cache_cls, processor_with_cache, mock_query_obj):
    """Timing dict is included in get_df_payload() result."""
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
    mock_cache_cls.get.return_value = cache

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            with patch(
                "superset.common.query_context_processor.current_app"
            ) as mock_app:
                mock_app.config = {
                    "STATS_LOGGER": MagicMock(),
                    "CHART_DATA_SLOW_QUERY_THRESHOLD_MS": None,
                }
                result = processor_with_cache.get_df_payload(mock_query_obj)

    assert "timing" in result
    timing = result["timing"]
    assert "validate_ms" in timing
    assert "cache_lookup_ms" in timing
    assert "result_processing_ms" in timing
    assert "total_ms" in timing
    assert "is_cached" in timing


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
def test_timing_values_are_non_negative(
    mock_cache_cls, processor_with_cache, mock_query_obj
):
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
    mock_cache_cls.get.return_value = cache

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            with patch(
                "superset.common.query_context_processor.current_app"
            ) as mock_app:
                mock_app.config = {
                    "STATS_LOGGER": MagicMock(),
                    "CHART_DATA_SLOW_QUERY_THRESHOLD_MS": None,
                }
                result = processor_with_cache.get_df_payload(mock_query_obj)

    timing = result["timing"]
    for key, value in timing.items():
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            assert value >= 0, f"timing[{key!r}] should be >= 0, got {value}"


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
def test_timing_no_db_execution_on_cache_hit(
    mock_cache_cls, processor_with_cache, mock_query_obj
):
    """db_execution_ms is absent when the result is served from cache."""
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
    mock_cache_cls.get.return_value = cache

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            with patch(
                "superset.common.query_context_processor.current_app"
            ) as mock_app:
                mock_app.config = {
                    "STATS_LOGGER": MagicMock(),
                    "CHART_DATA_SLOW_QUERY_THRESHOLD_MS": None,
                }
                result = processor_with_cache.get_df_payload(mock_query_obj)

    assert "db_execution_ms" not in result["timing"]
    assert result["timing"]["is_cached"] is True


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
def test_timing_has_db_execution_on_cache_miss(
    mock_cache_cls, processor_with_cache, mock_query_obj
):
    """db_execution_ms is present when the query is executed against the database."""
    cache = MagicMock()
    cache.is_loaded = False
    cache.is_cached = False
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
    mock_cache_cls.get.return_value = cache

    processor_with_cache._qc_datasource.column_names = ["col1"]
    processor_with_cache.get_query_result = MagicMock()
    processor_with_cache.get_annotation_data = MagicMock(return_value={})

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            with patch(
                "superset.common.query_context_processor.current_app"
            ) as mock_app:
                mock_app.config = {
                    "STATS_LOGGER": MagicMock(),
                    "CHART_DATA_SLOW_QUERY_THRESHOLD_MS": None,
                }
                result = processor_with_cache.get_df_payload(mock_query_obj)

    assert "db_execution_ms" in result["timing"]
    assert result["timing"]["db_execution_ms"] >= 0


@patch(
    "superset.common.query_context_processor.QueryCacheManager",
)
@patch("superset.common.query_context_processor.logger")
def test_slow_query_logging(
    mock_logger, mock_cache_cls, processor_with_cache, mock_query_obj
):
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
    mock_cache_cls.get.return_value = cache

    with patch.object(processor_with_cache, "query_cache_key", return_value="key"):
        with patch.object(processor_with_cache, "get_cache_timeout", return_value=300):
            # Set threshold to 0 so any query triggers slow logging
            with patch(
                "superset.common.query_context_processor.current_app"
            ) as mock_app:
                mock_app.config = {
                    "STATS_LOGGER": MagicMock(),
                    "CHART_DATA_SLOW_QUERY_THRESHOLD_MS": 0,
                }
                processor_with_cache.get_df_payload(mock_query_obj)

    mock_logger.warning.assert_called_once()
    call_args = mock_logger.warning.call_args[0][0]
    assert "Slow chart query" in call_args
