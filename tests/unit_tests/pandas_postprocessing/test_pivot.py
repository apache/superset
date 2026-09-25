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

import numpy as np
import pandas as pd
import pytest
from pandas import DataFrame, to_datetime

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing import flatten, pivot
from tests.unit_tests.fixtures.dataframes import categories_df
from tests.unit_tests.pandas_postprocessing.utils import AGGREGATES_SINGLE


def test_pivot_without_columns():
    """
    Make sure pivot without columns returns correct DataFrame
    """
    df = pivot(
        df=categories_df,
        index=["name"],
        aggregates=AGGREGATES_SINGLE,
    )
    assert df.columns.tolist() == ["idx_nulls"]
    assert len(df) == 101
    assert df["idx_nulls"].sum() == 1050


def test_pivot_with_single_column():
    """
    Make sure pivot with single column returns correct DataFrame
    """
    df = pivot(
        df=categories_df,
        index=["name"],
        columns=["category"],
        aggregates=AGGREGATES_SINGLE,
    )
    assert df.columns.tolist() == [
        ("idx_nulls", "cat0"),
        ("idx_nulls", "cat1"),
        ("idx_nulls", "cat2"),
    ]
    assert len(df) == 101
    assert df["idx_nulls"]["cat0"].sum() == 315

    df = pivot(
        df=categories_df,
        index=["dept"],
        columns=["category"],
        aggregates=AGGREGATES_SINGLE,
    )
    assert df.columns.tolist() == [
        ("idx_nulls", "cat0"),
        ("idx_nulls", "cat1"),
        ("idx_nulls", "cat2"),
    ]
    assert len(df) == 5


def test_pivot_with_multiple_columns():
    """
    Make sure pivot with multiple columns returns correct DataFrame
    """
    df = pivot(
        df=categories_df,
        index=["name"],
        columns=["category", "dept"],
        aggregates=AGGREGATES_SINGLE,
    )
    df = flatten(df)
    assert len(df.columns) == 1 + 3 * 5  # index + possible permutations


def test_pivot_fill_values():
    """
    Make sure pivot with fill values returns correct DataFrame
    """
    df = pivot(
        df=categories_df,
        index=["name"],
        columns=["category"],
        metric_fill_value=1,
        aggregates={"idx_nulls": {"operator": "sum"}},
    )
    assert df["idx_nulls"]["cat0"].sum() == 382


def test_pivot_fill_column_values():
    """
    Make sure pivot with null column names returns correct DataFrame
    """
    df_copy = categories_df.copy()
    df_copy["category"] = None
    df = pivot(
        df=df_copy,
        index=["name"],
        columns=["category"],
        aggregates={"idx_nulls": {"operator": "sum"}},
    )
    assert len(df) == 101
    assert df.columns.tolist() == [("idx_nulls", "<NULL>")]


def test_pivot_exceptions():
    """
    Make sure pivot raises correct Exceptions
    """
    # Missing index
    with pytest.raises(TypeError):
        pivot(df=categories_df, columns=["dept"], aggregates=AGGREGATES_SINGLE)

    # invalid index reference
    with pytest.raises(InvalidPostProcessingError):
        pivot(
            df=categories_df,
            index=["abc"],
            columns=["dept"],
            aggregates=AGGREGATES_SINGLE,
        )

    # invalid column reference
    with pytest.raises(InvalidPostProcessingError):
        pivot(
            df=categories_df,
            index=["dept"],
            columns=["abc"],
            aggregates=AGGREGATES_SINGLE,
        )

    # invalid aggregate options
    with pytest.raises(InvalidPostProcessingError):
        pivot(
            df=categories_df,
            index=["name"],
            columns=["category"],
            aggregates={"idx_nulls": {}},
        )


