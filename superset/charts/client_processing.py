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
from functools import partial
from io import BytesIO, StringIO
from typing import Any, Optional, TYPE_CHECKING, Union

import numpy as np
import pandas as pd
from flask import current_app
from flask_babel import gettext as __

from superset.common.chart_data import ChartDataResultFormat
from superset.extensions import event_logger
from superset.utils import csv, excel
from superset.utils.core import (
    extract_dataframe_dtypes,
    get_column_names,
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
) -> pd.DataFrame:
    metric_name = __("Total (%(aggfunc)s)", aggfunc=metric_name_aggfunc or aggfunc)

    if transpose_pivot:
        rows, columns = columns, rows

    # to apply the metrics on the rows we pivot the dataframe, apply the
    # metrics to the columns, and pivot the dataframe back before
    # returning it
    if apply_metrics_on_rows:
        rows, columns = columns, rows
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

    # compute fractions, if needed
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
                subtotal = pivot_v2_aggfunc_map[aggfunc](df.iloc[:, slice_], axis=1)
                depth = df.columns.nlevels - len(subgroup) - 1
                total = metric_name if level == 0 else __("Subtotal")
                subtotal_name = tuple([*subgroup, total, *([""] * depth)])  # noqa: C409
                # insert column after subgroup
                df.insert(int(slice_.stop), subtotal_name, subtotal)

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
                subtotal = pivot_v2_aggfunc_map[aggfunc](subtotal_values, axis=0)
                depth = groups.nlevels - len(subgroup) - 1
                total = metric_name if level == 0 else __("Subtotal")
                subtotal.name = tuple([*subgroup, total, *([""] * depth)])  # noqa: C409
                # insert row after subgroup
                df = pd.concat(
                    [df[: slice_.stop], subtotal.to_frame().T, df[slice_.stop :]]
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
    }

    pivoted = pivot_df(df, **pivot_options)
    if apply_number_format:
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
) -> pd.DataFrame:
    """
    Apply `valueFormat`/`columnFormats` and currency config to pivot values.

    The metric name is the first column level, or the last when `combineMetric`
    moves it there; in the ROWS metrics layout it is on the index instead.
    Per-metric overrides fall back to the global value format.
    """
    value_format = form_data.get("valueFormat")
    column_formats = merge_column_formats(form_data, datasource)
    currency_format = get_pivot_currency_format(form_data)
    currency_formats = merge_currency_formats(form_data, datasource)
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
                **{
                    **current_app.config["EXCEL_EXPORT"],
                    "index": show_default_index,
                },
            )

    return result
