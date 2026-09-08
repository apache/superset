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
"""
Functions to reproduce the client post-processing of data on charts.

Some text-based charts (pivot tables and t-test table) perform post-processing of the
data in JavaScript. When sending the data to users in reports we want to show the same
data they would see on Explore.

In order to do that, we reproduce the post-processing in Python for these chart types.
"""

import logging
from collections.abc import Callable
from functools import partial
from io import BytesIO, StringIO
from typing import Any, Optional, TYPE_CHECKING, Union

import numpy as np
import pandas as pd
from flask import current_app
from flask_babel import gettext as __

from superset.common.chart_data import ChartDataResultFormat
from superset.common.grouping_sets import GROUPING_MARKER_SUFFIX
from superset.constants import SHOW_VALUES_AS_PERCENT_MODES, ShowValuesAs
from superset.extensions import event_logger
from superset.utils import csv, excel
from superset.utils.core import (
    extract_dataframe_dtypes,
    get_column_names,
    get_metric_name,
    get_metric_names,
)
from superset.utils.number_format import (
    AUTO_CURRENCY,
    format_number_with_config,
    resolve_auto_currency,
    SMART_NUMBER,
)

if TYPE_CHECKING:
    from superset.connectors.sqla.models import BaseDatasource
    from superset.models.sql_lab import Query


logger = logging.getLogger(__name__)

# Default d3 format the Table plugin applies to percent metrics, mirroring
# ``number-format/NumberFormats.ts::PERCENT_3_POINT`` as used in the frontend's
# ``transformProps`` formatter selection.
PERCENT_3_POINT = ",.3%"

# The pivot renderer formats a fraction with ``usFmtPct``
# (``react-pivottable/utilities.ts``), which is one decimal place -- not the
# Table plugin's three.
PERCENT_1_POINT = ",.1%"

# The Excel equivalent, applied as a cell format so the value stays numeric.
EXCEL_PERCENT_FORMAT = "0.0%"


def get_column_key(label: tuple[str, ...], metrics: list[str]) -> tuple[Any, ...]:
    """
    Sort columns when combining metrics.

    MultiIndex labels have the metric name as the last element in the
    tuple. We want to sort these according to the list of passed metrics.
    """
    parts: list[Any] = list(label)
    metric = parts[-1]
    parts[-1] = metrics.index(metric)
    return tuple(parts)


# How a metric's rollup total is derived from its cells, mirroring
# `additiveReducerFor` in the pivot plugin's `plugin/utilities.ts`: SUM and
# COUNT add up, MIN takes the lowest, MAX the highest. Everything else (saved
# metrics, adhoc SQL, AVG, ...) is non-additive and has no correct answer at
# this layer, so it falls back to summing the cells.
_ROLLUP_REDUCERS: dict[str, str] = {"MIN": "min", "MAX": "max"}
DEFAULT_ROLLUP_REDUCER = "sum"


def split_grouping_sets_levels(
    df: pd.DataFrame,
) -> tuple[pd.DataFrame, dict[frozenset[str], pd.DataFrame]]:
    """
    Separate a GROUPING SETS result into its leaf frame and rollup levels.

    A pivot chart with non-additive metrics asks for every rollup level in one
    frame, tagging each row with a ``GROUPING()`` marker per groupby column
    (see ``common/grouping_sets.py``): ``0`` where the column is grouped at that
    row's level, ``1`` where it has been rolled up. The rollup rows must not be
    pivoted as ordinary rows -- their collapsed dimensions are NULL, so they
    would add phantom rows and columns and inflate every denominator.

    They are not discardable either: for a non-additive metric the database
    rollup is the only correct total, and re-deriving one from the leaf cells
    gives a different number (the mean of means, say, rather than the mean).
    The chart divides by these values, so the export has to as well.

    :return: the leaf frame, and each rollup level keyed by its grouped columns
    """
    markers = [
        column
        for column in df.columns
        if isinstance(column, str) and column.endswith(GROUPING_MARKER_SUFFIX)
    ]
    if not markers:
        return df, {}

    grouped_of = {marker: marker[: -len(GROUPING_MARKER_SUFFIX)] for marker in markers}
    levels: dict[frozenset[str], pd.DataFrame] = {}
    leaf = df
    for keys, rows_at_level in df.groupby(markers, sort=False):
        # `groupby` yields a scalar key for a single column and a tuple beyond.
        marker_values = keys if isinstance(keys, tuple) else (keys,)
        grouped = frozenset(
            grouped_of[marker]
            for marker, rolled_up in zip(markers, marker_values, strict=True)
            if not rolled_up
        )
        level = rows_at_level.drop(columns=markers).reset_index(drop=True)
        levels[grouped] = level
        if len(grouped) == len(markers):
            leaf = level
    return leaf, levels


def get_metric_rollup_reducers(
    metrics: list[Any], verbose_map: Optional[dict[str, Any]] = None
) -> dict[str, str]:
    """Map each metric's label to the reducer that rolls its cells up."""
    reducers: dict[str, str] = {}
    for metric in metrics:
        reducer = DEFAULT_ROLLUP_REDUCER
        if isinstance(metric, dict) and metric.get("expressionType") == "SIMPLE":
            reducer = _ROLLUP_REDUCERS.get(
                metric.get("aggregate") or "", DEFAULT_ROLLUP_REDUCER
            )
        reducers[get_metric_name(metric, verbose_map)] = reducer
    return reducers


def _collapsed_metric(present: list[Any], metrics: list[str]) -> Any:
    """
    The metric a rollup spanning `present` stands for.

    A total that collapses the metric axis is undefined in the renderer, which
    resolves it to the last metric pushed into the shared slot (see the
    ``metricAxis`` handling in ``react-pivottable/utilities.ts``). Mirror that
    by taking the last metric in the configured order, so exported percentages
    match the chart rather than summing metrics that share no unit.
    """
    distinct = set(present)
    if len(distinct) == 1:
        return distinct.pop()
    for metric in reversed(metrics):
        if metric in distinct:
            return metric
    return None


def _broadcast(total: pd.Series, block: pd.DataFrame, axis: int) -> pd.DataFrame:
    """Spread a per-row (`axis` 0) or per-column (`axis` 1) total over `block`."""
    if axis == 0:
        spread = pd.concat([total] * len(block.columns), axis=1)
        spread.columns = block.columns
        return spread
    return pd.DataFrame(
        np.tile(total.reindex(block.columns).to_numpy(), (len(block.index), 1)),
        index=block.index,
        columns=block.columns,
    )