def test_pivot_eliminate_cartesian_product_columns():
    # single metric
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "a": [0, 1],
            "b": [0, 1],
            "metric": [9, np.nan],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["a", "b"],
        aggregates={"metric": {"operator": "mean"}},
        drop_missing_columns=False,
    )
    df = flatten(df)
    assert list(df.columns) == ["dttm", "metric, 0, 0", "metric, 1, 1"]
    assert np.isnan(df["metric, 1, 1"][0])

    # multiple metrics
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "a": [0, 1],
            "b": [0, 1],
            "metric": [9, np.nan],
            "metric2": [10, 11],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["a", "b"],
        aggregates={
            "metric": {"operator": "mean"},
            "metric2": {"operator": "mean"},
        },
        drop_missing_columns=False,
    )
    df = flatten(df)
    assert list(df.columns) == [
        "dttm",
        "metric, 0, 0",
        "metric, 1, 1",
        "metric2, 0, 0",
        "metric2, 1, 1",
    ]
    assert np.isnan(df["metric, 1, 1"][0])


def test_pivot_preserves_all_nan_metric_flat():
    """
    Pivot with drop_missing_columns=True must not drop metric columns whose entries
    are all NaN. This prevents downstream post-processing (e.g. rename) from failing
    with "Referenced columns not available in DataFrame" when a Jinja metric
    expression evaluates to NULL for every row (SC-100398).
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-02", "2019-01-03"]),
            "metric": [np.nan, np.nan, np.nan],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        aggregates={"metric": {"operator": "mean"}},
        drop_missing_columns=True,
    )

    assert "metric" in df.columns
    assert df["metric"].isna().all()


def test_pivot_preserves_all_nan_metric_with_columns():
    """
    Pivot with groupby columns and drop_missing_columns=True must restore the
    exact (metric, category_val) MultiIndex keys when all values for that metric
    are NaN. The restored keys must use the actual category values from the input
    data so that downstream rename/rolling validation and flatten produce the
    correct column names.
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "category": ["A", "B"],
            "metric": [np.nan, np.nan],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["category"],
        aggregates={"metric": {"operator": "mean"}},
        drop_missing_columns=True,
    )

    assert isinstance(df.columns, pd.MultiIndex)
    assert "metric" in df.columns.get_level_values(0)
    # Exact keys must reflect the real category values, not placeholders.
    assert ("metric", "A") in df.columns
    assert ("metric", "B") in df.columns

    df = flatten(df)
    assert "metric, A" in df.columns
    assert "metric, B" in df.columns
    assert df["metric, A"].isna().all()
    assert df["metric, B"].isna().all()


def test_pivot_preserves_all_nan_metric_multi_column():
    """
    Pivot with multiple groupby columns and an all-NaN metric restores the full
    multi-level (metric, col_val_1, col_val_2) key, not a truncated or placeholder
    version. Exercises the case where columns=["country", "category"].
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(
                ["2019-01-01", "2019-01-01", "2019-01-01", "2019-01-01"]
            ),
            "country": ["US", "US", "EU", "EU"],
            "category": ["A", "B", "A", "B"],
            "metric": [np.nan, np.nan, np.nan, np.nan],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["country", "category"],
        aggregates={"metric": {"operator": "mean"}},
        drop_missing_columns=True,
    )

    assert isinstance(df.columns, pd.MultiIndex)
    assert "metric" in df.columns.get_level_values(0)
    # All four combinations must be restored with correct full tuple keys.
    assert ("metric", "US", "A") in df.columns
    assert ("metric", "US", "B") in df.columns
    assert ("metric", "EU", "A") in df.columns
    assert ("metric", "EU", "B") in df.columns

    df = flatten(df)
    assert "metric, US, A" in df.columns
    assert "metric, EU, B" in df.columns
    assert df["metric, US, A"].isna().all()


def test_pivot_restored_nan_metric_column_order_is_deterministic():
    """
    Restored all-NaN metric columns must appear in data-insertion order, not
    in nondeterministic hash-set iteration order. This prevents column ordering
    from varying across Python processes (which randomize hash seeds by default).
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01", "2019-01-01"]),
            "category": ["C", "A", "B"],
            "metric": [np.nan, np.nan, np.nan],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["category"],
        aggregates={"metric": {"operator": "mean"}},
        drop_missing_columns=True,
    )

    # Columns restored in data-insertion order: C, A, B (not alphabetical or random).
    assert list(df.columns.get_level_values(1)) == ["C", "A", "B"]


