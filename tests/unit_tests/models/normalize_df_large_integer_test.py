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
"""Chart-data results must not round integers beyond 2**53 - 1."""

from datetime import timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

from superset.common.chart_data import ChartDataResultType
from superset.common.query_object import QueryObject
from superset.dataframe import df_to_records
from superset.models.helpers import ExploreMixin, QueryResult
from superset.utils import json
from superset.utils.core import JS_MAX_INTEGER

LARGE_INTEGER = 333466480986292423


def _datasource(
    df: pd.DataFrame | None = None, verbose_map: dict[str, str] | None = None
) -> MagicMock:
    """A datasource double with the real ``ExploreMixin`` normalization bound."""
    datasource = MagicMock()
    datasource.offset = 0
    datasource.enforce_numerical_metrics = True
    datasource.columns = []
    datasource.verbose_map = verbose_map or {}
    datasource.get_column = lambda name: None
    datasource.query = lambda query_obj: QueryResult(
        df=df if df is not None else pd.DataFrame(),
        query="",
        duration=timedelta(0),
    )
    datasource.processing_time_offsets = lambda frame, *args, **kwargs: {
        "df": frame,
        "queries": [],
    }
    for method in (
        "_python_date_format",
        "_collect_dttm_labels",
        "_offset_only_dttm_cols",
        "normalize_df",
        "get_query_result",
    ):
        setattr(datasource, method, getattr(ExploreMixin, method).__get__(datasource))
    return datasource


def _run_query_and_serialize(df: pd.DataFrame, **query_fields: Any) -> str:
    """Run ``ExploreMixin.get_query_result`` and the chart-data JSON encoding."""
    datasource = _datasource(df)

    # a plain query: one selected column, no metrics, no Python-side processing
    query_object = MagicMock()
    query_object.columns = ["value"]
    query_object.column_names = ["value"]
    query_object.metrics = []
    query_object.metric_names = []
    query_object.granularity = None
    query_object.time_shift = None
    query_object.post_processing = []
    query_object.time_offsets = []
    query_object.result_type = ChartDataResultType.FULL
    query_object.exec_post_processing = lambda frame: frame
    for name, value in query_fields.items():
        setattr(query_object, name, value)

    result = datasource.get_query_result(query_object)
    return json.dumps(
        df_to_records(result.df),
        default=json.json_int_dttm_ser,
        ignore_nan=True,
    )


def _normalize(
    df: pd.DataFrame,
    columns: list[Any],
    metrics: list[Any] | None = None,
    verbose_map: dict[str, str] | None = None,
    **kwargs: Any,
) -> pd.DataFrame:
    """Run ``normalize_df`` for a real ``QueryObject`` selecting ``columns``."""
    datasource = _datasource(verbose_map=verbose_map)
    query_object = QueryObject(
        datasource=datasource, columns=columns, metrics=metrics or []
    )
    return datasource.normalize_df(df, query_object, **kwargs)


def _unchanged_normalization(df: pd.DataFrame) -> pd.DataFrame:
    """What ``normalize_df`` returned for a column before the keyword existed."""
    return df.mask(df.isin([np.inf, -np.inf])).infer_objects()


def test_nullable_bigint_column_keeps_every_digit() -> None:
    # a nullable BIGINT column arrives as an object column of ints and None
    df = pd.DataFrame({"value": pd.Series([LARGE_INTEGER, None], dtype=object)})

    payload = _run_query_and_serialize(df)

    assert str(LARGE_INTEGER) in payload


@pytest.mark.parametrize("null", [None, float("nan"), pd.NA], ids=["none", "nan", "na"])
@pytest.mark.parametrize("scalar", [int, np.int64], ids=["python-int", "numpy-int64"])
def test_kept_column_wire_contract(scalar: type, null: Any) -> None:
    """Exact strings beyond 2**53 - 1, ordinary numerics and JSON nulls."""
    values = [
        LARGE_INTEGER,
        null,
        7,
        -LARGE_INTEGER,
        2**63 - 1,
        -(2**63),
        JS_MAX_INTEGER,
        JS_MAX_INTEGER + 1,
    ]
    column = pd.Series([v if v is null else scalar(v) for v in values], dtype=object)

    payload = _run_query_and_serialize(pd.DataFrame({"value": column}))

    assert payload == (
        '[{"value": "333466480986292423"}, {"value": null}, {"value": 7}, '
        '{"value": "-333466480986292423"}, {"value": "9223372036854775807"}, '
        '{"value": "-9223372036854775808"}, {"value": 9007199254740991}, '
        '{"value": "9007199254740992"}]'
    )


@pytest.mark.parametrize(
    "query_fields, exact",
    [
        pytest.param({}, True, id="plain-full"),
        pytest.param({"result_type": None}, True, id="no-result-type"),
        pytest.param({"result_type": ChartDataResultType.RESULTS}, True, id="results"),
        pytest.param({"result_type": ChartDataResultType.SAMPLES}, True, id="samples"),
        pytest.param(
            {"result_type": ChartDataResultType.DRILL_DETAIL}, True, id="drill-detail"
        ),
        pytest.param({"grouping_sets": [["value"], []]}, True, id="grouping-sets"),
        pytest.param(
            {"post_processing": [{"operation": "cum"}]}, False, id="post-processing"
        ),
        pytest.param({"time_offsets": ["1 week ago"]}, False, id="time-offsets"),
        pytest.param(
            {"result_type": ChartDataResultType.POST_PROCESSED},
            False,
            id="post-processed",
        ),
    ],
)
def test_exact_integers_follow_the_query_gate(
    query_fields: dict[str, Any], exact: bool
) -> None:
    df = pd.DataFrame({"value": pd.Series([LARGE_INTEGER, None], dtype=object)})

    payload = _run_query_and_serialize(df, **query_fields)

    expected = (
        '[{"value": "333466480986292423"}, {"value": null}]'
        if exact
        else '[{"value": 3.334664809862924e+17}, {"value": null}]'
    )
    assert payload == expected