def _metric_of_column(column: Any, metric_level: int) -> Any:
    """The metric a pivoted column belongs to."""
    return column[metric_level] if isinstance(column, tuple) else column


def _reduce(
    data: Union[pd.DataFrame, pd.Series],
    reducer: str,
    axis: Optional[int] = None,
) -> Any:
    """Apply a rollup reducer (``sum``/``min``/``max``), skipping empty cells."""
    method = getattr(data, reducer)
    return method(axis=axis) if axis is not None else method()


def _rollup_index(
    rollup_levels: dict[frozenset[str], pd.DataFrame],
) -> Callable[[list[str]], dict[tuple[str, ...], dict[str, Any]]]:
    """
    Index each rollup level by its grouped dimension values, on first use.

    Reshaping a level costs a `fillna` and a `to_dict` over the whole frame, so
    it is done once per level rather than once per cell -- the difference
    between linear and quadratic on a large pivot.
    """
    cache: dict[tuple[str, ...], dict[tuple[str, ...], dict[str, Any]]] = {}

    def keyed(dimensions: list[str]) -> dict[tuple[str, ...], dict[str, Any]]:
        cache_key = tuple(dimensions)
        if cache_key not in cache:
            level = rollup_levels.get(frozenset(dimensions))
            cache[cache_key] = (
                {}
                if level is None
                else {
                    tuple(str(record[dimension]) for dimension in dimensions): record
                    for record in level.fillna("SUPERSET_PANDAS_NAN").to_dict("records")
                }
            )
        return cache[cache_key]

    return keyed


def _rollup_key(
    label: Any, depth: int, metric_level: int, is_column: bool
) -> tuple[str, ...]:
    """The grouped dimension values a pivoted row or column label carries."""
    parts = list(label) if isinstance(label, tuple) else [label]
    if is_column:
        # The column label interleaves the metric with the dimension values.
        parts = [part for index, part in enumerate(parts) if index != metric_level]
    return tuple(str(part) for part in parts[:depth])


def _apply_rollup_totals(  # pylint: disable=too-many-arguments,too-many-locals
    df: pd.DataFrame,
    rows: list[str],
    columns: list[str],
    metrics: list[str],
    rollup_levels: dict[frozenset[str], pd.DataFrame],
    metric_level: int,
    row_prefix_depth: dict[Any, int],
    column_prefix_depth: dict[Any, int],
) -> pd.DataFrame:
    """
    Replace inserted totals with the values the database computed.

    A total grouping ``i`` row and ``j`` column dimensions is exactly the rollup
    level over ``rows[:i] + columns[:j]``, which ``buildGroupbyCombinations``
    requests whenever the chart displays that total. Reading it keeps the export
    equal to the chart for a non-additive metric, where reducing the leaf cells
    gives a different number.

    A total the chart did not request keeps its leaf-derived value, so a missing
    level degrades to the previous behaviour. A total the database returned as
    NULL is kept as NULL, which is not the same thing -- the chart renders that
    cell blank.
    """
    keyed = _rollup_index(rollup_levels)
    metric_names = set(metrics)

    def metric_of(column: Any) -> Any:
        name = _metric_of_column(column, metric_level)
        return (
            name if name in metric_names else _collapsed_metric(list(metrics), metrics)
        )

    def lookup(row: Any, column: Any) -> tuple[bool, Any]:
        row_depth = row_prefix_depth.get(row, len(rows))
        column_depth = column_prefix_depth.get(column, len(columns))
        grouped = rows[:row_depth] + columns[:column_depth]
        key = _rollup_key(row, row_depth, metric_level, is_column=False) + _rollup_key(
            column, column_depth, metric_level, is_column=True
        )
        record = keyed(grouped).get(key)
        if record is None:
            return False, None
        return True, record.get(metric_of(column))

    # Index positionally: a tuple label on a MultiIndex is ambiguous to `.loc`.
    for column_position, column in enumerate(df.columns):
        for row_position, row in enumerate(df.index):
            if row not in row_prefix_depth and column not in column_prefix_depth:
                continue  # a leaf cell, already carrying its own value
            found, value = lookup(row, column)
            if found:
                df.iloc[row_position, column_position] = value
    return df