def test_pivot_preserves_all_nan_metric_combine_value_with_metric():
    """
    When combine_value_with_metric=True, a stack()/unstack() is applied after
    column restoration. stack() drops all-NaN rows by default, which would remove
    the restored metric before downstream post-processing can reference it.
    Using dropna=False on stack() ensures restored all-NaN metrics survive.
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "category": ["A", "B"],
            "metric": [np.nan, np.nan],
            "metric2": [1.0, 2.0],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["category"],
        aggregates={
            "metric": {"operator": "mean"},
            "metric2": {"operator": "mean"},
        },
        drop_missing_columns=True,
        combine_value_with_metric=True,
    )

    # After stack()/unstack(), columns are (category_val, metric_name) tuples.
    # The all-NaN metric must appear in level 1 alongside metric2.
    assert isinstance(df.columns, pd.MultiIndex)
    metric_names = df.columns.get_level_values(1).tolist()
    assert "metric" in metric_names
    assert "metric2" in metric_names


def test_pivot_combine_sparse_metrics_no_spurious_extra_columns():
    """
    With drop_missing_columns=True and combine_value_with_metric=True, using
    stack(dropna=False) to preserve restored all-NaN metrics must not alter output
    shape for sparse-but-not-all-NaN metric/category pairs. stack(dropna=False) only
    changes behaviour for rows that are entirely NaN (a restored metric); sparse rows
    with at least one non-NaN value are unaffected — same result as dropna=True.
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "category": ["A", "B"],
            "metric1": [1.0, np.nan],  # data only for category A
            "metric2": [np.nan, 2.0],  # data only for category B
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["category"],
        aggregates={
            "metric1": {"operator": "mean"},
            "metric2": {"operator": "mean"},
        },
        drop_missing_columns=True,
        combine_value_with_metric=True,
    )

    # After combine, columns are (category_val, metric_name) tuples.
    # Neither metric is entirely absent after pivoting, so _restore adds nothing.
    # stack(dropna=False) does not change results for sparse rows with mixed NaN/data.
    assert isinstance(df.columns, pd.MultiIndex)
    assert sorted(df.columns.get_level_values(0).unique()) == ["A", "B"]
    assert sorted(df.columns.get_level_values(1).unique()) == ["metric1", "metric2"]
    # Sparse NaN cells are present but the data cells must retain their values.
    assert df[("A", "metric1")].iloc[0] == 1.0
    assert df[("B", "metric2")].iloc[0] == 2.0


