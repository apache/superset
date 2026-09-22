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
from typing import cast
from unittest.mock import MagicMock, patch

import pytest

from superset.common import query_actions
from superset.common.chart_data import ChartDataResultType
from superset.common.chart_data_timing import (
    QueryAcquisitionResult,
    QueryAcquisitionTiming,
)
from superset.common.db_query_status import QueryStatus
from superset.common.query_actions import (
    _prepare_drill_detail_query,
    _prepare_samples_query,
    get_query_results,
    get_query_results_with_timing,
)
from superset.common.query_object import QueryObject
from superset.exceptions import QueryObjectValidationError
from superset.utils.core import QueryObjectFilterClause


def test_prepare_drill_detail_query_does_not_strip_filters() -> None:
    """Drill preparation keeps filters while rewriting the row query shape."""
    applied_filter: QueryObjectFilterClause = {
        "col": "region",
        "op": "==",
        "val": "USA",
    }
    query_obj = QueryObject(
        columns=["region", "sales"],
        metrics=["count"],
        filters=[applied_filter],
    )

    datasource = MagicMock()
    datasource.columns = [
        MagicMock(column_name="region"),
        MagicMock(column_name="sales"),
    ]
    query_context = MagicMock()
    query_context.datasource = datasource

    prepared = _prepare_drill_detail_query(query_context, query_obj)

    assert applied_filter in prepared.filter


def test_prepare_samples_query_marks_query_as_system_sampling() -> None:
    """Sample preparation is isolated from the caller's query object."""
    query_obj = QueryObject(columns=["region"], metrics=["count"])
    original_extras = query_obj.extras
    datasource = MagicMock()
    datasource.columns = [MagicMock(column_name="region")]
    query_context = MagicMock()
    query_context.datasource = datasource

    prepared = _prepare_samples_query(query_context, query_obj)

    assert prepared.extras.get("system_sampling") is True
    assert "system_sampling" not in query_obj.extras
    assert query_obj.extras is original_extras


def test_timed_dataframe_result_uses_sidecar_and_continuous_total() -> None:
    query_context = MagicMock()
    query_obj = MagicMock()
    acquisition_timing = QueryAcquisitionTiming(
        query_planning_ns=1,
        cache_resolution_ns=2,
        data_acquisition_ns=3,
        payload_assembly_ns=4,
    )
    query_context.get_df_payload_result.return_value = QueryAcquisitionResult(
        payload={"df": "frame"},
        timing=acquisition_timing,
    )

    with (
        patch(
            "superset.common.query_actions._materialize_full_payload",
            return_value={"data": [{"col1": 1}]},
        ) as materialize_full_payload,
        patch(
            "superset.common.query_actions.time.perf_counter_ns",
            side_effect=[100, 110, 120, 150],
        ),
    ):
        result = get_query_results_with_timing(
            ChartDataResultType.FULL,
            query_context,
            query_obj,
            force_cached=False,
        )

    query_context.get_df_payload_result.assert_called_once_with(
        query_obj,
        force_cached=False,
    )
    query_context.get_df_payload.assert_not_called()
    materialize_full_payload.assert_called_once_with(
        query_context,
        query_obj,
        {"df": "frame"},
    )
    assert result.payload == {"data": [{"col1": 1}]}
    assert result.timing.query_planning_ns == 1
    assert result.timing.cache_resolution_ns == 2
    assert result.timing.data_acquisition_ns == 3
    assert result.timing.payload_assembly_ns == 14
    assert result.timing.total_ns == 50


def test_metadata_result_has_null_phases_and_numeric_total() -> None:
    query_context = MagicMock()
    query_obj = MagicMock()
    result_func = MagicMock(return_value={"language": "sql", "query": "SELECT 1"})

    with (
        patch.dict(
            "superset.common.query_actions._metadata_result_type_functions",
            {ChartDataResultType.QUERY: result_func},
            clear=True,
        ),
        patch(
            "superset.common.query_actions.time.perf_counter_ns",
            side_effect=[100, 125],
        ),
    ):
        result = get_query_results_with_timing(
            ChartDataResultType.QUERY,
            query_context,
            query_obj,
            force_cached=True,
        )

    result_func.assert_called_once_with(query_context, query_obj, True)
    assert result.payload == {"language": "sql", "query": "SELECT 1"}
    assert result.timing.query_planning_ns is None
    assert result.timing.cache_resolution_ns is None
    assert result.timing.data_acquisition_ns is None
    assert result.timing.payload_assembly_ns is None
    assert result.timing.total_ns == 25


def test_result_type_dispatchers_are_complete_and_disjoint() -> None:
    """Every result type is owned by exactly one timing execution path."""
    metadata_types = set(query_actions._metadata_result_type_functions)
    data_types = set(query_actions._data_result_type_preparers)

    assert metadata_types.isdisjoint(data_types)
    assert metadata_types | data_types == set(ChartDataResultType)


def test_timed_result_refuses_a_result_type_without_a_dispatch_owner() -> None:
    with pytest.raises(QueryObjectValidationError, match="Invalid result type"):
        get_query_results_with_timing(
            cast("ChartDataResultType", "unowned"),
            MagicMock(),
            MagicMock(),
            force_cached=False,
        )