def test_normalize_df_defaults_to_float_normalization() -> None:
    """Callers that do not opt in (e.g. the time-offset subquery) keep float64."""
    df = pd.DataFrame({"value": pd.Series([LARGE_INTEGER, None], dtype=object)})

    result = _normalize(df, ["value"])

    assert result["value"].dtype == np.float64
    assert result["value"].iloc[0] == float(LARGE_INTEGER)


KEPT_VALUES = {
    "just-beyond-safe": [JS_MAX_INTEGER + 1, None],
    "beyond-safe-plus-one": [JS_MAX_INTEGER + 2, None],
    "negative-beyond-safe": [-(JS_MAX_INTEGER + 2), None],
    "int64-minimum": [-(2**63), None],
    "int64-maximum": [2**63 - 1, None],
    "mixed-small-large-negative": [1, JS_MAX_INTEGER + 2, None, -5, -LARGE_INTEGER],
    "numpy-scalars": [np.int64(JS_MAX_INTEGER + 2), None, np.int64(-(2**63))],
    "nan-null": [JS_MAX_INTEGER + 2, float("nan")],
    "pandas-na-null": [JS_MAX_INTEGER + 2, pd.NA],
}

NOT_KEPT_VALUES = {
    "safe-boundary": [JS_MAX_INTEGER, None],
    "small-only": [7, None],
    "above-int64": [2**63, None],
    "uint64-only": [2**64 - 1, None],
    "uint64-range-with-small": [2**63 + 5, 7, None],
    "negative-and-above-int64": [-1, 2**63 + 1, None],
    "beyond-64-bits": [2**64, None],
    "no-nulls": [JS_MAX_INTEGER + 2, 3],
    "bool-mixed": [True, JS_MAX_INTEGER + 2, None],
    "float-mixed": [JS_MAX_INTEGER + 2, 1.5, None],
    "all-null": [None, None],
    "decimal": [Decimal(JS_MAX_INTEGER + 2), None],
    "string": ["a", None],
}


@pytest.mark.parametrize("values", KEPT_VALUES.values(), ids=KEPT_VALUES.keys())
def test_kept_columns_stay_exact_python_integers(values: list[Any]) -> None:
    df = pd.DataFrame({"value": pd.Series(values, dtype=object)})

    result = _normalize(df, ["value"], keep_exact_integers=True)

    assert result["value"].dtype == object
    assert [None if pd.isna(v) else v for v in result["value"]] == [
        None if pd.isna(v) else v for v in values
    ]


@pytest.mark.parametrize("values", NOT_KEPT_VALUES.values(), ids=NOT_KEPT_VALUES.keys())
def test_kept_columns_only_lossy_int64_range(values: list[Any]) -> None:
    """Every other shape is normalized exactly as before the keyword existed."""
    df = pd.DataFrame({"value": pd.Series(values, dtype=object)})

    result = _normalize(df, ["value"], keep_exact_integers=True)

    pd.testing.assert_frame_equal(result, _unchanged_normalization(df))


def test_value_above_int64_maximum_stays_float() -> None:
    df = pd.DataFrame({"value": pd.Series([2**63, None], dtype=object)})

    result = _normalize(df, ["value"], keep_exact_integers=True)

    assert result["value"].dtype == np.float64


def test_duplicate_labels_keep_float_normalization() -> None:
    df = pd.DataFrame(
        [[JS_MAX_INTEGER + 2, JS_MAX_INTEGER + 3], [None, None]],
        columns=["value", "value"],
        dtype=object,
    )

    result = _normalize(df, ["value"], keep_exact_integers=True)

    pd.testing.assert_frame_equal(result, _unchanged_normalization(df))


def test_saved_metric_with_verbose_name_stays_float() -> None:
    """The frame carries the saved metric's raw name while ``metric_names`` is
    mapped to the verbose name, so metrics must be told apart by the raw label."""
    verbose_map = {"max_big": "Max Big Verbose"}
    datasource = _datasource(verbose_map=verbose_map)
    query_object = QueryObject(
        datasource=datasource, columns=["big"], metrics=["max_big"]
    )
    assert query_object.metric_names == ["Max Big Verbose"]
    nullable = pd.Series([LARGE_INTEGER, None], dtype=object)
    df = pd.DataFrame({"big": nullable, "max_big": nullable.copy()})

    result = datasource.normalize_df(df, query_object, keep_exact_integers=True)

    assert result["big"].dtype == object
    assert result["big"].tolist() == [LARGE_INTEGER, None]
    assert result["max_big"].dtype == np.float64


def test_metrics_only_totals_query_converts_nothing() -> None:
    """A metrics-only query selects no columns, so nothing qualifies."""
    df = pd.DataFrame({"sum_big": pd.Series([LARGE_INTEGER, None], dtype=object)})

    result = _normalize(df, [], metrics=["sum_big"], keep_exact_integers=True)

    assert result["sum_big"].dtype == np.float64


def test_columns_not_selected_by_the_query_are_not_kept() -> None:
    df = pd.DataFrame(
        {
            "selected": pd.Series([LARGE_INTEGER, None], dtype=object),
            "extra": pd.Series([LARGE_INTEGER, None], dtype=object),
        }
    )

    result = _normalize(df, ["selected"], keep_exact_integers=True)

    assert result["selected"].dtype == object
    assert result["extra"].dtype == np.float64