def test_pivot_only_entirely_absent_metrics_are_restored():
    """
    Only metrics with zero surviving columns after pivoting are restored.
    A metric with partial NaN — data for some categories but not all — must not
    be touched: its present columns are unchanged and its absent sparse combinations
    remain dropped. This makes the restoration invariant explicit.
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "category": ["A", "B"],
            "metric_all_nan": [np.nan, np.nan],  # entirely absent → restored
            "metric_partial": [1.0, np.nan],  # partially present → not restored
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["category"],
        aggregates={
            "metric_all_nan": {"operator": "mean"},
            "metric_partial": {"operator": "mean"},
        },
        drop_missing_columns=True,
    )

    # metric_all_nan was entirely absent: both category columns are restored as NaN.
    assert ("metric_all_nan", "A") in df.columns
    assert ("metric_all_nan", "B") in df.columns
    assert df[("metric_all_nan", "A")].isna().all()
    assert df[("metric_all_nan", "B")].isna().all()

    # metric_partial has data for A: present column is unchanged, sparse B dropped.
    assert ("metric_partial", "A") in df.columns
    assert ("metric_partial", "B") not in df.columns
    assert df[("metric_partial", "A")].iloc[0] == 1.0


# --- show_values_as regression tests (#42809) --------------------------------
#
# ``show_values_as`` expresses each metric cell as a fraction of the row,
# column, or grand total after pivoting. Mirrors the client-side
# ``fractionOf`` semantic in
# ``plugin-chart-pivot-table/src/react-pivottable/utilities.ts:739`` so
# server-side rendering paths (CSV / XLSX exports, scheduled reports)
# match the browser output. See #42809.
#
# Fixture: a tiny 3-column DataFrame that keeps row/col/grand totals easy
# to eyeball. Two rows (``r1``, ``r2``), two columns (``c1``, ``c2``),
# single metric ``v``. Grand total is 100 so every percent-of-total
# assertion is trivially checkable.


def _show_values_as_fixture() -> DataFrame:
    """Long-format input that pivots to::

              v
        col   c1   c2
        row
        r1    10   20
        r2    30   40

    row totals: r1=30, r2=70; col totals: c1=40, c2=60; grand=100.
    """
    return DataFrame(
        {
            "row": ["r1", "r1", "r2", "r2"],
            "col": ["c1", "c2", "c1", "c2"],
            "v": [10, 20, 30, 40],
        }
    )


def test_pivot_show_values_as_actual_is_noop() -> None:
    """``show_values_as='actual'`` (and ``None``) leaves values unchanged."""
    df = _show_values_as_fixture()
    aggregates = {"v": {"operator": "sum"}}
    baseline = pivot(df=df, index=["row"], columns=["col"], aggregates=aggregates)

    for mode in (None, "actual"):
        result = pivot(
            df=df,
            index=["row"],
            columns=["col"],
            aggregates=aggregates,
            show_values_as=mode,
        )
        pd.testing.assert_frame_equal(result, baseline)


def test_pivot_show_values_as_percent_row() -> None:
    """Each cell = cell / row-total; each row sums to 1.0."""
    result = pivot(
        df=_show_values_as_fixture(),
        index=["row"],
        columns=["col"],
        aggregates={"v": {"operator": "sum"}},
        show_values_as="percent_row",
    )
    # r1: 10/30, 20/30; r2: 30/70, 40/70
    assert result.loc["r1", ("v", "c1")] == pytest.approx(10 / 30)
    assert result.loc["r1", ("v", "c2")] == pytest.approx(20 / 30)
    assert result.loc["r2", ("v", "c1")] == pytest.approx(30 / 70)
    assert result.loc["r2", ("v", "c2")] == pytest.approx(40 / 70)
    assert result.sum(axis=1).tolist() == pytest.approx([1.0, 1.0])


def test_pivot_show_values_as_percent_col() -> None:
    """Each cell = cell / column-total; each column sums to 1.0."""
    result = pivot(
        df=_show_values_as_fixture(),
        index=["row"],
        columns=["col"],
        aggregates={"v": {"operator": "sum"}},
        show_values_as="percent_col",
    )
    # c1 total=40: 10/40, 30/40; c2 total=60: 20/60, 40/60
    assert result.loc["r1", ("v", "c1")] == pytest.approx(10 / 40)
    assert result.loc["r2", ("v", "c1")] == pytest.approx(30 / 40)
    assert result.loc["r1", ("v", "c2")] == pytest.approx(20 / 60)
    assert result.loc["r2", ("v", "c2")] == pytest.approx(40 / 60)
    assert result.sum(axis=0).tolist() == pytest.approx([1.0, 1.0])


def test_pivot_show_values_as_percent_total() -> None:
    """Each cell = cell / grand-total; the whole frame sums to 1.0."""
    result = pivot(
        df=_show_values_as_fixture(),
        index=["row"],
        columns=["col"],
        aggregates={"v": {"operator": "sum"}},
        show_values_as="percent_total",
    )
    # grand=100: each cell divided by 100
    assert result.loc["r1", ("v", "c1")] == pytest.approx(0.10)
    assert result.loc["r1", ("v", "c2")] == pytest.approx(0.20)
    assert result.loc["r2", ("v", "c1")] == pytest.approx(0.30)
    assert result.loc["r2", ("v", "c2")] == pytest.approx(0.40)
    assert result.values.sum() == pytest.approx(1.0)


def test_pivot_show_values_as_preserves_nan_numerator() -> None:
    """A NaN/NULL numerator stays NaN — matches the client-side #42810 guard
    that a genuine SQL NULL should render blank, not "0.0%".

    The fixture uses a **missing** (row, col) combination — ``r1`` has no
    ``c2`` row — so ``pivot_table`` produces a genuine NaN cell for
    (``r1``, ``c2``). Using a ``NaN`` *input value* with ``operator='sum'``
    would not exercise this path because ``pandas`` ``.sum(skipna=True)``
    on a single-value ``[NaN]`` group returns ``0.0``, not ``NaN``.
    """
    df = DataFrame(
        {
            "row": ["r1", "r2", "r2"],  # r1 has no c2 row → post-pivot NaN
            "col": ["c1", "c1", "c2"],
            "v": [10, 30, 40],
        }
    )
    result = pivot(
        df=df,
        index=["row"],
        columns=["col"],
        aggregates={"v": {"operator": "sum"}},
        show_values_as="percent_row",
    )
    # The genuinely-NaN cell stays NaN through the percent transform.
    assert pd.isna(result.loc["r1", ("v", "c2")])
    # The other cell in the same row divides correctly against just its
    # own value (row total is 10 since c2 is NaN and skipna=True).
    assert result.loc["r1", ("v", "c1")] == pytest.approx(1.0)


def test_pivot_show_values_as_percent_total_zero_grand_total_yields_nan() -> None:
    """Grand total of zero yields NaN cells rather than Infinity — matches the
    client's ``if (acc === null) return null`` division-by-zero guard."""
    df = DataFrame(
        {
            "row": ["r1", "r1", "r2", "r2"],
            "col": ["c1", "c2", "c1", "c2"],
            "v": [0, 0, 0, 0],
        }
    )
    result = pivot(
        df=df,
        index=["row"],
        columns=["col"],
        aggregates={"v": {"operator": "sum"}},
        show_values_as="percent_total",
    )
    # No cell should be Infinity or a real number; all should be NaN.
    assert result.isna().values.all()