@pytest.mark.parametrize(
    "result_type",
    [ChartDataResultType.SAMPLES, ChartDataResultType.DRILL_DETAIL],
)
def test_data_preparation_is_inside_the_continuous_total(
    result_type: ChartDataResultType,
) -> None:
    query_context = MagicMock()
    query_obj = MagicMock()
    preparation_started_ns: list[int] = []
    acquisition_timing = QueryAcquisitionTiming(
        query_planning_ns=1,
        cache_resolution_ns=2,
        data_acquisition_ns=3,
        payload_assembly_ns=4,
    )

    def preparer(_query_context: MagicMock, prepared_query: MagicMock) -> MagicMock:
        preparation_started_ns.append(query_actions.time.perf_counter_ns())
        return prepared_query

    with (
        patch.dict(
            "superset.common.query_actions._data_result_type_preparers",
            {result_type: preparer},
        ),
        patch(
            "superset.common.query_actions._get_full_with_timing",
            return_value=(
                {"data": []},
                acquisition_timing,
                5,
            ),
        ),
        patch(
            "superset.common.query_actions.time.perf_counter_ns",
            side_effect=[100, 125, 150],
        ),
    ):
        result = get_query_results_with_timing(
            result_type,
            query_context,
            query_obj,
            force_cached=False,
        )

    assert preparation_started_ns == [125]
    assert result.timing.total_ns == 50


def test_timed_drill_detail_keeps_capability_refusal() -> None:
    query_context = MagicMock()
    query_context.datasource = MagicMock(supports_drill_to_detail=False)
    query_obj = MagicMock()
    query_obj.datasource = None

    with pytest.raises(QueryObjectValidationError):
        get_query_results_with_timing(
            ChartDataResultType.DRILL_DETAIL,
            query_context,
            query_obj,
            force_cached=False,
        )


def test_legacy_result_wrapper_keeps_drill_detail_capability_refusal() -> None:
    query_context = MagicMock()
    query_context.datasource = MagicMock(supports_drill_to_detail=False)
    query_obj = MagicMock()
    query_obj.datasource = None

    with pytest.raises(QueryObjectValidationError):
        get_query_results(
            ChartDataResultType.DRILL_DETAIL,
            query_context,
            query_obj,
            force_cached=False,
        )


def test_legacy_result_wrapper_delegates_to_timed_resolver() -> None:
    query_context = MagicMock()
    query_obj = MagicMock()

    with patch(
        "superset.common.query_actions.get_query_results_with_timing"
    ) as timed_resolver:
        timed_resolver.return_value.payload = {"data": []}

        result = get_query_results(
            ChartDataResultType.FULL,
            query_context,
            query_obj,
            force_cached=False,
        )

    assert result == {"data": []}
    timed_resolver.assert_called_once_with(
        ChartDataResultType.FULL,
        query_context,
        query_obj,
        False,
    )


def test_get_query_surfaces_rejected_filter_columns() -> None:
    """The QUERY result type must report filters dropped while building the SQL.

    A filter naming a column the dataset does not have is silently discarded
    during query construction. Without this, a caller asking only for the SQL
    (e.g. the MCP get_chart_sql tool, or "View query") receives the unfiltered
    statement with no indication that a filter was dropped.
    """
    from superset.common.query_actions import _get_query
    from superset.models.helpers import QueryStringExtended

    extended = QueryStringExtended(
        applied_template_filters=[],
        applied_filter_columns=["country"],
        rejected_filter_columns=["does_not_exist"],
        labels_expected=[],
        prequeries=[],
        sql="SELECT country FROM sales",
        sql_shifted_temporal_labels=set(),
    )

    mock_query_obj = MagicMock()
    mock_query_obj.to_dict.return_value = {}
    mock_query_obj.applied_time_extras = {}

    with (
        patch.object(query_actions, "_get_datasource") as mock_get_ds,
        patch.object(query_actions, "get_time_filter_status", return_value=([], [])),
    ):
        datasource = MagicMock()
        datasource.query_language = "sql"
        datasource.get_query_str_extended.return_value = extended
        mock_get_ds.return_value = datasource

        result = _get_query(MagicMock(), mock_query_obj, False)

    assert result["query"] == "SELECT country FROM sales;"
    assert result["applied_filters"] == [{"column": "country"}]
    assert [entry["column"] for entry in result["rejected_filters"]] == [
        "does_not_exist"
    ]
    assert result["rejected_filter_columns"] == ["does_not_exist"]


def test_materialized_payload_preserves_datasource_rejection_origin() -> None:
    """Data results retain provenance alongside combined temporal status."""
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_obj = MagicMock()
    query_obj.result_type = ChartDataResultType.FULL
    query_obj.applied_time_extras = {}
    payload = {
        "df": None,
        "status": QueryStatus.FAILED,
        "applied_filter_columns": [],
        "rejected_filter_columns": ["__time_col"],
    }

    with (
        patch.object(query_actions, "_get_datasource", return_value=MagicMock()),
        patch.object(
            query_actions,
            "get_time_filter_status",
            return_value=(
                [],
                [{"reason": "not_in_datasource", "column": "__time_col"}],
            ),
        ),
    ):
        result = query_actions._materialize_full_payload(
            query_context, query_obj, payload
        )

    assert result["rejected_filter_columns"] == ["__time_col"]
    assert len(result["rejected_filters"]) == 2


def test_get_query_falls_back_when_datasource_has_no_extended_form() -> None:
    """Datasources without get_query_str_extended keep the plain string path."""
    from superset.common.query_actions import _get_query

    mock_query_obj = MagicMock()
    mock_query_obj.to_dict.return_value = {}

    with patch.object(query_actions, "_get_datasource") as mock_get_ds:
        datasource = MagicMock(spec=["query_language", "get_query_str"])
        datasource.query_language = "sql"
        datasource.get_query_str.return_value = "SELECT 1;"
        mock_get_ds.return_value = datasource

        result = _get_query(MagicMock(), mock_query_obj, False)

    assert result["query"] == "SELECT 1;"
    assert "rejected_filters" not in result
