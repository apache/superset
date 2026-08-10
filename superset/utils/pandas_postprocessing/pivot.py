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
from typing import Any, Optional

import pandas as pd
from flask_babel import gettext as _
from pandas import DataFrame

from superset.constants import NULL_STRING, PandasAxis
from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.utils import (
    _get_aggregate_funcs,
    validate_column_args,
)

_PERCENT_MODES = frozenset({"percent_row", "percent_col", "percent_total"})


def _div_preserving_nan(numerator: DataFrame, denominator: Any, axis: int) -> DataFrame:
    """Divide ``numerator`` by ``denominator``, preserving NaN numerators.

    A genuine SQL NULL numerator must stay NaN (rendered blank) rather than
    become ``0.0`` — matches the client-side #42810 semantics guarding
    against measured "0.0%" values for values that should stay blank.
    """
    result = numerator.div(denominator, axis=axis)
    return result.mask(numerator.isna(), other=float("nan"))


def _apply_show_values_as(df: DataFrame, mode: str) -> DataFrame:
    """Divide each metric cell by the appropriate rollup total.

    Mirrors the client-side ``fractionOf`` semantic in
    ``superset-frontend/plugins/plugin-chart-pivot-table/src/react-pivottable/utilities.ts:739``:

    - ``percent_row``:   cell / row-total     (denominator: sum across the columns axis)
    - ``percent_col``:   cell / column-total  (denominator: sum across the rows axis)
    - ``percent_total``: cell / grand-total   (denominator: sum of the whole DataFrame)

    On a multi-metric pivot (``MultiIndex`` columns) the totals are computed
    *within each metric group* — never across metrics — so per-metric totals
    stay separate, matching the client's ``metricAxis`` handling which never
    conflates one metric's numerator with another metric's denominator.

    A zero or NaN denominator produces NaN cells rather than
    ``Infinity``/``NaN`` from division-by-zero, matching the client's
    ``if (acc === null) return null`` guard.
    """
    is_multi_metric = isinstance(df.columns, pd.MultiIndex)

    if mode == "percent_row":
        if is_multi_metric:
            return df.groupby(level=0, axis=1, group_keys=False).apply(
                lambda g: _div_preserving_nan(
                    g,
                    g.sum(axis=PandasAxis.COLUMN, skipna=True).replace(0, float("nan")),
                    axis=PandasAxis.ROW,
                )
            )
        return _div_preserving_nan(
            df,
            df.sum(axis=PandasAxis.COLUMN, skipna=True).replace(0, float("nan")),
            axis=PandasAxis.ROW,
        )

    if mode == "percent_col":
        if is_multi_metric:
            return df.groupby(level=0, axis=1, group_keys=False).apply(
                lambda g: _div_preserving_nan(
                    g,
                    g.sum(axis=PandasAxis.ROW, skipna=True).replace(0, float("nan")),
                    axis=PandasAxis.COLUMN,
                )
            )
        return _div_preserving_nan(
            df,
            df.sum(axis=PandasAxis.ROW, skipna=True).replace(0, float("nan")),
            axis=PandasAxis.COLUMN,
        )

    if mode == "percent_total":
        if is_multi_metric:

            def _per_metric_total(g: DataFrame) -> DataFrame:
                grand = g.sum(skipna=True).sum(skipna=True)
                if pd.isna(grand) or grand == 0:
                    return g * float("nan")
                return _div_preserving_nan(g, grand, axis=PandasAxis.ROW)

            return df.groupby(level=0, axis=1, group_keys=False).apply(
                _per_metric_total
            )
        grand = df.sum(skipna=True).sum(skipna=True)
        if pd.isna(grand) or grand == 0:
            return df * float("nan")
        return _div_preserving_nan(df, grand, axis=PandasAxis.ROW)

    return df


def _restore_dropped_metric_columns(
    df: DataFrame,
    expected_metrics: list[str],
    orig_columns: Optional[DataFrame],
) -> DataFrame:
    """Re-add metric columns that pivot_table dropped due to all-NaN values.

    When drop_missing_columns=True, pandas pivot_table silently removes columns
    whose entries are all NaN. This breaks downstream post-processing steps
    (rename, rolling) that use validate_column_args to assert the columns exist.
    Restoring the columns as all-NaN preserves the expected schema while still
    allowing sparse category combinations to be dropped — only metric-level
    absences are restored.

    Note: this intentionally changes the visible output of drop_missing_columns=True
    for all-NaN metrics: they are kept as empty series rather than dropped. This is
    necessary for chart-rendering post-processing to maintain schema stability.

    :param df: Post-pivot DataFrame (may have MultiIndex or flat columns).
    :param expected_metrics: Metric column names that should exist at level 0.
    :param orig_columns: Pre-pivot slice of the groupby column(s), used to
           lazily compute (metric, *col_vals) restoration keys for only the
           metrics that were entirely absent after pivoting. None for flat pivots.
    """
    if orig_columns is not None:
        # MultiIndex case. Only compute keys for metrics that were entirely
        # dropped — skips metrics still present, avoiding O(n_rows × n_metrics)
        # upfront work when no all-NaN drop occurred.
        existing_metrics = (
            set(df.columns.get_level_values(0)) if len(df.columns) > 0 else set()
        )
        missing = {m for m in expected_metrics if m not in existing_metrics}
        if missing:
            # Dict preserves data-insertion order and deduplicates, so restored
            # columns appear in deterministic order.
            keys_dict: dict[tuple[Any, ...], None] = {}
            for row in orig_columns.itertuples():
                for metric in missing:
                    keys_dict[(metric, *row[1:])] = None
            for key in keys_dict:
                df[key] = float("nan")
    else:
        # Flat case (no groupby columns): restore simple metric columns.
        for metric in expected_metrics:
            if metric not in df.columns:
                df[metric] = float("nan")
    return df