def test_pivot_show_values_as_percent_row_multi_metric_keeps_metrics_separate() -> None:
    """On a multi-metric pivot (``MultiIndex`` columns), per-row totals are
    computed *within each metric*. Metric A's percentages must sum to 1.0
    per row independent of metric B's values."""
    df = DataFrame(
        {
            "row": ["r1", "r1", "r2", "r2"],
            "col": ["c1", "c2", "c1", "c2"],
            "a": [10, 20, 30, 40],
            "b": [1, 3, 5, 7],
        }
    )
    result = pivot(
        df=df,
        index=["row"],
        columns=["col"],
        aggregates={"a": {"operator": "sum"}, "b": {"operator": "sum"}},
        show_values_as="percent_row",
    )
    # Metric ``a``: row totals 30 and 70; each row of ``a`` sums to 1.
    assert result["a"].sum(axis=1).tolist() == pytest.approx([1.0, 1.0])
    # Metric ``b``: row totals 4 and 12; each row of ``b`` sums to 1.
    assert result["b"].sum(axis=1).tolist() == pytest.approx([1.0, 1.0])
    # Metric ``a`` percentages must not be contaminated by metric ``b`` values.
    assert result.loc["r1", ("a", "c1")] == pytest.approx(10 / 30)
    assert result.loc["r1", ("b", "c1")] == pytest.approx(1 / 4)


def test_pivot_show_values_as_invalid_mode_raises() -> None:
    """An unknown ``show_values_as`` value raises ``InvalidPostProcessingError``
    rather than silently falling through to a no-op."""
    with pytest.raises(InvalidPostProcessingError):
        pivot(
            df=_show_values_as_fixture(),
            index=["row"],
            columns=["col"],
            aggregates={"v": {"operator": "sum"}},
            show_values_as="percent_of_moon",
        )


def test_pivot_show_values_as_empty_string_is_noop() -> None:
    """Empty-string ``show_values_as`` is treated as a no-op alongside
    ``None`` and ``"actual"`` — it must NOT reach the percent-mode
    validator (which would raise on it) or silently divide.
    """
    df = _show_values_as_fixture()
    aggregates = {"v": {"operator": "sum"}}
    baseline = pivot(df=df, index=["row"], columns=["col"], aggregates=aggregates)

    result = pivot(
        df=df,
        index=["row"],
        columns=["col"],
        aggregates=aggregates,
        show_values_as="",
    )
    pd.testing.assert_frame_equal(result, baseline)