def _rollup_denominators(  # pylint: disable=too-many-arguments,too-many-locals
    df: pd.DataFrame,
    mode: str,
    rows: list[str],
    columns: list[str],
    metrics: list[str],
    rollup_levels: dict[frozenset[str], pd.DataFrame],
    metric_level: int,
    row_prefix_depth: dict[Any, int],
    column_prefix_depth: dict[Any, int],
    metrics_on_rows: bool,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Each cell's denominator, taken from the database-computed rollup levels.

    A percent mode makes the chart request the level its denominator needs: for
    "% of row" the cell's own row with the columns collapsed, for "% of column"
    the reverse, for "% of total" both (see ``buildGroupbyCombinations``). A
    subtotal divides by its own prefix, not by the grand total -- an "EU"
    subtotal row divides by the ``{region}`` rollup.

    The metrics layout decides which frame axis carries the displayed rows, so
    "% of row" groups the column dimensions when metrics sit on rows.

    :return: the denominators, and a mask of the cells the database resolved.
        A resolved cell holding NULL stays NULL, where an unresolved one lets
        the caller fall back to a leaf-derived total.
    """
    keyed = _rollup_index(rollup_levels)
    metric_names = set(metrics)

    def metric_of(column: Any) -> Any:
        name = _metric_of_column(column, metric_level)
        return (
            name if name in metric_names else _collapsed_metric(list(metrics), metrics)
        )

    def denominator(row: Any, column: Any) -> tuple[bool, Any]:
        if mode == ShowValuesAs.PERCENT_OF_TOTAL:
            grouped: list[str] = []
            key: tuple[str, ...] = ()
        else:
            # The displayed row axis is the frame index, unless the metrics
            # layout moved it to the columns.
            along_index = (mode == ShowValuesAs.PERCENT_OF_ROW) != metrics_on_rows
            if along_index:
                depth = row_prefix_depth.get(row, len(rows))
                grouped = rows[:depth]
                key = _rollup_key(row, depth, metric_level, is_column=False)
            else:
                depth = column_prefix_depth.get(column, len(columns))
                grouped = columns[:depth]
                key = _rollup_key(column, depth, metric_level, is_column=True)
        record = keyed(grouped).get(key)
        if record is None:
            return False, None
        return True, record.get(metric_of(column))

    resolved = [[denominator(row, column) for column in df.columns] for row in df.index]
    values = pd.DataFrame(
        [[value for _, value in row] for row in resolved],
        index=df.index,
        columns=df.columns,
    )
    found = pd.DataFrame(
        [[hit for hit, _ in row] for row in resolved],
        index=df.index,
        columns=df.columns,
    )
    return values.apply(pd.to_numeric, errors="coerce").astype(float), found


def _apply_show_values_as(  # pylint: disable=too-many-arguments
    df: pd.DataFrame,
    mode: str,
    axis: dict[str, int],
    metrics: list[str],
    combine_metrics: bool,
    inserted_rows: list[Any],
    inserted_columns: list[Any],
    reducers: dict[str, str],
    denominators: Optional[tuple[pd.DataFrame, pd.DataFrame]] = None,
) -> pd.DataFrame:
    """
    Express each cell as a fraction of its row, column, or grand total.

    Mirrors the client's ``fractionOf`` aggregator in
    ``plugin-chart-pivot-table/src/react-pivottable/utilities.ts``. Two details
    it inherits from there:

    - Denominators are summed over leaf cells only. Totals and subtotals
      inserted into the frame are numerators like any other cell -- a "% of
      row" grand total row reads ``column total / grand total``, not the sum of
      the fractions above it.
    - A total is rolled up within a single metric, so a cell is never divided by
      a total that mixes in another metric, and each metric uses its own
      reducer -- a MIN/MAX metric divides by the row's minimum/maximum rather
      than its sum. A total that collapses the metric axis resolves to a single
      metric the way the renderer does; see ``_collapsed_metric``.

    A zero denominator yields NaN (blank) rather than infinity, matching
    ``pandas_postprocessing.pivot``'s ``show_values_as``.
    """
    numeric = df.apply(pd.to_numeric, errors="coerce").astype(float)
    is_multi_index = isinstance(df.columns, pd.MultiIndex)
    # `combine_metrics` has already moved the metric to the lowest column level.
    metric_level = df.columns.nlevels - 1 if combine_metrics and is_multi_index else 0
    metric_names = set(metrics)
    metric_of_column = [
        key if key in metric_names else None
        for key in df.columns.get_level_values(metric_level)
    ]
    leaf_rows = ~df.index.isin(inserted_rows)
    leaf_columns = ~df.columns.isin(inserted_columns)

    derived = pd.DataFrame(np.nan, index=numeric.index, columns=numeric.columns)
    for metric in dict.fromkeys(metric_of_column):
        selection = np.array([column == metric for column in metric_of_column])
        denominator_selection = (
            selection if metric is not None else np.ones(len(selection), dtype=bool)
        )
        # Derive the reducer from the columns forming the denominator, not from
        # the numerator's own label: a total column carries a total label, but
        # must still divide by a rollup of the metric it totals.
        denominator_metric = _collapsed_metric(
            [
                column_metric
                for column_metric, keep in zip(
                    metric_of_column, denominator_selection, strict=True
                )
                if keep and column_metric is not None
            ],
            metrics,
        )
        reducer = reducers.get(str(denominator_metric), DEFAULT_ROLLUP_REDUCER)
        if denominator_metric is not None:
            denominator_selection = denominator_selection & np.array(
                [column == denominator_metric for column in metric_of_column]
            )
        block = numeric.loc[:, selection]
        if mode == ShowValuesAs.PERCENT_OF_TOTAL:
            leaf = numeric.loc[leaf_rows, leaf_columns & denominator_selection]
            # Reduce through pandas, not numpy: a sparse pivot leaves NaN in
            # cells whose group had no rows, and numpy would propagate that to
            # the grand total, blanking every cell.
            grand_total = _reduce(_reduce(leaf, reducer, axis=0), reducer)
            group_denominator = pd.DataFrame(
                np.nan if pd.isna(grand_total) else grand_total,
                index=block.index,
                columns=block.columns,
            )
        else:
            summed, divided = (
                (axis["rows"], axis["columns"])
                if mode == ShowValuesAs.PERCENT_OF_COLUMN
                else (axis["columns"], axis["rows"])
            )
            # The metric lives on the column axis, so only a rollup taken along
            # that axis has to stay within one metric.
            leaf = (
                numeric.loc[:, leaf_columns & denominator_selection]
                if summed == 1
                else numeric.loc[leaf_rows, :]
            )
            total = _reduce(leaf, reducer, axis=summed)
            group_denominator = _broadcast(total, block, divided)
        derived.loc[:, selection] = group_denominator

    denominator = derived
    if denominators is not None:
        # Database-computed rollups win wherever the chart requested the level.
        # Mask on whether the level resolved, not on whether the value is null:
        # a rollup the database returned as NULL leaves the cell blank, as the
        # chart does, while an unrequested level falls back to the leaf total.
        values, found = denominators
        denominator = derived.mask(found, values)
    return numeric / denominator.replace(0, np.nan)


def pivot_df(  # pylint: disable=too-many-locals, too-many-arguments, too-many-statements, too-many-branches  # noqa: C901
    df: pd.DataFrame,
    rows: list[str],
    columns: list[str],
    metrics: list[str],
    aggfunc: str = "Sum",
    transpose_pivot: bool = False,
    combine_metrics: bool = False,
    show_rows_total: bool = False,
    show_columns_total: bool = False,
    apply_metrics_on_rows: bool = False,
    metric_name_aggfunc: Optional[str] = None,
    show_values_as: Optional[str] = None,
    metric_rollup_reducers: Optional[dict[str, str]] = None,
    rollup_levels: Optional[dict[frozenset[str], pd.DataFrame]] = None,
) -> pd.DataFrame:
    percent_mode = (
        show_values_as if show_values_as in SHOW_VALUES_AS_PERCENT_MODES else None
    )
    reducers = metric_rollup_reducers or {}
    if percent_mode:
        # The chart ignores `aggregateFunction` post-SIP-216: cells arrive
        # pre-aggregated from the database and totals are per-metric rollups of
        # them. Match that here so the totals and the percent denominators
        # cannot disagree -- otherwise a total stops dividing by itself and the
        # Total row/column reads something other than 100%.
        aggfunc = "Sum"
    metric_name = __("Total (%(aggfunc)s)", aggfunc=metric_name_aggfunc or aggfunc)
    # Labels of the total/subtotal rows and columns inserted below, so the
    # `showValuesAs` denominators can be summed over leaf cells only.
    inserted_rows: list[Any] = []
    inserted_columns: list[Any] = []
    # How many dimensions of its own axis each inserted total still groups; 0
    # collapses the axis entirely. Together with the other axis they name the
    # rollup level holding that total's database-computed value.
    row_prefix_depth: dict[Any, int] = {}
    column_prefix_depth: dict[Any, int] = {}

    if transpose_pivot:
        rows, columns = columns, rows

    # to apply the metrics on the rows we pivot the dataframe, apply the
    # metrics to the columns, and pivot the dataframe back before
    # returning it
    if apply_metrics_on_rows:
        rows, columns = columns, rows
        # The frame is transposed on the way out, which flips the axis each
        # total was inserted on. Swap the toggles too, so `rowTotals` still
        # means the right-hand Total column of the rendered table, whether or
        # not there are column dimensions to group by.
        show_rows_total, show_columns_total = show_columns_total, show_rows_total
        axis = {"columns": 0, "rows": 1}
    else:
        axis = {"columns": 1, "rows": 0}

    # pivoting with null values will create an empty df
    df = df.fillna("SUPERSET_PANDAS_NAN")

    # pivot data; we'll compute totals and subtotals later
    if rows or columns:
        df = df.pivot_table(
            index=rows,
            columns=columns,
            values=metrics,
            aggfunc=pivot_v2_aggfunc_map[aggfunc],
            margins=False,
        )
    else:
        # if there's no rows nor columns we have a single value; update
        # the index with the metric name so it shows up in the table
        df.index = pd.Index([*df.index[:-1], metric_name], name="metric")

    # if no rows were passed the metrics will be in the rows, so we
    # need to move them back to columns
    if columns and not rows:
        df = df.stack()
        if not isinstance(df, pd.DataFrame):
            df = df.to_frame()
        df = df.T
        df = df[metrics]
        df.index = pd.Index([*df.index[:-1], metric_name], name="metric")

    # combining metrics changes the column hierarchy, moving the metric
    # from the top to the bottom, eg:
    #
    # ('SUM(col)', 'age', 'name') => ('age', 'name', 'SUM(col)')
    if combine_metrics and isinstance(df.columns, pd.MultiIndex):
        # move metrics to the lowest level
        new_order = [*range(1, df.columns.nlevels), 0]
        df = df.reorder_levels(new_order, axis=1)

        # sort columns, combining metrics for each group
        decorated_columns = [(col, i) for i, col in enumerate(df.columns)]
        grouped_columns = sorted(
            decorated_columns, key=lambda t: get_column_key(t[0], metrics)
        )
        indexes = [i for col, i in grouped_columns]
        df = df[df.columns[indexes]]
    elif rows:
        # if metrics were not combined we sort the dataframe by the list
        # of metrics defined by the user
        df = df[metrics]

    # Compute fractions, if needed. `showValuesAs` supersedes the pre-SIP-216
    # "... as Fraction of ..." aggregate functions, and is applied after the
    # totals below so each total divides by its own rollup, as the chart does.
    if not percent_mode:
        if aggfunc.endswith(" as Fraction of Total"):
            total = df.sum().sum()
            df = df.astype(total.dtypes) / total
        elif aggfunc.endswith(" as Fraction of Columns"):
            total = df.sum(axis=axis["rows"])
            df = df.astype(total.dtypes).div(total, axis=axis["columns"])
        elif aggfunc.endswith(" as Fraction of Rows"):
            total = df.sum(axis=axis["columns"])
            df = df.astype(total.dtypes).div(total, axis=axis["rows"])

    # convert to a MultiIndex to simplify logic
    if not isinstance(df.index, pd.MultiIndex):
        df.index = pd.MultiIndex.from_tuples([(str(i),) for i in df.index])
    if not isinstance(df.columns, pd.MultiIndex):
        df.columns = pd.MultiIndex.from_tuples([(str(i),) for i in df.columns])

    # Rollups follow each metric's own reducer under a percent mode, so a total
    # still divides by itself: a MAX metric's row total is the row's maximum,
    # and dividing that maximum by itself reads 100%.
    totals_metric_level = df.columns.nlevels - 1 if combine_metrics else 0
    # A column carrying a total label rather than a metric name rolls up
    # everything; with no metric to resolve it to, it sums.
    cross_metric_reducer = (
        reducers.get(metrics[0], DEFAULT_ROLLUP_REDUCER)
        if len(set(metrics)) == 1
        else DEFAULT_ROLLUP_REDUCER
    )

    def collapse(block: pd.DataFrame) -> tuple[pd.DataFrame, str]:
        """Narrow a total's source columns to one metric, and pick its reducer."""
        metric_names = set(metrics)
        present = [
            _metric_of_column(column, totals_metric_level) for column in block.columns
        ]
        known = [metric for metric in present if metric in metric_names]
        metric = _collapsed_metric(known, metrics) if known else None
        if metric is None:
            return block, cross_metric_reducer
        keep = [column == metric for column in present]
        return block.loc[:, keep], reducers.get(str(metric), DEFAULT_ROLLUP_REDUCER)

    if show_rows_total:
        # add subtotal for each group and overall total; we start from the
        # overall group, and iterate deeper into subgroups
        groups = df.columns
        if not apply_metrics_on_rows:
            for col in df.columns:
                # we need to replace the temporary placeholder with either a string
                # or np.nan, depending on the column type so that they can sum correctly
                if pd.api.types.is_numeric_dtype(df[col]):
                    df[col].replace("SUPERSET_PANDAS_NAN", np.nan, inplace=True)
                else:
                    df[col].replace("SUPERSET_PANDAS_NAN", "nan", inplace=True)
        else:
            # when we applied metrics on rows, we switched the columns and rows
            # so checking column type doesn't apply. Replace everything with np.nan
            df.replace("SUPERSET_PANDAS_NAN", np.nan, inplace=True)
        for level in range(df.columns.nlevels):
            subgroups = {group[:level] for group in groups}
            for subgroup in subgroups:
                slice_ = df.columns.get_loc(subgroup)
                block = df.iloc[:, slice_]
                if aggfunc != CURRENCY_CONTEXT_AGGREGATION:
                    # A metric column can hold non-numeric values (a literal
                    # "NULL", say), which a reduction across columns cannot add
                    # to a number. The row totals below already coerce; do the
                    # same here so a total means the same thing on both axes.
                    block = block.apply(pd.to_numeric, errors="coerce")
                if percent_mode:
                    source, reducer = collapse(block)
                    subtotal = _reduce(source, reducer, axis=1)
                else:
                    subtotal = pivot_v2_aggfunc_map[aggfunc](block, axis=1)
                depth = df.columns.nlevels - len(subgroup) - 1
                total = metric_name if level == 0 else __("Subtotal")
                subtotal_name = tuple([*subgroup, total, *([""] * depth)])  # noqa: C409
                # insert column after subgroup
                df.insert(int(slice_.stop), subtotal_name, subtotal)
                inserted_columns.append(subtotal_name)
                column_prefix_depth[subtotal_name] = (
                    level if combine_metrics else max(0, level - 1)
                )

    if rows and show_columns_total:
        # add subtotal for each group and overall total; we start from the
        # overall group, and iterate deeper into subgroups
        groups = df.index
        for level in range(df.index.nlevels):
            subgroups = {group[:level] for group in groups}
            for subgroup in subgroups:
                try:
                    slice_ = df.index.get_loc(subgroup)
                except Exception:  # pylint: disable=broad-except
                    logger.exception(
                        "Error getting location for subgroup %s from %s",
                        subgroup,
                        groups,
                    )
                    raise

                subtotal_values = df.iloc[slice_, :]
                if aggfunc != CURRENCY_CONTEXT_AGGREGATION:
                    subtotal_values = subtotal_values.apply(
                        pd.to_numeric, errors="coerce"
                    )
                if percent_mode:
                    subtotal = subtotal_values.apply(
                        lambda series: _reduce(series, collapse(series.to_frame())[1])
                    )
                else:
                    subtotal = pivot_v2_aggfunc_map[aggfunc](subtotal_values, axis=0)
                depth = groups.nlevels - len(subgroup) - 1
                total = metric_name if level == 0 else __("Subtotal")
                subtotal.name = tuple([*subgroup, total, *([""] * depth)])  # noqa: C409
                # insert row after subgroup
                df = pd.concat(
                    [df[: slice_.stop], subtotal.to_frame().T, df[slice_.stop :]]
                )
                inserted_rows.append(subtotal.name)
                row_prefix_depth[subtotal.name] = level

    if percent_mode and rollup_levels:
        df = _apply_rollup_totals(
            df,
            rows,
            columns,
            metrics,
            rollup_levels,
            totals_metric_level,
            row_prefix_depth,
            column_prefix_depth,
        )

    if percent_mode:
        df = _apply_show_values_as(
            df,
            percent_mode,
            axis,
            metrics,
            combine_metrics,
            inserted_rows,
            inserted_columns,
            reducers,
            _rollup_denominators(
                df,
                percent_mode,
                rows,
                columns,
                metrics,
                rollup_levels or {},
                totals_metric_level,
                row_prefix_depth,
                column_prefix_depth,
                apply_metrics_on_rows,
            )
            if rollup_levels
            else None,
        )

    # if we want to apply the metrics on the rows we need to pivot the
    # dataframe back
    if apply_metrics_on_rows:
        df = df.T

    # replace the remaining temporary placeholder string for np.nan after pivoting
    df.replace("SUPERSET_PANDAS_NAN", np.nan, inplace=True)
    df.rename(
        index={"SUPERSET_PANDAS_NAN": np.nan},
        columns={"SUPERSET_PANDAS_NAN": np.nan},
        inplace=True,
    )

    return df


def list_unique_values(series: pd.Series) -> str:
    """
    List unique values in a series.
    """
    return ", ".join({str(v) for v in pd.Series.unique(series)})


def union_currency_context(
    values: Union[pd.Series, pd.DataFrame], axis: int = 0
) -> Union[tuple[str, ...], pd.Series]:
    """Union the currency sets contributing to a Pivot Table cell or total."""
    if isinstance(values, pd.DataFrame):
        contexts = (
            [union_currency_context(values[column]) for column in values.columns]
            if axis == 0
            else [union_currency_context(values.loc[index]) for index in values.index]
        )
        index = values.columns if axis == 0 else values.index
        return pd.Series(contexts, index=index, dtype=object)

    currencies: dict[str, None] = {}
    for value in values:
        if isinstance(value, (list, set, frozenset, tuple)):
            currencies.update((str(currency), None) for currency in value)
    return tuple(currencies)


CURRENCY_CONTEXT_AGGREGATION = "__currency_context__"

# The frontend's plain Count aggregator is the only Pivot Table aggregator
# without ``getCurrencies()``. Fraction wrappers inherit that absence, so these
# modes use the query-wide detected fallback instead of per-cell context.
PIVOT_AGGREGATIONS_WITHOUT_CURRENCY_CONTEXT = frozenset(
    {
        "Count",
        "Count as Fraction of Total",
        "Count as Fraction of Rows",
        "Count as Fraction of Columns",
    }
)


pivot_v2_aggfunc_map = {
    "Count": pd.Series.count,
    "Count Unique Values": pd.Series.nunique,
    "List Unique Values": list_unique_values,
    "Sum": pd.Series.sum,
    "Average": pd.Series.mean,
    "Median": pd.Series.median,
    "Sample Variance": lambda series: pd.series.var(series) if len(series) > 1 else 0,
    "Sample Standard Deviation": (
        lambda series: pd.series.std(series) if len(series) > 1 else 0,
    ),
    "Minimum": pd.Series.min,
    "Maximum": pd.Series.max,
    "First": lambda series: series[:1],
    "Last": lambda series: series[-1:],
    "Sum as Fraction of Total": pd.Series.sum,
    "Sum as Fraction of Rows": pd.Series.sum,
    "Sum as Fraction of Columns": pd.Series.sum,
    "Count as Fraction of Total": pd.Series.count,
    "Count as Fraction of Rows": pd.Series.count,
    "Count as Fraction of Columns": pd.Series.count,
    CURRENCY_CONTEXT_AGGREGATION: union_currency_context,
}


def format_column(
    df: pd.DataFrame,
    column: Any,
    d3_format: Optional[str],
    currency: dict[str, Any],
    detected_currency: Optional[str] = None,
    currency_context: Optional[pd.Series] = None,
    fallback_to_detected: bool = True,
) -> None:
    """
    Format a column in place when a number or currency format is configured.

    ``detected_currency`` represents the query-wide single currency. When a
    parallel ``currency_context`` series is present, AUTO uses each row/cell's
    contributing currencies first. Mixed context renders a neutral number;
    empty context optionally falls back to query-wide detection.
    """
    if d3_format or currency.get("symbol"):
        if currency_context is None:
            resolved_currency = resolve_auto_currency(currency, detected_currency)
            df[column] = df[column].apply(
                partial(format_number_with_config, d3_format, resolved_currency)
            )
            return

        contexts = currency_context.reindex(df.index)
        df[column] = [
            format_number_with_config(
                d3_format,
                resolve_auto_currency(
                    currency,
                    detected_currency,
                    context,
                    fallback_to_detected,
                ),
                value,
            )
            for value, context in zip(df[column], contexts, strict=True)
        ]


def get_datasource_column_formats(
    datasource: Optional[Union["BaseDatasource", "Query"]],
) -> tuple[dict[str, str | None], dict[str, str]]:
    """Return saved metric formats and verbose labels from a datasource."""
    if not datasource:
        return {}, {}

    datasource_data = datasource.data
    return (
        datasource_data.get("column_formats") or {},
        datasource_data.get("verbose_map") or {},
    )


def get_datasource_currency_formats(
    datasource: Optional[Union["BaseDatasource", "Query"]],
) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    """Return saved metric currencies and verbose labels from a datasource.

    The frontend derives ``datasource.currencyFormats`` from each metric's
    ``currency`` property in ``hydrateExplore.ts``. Report processing receives
    the raw datasource payload, so it performs the same derivation here.
    """
    if not datasource:
        return {}, {}

    datasource_data = datasource.data
    stored_currency_formats = datasource_data.get("currency_formats")
    currency_formats: dict[str, dict[str, Any]] = (
        {
            metric: currency
            for metric, currency in stored_currency_formats.items()
            if isinstance(metric, str) and isinstance(currency, dict)
        }
        if isinstance(stored_currency_formats, dict)
        else {}
    )
    currency_formats.update(
        {
            metric["metric_name"]: metric["currency"]
            for metric in datasource_data.get("metrics") or []
            if isinstance(metric, dict)
            and isinstance(metric.get("metric_name"), str)
            and isinstance(metric.get("currency"), dict)
            and metric["currency"].get("symbol")
        }
    )
    return currency_formats, datasource_data.get("verbose_map") or {}


def get_datasource_currency_column(
    datasource: Optional[Union["BaseDatasource", "Query"]],
    df: pd.DataFrame,
) -> Optional[str]:
    """Return the currency-code column name as represented in ``df``."""
    if not datasource:
        return None

    datasource_data = datasource.data
    currency_column = datasource_data.get("currency_code_column")
    if not isinstance(currency_column, str):
        return None
    if currency_column in df.columns:
        return currency_column

    verbose_column = (datasource_data.get("verbose_map") or {}).get(
        currency_column, currency_column
    )
    return verbose_column if verbose_column in df.columns else None


def currency_context_value(value: Any) -> tuple[str, ...]:
    """Convert a truthy row currency value to frontend-compatible context."""
    try:
        if value is None or pd.isna(value) or not value:
            return ()
    except (TypeError, ValueError):
        return ()
    return (str(value),)


def build_pivot_currency_context(
    df: pd.DataFrame,
    currency_column: str,
    metrics: list[str],
    pivot_options: dict[str, Any],
) -> pd.DataFrame:
    """
    Pivot contributing currency sets through the same layout as metric values.

    This mirrors the frontend Pivot Table aggregators' ``currencySet``: every
    output cell, subtotal, and total carries the union of currencies from its
    contributing records while numeric aggregation remains unchanged.
    """
    currency_source = df.copy()
    row_context = currency_source[currency_column].map(currency_context_value)
    for metric in metrics:
        currency_source[metric] = row_context

    currency_pivot_options = {
        **pivot_options,
        "aggfunc": CURRENCY_CONTEXT_AGGREGATION,
        "metric_name_aggfunc": pivot_options["aggfunc"],
        # Cells here hold currency-code sets, not numbers, so a percent
        # transform would coerce them away.
        "show_values_as": None,
    }
    return pivot_df(currency_source, **currency_pivot_options)


def get_pivot_currency_format(form_data: dict[str, Any]) -> dict[str, Any]:
    """Return Pivot Table currency config from transformed or stored form data."""
    currency_format = form_data.get("currencyFormat") or form_data.get(
        "currency_format"
    )
    return currency_format if isinstance(currency_format, dict) else {}


def has_auto_currency_format(
    form_data: dict[str, Any],
    datasource: Optional[Union["BaseDatasource", "Query"]] = None,
) -> bool:
    """Return whether the Pivot Table has a global or per-metric AUTO format."""
    currency_formats = [
        get_pivot_currency_format(form_data),
        *merge_currency_formats(form_data, datasource).values(),
    ]
    return any(
        isinstance(currency, dict) and currency.get("symbol") == AUTO_CURRENCY
        for currency in currency_formats
    )


def merge_column_formats(
    form_data: dict[str, Any],
    datasource: Optional[Union["BaseDatasource", "Query"]],
) -> dict[str, str | None]:
    """Merge saved formats with truthy chart overrides using verbose labels."""
    saved_formats, verbose_map = get_datasource_column_formats(datasource)
    column_formats = {
        verbose_map.get(metric, metric): d3_format
        for metric, d3_format in saved_formats.items()
    }
    column_formats.update(
        {
            verbose_map.get(metric, metric): d3_format
            for metric, d3_format in (form_data.get("columnFormats") or {}).items()
            if d3_format
        }
    )
    return column_formats


def merge_currency_formats(
    form_data: dict[str, Any],
    datasource: Optional[Union["BaseDatasource", "Query"]],
) -> dict[str, dict[str, Any]]:
    """Merge saved metric currencies with chart overrides by verbose label."""
    saved_formats, verbose_map = get_datasource_currency_formats(datasource)
    currency_formats = {
        verbose_map.get(metric, metric): currency
        for metric, currency in saved_formats.items()
    }
    currency_formats.update(
        {
            verbose_map.get(metric, metric): currency
            for metric, currency in (form_data.get("currencyFormats") or {}).items()
            if isinstance(currency, dict) and currency.get("symbol")
        }
    )
    return currency_formats


def pivot_table_v2(
    df: pd.DataFrame,
    form_data: dict[str, Any],
    datasource: Optional[Union["BaseDatasource", "Query"]] = None,
    apply_number_format: bool = True,
    detected_currency: Optional[str] = None,
) -> pd.DataFrame:
    """
    Pivot table v2.
    """
    verbose_map = datasource.data["verbose_map"] if datasource else None
    metrics = get_metric_names(form_data["metrics"], verbose_map)
    # A non-additive metric makes the chart query every rollup level at once:
    # the leaf rows describe the table, the rest are its database-computed
    # totals.
    df, rollup_levels = split_grouping_sets_levels(df)
    show_values_as = form_data.get("showValuesAs")
    percent_mode = (
        show_values_as if show_values_as in SHOW_VALUES_AS_PERCENT_MODES else None
    )
    pivot_options: dict[str, Any] = {
        "rows": get_column_names(form_data.get("groupbyRows"), verbose_map),
        "columns": get_column_names(form_data.get("groupbyColumns"), verbose_map),
        "metrics": metrics,
        "aggfunc": form_data.get("aggregateFunction", "Sum"),
        "transpose_pivot": bool(form_data.get("transposePivot")),
        "combine_metrics": bool(form_data.get("combineMetric")),
        "show_rows_total": bool(form_data.get("rowTotals")),
        "show_columns_total": bool(form_data.get("colTotals")),
        "apply_metrics_on_rows": form_data.get("metricsLayout") == "ROWS",
        "show_values_as": percent_mode,
        "metric_rollup_reducers": get_metric_rollup_reducers(
            form_data["metrics"], verbose_map
        ),
        "rollup_levels": rollup_levels,
    }

    pivoted = pivot_df(df, **pivot_options)
    if apply_number_format:
        if percent_mode:
            # A ratio has no currency and ignores per-metric value formats, the
            # same way the client skips `formattedAggregators` while a fraction
            # is active.
            return apply_pivot_number_formats(
                pivoted,
                form_data,
                detected_currency,
                datasource,
                force_number_format=PERCENT_1_POINT,
            )
        currency_context = None
        if (
            pivot_options["aggfunc"] not in PIVOT_AGGREGATIONS_WITHOUT_CURRENCY_CONTEXT
            and has_auto_currency_format(form_data, datasource)
            and (currency_column := get_datasource_currency_column(datasource, df))
        ):
            currency_context = build_pivot_currency_context(
                df,
                currency_column,
                metrics,
                pivot_options,
            )
        return apply_pivot_number_formats(
            pivoted,
            form_data,
            detected_currency,
            datasource,
            currency_context,
        )
    return pivoted


def apply_pivot_number_formats(
    df: pd.DataFrame,
    form_data: dict[str, Any],
    detected_currency: Optional[str] = None,
    datasource: Optional[Union["BaseDatasource", "Query"]] = None,
    currency_context: Optional[pd.DataFrame] = None,
    force_number_format: Optional[str] = None,
) -> pd.DataFrame:
    """
    Apply `valueFormat`/`columnFormats` and currency config to pivot values.

    The metric name is the first column level, or the last when `combineMetric`
    moves it there; in the ROWS metrics layout it is on the index instead.
    Per-metric overrides fall back to the global value format.

    `force_number_format` applies one d3 format to every metric and drops the
    currency config, for values whose configured format no longer applies.
    """
    value_format = form_data.get("valueFormat")
    column_formats = merge_column_formats(form_data, datasource)
    currency_format = get_pivot_currency_format(form_data)
    currency_formats = merge_currency_formats(form_data, datasource)
    if force_number_format:
        value_format = force_number_format
        column_formats = {}
        currency_format = {}
        currency_formats = {}
        currency_context = None
    metric_level = -1 if form_data.get("combineMetric") else 0
    metrics_on_rows = form_data.get("metricsLayout") == "ROWS"

    if metrics_on_rows:
        df = df.T
        if currency_context is not None:
            currency_context = currency_context.T

    for column in df.columns:
        metric = column[metric_level] if isinstance(column, tuple) else column
        column_currency_context = (
            currency_context[column]
            if currency_context is not None and column in currency_context.columns
            else None
        )
        column_number_format = column_formats.get(metric) or value_format
        column_currency = currency_formats.get(metric) or currency_format
        if not column_number_format and not column_currency.get("symbol"):
            # The frontend Pivot Table formatter falls back to SMART_NUMBER when
            # neither a value format nor a currency is configured
            # (``getNumberFormatter``'s default key), so unconfigured metric
            # cells must not be left raw.
            column_number_format = SMART_NUMBER
        format_column(
            df,
            column,
            column_number_format,
            column_currency,
            detected_currency,
            column_currency_context,
        )

    return df.T if metrics_on_rows else df


def table(
    df: pd.DataFrame,
    form_data: dict[str, Any],
    datasource: Optional[Union["BaseDatasource", "Query"]] = None,
    apply_number_format: bool = True,
    detected_currency: Optional[str] = None,
) -> pd.DataFrame:
    """
    Table.
    """
    if not apply_number_format:
        return df

    saved_formats, verbose_map = get_datasource_column_formats(datasource)
    saved_currency_formats, _ = get_datasource_currency_formats(datasource)
    currency_column = get_datasource_currency_column(datasource, df)
    row_currency_context = (
        df[currency_column].map(currency_context_value) if currency_column else None
    )
    column_config = form_data.get("column_config") or {}

    def label_of(name: str) -> str:
        """Return the column label as it appears in ``df`` (verbose-renamed)."""
        return name if name in df.columns else verbose_map.get(name, name)

    # Index the per-column overrides by the label present in ``df`` so numeric
    # and metric columns can be looked up while iterating the frame.
    number_format_by_label = {
        label_of(name): fmt for name, fmt in saved_formats.items()
    }
    currency_by_label = {
        label_of(name): currency for name, currency in saved_currency_formats.items()
    }
    config_by_label = {label_of(name): config for name, config in column_config.items()}
    metric_labels = {
        label_of(name) for name in get_metric_names(form_data.get("metrics"))
    }
    # Percent metric columns are emitted with a leading ``%`` and are not
    # verbose-renamed, so match them by that prefixed label.
    percent_metric_labels = {
        f"%{name}"
        for name in get_metric_names(form_data.get("percent_metrics"))
        if f"%{name}" in df.columns
    }

    # Mirror the Table plugin's per-column formatter selection in
    # ``plugin-chart-table/src/transformProps.ts``: percent metrics default to
    # PERCENT_3_POINT, every (numeric) metric gets a formatter that defaults to
    # SMART_NUMBER, and other numeric columns are only formatted when an explicit
    # format or currency is configured. Dimension and non-numeric columns are
    # left untouched, matching the browser.
    for column in df.columns:
        config = config_by_label.get(column) or {}
        configured_currency = config.get("currencyFormat") or {}
        number_format = config.get("d3NumberFormat") or number_format_by_label.get(
            column
        )
        currency = (
            configured_currency
            if configured_currency.get("symbol")
            else currency_by_label.get(column) or {}
        )

        is_number = pd.api.types.is_numeric_dtype(df[column])

        if column in percent_metric_labels:
            format_column(df, column, number_format or PERCENT_3_POINT, {})
        elif (column in metric_labels and is_number) or (
            is_number and (number_format or currency.get("symbol"))
        ):
            if not number_format and not currency.get("symbol"):
                number_format = SMART_NUMBER
            format_column(
                df,
                column,
                number_format,
                currency,
                detected_currency,
                row_currency_context,
                fallback_to_detected=False,
            )

    return df


post_processors = {
    "pivot_table_v2": pivot_table_v2,
    "table": table,
}


def _is_default_index_column(series: pd.Series) -> bool:
    return series.tolist() == list(range(len(series)))


def _read_excel_for_client_processing(
    data: bytes,
    form_data: dict[str, Any],
) -> pd.DataFrame:
    df = pd.read_excel(BytesIO(data))
    if len(df.columns) == 0:
        return df

    first_column = df.columns[0]
    expected_columns = {
        *get_column_names(form_data.get("columns")),
        *get_column_names(form_data.get("groupbyRows")),
        *get_column_names(form_data.get("groupbyColumns")),
        *get_metric_names(form_data.get("metrics")),
    }

    if first_column in expected_columns:
        return df

    if _is_default_index_column(df.iloc[:, 0]):
        return df.iloc[:, 1:].reset_index(drop=True)

    return df.set_index(first_column)


@event_logger.log_this
def apply_client_processing(  # noqa: C901
    result: dict[Any, Any],
    form_data: Optional[dict[str, Any]] = None,
    datasource: Optional[Union["BaseDatasource", "Query"]] = None,
) -> dict[Any, Any]:
    form_data = form_data or {}

    viz_type = form_data.get("viz_type")
    if viz_type not in post_processors:
        return result

    post_processor = post_processors[viz_type]

    for query in result["queries"]:
        if query["result_format"] not in (rf.value for rf in ChartDataResultFormat):
            raise Exception(  # pylint: disable=broad-exception-raised
                f"Result format {query['result_format']} not supported"
            )

        data = query["data"]

        csv_export_config = current_app.config.get("CSV_EXPORT", {})

        if query["result_format"] == ChartDataResultFormat.CSV and isinstance(
            data, bytes
        ):
            # QueryContextProcessor.get_data encodes CSV `data` to bytes using
            # the configured CSV_EXPORT encoding (default utf-8), matching
            # the encoding SQL Lab's own CSV export uses -- decode with that
            # same encoding rather than assuming `data` is already a `str`.
            # Decode before the empty-data check below so whitespace-only
            # payloads (e.g. a columnless frame serialized as a bare
            # newline) are caught rather than reaching `pd.read_csv` and
            # raising `EmptyDataError`.
            data = data.decode(csv_export_config.get("encoding", "utf-8"))

        if isinstance(data, str):
            data = data.strip()

        if not data:
            # do not try to process empty data
            continue

        sep = csv_export_config.get("sep", ",")
        decimal = csv_export_config.get("decimal", ".")

        if query["result_format"] == ChartDataResultFormat.JSON:
            df = pd.DataFrame.from_dict(data)
        elif query["result_format"] == ChartDataResultFormat.CSV:
            # Use custom NA values configuration for
            # reports to avoid unwanted conversions
            # This allows users to control which values should be treated as null/NA
            na_values = current_app.config["REPORTS_CSV_NA_NAMES"]
            df = pd.read_csv(
                StringIO(data),
                keep_default_na=na_values is None,
                na_values=na_values,
                sep=sep,
                decimal=decimal,
            )
        elif query["result_format"] == ChartDataResultFormat.XLSX:
            df = _read_excel_for_client_processing(data, form_data)

        # convert all columns to verbose (label) name
        if datasource:
            df.rename(columns=datasource.data["verbose_map"], inplace=True)

        apply_number_format = query["result_format"] == ChartDataResultFormat.JSON
        processed_df = post_processor(
            df,
            form_data,
            datasource,
            apply_number_format,
            query.get("detected_currency"),
        )

        query["colnames"] = list(processed_df.columns)
        query["indexnames"] = list(processed_df.index)
        query["coltypes"] = extract_dataframe_dtypes(processed_df, datasource)
        query["rowcount"] = len(processed_df.index)

        # Check if the DataFrame has a default RangeIndex, which should not be shown
        show_default_index = not isinstance(processed_df.index, pd.RangeIndex)

        # Flatten hierarchical columns since they are represented as
        # `Tuple[str]`. Otherwise encoding to JSON later will fail because
        # maps cannot have tuples as their keys in JSON.
        processed_df.columns = [
            (
                " ".join(str(name) for name in column).strip()
                if isinstance(column, tuple)
                else column
            )
            for column in processed_df.columns
        ]

        if query["result_format"] == ChartDataResultFormat.JSON:
            # JSON object keys must be strings, so a hierarchical (multi-level)
            # row index has to be flattened into a single string per row.
            processed_df.index = [
                (
                    " ".join(str(name) for name in index).strip()
                    if isinstance(index, tuple)
                    else index
                )
                for index in processed_df.index
            ]
        elif (
            isinstance(processed_df.index, pd.MultiIndex)
            and processed_df.index.nlevels > 1
        ):
            # For tabular formats (CSV/XLSX) keep each "Rows" field as its own
            # column instead of collapsing them into a single joined string.
            # Previously, when a pivot table had multiple "Rows" fields, they
            # were merged into a single column on export; pandas natively
            # writes a MultiIndex as one column per level when serializing to
            # CSV/Excel. See: https://github.com/apache/superset/issues/32369
            processed_df.index.names = [
                name if name is not None else "" for name in processed_df.index.names
            ]
        else:
            processed_df.index = [
                (
                    " ".join(str(name) for name in index).strip()
                    if isinstance(index, tuple)
                    else index
                )
                for index in processed_df.index
            ]

        if query["result_format"] == ChartDataResultFormat.JSON:
            query["data"] = processed_df.to_dict()
        elif query["result_format"] == ChartDataResultFormat.CSV:
            # Route through the formula-escaping CSV writer, consistent with the
            # other CSV export paths (viz, query context, SQL Lab export), while
            # applying CSV_EXPORT config for consistent CSV formatting.
            query["data"] = csv.df_to_escaped_csv(
                processed_df,
                index=show_default_index,
                **current_app.config["CSV_EXPORT"],
            )
        elif query["result_format"] == ChartDataResultFormat.XLSX:
            excel.apply_column_types(processed_df, query["coltypes"])
            query["data"] = excel.df_to_excel(
                processed_df,
                # A percent mode leaves every cell a fraction. Excel can render
                # those as percentages without turning them into text, so the
                # workbook reads like the chart and still calculates.
                number_format=(
                    EXCEL_PERCENT_FORMAT
                    if viz_type == "pivot_table_v2"
                    and form_data.get("showValuesAs") in SHOW_VALUES_AS_PERCENT_MODES
                    else None
                ),
                **{
                    **current_app.config["EXCEL_EXPORT"],
                    "index": show_default_index,
                },
            )

    return result
