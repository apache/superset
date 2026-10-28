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
import io
import sys
from decimal import Decimal, DivisionByZero, InvalidOperation, localcontext

import pandas as pd
import pytest

from superset.constants import PandasPostprocessingCompare as PPC  # noqa: N817
from superset.utils import pandas_postprocessing as pp
from superset.utils.pandas_postprocessing.utils import FLAT_COLUMN_SEPARATOR
from tests.unit_tests.fixtures.dataframes import multiple_metrics_df, timeseries_df2


@pytest.mark.parametrize(
    "compare_type, expected",
    [
        (PPC.PCT, [float("inf"), float("nan"), -float("inf"), 1.5, -1.0]),
        (PPC.RAT, [float("inf"), float("nan"), -float("inf"), 2.5, 0.0]),
    ],
)
@pytest.mark.parametrize("multi_index", [False, True])
def test_compare_decimal_zero_baseline(
    compare_type: PPC, expected: list[float], multi_index: bool
) -> None:
    """Decimal comparisons follow numeric division semantics for zero baselines."""
    df = pd.DataFrame(
        {
            "current": [Decimal(value) for value in ["10", "0", "-10", "10", "0"]],
            "previous": [Decimal(value) for value in ["0", "0", "0", "4", "4"]],
        }
    )
    if multi_index:
        df.columns = pd.MultiIndex.from_product([df.columns, ["group"]])
    original = df.copy(deep=True)

    result = pp.compare(
        df,
        source_columns=["current"],
        compare_columns=["previous"],
        compare_type=compare_type,
        drop_original_columns=True,
    )
    column = f"{compare_type}__current__previous"
    columns = (
        pd.MultiIndex.from_tuples([(column, "group")]) if multi_index else [column]
    )
    pd.testing.assert_frame_equal(result, pd.DataFrame(expected, columns=columns))
    pd.testing.assert_frame_equal(df, original)


def test_compare_decimal_raw_query() -> None:
    """Raw query columns retain Decimals through normalization and comparison."""
    from superset.common.query_object import QueryObject
    from superset.connectors.sqla.models import SqlaTable

    query = QueryObject(
        columns=["current", "previous"],
        metrics=[],
        post_processing=[
            {
                "operation": "compare",
                "options": {
                    "source_columns": ["current"],
                    "compare_columns": ["previous"],
                    "compare_type": PPC.RAT,
                    "drop_original_columns": True,
                },
            }
        ],
    )
    df = pd.DataFrame({"current": [Decimal("10")], "previous": [Decimal("0")]})
    df = SqlaTable().normalize_df(df, query)
    assert isinstance(df.loc[0, "current"], Decimal)

    result = query.exec_post_processing(df)

    pd.testing.assert_frame_equal(
        result, pd.DataFrame({"ratio__current__previous": [float("inf")]})
    )


@pytest.mark.parametrize("compare_type, expected", [(PPC.PCT, 1.0), (PPC.RAT, 2.0)])
@pytest.mark.parametrize("exponent", [500, -500])
def test_compare_decimal_range(
    compare_type: PPC, expected: float, exponent: int
) -> None:
    """Divide Decimals before converting the finite result to a float."""
    df = pd.DataFrame(
        {
            "current": [Decimal(f"1e{exponent}")],
            "previous": [Decimal(f"5e{exponent - 1}")],
        }
    )

    result = pp.compare(
        df,
        source_columns=["current"],
        compare_columns=["previous"],
        compare_type=compare_type,
    )

    assert result[f"{compare_type}__current__previous"].iloc[0] == expected


def test_compare_preserves_decimal_context() -> None:
    """Zero-baseline handling must not change the caller's Decimal traps."""
    df = pd.DataFrame({"current": [Decimal("0")], "previous": [Decimal("0")]})
    with localcontext() as context:
        context.traps[DivisionByZero] = True
        context.traps[InvalidOperation] = True
        pp.compare(
            df,
            source_columns=["current"],
            compare_columns=["previous"],
            compare_type=PPC.RAT,
        )
        assert context.traps[DivisionByZero]
        assert context.traps[InvalidOperation]


def test_compare_should_not_side_effect():
    _timeseries_df2 = timeseries_df2.copy()
    pp.compare(
        df=_timeseries_df2,
        source_columns=["y"],
        compare_columns=["z"],
        compare_type=PPC.DIFF,
    )
    assert _timeseries_df2.equals(timeseries_df2)


