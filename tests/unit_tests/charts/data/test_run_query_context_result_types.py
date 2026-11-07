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
"""Exercise export result types through real chart-data materialization."""

from collections.abc import Iterator
from copy import deepcopy
from types import SimpleNamespace
from typing import Any
from unittest import mock

import pandas as pd
import pytest
from superset_core.exports.types import ChartQueryResult, GenericDataType

from superset.charts.data.run_query_context import run_query_context
from superset.common.chart_data_timing import (
    QueryAcquisitionResult,
    QueryAcquisitionTiming,
)
from superset.common.db_query_status import QueryStatus
from superset.common.query_context import QueryContext
from superset.common.query_context_factory import QueryContextFactory
from superset.common.query_object import QueryObject


def _source_rows(multiplier: int) -> list[dict[str, Any]]:
    """Give each acquired query distinct values so result ordering is observable."""
    return [
        {"state": "CA", "gender": "boy", "num": 10 * multiplier},
        {"state": "CA", "gender": "girl", "num": 5 * multiplier},
        {"state": "NY", "gender": "boy", "num": 3 * multiplier},
    ]


@pytest.fixture
def acquisition() -> Iterator[mock.MagicMock]:
    """Replace datasource I/O while retaining schema, command and result handling."""
    datasource = mock.MagicMock()
    datasource.columns = [
        SimpleNamespace(column_name=name, is_dttm=False)
        for name in ("state", "gender", "num")
    ]
    datasource.data = {"verbose_map": {}}
    datasource.supports_drill_to_detail = True
    acquired_count = 0

    def acquire(
        query_obj: QueryObject, force_cached: bool | None = False
    ) -> QueryAcquisitionResult:
        """Return dataframe payloads at the database acquisition boundary."""
        nonlocal acquired_count
        acquired_count += 1
        return QueryAcquisitionResult(
            payload={
                "df": pd.DataFrame(_source_rows(acquired_count)),
                "status": QueryStatus.SUCCESS,
                "rowcount": 3,
                "applied_filter_columns": [],
                "rejected_filter_columns": [],
            },
            timing=QueryAcquisitionTiming(
                query_planning_ns=0,
                cache_resolution_ns=0,
                data_acquisition_ns=0,
                payload_assembly_ns=0,
            ),
        )

    with (
        mock.patch.object(
            QueryContextFactory, "_convert_to_model", return_value=datasource
        ),
        mock.patch.object(QueryContext, "raise_for_access"),
        mock.patch.object(
            QueryContext, "get_df_payload_result", side_effect=acquire
        ) as acquired,
    ):
        yield acquired


def _payload(result_type: str, overrides: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a pivot request with independent query-level result-type overrides."""
    return {
        "datasource": {"id": 1, "type": "table"},
        "result_type": result_type,
        "result_format": "csv",
        "queries": [
            {
                "columns": ["state", "gender"],
                "metrics": ["num"],
                "row_limit": 100,
                **override,
            }
            for override in overrides
        ],
        "form_data": {
            "viz_type": "pivot_table_v2",
            "groupbyRows": ["state"],
            "groupbyColumns": ["gender"],
            "metrics": ["num"],
            "metricsLayout": "COLUMNS",
            "rowTotals": False,
            "colTotals": False,
        },
    }


@pytest.mark.parametrize(
    ("context_type", "overrides", "pivoted"),
    [
        ("full", [{"result_type": "post_processed"}], [True]),
        ("post_processed", [{"result_type": "results"}], [False]),
        (
            "full",
            [{}, {"result_type": "post_processed"}, {"result_type": "results"}],
            [False, True, False],
        ),
        (
            "post_processed",
            [
                {},
                {"result_type": "results"},
                {"result_type": "full"},
                {"result_type": "post_processed"},
            ],
            [True, False, False, True],
        ),
        (
            "post_processed",
            [{"result_type": "samples"}, {"result_type": "drill_detail"}],
            [False, False],
        ),
        ("post_processed", [{"result_type": None}], [True]),
    ],
)
def test_effective_query_result_types_preserve_export_rows(
    acquisition: mock.MagicMock,
    context_type: str,
    overrides: list[dict[str, Any]],
    pivoted: list[bool],
) -> None:
    """Process only effective pivot requests and preserve mixed result ordering."""
    payload = _payload(context_type, overrides)
    original = deepcopy(payload)

    results = run_query_context(payload)

    assert len(results) == len(overrides)
    assert acquisition.call_count == len(overrides)
    assert payload == original
    for multiplier, (result, is_pivoted) in enumerate(
        zip(results, pivoted, strict=True), start=1
    ):
        if is_pivoted:
            assert result == ChartQueryResult(
                colnames=["", "num boy", "num girl"],
                coltypes=[
                    GenericDataType.STRING,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                ],
                data=[
                    {
                        "": "CA",
                        "num boy": 10.0 * multiplier,
                        "num girl": 5.0 * multiplier,
                    },
                    {"": "NY", "num boy": 3.0 * multiplier, "num girl": None},
                ],
            )
        else:
            assert result == ChartQueryResult(
                colnames=["state", "gender", "num"],
                coltypes=[
                    GenericDataType.STRING,
                    GenericDataType.STRING,
                    GenericDataType.NUMERIC,
                ],
                data=_source_rows(multiplier),
            )


@pytest.mark.parametrize("result_type", ["query", "columns", "timegrains"])
def test_non_row_query_result_type_is_rejected_before_acquisition(
    acquisition: mock.MagicMock, result_type: str
) -> None:
    """Reject metadata overrides before executing any query in the request."""
    payload = _payload("full", [{}, {"result_type": result_type}])

    with pytest.raises(ValueError, match=result_type):
        run_query_context(payload)

    acquisition.assert_not_called()