@validate_column_args("index", "columns")
def pivot(  # pylint: disable=too-many-arguments  # noqa: C901
    df: DataFrame,
    index: list[str],
    aggregates: dict[str, dict[str, Any]],
    columns: Optional[list[str]] = None,
    metric_fill_value: Optional[Any] = None,
    column_fill_value: Optional[str] = NULL_STRING,
    drop_missing_columns: Optional[bool] = True,
    combine_value_with_metric: bool = False,
    marginal_distributions: Optional[bool] = None,
    marginal_distribution_name: Optional[str] = None,
    show_values_as: Optional[str] = None,
) -> DataFrame:
    """
    Perform a pivot operation on a DataFrame.

    :param df: Object on which pivot operation will be performed
    :param index: Columns to group by on the table index (=rows)
    :param columns: Columns to group by on the table columns
    :param metric_fill_value: Value to replace missing values with
    :param column_fill_value: Value to replace missing pivot columns with. By default
           replaces missing values with "<NULL>". Set to `None` to remove columns
           with missing values.
    :param drop_missing_columns: Do not include columns whose entries are all missing.
           Note: metric columns entirely absent after pivoting (the whole metric is
           all-NaN) are restored as empty series so that downstream post-processing
           (rename, rolling) can reference them. Sparse category combinations where
           only some (metric, category) pairs are all-NaN may still be dropped.
    :param combine_value_with_metric: Display metrics side by side within each column,
           as opposed to each column being displayed side by side for each metric.
    :param aggregates: A mapping from aggregate column name to the aggregate
           config.
    :param marginal_distributions: Add totals for row/column. Default to False
    :param marginal_distribution_name: Name of row/column with marginal distribution.
           Default to 'All'.
    :param show_values_as: Optional post-pivot transform that expresses each
           metric cell as a fraction of the row / column / grand total.
           One of ``"percent_row"``, ``"percent_col"``, ``"percent_total"`` or
           ``None`` / ``"actual"`` (no-op, default). Mirrors the pivot chart's
           client-side ``fractionOf`` semantic so server-side rendering paths
           (CSV / XLSX exports, scheduled reports) can reproduce the browser
           output. See #42809.
    :return: A pivot table
    :raises InvalidPostProcessingError: If the request in incorrect
    """
    if not index:
        raise InvalidPostProcessingError(
            _("Pivot operation requires at least one index")
        )
    if not aggregates:
        raise InvalidPostProcessingError(
            _("Pivot operation must include at least one aggregate")
        )

    if columns and column_fill_value:
        df[columns] = df[columns].fillna(value=column_fill_value)

    aggregate_funcs = _get_aggregate_funcs(df, aggregates)

    # TODO (villebro): Pandas 1.0.3 doesn't yet support NamedAgg in pivot_table.
    #  Remove once/if support is added.
    aggfunc = {na.column: na.aggfunc for na in aggregate_funcs.values()}

    # For drop_missing_columns=False: pre-compute all (metric, *col_vals) tuples
    # to filter Cartesian-product columns after pivoting.
    # For drop_missing_columns=True: save a slice of the groupby column data so
    # that _restore_dropped_metric_columns can build keys lazily — only for metrics
    # that were actually dropped, avoiding O(n_rows × n_metrics) upfront work in
    # the common case where no metric is entirely all-NaN.
    # https://github.com/apache/superset/issues/15956
    # https://github.com/pandas-dev/pandas/issues/18030
    pivot_key_set: set[tuple[Any, ...]] = set()
    if not drop_missing_columns and columns:
        for row in df[columns].itertuples():
            for metric in aggfunc.keys():
                pivot_key_set.add((metric, *row[1:]))
    orig_columns_df = df[columns] if columns else None

    df = df.pivot_table(
        values=aggfunc.keys(),
        index=index,
        columns=columns,
        aggfunc=aggfunc,
        fill_value=metric_fill_value,
        dropna=drop_missing_columns,
        margins=marginal_distributions,
        margins_name=marginal_distribution_name,
    )

    if drop_missing_columns:
        df = _restore_dropped_metric_columns(df, list(aggfunc.keys()), orig_columns_df)
    elif pivot_key_set and not df.empty:
        df = df.drop(df.columns.difference(pivot_key_set), axis=PandasAxis.COLUMN)

    if combine_value_with_metric:
        # dropna=False preserves restored all-NaN metric rows that would otherwise
        # be silently dropped by stack's default dropna=True behavior.
        df = df.stack(level=0, dropna=False).unstack()

    if show_values_as and show_values_as != "actual":
        if show_values_as not in _PERCENT_MODES:
            raise InvalidPostProcessingError(
                _(
                    "Unsupported show_values_as value: %(mode)s. "
                    "Expected one of: percent_row, percent_col, percent_total, actual.",
                    mode=show_values_as,
                )
            )
        df = _apply_show_values_as(df, show_values_as)

    return df