def test_compare_diff():
    # `difference` comparison
    post_df = pp.compare(
        df=timeseries_df2,
        source_columns=["y"],
        compare_columns=["z"],
        compare_type=PPC.DIFF,
    )
    """
               label    y     z  difference__y__z
    2019-01-01     x  2.0   2.0               0.0
    2019-01-02     y  2.0   4.0              -2.0
    2019-01-05     z  2.0  10.0              -8.0
    2019-01-07     q  2.0   8.0              -6.0
    """
    assert post_df.equals(
        pd.DataFrame(
            index=timeseries_df2.index,
            data={
                "label": ["x", "y", "z", "q"],
                "y": [2.0, 2.0, 2.0, 2.0],
                "z": [2.0, 4.0, 10.0, 8.0],
                "difference__y__z": [0.0, -2.0, -8.0, -6.0],
            },
        )
    )

    # drop original columns
    post_df = pp.compare(
        df=timeseries_df2,
        source_columns=["y"],
        compare_columns=["z"],
        compare_type=PPC.DIFF,
        drop_original_columns=True,
    )
    assert post_df.equals(
        pd.DataFrame(
            index=timeseries_df2.index,
            data={
                "label": ["x", "y", "z", "q"],
                "difference__y__z": [0.0, -2.0, -8.0, -6.0],
            },
        )
    )


def test_compare_percentage():
    # `percentage` comparison
    post_df = pp.compare(
        df=timeseries_df2,
        source_columns=["y"],
        compare_columns=["z"],
        compare_type=PPC.PCT,
    )
    """
               label    y     z  percentage__y__z
    2019-01-01     x  2.0   2.0              0.0
    2019-01-02     y  2.0   4.0              -0.50
    2019-01-05     z  2.0  10.0              -0.80
    2019-01-07     q  2.0   8.0              -0.75
    """
    assert post_df.equals(
        pd.DataFrame(
            index=timeseries_df2.index,
            data={
                "label": ["x", "y", "z", "q"],
                "y": [2.0, 2.0, 2.0, 2.0],
                "z": [2.0, 4.0, 10.0, 8.0],
                "percentage__y__z": [0.0, -0.50, -0.80, -0.75],
            },
        )
    )


def test_compare_ratio():
    # `ratio` comparison
    post_df = pp.compare(
        df=timeseries_df2,
        source_columns=["y"],
        compare_columns=["z"],
        compare_type=PPC.RAT,
    )
    """
               label    y     z  ratio__y__z
    2019-01-01     x  2.0   2.0         1.00
    2019-01-02     y  2.0   4.0         0.50
    2019-01-05     z  2.0  10.0         0.20
    2019-01-07     q  2.0   8.0         0.25
    """
    assert post_df.equals(
        pd.DataFrame(
            index=timeseries_df2.index,
            data={
                "label": ["x", "y", "z", "q"],
                "y": [2.0, 2.0, 2.0, 2.0],
                "z": [2.0, 4.0, 10.0, 8.0],
                "ratio__y__z": [1.00, 0.50, 0.20, 0.25],
            },
        )
    )


def test_compare_multi_index_column():
    index = pd.to_datetime(["2021-01-01", "2021-01-02", "2021-01-03"])
    index.name = "__timestamp"
    iterables = [["m1", "m2"], ["a", "b"], ["x", "y"]]
    columns = pd.MultiIndex.from_product(iterables, names=[None, "level1", "level2"])
    df = pd.DataFrame(index=index, columns=columns, data=1)
    """
                m1          m2
    level1       a     b     a     b
    level2       x  y  x  y  x  y  x  y
    __timestamp
    2021-01-01   1  1  1  1  1  1  1  1
    2021-01-02   1  1  1  1  1  1  1  1
    2021-01-03   1  1  1  1  1  1  1  1
    """
    post_df = pp.compare(
        df,
        source_columns=["m1"],
        compare_columns=["m2"],
        compare_type=PPC.DIFF,
        drop_original_columns=True,
    )
    flat_df = pp.flatten(post_df)
    """
      __timestamp  difference__m1__m2, a, x  difference__m1__m2, a, y  difference__m1__m2, b, x  difference__m1__m2, b, y
    0  2021-01-01                         0                         0                         0                         0
    1  2021-01-02                         0                         0                         0                         0
    2  2021-01-03                         0                         0                         0                         0
    """  # noqa: E501
    assert flat_df.equals(
        pd.DataFrame(
            data={
                "__timestamp": pd.to_datetime(
                    ["2021-01-01", "2021-01-02", "2021-01-03"]
                ),
                "difference__m1__m2, a, x": [0, 0, 0],
                "difference__m1__m2, a, y": [0, 0, 0],
                "difference__m1__m2, b, x": [0, 0, 0],
                "difference__m1__m2, b, y": [0, 0, 0],
            }
        )
    )