def test_pivot_show_values_as_percent_total_flat_multi_metric() -> None:
    """A multi-metric pivot with **no** ``columns`` groupby produces a
    **flat** column index — each column IS its own metric. ``percent_total``
    must divide each metric column by its OWN grand total (never mixing
    metrics), otherwise one metric's magnitude changes another metric's
    percentages.
    """
    df = DataFrame({"row": ["r1", "r2"], "a": [10, 30], "b": [1, 3]})
    result = pivot(
        df=df,
        index=["row"],
        aggregates={"a": {"operator": "sum"}, "b": {"operator": "sum"}},
        show_values_as="percent_total",
    )
    # Each metric column sums to 1.0 independently.
    assert result["a"].sum() == pytest.approx(1.0)
    assert result["b"].sum() == pytest.approx(1.0)
    # And metric a's magnitude (10, 30 → grand 40) doesn't leak into
    # metric b's percentages (which use grand 4).
    assert result.loc["r1", "a"] == pytest.approx(10 / 40)
    assert result.loc["r1", "b"] == pytest.approx(1 / 4)


def test_pivot_show_values_as_percent_row_zero_row_total_yields_nan() -> None:
    """A row whose values sum to zero yields NaN cells in that row rather
    than ``Infinity``/``NaN`` from division-by-zero. Other rows still
    divide correctly.
    """
    df = DataFrame(
        {
            "row": ["r1", "r1", "r2", "r2"],
            "col": ["c1", "c2", "c1", "c2"],
            "v": [0, 0, 30, 40],  # r1's row-total is 0
        }
    )
    result = pivot(
        df=df,
        index=["row"],
        columns=["col"],
        aggregates={"v": {"operator": "sum"}},
        show_values_as="percent_row",
    )
    assert pd.isna(result.loc["r1", ("v", "c1")])
    assert pd.isna(result.loc["r1", ("v", "c2")])
    # r2 still divides correctly against its own row-total (70).
    assert result.loc["r2", ("v", "c1")] == pytest.approx(30 / 70)


def test_pivot_show_values_as_percent_col_zero_col_total_yields_nan() -> None:
    """A column whose values sum to zero yields NaN cells in that column
    rather than ``Infinity``/``NaN`` from division-by-zero. Other columns
    still divide correctly.
    """
    df = DataFrame(
        {
            "row": ["r1", "r1", "r2", "r2"],
            "col": ["c1", "c2", "c1", "c2"],
            "v": [0, 20, 0, 40],  # c1's column-total is 0
        }
    )
    result = pivot(
        df=df,
        index=["row"],
        columns=["col"],
        aggregates={"v": {"operator": "sum"}},
        show_values_as="percent_col",
    )
    assert pd.isna(result.loc["r1", ("v", "c1")])
    assert pd.isna(result.loc["r2", ("v", "c1")])
    # c2 still divides correctly against its own column-total (60).
    assert result.loc["r1", ("v", "c2")] == pytest.approx(20 / 60)


def test_pivot_show_values_as_with_marginal_distributions_raises() -> None:
    """``show_values_as`` combined with ``marginal_distributions`` would
    include the ``All`` margin row/column in the row/column/grand-total
    denominators, producing wrong percentages. Combining the two needs a
    first-class design; for now the combination raises loudly rather than
    silently returning wrong numbers.
    """
    with pytest.raises(InvalidPostProcessingError, match="marginal_distributions"):
        pivot(
            df=_show_values_as_fixture(),
            index=["row"],
            columns=["col"],
            aggregates={"v": {"operator": "sum"}},
            marginal_distributions=True,
            show_values_as="percent_row",
        )


def test_pivot_show_values_as_with_combine_value_with_metric_preserves_per_metric() -> (
    None
):
    """Regression test for sadpandajoe's finding on #42976.

    ``combine_value_with_metric`` reshapes the column ``MultiIndex`` from
    ``(metric, category)`` to ``(category, metric)``. Historically the
    ``show_values_as`` transform ran *after* this reshape, so its per-metric
    iteration walked categories thinking they were metrics — mixing metric
    magnitudes and producing wrong percentages (e.g. metric ``a``'s row
    would sum to ~1.78 instead of 1.0 because metric ``b``'s values leaked
    into ``a``'s denominators).

    The transform now runs *before* the reshape so per-metric isolation
    stays intact regardless of the final column layout.
    """
    df = DataFrame(
        {
            "row": ["r1", "r1", "r2", "r2"],
            "col": ["c1", "c2", "c1", "c2"],
            "a": [10, 20, 30, 40],
            "b": [1, 3, 5, 7],
        }
    )
    result = pivot(
        df=df,
        index=["row"],
        columns=["col"],
        aggregates={"a": {"operator": "sum"}, "b": {"operator": "sum"}},
        combine_value_with_metric=True,
        show_values_as="percent_row",
    )

    # After combine_value_with_metric, the column MultiIndex is
    # ``(category, metric)``. Per-metric row sums are pulled via cross-section
    # on level 1 (the metric axis).
    for metric, expected in (("a", [1.0, 1.0]), ("b", [1.0, 1.0])):
        per_metric = result.xs(metric, axis=1, level=1)
        assert per_metric.sum(axis=1).tolist() == pytest.approx(expected), (
            f"metric {metric!r} rows must each sum to 1.0 after "
            "percent_row on a combined pivot; got contamination from "
            "other metrics"
        )

    # And the actual values match the natural per-metric percentages,
    # not the mixed-metric ones that the bug produced.
    assert result.loc["r1", ("c1", "a")] == pytest.approx(10 / 30)
    assert result.loc["r1", ("c1", "b")] == pytest.approx(1 / 4)


def test_pivot_show_values_as_rejects_non_additive_aggregate() -> None:
    """``show_values_as`` requires additive aggregates.

    For a ``mean`` aggregate, the summed per-cell values are not the
    row/column/grand rollup the DB would compute over the underlying
    rows, so ``cell / sum(cells)`` disagrees with the "share of the
    real row total" the chart shows. Reject up front rather than emit
    numbers that mix with the DB rollup incorrectly.
    """
    with pytest.raises(InvalidPostProcessingError, match="additive"):
        pivot(
            df=_show_values_as_fixture(),
            index=["row"],
            columns=["col"],
            aggregates={"v": {"operator": "mean"}},
            show_values_as="percent_row",
        )


def test_pivot_show_values_as_on_empty_pivot_returns_empty_frame() -> None:
    """Empty inputs must not crash the percent transform.

    An empty pivot with a column grouping has a ``MultiIndex`` with zero
    level-0 groups; the metric-iteration loop then feeds ``pd.concat``
    an empty list and raises ``ValueError: No objects to concatenate``.
    The empty frame should pass through unchanged.
    """
    empty = DataFrame({"row": [], "col": [], "v": []}).astype(
        {"row": str, "col": str, "v": float}
    )
    result = pivot(
        df=empty,
        index=["row"],
        columns=["col"],
        aggregates={"v": {"operator": "sum"}},
        show_values_as="percent_row",
    )
    assert result.empty


def test_pivot_show_values_as_preserves_structural_nan() -> None:
    """Structurally-missing cells (no input rows for that (row, col)) stay NaN.

    NULL preservation is scoped to the structural case: cells that
    ``pivot_table`` left as ``NaN`` because no input row exists for that
    (row, column) group must render as blank (``NaN``), not as ``0%``.
    Value-is-NULL cells are a separate case documented on
    ``_apply_show_values_as``.
    """
    df = DataFrame(
        {
            "row": ["r1", "r2", "r2"],
            "col": ["c1", "c1", "c2"],
            "v": [10.0, 30.0, 40.0],
        }
    )
    result = pivot(
        df=df,
        index=["row"],
        columns=["col"],
        aggregates={"v": {"operator": "sum"}},
        show_values_as="percent_row",
    )
    # r1 has no c2 row → cell is structurally missing → stays NaN.
    assert pd.isna(result.loc["r1", ("v", "c2")])
    # r1's row-total is just c1 (10.0), so c1 is 100%.
    assert result.loc["r1", ("v", "c1")] == pytest.approx(1.0)