def test_compare_multi_index_column_non_lex_sorted():
    index = pd.to_datetime(["2021-01-01", "2021-01-02", "2021-01-03"])
    index.name = "__timestamp"

    iterables = [["m1", "m2"], ["a", "b"], ["x", "y"]]
    columns = pd.MultiIndex.from_product(iterables, names=[None, "level1", "level2"])

    df = pd.DataFrame(index=index, columns=columns, data=1)

    # Define a non-lexicographical column order
    # arrange them as m1, m2 instead of m2, m1
    new_columns_order = [
        ("m1", "a", "x"),
        ("m1", "a", "y"),
        ("m1", "b", "x"),
        ("m1", "b", "y"),
        ("m2", "a", "x"),
        ("m2", "a", "y"),
        ("m2", "b", "x"),
        ("m2", "b", "y"),
    ]

    df.columns = pd.MultiIndex.from_tuples(
        new_columns_order, names=["level1", "level2", None]
    )

    # to capture stderr
    stderr = sys.stderr
    sys.stderr = io.StringIO()

    try:
        post_df = pp.compare(
            df,
            source_columns=["m1"],
            compare_columns=["m2"],
            compare_type=PPC.DIFF,
            drop_original_columns=True,
        )
        assert sys.stderr.getvalue() == ""
    finally:
        sys.stderr = stderr

    flat_df = pp.flatten(post_df)
    """
      __timestamp  difference__m1__m2, a, x  difference__m1__m2, a, y  difference__m1__m2, b, x  difference__m1__m2, b, y
    0  2021-01-01                         0                         0                         0                         0
    1  2021-01-02                         0                         0                         0                         0
    2  2021-01-03                         0                         0                         0                         0
    """  # noqa: E501
    assert flat_df.equals(
        pd.DataFrame(
            data={
                "__timestamp": pd.to_datetime(
                    ["2021-01-01", "2021-01-02", "2021-01-03"]
                ),
                "difference__m1__m2, a, x": [0, 0, 0],
                "difference__m1__m2, a, y": [0, 0, 0],
                "difference__m1__m2, b, x": [0, 0, 0],
                "difference__m1__m2, b, y": [0, 0, 0],
            }
        )
    )


def test_compare_after_pivot():
    pivot_df = pp.pivot(
        df=multiple_metrics_df,
        index=["dttm"],
        columns=["country"],
        aggregates={
            "sum_metric": {"operator": "sum"},
            "count_metric": {"operator": "sum"},
        },
    )
    """
                   count_metric    sum_metric
    country              UK US         UK US
    dttm
    2019-01-01            1  2          5  6
    2019-01-02            3  4          7  8
    """
    compared_df = pp.compare(
        pivot_df,
        source_columns=["count_metric"],
        compare_columns=["sum_metric"],
        compare_type=PPC.DIFF,
        drop_original_columns=True,
    )
    """
               difference__count_metric__sum_metric
    country                                      UK US
    dttm
    2019-01-01                                   -4 -4
    2019-01-02                                   -4 -4
    """
    flat_df = pp.flatten(compared_df)
    """
            dttm  difference__count_metric__sum_metric, UK  difference__count_metric__sum_metric, US
    0 2019-01-01                                        -4                                        -4
    1 2019-01-02                                        -4                                        -4
    """  # noqa: E501
    assert flat_df.equals(
        pd.DataFrame(
            data={
                "dttm": pd.to_datetime(["2019-01-01", "2019-01-02"]),
                FLAT_COLUMN_SEPARATOR.join(
                    ["difference__count_metric__sum_metric", "UK"]
                ): [-4, -4],
                FLAT_COLUMN_SEPARATOR.join(
                    ["difference__count_metric__sum_metric", "US"]
                ): [-4, -4],
            }
        )
    )
