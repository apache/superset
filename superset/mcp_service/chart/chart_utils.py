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
Shared chart utilities for MCP tools

This module contains shared logic for chart configuration mapping and explore link
generation that can be used by both generate_chart and generate_explore_link tools.
"""

import hashlib
import logging
import math
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Dict, TYPE_CHECKING

from sqlalchemy.exc import SQLAlchemyError

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable

from superset.constants import NO_TIME_RANGE
from superset.mcp_service.chart.schemas import (
    BigNumberChartConfig,
    BoxPlotChartConfig,
    BulletChartConfig,
    ChartCapabilities,
    ChartConfig,
    ChartSemantics,
    ColumnRef,
    CurrencyFormat,
    FilterConfig,
    GaugeChartConfig,
    HandlebarsChartConfig,
    HistogramChartConfig,
    MixedTimeseriesChartConfig,
    PieChartConfig,
    PivotTableChartConfig,
    resolve_bullet_order_target,
    SortByConfig,
    TableChartConfig,
    WaterfallChartConfig,
    XYChartConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import (
    is_dataset_column_temporal,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json
from superset.utils.core import FilterOperator

logger = logging.getLogger(__name__)

MCP_DASHBOARD_TIME_FILTER_SUBJECT = "_mcp_dashboard_time_filter_subject"


@dataclass
class DatasetValidationResult:
    """Result of dataset accessibility validation."""

    is_valid: bool
    dataset_id: int | str | None
    dataset_name: str | None
    warnings: list[str]
    error: str | None = None


def validate_chart_dataset(
    datasource_id: int | None,
    check_access: bool = True,
) -> DatasetValidationResult:
    """
    Validate that a chart's dataset exists and is accessible.

    This shared utility should be called by MCP tools after creating or retrieving
    charts to detect issues like missing or deleted datasets early.

    Takes the datasource id rather than the chart so that callers holding an ORM
    instance read it while that instance is attached; reading it here can raise
    ``DetachedInstanceError`` when a concurrent request has torn down the session.

    Args:
        datasource_id: The chart's ``datasource_id``, or None if it has none
        check_access: Whether to also check user permissions (default True)

    Returns:
        DatasetValidationResult with validation status and any warnings
    """
    from superset.daos.dataset import DatasetDAO
    from superset.mcp_service.auth import has_dataset_access

    warnings: list[str] = []

    # Check if chart has a datasource reference
    if datasource_id is None:
        return DatasetValidationResult(
            is_valid=False,
            dataset_id=None,
            dataset_name=None,
            warnings=[],
            error="Chart has no dataset reference (datasource_id is None)",
        )

    # Skip the DatasourceFilter base filter when not checking access, so the
    # lookup is a true existence check (it otherwise denies a guest outright).
    try:
        dataset = DatasetDAO.find_by_id(
            datasource_id, skip_base_filter=not check_access
        )

        if dataset is None:
            return DatasetValidationResult(
                is_valid=False,
                dataset_id=datasource_id,
                dataset_name=None,
                warnings=[],
                error=(
                    f"Dataset (ID: {datasource_id}) has been deleted or does not "
                    f"exist. The chart will not render correctly. "
                    f"Consider updating the chart to use a different dataset."
                ),
            )

        dataset_name = getattr(dataset, "table_name", None) or getattr(
            dataset, "name", None
        )

        # Check if it's a virtual dataset (SQL Lab query)
        is_virtual = bool(getattr(dataset, "sql", None))
        if is_virtual:
            warnings.append(
                f"This chart uses a virtual dataset (SQL-based). "
                f"If the dataset '{dataset_name}' is deleted, this chart will break."
            )

        # Check access permissions if requested
        if check_access and not has_dataset_access(dataset):
            return DatasetValidationResult(
                is_valid=False,
                dataset_id=datasource_id,
                dataset_name=dataset_name,
                warnings=warnings,
                error=(
                    f"Access denied to dataset '{dataset_name}' (ID: {datasource_id}). "
                    f"You do not have permission to view this dataset."
                ),
            )

        return DatasetValidationResult(
            is_valid=True,
            dataset_id=datasource_id,
            dataset_name=dataset_name,
            warnings=warnings,
            error=None,
        )

    except (AttributeError, ValueError, RuntimeError, SQLAlchemyError) as e:
        logger.exception("Error validating chart dataset %s: %s", datasource_id, e)
        return DatasetValidationResult(
            is_valid=False,
            dataset_id=datasource_id,
            dataset_name=None,
            warnings=[],
            error=f"Error validating dataset (ID: {datasource_id}): {str(e)}",
        )


def generate_explore_link(
    dataset_id: int | str,
    form_data: Dict[str, Any],
    prefer_permalink: bool = True,
) -> str:
    """Generate an explore link for the given dataset and form data.

    Prefers a durable explore permalink (DB-backed key-value store, does not
    expire) over an ephemeral form_data_key (Redis cache, expires in ~24h).
    Falls back to the form_data_key approach if permalink creation fails, then
    to a plain dataset URL as a last resort.

    Set ``prefer_permalink=False`` for callers that depend on a ``form_data_key``
    in the returned URL (e.g. preview flows that extract and re-cache the key);
    this skips the permalink path and returns an ``/explore/?form_data_key=...``
    URL directly.
    """
    from superset.commands.exceptions import CommandException
    from superset.commands.explore.form_data.parameters import CommandParameters
    from superset.commands.explore.permalink.create import CreateExplorePermalinkCommand
    from superset.daos.dataset import DatasetDAO
    from superset.exceptions import SupersetException
    from superset.explore.permalink.exceptions import ExplorePermalinkCreateFailedError
    from superset.mcp_service.commands.create_form_data import (
        MCPCreateFormDataCommand,
    )
    from superset.utils.core import DatasourceType

    base_url = get_superset_base_url()
    numeric_dataset_id = None
    dataset = None

    try:
        if isinstance(dataset_id, int) or (
            isinstance(dataset_id, str) and dataset_id.isdigit()
        ):
            numeric_dataset_id = (
                int(dataset_id) if isinstance(dataset_id, str) else dataset_id
            )
            dataset = DatasetDAO.find_by_id(numeric_dataset_id)
        else:
            # Try UUID lookup using DAO flexible method
            dataset = DatasetDAO.find_by_id(dataset_id, id_column="uuid")
            if dataset:
                numeric_dataset_id = dataset.id

        if not dataset or numeric_dataset_id is None:
            # Fallback to basic explore URL
            return (
                f"{base_url}/explore/?datasource_type=table&datasource_id={dataset_id}"
            )

        # Add datasource to form_data
        form_data_with_datasource = {
            **form_data,
            "datasource": f"{numeric_dataset_id}__table",
        }

        # Try durable permalink first (DB-backed key-value store, does not expire).
        # CreateExplorePermalinkCommand wraps its internal failures (encode/create/
        # SQLAlchemy errors) into ExplorePermalinkCreateFailedError, so catch only
        # those expected modes here — letting programming errors (TypeError, etc.)
        # surface instead of being silently masked by the form_data_key fallback.
        # Callers that need a form_data_key URL opt out via prefer_permalink=False.
        if prefer_permalink:
            try:
                state = {"formData": form_data_with_datasource}
                permalink_key = CreateExplorePermalinkCommand(state=state).run()
                return f"{base_url}/explore/p/{permalink_key}/"
            except (
                ExplorePermalinkCreateFailedError,
                SQLAlchemyError,
            ) as permalink_e:
                logger.debug(
                    "Permalink generation failed, falling back to form_data_key: %s",
                    permalink_e,
                )

        # Fall back to ephemeral form_data_key (Redis-backed cache)
        cmd_params = CommandParameters(
            datasource_type=DatasourceType.TABLE,
            datasource_id=numeric_dataset_id,
            chart_id=0,  # 0 for new charts
            tab_id=None,
            form_data=json.dumps(form_data_with_datasource),
        )
        form_data_key = MCPCreateFormDataCommand(cmd_params).run()
        return f"{base_url}/explore/?form_data_key={form_data_key}"

    except (
        CommandException,
        SupersetException,
        SQLAlchemyError,
    ) as e:
        # Fallback to basic explore URL with numeric ID if available. Only the
        # expected failure modes of dataset lookup / form_data creation are caught
        # here; programming errors propagate to the tool handler so they aren't
        # silently masked behind a fallback URL.
        logger.debug("Explore link generation fallback due to: %s", e)
        if numeric_dataset_id is not None:
            return (
                f"{base_url}/explore/?datasource_type=table"
                f"&datasource_id={numeric_dataset_id}"
            )
        return f"{base_url}/explore/?datasource_type=table&datasource_id={dataset_id}"


def _find_dataset_by_id_or_uuid(dataset_id: int | str | None) -> "SqlaTable | None":
    """Look up a dataset by numeric ID or UUID string.

    Shared by callers that resolve a dataset from the ``dataset_id | str | None``
    shape accepted throughout this module; each caller decides its own behavior
    for a missing dataset_id or dataset (raise vs. default vs. None).

    Delegates to ``DatasetDAO.find_by_id_or_uuid`` (also used by the dataset
    API) instead of reimplementing the id/uuid dispatch here.
    """
    if not dataset_id:
        return None
    from superset.daos.dataset import DatasetDAO  # avoid circular import

    return DatasetDAO.find_by_id_or_uuid(str(dataset_id))


def is_column_truly_temporal(
    column_name: str,
    dataset_id: int | str | None,
    dataset: "SqlaTable | None" = None,
) -> bool:
    """
    Check if a column is truly temporal, mirroring TableColumn.is_temporal
    using the shared dataset temporal predicate.

    Args:
        column_name: Name of the column to check
        dataset_id: Dataset ID to look up column metadata
        dataset: Optional pre-fetched dataset, reused as-is to avoid a
            redundant DAO lookup when the caller already resolved it.

    Returns:
        True if the column should be treated as temporal, False otherwise
    """

    if not dataset_id and dataset is None:
        return True  # Default to temporal if we can't check (backward compatible)

    try:
        if dataset is None:
            dataset = _find_dataset_by_id_or_uuid(dataset_id)

        if not dataset:
            return True  # Default to temporal if dataset not found

        column_lower = column_name.lower()
        for col in dataset.columns:
            if col.column_name.lower() == column_lower:
                db_engine_spec = dataset.database.db_engine_spec
                return is_dataset_column_temporal(col, column_name, db_engine_spec)

        return True  # Default if column not found

    except (ValueError, AttributeError) as e:
        logger.warning(
            "Error checking column type for '%s' in dataset %s: %s",
            column_name,
            dataset_id,
            e,
        )
        return True  # Default to temporal on error (backward compatible)


def map_config_to_form_data(
    config: ChartConfig,
    dataset_id: int | str | None = None,
) -> Dict[str, Any]:
    """Map chart config to Superset form_data via the plugin registry.

    The previous per-chart-type if/elif chain has been replaced by a
    single registry lookup. Cross-field constraints (e.g. BigNumber trendline
    temporal check) are now owned by each plugin's post_map_validate() method
    rather than being baked into this dispatcher.
    """
    # Local import: plugins call map_*_config from their to_form_data() methods,
    # so chart_utils is loaded before plugins finish registering. A top-level
    # import of registry here would trigger plugin loading mid-import = cycle.
    from superset.mcp_service.chart.registry import get_registry

    chart_type = getattr(config, "chart_type", None)
    plugin = get_registry().get(chart_type) if chart_type else None

    if plugin is None:
        if chart_type is None:
            raise ValueError(f"Unsupported config type: {type(config)}")
        raise ValueError(
            f"Unsupported config type: {type(config)} (chart_type={chart_type!r})"
        )

    form_data = plugin.to_form_data(config, dataset_id=dataset_id)

    # Run post-map validation (e.g. BigNumber trendline temporal type check).
    # Raise ValueError to preserve backward-compatible error handling in callers.
    # Include details and suggestions so callers logging str(e) surface actionable
    # context (e.g. BigNumber trendline guidance) rather than just the headline.
    error = plugin.post_map_validate(config, form_data, dataset_id=dataset_id)
    if error is not None:
        parts = [error.message]
        if error.details:
            parts.append(error.details)
        if error.suggestions:
            parts.append("Suggestions: " + "; ".join(error.suggestions))
        raise ValueError(" ".join(parts))

    _bind_dashboard_time_range_filter(form_data, config, dataset_id)
    return form_data


def _add_adhoc_filters(
    form_data: Dict[str, Any], filters: list[FilterConfig] | None
) -> None:
    """Add adhoc filters to form_data if any are specified."""
    if filters:
        form_data["adhoc_filters"] = [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": filter_config.column,
                "operator": map_filter_operator(filter_config.op),
                "comparator": filter_config.value,
            }
            for filter_config in filters
            if filter_config is not None
        ]


def adhoc_filters_to_query_filters(
    adhoc_filters: list[Dict[str, Any]],
) -> list[Dict[str, Any]]:
    """Convert adhoc filter format to QueryObject filter format.

    Adhoc filters use ``{subject, operator, comparator}`` keys while
    ``QueryContextFactory`` expects ``{col, op, val}`` (QueryObjectFilterClause).
    Delegates to the shared builder so the MCP and dashboard-export paths stay in
    sync (single source of truth).
    """
    from superset.common.form_data_query_context import (
        adhoc_filters_to_query_filters as _shared,
    )

    return _shared(adhoc_filters)


def map_table_config(config: TableChartConfig) -> Dict[str, Any]:
    """Map table chart config to form_data with defensive validation."""
    # Early validation to prevent empty charts
    if not config.columns:
        raise ValueError("Table chart must have at least one column")

    # Use the viz_type from config (defaults to "table", can be "ag-grid-table")
    form_data: Dict[str, Any] = {
        "viz_type": config.viz_type,
    }

    # When query_mode is explicitly set to "raw", force raw mode for all columns.
    # Aggregate settings on individual columns are ignored in this case.
    if config.query_mode == "raw":
        column_names = [col.name for col in config.columns]
        form_data.update(
            {
                "all_columns": column_names,
                "columns": column_names,
                "query_mode": "raw",
                "include_time": False,
                "order_desc": True,
            }
        )
    else:
        # Auto-detect or explicit "aggregate": separate columns with aggregates
        # from raw columns and build the appropriate form_data.
        raw_columns = []
        aggregated_metrics = []

        for col in config.columns:
            if col.is_metric:
                # Saved metric or column with aggregation - treat as metric
                aggregated_metrics.append(create_metric_object(col))
            else:
                # No aggregation - treat as raw column
                raw_columns.append(col.name)

        # Final validation - ensure we have some data to display
        if not raw_columns and not aggregated_metrics:
            raise ValueError(
                "Table chart configuration resulted in no displayable columns"
            )

        # Handle raw columns (no aggregation)
        if raw_columns and not aggregated_metrics:
            # Pure raw columns - show individual rows
            # Include both "all_columns" (Superset table viz) and "columns"
            # (QueryContextFactory validation) to avoid "Empty query?" errors
            form_data.update(
                {
                    "all_columns": raw_columns,
                    "columns": raw_columns,
                    "query_mode": "raw",
                    "include_time": False,
                    "order_desc": True,
                }
            )

        # Handle aggregated columns only
        elif aggregated_metrics and not raw_columns:
            # Pure aggregation - show totals
            form_data.update(
                {
                    "metrics": aggregated_metrics,
                    "query_mode": "aggregate",
                }
            )

        # Handle mixed columns (raw + aggregated)
        else:
            # Mixed mode - group by raw columns, aggregate metrics
            form_data.update(
                {
                    "all_columns": raw_columns,
                    "metrics": aggregated_metrics,
                    "groupby": raw_columns,
                    "query_mode": "aggregate",
                }
            )

    _add_adhoc_filters(form_data, config.filters)

    if config.sort_by:
        form_data["order_by_cols"] = [
            json.dumps(
                [entry.column, entry.ascending]
                if isinstance(entry, SortByConfig)
                else [entry, False]
            )
            for entry in config.sort_by
        ]

    form_data["row_limit"] = config.row_limit
    add_color_scheme(form_data, config.color_scheme)
    if config.column_config is not None:
        form_data["column_config"] = {
            label: column.model_dump(by_alias=True, exclude_unset=True)
            for label, column in config.column_config.items()
        }

    return form_data


def merge_table_column_config(
    existing_form_data: Mapping[str, Any], new_form_data: Dict[str, Any]
) -> None:
    """Merge MCP table formatting without discarding UI-only settings.

    An omitted ``column_config`` preserves the saved value, an explicit empty
    mapping clears it, and a non-empty mapping updates only the supplied labels
    and properties. The nested merge is important because the Superset UI stores
    additional column settings that the MCP schema does not expose.
    """
    table_viz_types = {"table", "ag-grid-table"}
    if (
        existing_form_data.get("viz_type") not in table_viz_types
        or new_form_data.get("viz_type") not in table_viz_types
    ):
        return

    if "column_config" not in new_form_data:
        if "column_config" in existing_form_data:
            new_form_data["column_config"] = existing_form_data["column_config"]
        return

    new_column_config = new_form_data["column_config"]
    if not isinstance(new_column_config, dict) or not new_column_config:
        return

    existing_column_config = existing_form_data.get("column_config")
    if not isinstance(existing_column_config, dict):
        return

    merged_column_config = dict(existing_column_config)
    for label, settings in new_column_config.items():
        existing_settings = existing_column_config.get(label)
        if isinstance(existing_settings, dict) and isinstance(settings, dict):
            merged_column_config[label] = {**existing_settings, **settings}
        else:
            merged_column_config[label] = settings
    new_form_data["column_config"] = merged_column_config


def merge_interactive_pivot_ui_config(
    existing_form_data: Mapping[str, Any], new_form_data: Dict[str, Any]
) -> None:
    """Preserve UI-managed Interactive Pivot config during MCP replacement.

    Rows, columns, and metric aggregation are declarative MCP fields, so their
    three state sections come from ``new_form_data``. Other state sections
    (column sizing/order, filters, sorting, and pagination) are managed by the
    grid UI and survive an update. Formatting controls that MCP cannot express
    also survive rather than being erased by an unrelated config change.
    """
    viz_type = "ag-grid-pivot-table"
    if (
        existing_form_data.get("viz_type") != viz_type
        or new_form_data.get("viz_type") != viz_type
    ):
        return
    for key in ("column_config", "conditional_formatting"):
        if key in existing_form_data and key not in new_form_data:
            new_form_data[key] = existing_form_data[key]

    existing_state = existing_form_data.get("pivot_table_state")
    new_state = new_form_data.get("pivot_table_state")
    if isinstance(existing_state, dict) and isinstance(new_state, dict):
        new_form_data["pivot_table_state"] = {**existing_state, **new_state}


def create_metric_object(col: ColumnRef) -> Dict[str, Any] | str:
    """Create a metric object for a column with enhanced validation.

    For saved metrics, returns the metric name as a plain string which
    Superset's query engine resolves via its metrics_by_name lookup.
    For custom SQL metrics, returns a SQL adhoc dict (expressionType="SQL").
    For ad-hoc column metrics, returns a SIMPLE expression dict.
    """
    if col.sql_expression:
        return {
            "aggregate": None,
            "column": None,
            "expressionType": "SQL",
            "sqlExpression": col.sql_expression,
            "label": col.label,
            "optionName": (
                "metric_sql_"
                + hashlib.md5(
                    col.sql_expression.encode("utf-8"), usedforsecurity=False
                ).hexdigest()[:8]
            ),
            "hasCustomLabel": True,
            "datasourceWarning": False,
        }

    if col.saved_metric:
        return col.name  # type: ignore[return-value]

    # Ensure aggregate is valid - default to SUM if not specified or invalid
    valid_aggregates = {
        "SUM",
        "COUNT",
        "AVG",
        "MIN",
        "MAX",
        "COUNT_DISTINCT",
        "STDDEV_SAMP",
        "VAR_SAMP",
        "MEDIAN",
        "PERCENTILE",
    }
    # Accept the pre-SIP shorthand names too, mapped onto the real,
    # unambiguous aggregate names Superset actually supports (bare
    # "STDDEV"/"VAR" are ambiguous between sample and population statistics,
    # and differ by engine -- see docs/sip/median-stddev-variance-aggregates.md).
    aggregate_aliases = {"STDDEV": "STDDEV_SAMP", "VAR": "VAR_SAMP"}
    aggregate = aggregate_aliases.get(
        (col.aggregate or "SUM").upper(), col.aggregate or "SUM"
    )

    # Validate aggregate function (final safety check)
    if aggregate.upper() not in valid_aggregates:
        aggregate = "SUM"  # Safe fallback

    return {
        "aggregate": aggregate.upper(),
        "column": {
            "column_name": col.name,
        },
        "expressionType": "SIMPLE",
        "label": col.label or f"{aggregate.upper()}({col.name})",
        "optionName": f"metric_{col.name}",
        "sqlExpression": None,
        "hasCustomLabel": bool(col.label),
        "datasourceWarning": False,
    }


def add_axis_config(form_data: Dict[str, Any], config: XYChartConfig) -> None:
    """Add axis configurations to form_data."""
    if config.x_axis:
        if config.x_axis.title:
            form_data["x_axis_title"] = config.x_axis.title
        if config.x_axis.format:
            form_data["x_axis_format"] = config.x_axis.format

    if config.y_axis:
        if config.y_axis.title:
            form_data["y_axis_title"] = config.y_axis.title
        if config.y_axis.format:
            form_data["y_axis_format"] = config.y_axis.format
        if config.y_axis.scale == "log":
            form_data["logAxis"] = True


def add_legend_config(form_data: Dict[str, Any], config: XYChartConfig) -> None:
    """Add legend configuration to form_data."""
    if config.legend:
        if not config.legend.show:
            form_data["show_legend"] = False
        if config.legend.position:
            # Canonical form_data key is camelCase; the echarts plugins read
            # `legendOrientation` directly off form_data.
            form_data["legendOrientation"] = config.legend.position
    if config.legend_orientation:
        form_data["legendOrientation"] = config.legend_orientation


def add_color_scheme(form_data: Dict[str, Any], color_scheme: str | None) -> None:
    """Add color scheme to form_data when set."""
    if color_scheme:
        form_data["color_scheme"] = color_scheme


def add_currency_format(
    form_data: Dict[str, Any],
    currency_format: CurrencyFormat | None,
    key: str = "currency_format",
) -> None:
    """Add currency format to form_data under the given key when set."""
    if currency_format:
        form_data[key] = currency_format.to_form_data()


def add_xy_data_label_options(
    form_data: Dict[str, Any], config: XYChartConfig, x_is_temporal: bool
) -> None:
    """Apply XY-specific data-label and time-format options when set."""
    if config.x_axis_time_format and x_is_temporal:
        form_data["x_axis_time_format"] = config.x_axis_time_format
    if config.show_value:
        form_data["show_value"] = True


def add_orientation_config(form_data: Dict[str, Any], config: XYChartConfig) -> None:
    """Add orientation configuration to form_data for bar charts.

    Only applies when kind='bar' and an explicit orientation is set.
    When orientation is None (the default), Superset uses its own default
    (vertical bars).
    """
    if config.kind == "bar" and config.orientation:
        form_data["orientation"] = config.orientation


def configure_temporal_handling(
    form_data: Dict[str, Any],
    x_is_temporal: bool,
    time_grain: str | None,
) -> None:
    """Configure form_data based on whether x-axis column is temporal.

    For temporal columns, enables standard time series handling.
    For non-temporal columns (e.g., BIGINT year), disables DATE_TRUNC
    by setting categorical sorting options.

    Stores any warnings in ``form_data["_mcp_warnings"]``.
    """
    if x_is_temporal:
        form_data["granularity_sqla"] = form_data.get("x_axis")
        if time_grain:
            form_data["time_grain_sqla"] = time_grain
    else:
        # Non-temporal column - disable temporal handling to prevent DATE_TRUNC
        form_data["x_axis_sort_series_type"] = "name"
        form_data["x_axis_sort_series_ascending"] = True
        form_data["time_grain_sqla"] = None
        form_data["granularity_sqla"] = None
        if time_grain:
            form_data.setdefault("_mcp_warnings", []).append(
                f"time_grain='{time_grain}' was ignored because the x-axis "
                f"column is not a temporal type. time_grain only applies to "
                f"DATE/DATETIME/TIMESTAMP columns, or other column types "
                f"explicitly marked as temporal (is_dttm) with a "
                f"python_date_format on the dataset."
            )


def _ensure_temporal_adhoc_filter(form_data: Dict[str, Any], column: str) -> None:
    """Ensure a TEMPORAL_RANGE adhoc filter exists for the given column.

    Mirrors the Explore UI behavior: when a temporal column is set as
    the x-axis, a TEMPORAL_RANGE filter must be present so dashboard
    time-range filters can bind to it.  Without this filter, Explore
    shows a warning dialog asking the user to add it manually.
    """
    existing = form_data.get("adhoc_filters", [])
    if any(
        f.get("operator") == FilterOperator.TEMPORAL_RANGE.value
        and f.get("subject") == column
        for f in existing
    ):
        return
    existing.append(
        {
            "clause": "WHERE",
            "expressionType": "SIMPLE",
            "subject": column,
            "operator": FilterOperator.TEMPORAL_RANGE.value,
            "comparator": NO_TIME_RANGE,
        }
    )
    form_data["adhoc_filters"] = existing


def _has_generated_temporal_filter(form_data: Dict[str, Any], column: str) -> bool:
    """Return whether form data contains the neutral generated time binding."""
    return any(
        isinstance(filter_, dict)
        and filter_.get("operator") == FilterOperator.TEMPORAL_RANGE.value
        and filter_.get("subject") == column
        and filter_.get("comparator") == NO_TIME_RANGE
        for filter_ in form_data.get("adhoc_filters", [])
    )


def _ensure_generated_temporal_binding(form_data: Dict[str, Any], column: str) -> None:
    """Add a neutral time filter and record its generated provenance."""
    _ensure_temporal_adhoc_filter(form_data, column)
    if _has_generated_temporal_filter(form_data, column):
        form_data[MCP_DASHBOARD_TIME_FILTER_SUBJECT] = column


def _bind_temporal_filter(
    form_data: Dict[str, Any],
    column: str,
    *,
    range_explicit: bool,
    time_range: str | None,
) -> None:
    """Create a generated binding and apply an explicit active/neutral range."""
    _ensure_temporal_adhoc_filter(form_data, column)
    if range_explicit:
        comparator = time_range or NO_TIME_RANGE
        for filter_ in form_data.get("adhoc_filters", []):
            if (
                isinstance(filter_, dict)
                and filter_.get("operator") == FilterOperator.TEMPORAL_RANGE.value
                and filter_.get("subject") == column
                and filter_.get("comparator") == NO_TIME_RANGE
            ):
                filter_["comparator"] = comparator
                break
    form_data[MCP_DASHBOARD_TIME_FILTER_SUBJECT] = column


def _clears_temporal_subject(config: ChartConfig, explicit_fields: set[str]) -> bool:
    """Return whether a caller explicitly cleared the generated subject."""
    return "temporal_column" in explicit_fields and not getattr(
        config, "temporal_column", None
    )


def _bind_dashboard_time_range_filter(  # noqa: C901
    form_data: Dict[str, Any],
    config: ChartConfig,
    dataset_id: int | str | None,
) -> None:
    """Bind charts without time configuration to a temporal filter subject."""
    explicit_fields = set(getattr(config, "model_fields_set", set()))
    if _clears_temporal_subject(config, explicit_fields):
        # An explicit null clears the generated subject; unlike omission it must
        # not silently fall back to the dataset's main datetime column.
        return

    if temporal_column := getattr(config, "temporal_column", None):
        if _is_temporal_for_dashboard_binding(temporal_column, dataset_id):
            granularity = form_data.get("granularity_sqla")
            if isinstance(granularity, str) and granularity != temporal_column:
                # QueryContextFactory gives granularity precedence over a temporal
                # filter, so a different granularity would bind both columns.
                form_data["granularity_sqla"] = None
            _bind_temporal_filter(
                form_data,
                temporal_column,
                range_explicit="time_range" in explicit_fields,
                time_range=getattr(config, "time_range", None),
            )
        return

    dataset = None
    if dataset_id:
        try:
            dataset = _find_dataset_by_id_or_uuid(dataset_id)
        except (AttributeError, RuntimeError, ValueError, SQLAlchemyError) as ex:
            logger.debug(
                "Could not resolve dataset %s for dashboard time binding: %s",
                dataset_id,
                ex,
            )
            return

    granularity = form_data.get("granularity_sqla")
    if isinstance(granularity, str) and _is_temporal_for_dashboard_binding(
        granularity, dataset_id, dataset
    ):
        # Native temporal axes need the same generated dashboard binding whether
        # their mapper is XY, Mixed Timeseries, Waterfall, or another plugin. XY
        # already supplies the neutral filter; the shared binder creates it for
        # mappers that expose granularity without constructing adhoc filters.
        _bind_temporal_filter(
            form_data,
            granularity,
            range_explicit="time_range" in explicit_fields,
            time_range=getattr(config, "time_range", None),
        )
        return

    x_axis = form_data.get("x_axis")
    if isinstance(x_axis, str) and _is_temporal_for_dashboard_binding(
        x_axis, dataset_id, dataset
    ):
        _bind_temporal_filter(
            form_data,
            x_axis,
            range_explicit="time_range" in explicit_fields,
            time_range=getattr(config, "time_range", None),
        )
        return

    main_dttm_col = getattr(dataset, "main_dttm_col", None)
    if isinstance(main_dttm_col, str) and _is_temporal_for_dashboard_binding(
        main_dttm_col, dataset_id, dataset
    ):
        _bind_temporal_filter(
            form_data,
            main_dttm_col,
            range_explicit="time_range" in explicit_fields,
            time_range=getattr(config, "time_range", None),
        )


def _is_temporal_for_dashboard_binding(
    column: str,
    dataset_id: int | str | None,
    dataset: "SqlaTable | None" = None,
) -> bool:
    """Check temporal metadata without making chart mapping fail on lookup errors."""
    try:
        return is_column_truly_temporal(column, dataset_id, dataset=dataset)
    except (AttributeError, RuntimeError, ValueError, SQLAlchemyError) as ex:
        logger.debug(
            "Could not validate temporal column %s for dataset %s: %s",
            column,
            dataset_id,
            ex,
        )
        return False


def _resolve_default_x_axis(
    config: XYChartConfig, dataset_id: int | str | None
) -> tuple[XYChartConfig, "SqlaTable | None"]:
    """Resolve x-axis to the dataset's main_dttm_col when x is omitted.

    Returns the (possibly updated) config alongside the dataset fetched while
    resolving the default, if any, so callers can reuse it (e.g. passing it
    into is_column_truly_temporal) instead of re-querying DatasetDAO for the
    same dataset_id.
    """
    if config.x is not None:
        return config, None

    if not dataset_id:
        raise ValueError("x-axis column is required when dataset_id is not provided")

    dataset = _find_dataset_by_id_or_uuid(dataset_id)

    if not dataset or not dataset.main_dttm_col:
        raise ValueError(
            "x-axis column is required: dataset has no primary datetime "
            "column (main_dttm_col). Please specify the x-axis column "
            "explicitly."
        )
    from superset.mcp_service.chart.schemas import ColumnRef

    return (
        config.model_copy(update={"x": ColumnRef(name=dataset.main_dttm_col)}),
        dataset,
    )


def _add_xy_limits(form_data: Dict[str, Any], config: XYChartConfig) -> None:
    form_data["row_limit"] = config.row_limit
    if config.series_limit is not None:
        form_data["series_limit"] = config.series_limit


def map_xy_config(  # noqa: C901
    config: XYChartConfig, dataset_id: int | str | None = None
) -> Dict[str, Any]:
    """Map XY chart config to form_data with defensive validation."""
    # Early validation to prevent empty charts
    if not config.y:
        raise ValueError("XY chart must have at least one Y-axis metric")

    # Resolve x-axis default: use dataset's main_dttm_col when x is omitted.
    config, resolved_dataset = _resolve_default_x_axis(config, dataset_id)

    # ``_resolve_default_x_axis`` guarantees x is set.
    if config.x is None or config.x.name is None:
        raise ValueError("XY chart requires an x-axis with a resolvable column name")

    # Check if x-axis column is truly temporal (based on actual SQL type).
    # Reuse the dataset fetched above (if any) to avoid a second DAO lookup.
    x_is_temporal = is_column_truly_temporal(
        config.x.name, dataset_id, dataset=resolved_dataset
    )

    # Map chart kind to viz_type - always use the same viz types
    # The temporal vs non-temporal handling is done via form_data configuration
    viz_type_map = {
        "line": "echarts_timeseries_line",
        "bar": "echarts_timeseries_bar",
        "area": "echarts_area",
        "scatter": "echarts_timeseries_scatter",
    }

    if not x_is_temporal:
        logger.info(
            "X-axis column '%s' is not temporal (dataset_id=%s), "
            "configuring as categorical dimension",
            config.x.name,
            dataset_id,
        )

    # Convert Y columns to metrics with validation
    metrics = []
    for col in config.y:
        # SQL metrics carry sql_expression instead of name.
        if not col.sql_expression and not (col.name and col.name.strip()):
            raise ValueError("Y-axis column name cannot be empty")
        metrics.append(create_metric_object(col))

    # Final validation - ensure we have metrics to display
    if not metrics:
        raise ValueError("XY chart configuration resulted in no displayable metrics")

    form_data: Dict[str, Any] = {
        "viz_type": viz_type_map.get(config.kind, "echarts_timeseries_line"),
        "metrics": metrics,
        "x_axis": config.x.name,
    }

    # Configure temporal handling based on whether column is truly temporal
    configure_temporal_handling(form_data, x_is_temporal, config.time_grain)

    # Only add groupby columns that differ from x_axis to avoid
    # "Duplicate column/metric labels" errors in Superset.
    if config.group_by:
        groupby_columns = [c.name for c in config.group_by if c.name != config.x.name]
        if groupby_columns:
            form_data["groupby"] = groupby_columns

    _add_adhoc_filters(form_data, config.filters)

    # A shared explicit temporal_column is the dashboard binding source of truth.
    # Defer to _bind_dashboard_time_range_filter instead of also binding the
    # temporal x-axis, which would apply the dashboard range to both columns.
    if x_is_temporal and not config.temporal_column:
        _ensure_temporal_adhoc_filter(form_data, config.x.name)

    _add_xy_limits(form_data, config)

    # Add stacking configuration
    if getattr(config, "stacked", False):
        form_data["stack"] = "Stack"

    # Add configurations
    add_axis_config(form_data, config)
    add_legend_config(form_data, config)
    add_orientation_config(form_data, config)
    add_color_scheme(form_data, config.color_scheme)
    add_currency_format(form_data, config.currency_format)
    add_xy_data_label_options(form_data, config, x_is_temporal)

    return form_data


def map_pie_config(config: PieChartConfig) -> Dict[str, Any]:
    """Map pie chart config to Superset form_data."""
    metric = create_metric_object(config.metric)

    form_data: Dict[str, Any] = {
        "viz_type": "pie",
        "groupby": [config.dimension.name],
        "metric": metric,
        "color_scheme": config.color_scheme or "supersetColors",
        "show_labels": config.show_labels,
        "show_legend": config.show_legend,
        "legendOrientation": config.legend_orientation,
        "label_type": config.label_type,
        "number_format": config.number_format,
        "date_format": config.date_format,
        "sort_by_metric": config.sort_by_metric,
        "row_limit": config.row_limit,
        "donut": config.donut,
        "show_total": config.show_total,
        "labels_outside": config.labels_outside,
        "outerRadius": config.outer_radius,
        "innerRadius": config.inner_radius,
    }

    add_currency_format(form_data, config.currency_format)
    _add_adhoc_filters(form_data, config.filters)

    return form_data


def map_gauge_config(config: GaugeChartConfig) -> Dict[str, Any]:
    """Map gauge config to Superset form_data (viz_type ``gauge_chart``).

    Matches the frontend Gauge buildQuery contract: a single ``metric`` and an
    optional ``groupby`` list (one dial per row). ``min_val``/``max_val`` fix
    the dial scale; both default to ``None`` (auto), mirroring the frontend
    defaults.
    """
    form_data: Dict[str, Any] = {
        "viz_type": "gauge_chart",
        "groupby": [g.name for g in (config.groupby or [])],
        "metric": create_metric_object(config.metric),
        "sort_by_metric": config.sort_by_metric,
        "row_limit": config.row_limit,
        "min_val": config.min_val,
        "max_val": config.max_val,
        "color_scheme": config.color_scheme or "supersetColors",
    }
    _add_adhoc_filters(form_data, config.filters)
    return form_data


def map_histogram_config(config: "HistogramChartConfig") -> Dict[str, Any]:
    """Map histogram config to Superset form_data (viz_type histogram_v2).

    Matches the frontend Histogram buildQuery contract: a single ``column``
    string to bin, ``groupby`` name list for series, plus bins/normalize/
    cumulative passed straight through to the histogram post-processing
    operator.
    """
    form_data: Dict[str, Any] = {
        "viz_type": "histogram_v2",
        "column": config.column.name,
        "groupby": [g.name for g in (config.groupby or [])],
        "bins": config.bins,
        "normalize": config.normalize,
        "cumulative": config.cumulative,
        "row_limit": config.row_limit,
    }
    _add_adhoc_filters(form_data, config.filters)
    return form_data


def _bullet_token_list(values: Sequence[str | int | float]) -> str:
    """Serialize typed Bullet controls to the frontend's comma-separated form."""
    tokens: list[str] = []
    for value in values:
        if isinstance(value, float):
            token = repr(value)
            # ``100`` parses back to the same binary float as ``100.0`` and
            # preserves the frontend's established compact integer spelling.
            if token.endswith(".0") and not (
                value == 0.0 and math.copysign(1.0, value) < 0
            ):
                token = token[:-2]
            tokens.append(token)
        else:
            tokens.append(str(value))
    return ",".join(tokens)


def map_bullet_config(config: BulletChartConfig) -> Dict[str, Any]:  # noqa: C901
    """Map typed Bullet config to ``Bullet/buildQuery`` and transformProps.

    The frontend buildQuery replaces the generic query fields with exactly one
    metric and the groupby hierarchy. Presentation controls stay in native
    snake_case form_data; the chart plugin camelizes them for transformProps.
    """
    metric = create_metric_object(config.metric)
    form_data: Dict[str, Any] = {
        "viz_type": "bullet",
        "metric": metric,
    }

    # Optional semantic/query fields are emitted only when explicitly supplied.
    # This lets update_chart and update_chart_preview preserve native saved state,
    # while an explicit empty value still clears it through the generic merge path.
    if "dimensions" in config.model_fields_set:
        form_data["groupby"] = [dimension.name for dimension in config.dimensions or []]
    if "row_limit" in config.model_fields_set:
        form_data["row_limit"] = config.row_limit
    if "time_range" in config.model_fields_set:
        form_data["time_range"] = config.time_range

    if config.order_by:
        dimensions = config.dimensions or []
        orderby: list[list[Any]] = []
        for order in config.order_by:
            role, index = resolve_bullet_order_target(
                order.column, dimensions, config.metric
            )
            if role == "metric":
                order_target: Any = metric
            else:
                if index is None:  # Defensive: resolver pairs dimensions with indexes.
                    raise ValueError("Bullet dimension order target has no index")
                order_target = dimensions[index].name
            orderby.append([order_target, order.ascending])
        form_data["orderby"] = orderby
    elif "order_by" in config.model_fields_set:
        form_data["orderby"] = []

    presentation_fields: dict[str, tuple[str, Any]] = {
        "ranges": ("ranges", _bullet_token_list(config.ranges)),
        "range_labels": (
            "range_labels",
            _bullet_token_list(config.range_labels),
        ),
        "markers": ("markers", _bullet_token_list(config.markers)),
        "marker_labels": (
            "marker_labels",
            _bullet_token_list(config.marker_labels),
        ),
        "marker_lines": (
            "marker_lines",
            _bullet_token_list(config.marker_lines),
        ),
        "marker_line_labels": (
            "marker_line_labels",
            _bullet_token_list(config.marker_line_labels),
        ),
        "y_axis_format": ("y_axis_format", config.y_axis_format),
        "show_labels": ("show_labels", config.show_labels),
        "show_legend": ("show_legend", config.show_legend),
    }
    for field_name, (form_key, value) in presentation_fields.items():
        if field_name in config.model_fields_set:
            form_data[form_key] = value

    _add_adhoc_filters(form_data, config.filters)
    if config.filters == [] and "filters" in config.model_fields_set:
        form_data["adhoc_filters"] = []
    if config.time_range and config.temporal_column:
        _ensure_temporal_adhoc_filter(form_data, config.temporal_column)
        for filter_ in form_data.get("adhoc_filters", []):
            if (
                isinstance(filter_, dict)
                and filter_.get("operator") == FilterOperator.TEMPORAL_RANGE.value
                and filter_.get("subject") == config.temporal_column
                and filter_.get("comparator") == NO_TIME_RANGE
            ):
                filter_["comparator"] = config.time_range
    return form_data


def merge_bullet_form_data(
    existing_form_data: Mapping[str, Any], new_form_data: Dict[str, Any]
) -> None:
    """Preserve omitted native Bullet controls across update tool paths.

    Query roles and every UI control have an explicit typed representation.
    Mappers emit optional fields only when the caller supplied them, so copying
    the bounded native keys below preserves omitted state while explicit empty,
    false, null, and zero-like values remain authoritative.
    """
    if (
        existing_form_data.get("viz_type") != "bullet"
        or new_form_data.get("viz_type") != "bullet"
    ):
        return
    preserved_keys = {
        "groupby",
        "adhoc_filters",
        "time_range",
        "row_limit",
        "orderby",
        "ranges",
        "range_labels",
        "markers",
        "marker_labels",
        "marker_lines",
        "marker_line_labels",
        "y_axis_format",
        "show_labels",
        "show_legend",
        MCP_DASHBOARD_TIME_FILTER_SUBJECT,
    }

    # Threshold and label arrays are one frontend control pair. If callers
    # replace the values without replacing their labels, clear the stale labels
    # instead of accidentally reassigning them by position.
    dependent_controls = {
        "ranges": "range_labels",
        "markers": "marker_labels",
        "marker_lines": "marker_line_labels",
    }
    for values_key, labels_key in dependent_controls.items():
        if values_key in new_form_data and labels_key not in new_form_data:
            new_form_data[labels_key] = ""

    for key in preserved_keys:
        if (
            key == MCP_DASHBOARD_TIME_FILTER_SUBJECT
            and "adhoc_filters" in new_form_data
        ):
            # The marker describes a mapper-generated temporal filter. Do not
            # retain stale provenance when an explicit filter update removed it.
            continue
        if key in existing_form_data and key not in new_form_data:
            new_form_data[key] = existing_form_data[key]


def _filter_identity(filter_: Any) -> tuple[Any, ...] | None:
    """Return the native identity used when one filter replaces another."""
    if not isinstance(filter_, Mapping):
        return None
    return (
        filter_.get("clause"),
        filter_.get("expressionType"),
        filter_.get("subject"),
        filter_.get("operator"),
    )


def _temporal_binding_filter(filters: list[Any], subject: Any) -> dict[str, Any] | None:
    """Find the unique filter owned by a recorded MCP temporal marker."""
    if subject is None:
        return None
    if not isinstance(subject, str) or not subject:
        raise ValueError(
            "MCP temporal binding provenance subject must be a non-empty string"
        )
    matches = [
        filter_
        for filter_ in filters
        if isinstance(filter_, dict)
        and filter_.get("subject") == subject
        and filter_.get("operator") == FilterOperator.TEMPORAL_RANGE.value
    ]
    if len(matches) != 1:
        raise ValueError(
            "MCP temporal binding provenance must match exactly one "
            f"TEMPORAL_RANGE filter for subject {subject!r}; found {len(matches)}"
        )
    return matches[0]


def _append_or_replace_filter(filters: list[Any], filter_: Any) -> None:
    """Append a filter, replacing the same native role when identifiable."""
    identity = _filter_identity(filter_)
    if identity is None:
        if filter_ not in filters:
            filters.append(filter_)
        return
    filters[:] = [item for item in filters if _filter_identity(item) != identity]
    filters.append(filter_)


_NATIVE_TEMPORAL_ROLE_FIELDS: dict[str, frozenset[str]] = {
    # Typed ``x`` is persisted as native x_axis/granularity_sqla for XY and
    # Mixed Timeseries. Waterfall exposes the typed field as ``x_axis``.
    "x_axis": frozenset({"x", "x_axis"}),
    "granularity_sqla": frozenset({"x", "x_axis", "temporal_column"}),
    # Chart plugins may designate a chart-specific query role as the implicit
    # dashboard-time subject.
    "start_time": frozenset({"start_time"}),
}


def _native_temporal_subject_changed(
    existing_form_data: Mapping[str, Any],
    new_form_data: Mapping[str, Any],
    explicit_fields: set[str],
) -> bool:
    """Return whether an authoritative native temporal role was replaced.

    Mapping a partial update can propose a dataset fallback binding even when
    the caller only changed filters. That proposal is not authoritative. A
    changed x/granularity/chart-specific role is authoritative only when its
    corresponding typed field was actually supplied.
    """
    for native_key, typed_fields in _NATIVE_TEMPORAL_ROLE_FIELDS.items():
        if explicit_fields.isdisjoint(typed_fields):
            continue
        existing_value = existing_form_data.get(native_key)
        incoming_value = new_form_data.get(native_key)
        if existing_value != incoming_value:
            return True
    return False


def _native_temporal_binding(
    form_data: Mapping[str, Any], filters: list[Any]
) -> tuple[str | None, dict[str, Any] | None]:
    """Resolve one binding for a trusted native temporal role, if present."""
    for native_key in _NATIVE_TEMPORAL_ROLE_FIELDS:
        subject = form_data.get(native_key)
        if not isinstance(subject, str) or not subject:
            continue
        matches = [
            filter_
            for filter_ in filters
            if isinstance(filter_, dict)
            and filter_.get("subject") == subject
            and filter_.get("operator") == FilterOperator.TEMPORAL_RANGE.value
        ]
        if len(matches) > 1:
            raise ValueError(
                "An authoritative native temporal subject must match at most one "
                f"TEMPORAL_RANGE filter for subject {subject!r}; found "
                f"{len(matches)}"
            )
        if matches:
            return subject, matches[0]
    return None, None


def merge_update_form_data(  # noqa: C901
    existing_form_data: Mapping[str, Any],
    new_form_data: Dict[str, Any],
    config: ChartConfig,
) -> None:
    """Apply the shared omission/provenance contract for chart updates.

    Mapper-generated neutral temporal bindings are infrastructure, not evidence
    that the caller supplied ``filters`` or changed a saved time-range binding.
    This helper is used by immediate saves, preview-first saved updates, and
    cached-preview updates so omission, clear, replacement, and temporal
    overrides have identical behavior.
    """
    existing_filters = list(existing_form_data.get("adhoc_filters") or [])
    incoming_filters = list(new_form_data.get("adhoc_filters") or [])
    existing_subject = existing_form_data.get(MCP_DASHBOARD_TIME_FILTER_SUBJECT)
    incoming_subject = new_form_data.get(MCP_DASHBOARD_TIME_FILTER_SUBJECT)
    existing_binding = _temporal_binding_filter(existing_filters, existing_subject)
    incoming_binding = _temporal_binding_filter(incoming_filters, incoming_subject)

    explicit_fields = set(getattr(config, "model_fields_set", set()))
    filters_explicit = "filters" in explicit_fields
    range_explicit = "time_range" in explicit_fields
    subject_explicit = "temporal_column" in explicit_fields
    native_subject_changed = _native_temporal_subject_changed(
        existing_form_data, new_form_data, explicit_fields
    )
    subject_authoritative = subject_explicit or native_subject_changed
    if incoming_binding is None:
        native_subject, native_binding = _native_temporal_binding(
            new_form_data, incoming_filters
        )
        if native_binding is not None:
            incoming_subject = native_subject
            incoming_binding = native_binding
    incoming_user_filters = [
        filter_ for filter_ in incoming_filters if filter_ is not incoming_binding
    ]
    temporal_explicit = range_explicit or subject_authoritative

    chosen_binding: dict[str, Any] | None = None
    chosen_subject: Any = None
    if not filters_explicit:
        # Omission is byte-faithful: keep the native sequence in its exact order,
        # including SQL/HAVING objects and a provenance-owned binding at any index.
        merged_filters = list(existing_filters)
        chosen_binding = existing_binding
        chosen_subject = existing_subject
        if temporal_explicit:
            if subject_authoritative:
                chosen_binding = incoming_binding
                chosen_subject = incoming_subject
            elif existing_binding is not None:
                # A range-only update belongs to the saved subject, even when
                # mapping the partial config proposed the dataset main_dttm.
                chosen_binding = dict(existing_binding)
                chosen_subject = existing_subject
            else:
                chosen_binding = incoming_binding
                chosen_subject = incoming_subject

            if chosen_binding is not None:
                chosen_binding = dict(chosen_binding)
                if range_explicit:
                    chosen_binding["comparator"] = (
                        getattr(config, "time_range", None) or NO_TIME_RANGE
                    )
                elif existing_binding is not None:
                    # Subject-only replacement preserves the saved active or
                    # neutral range instead of resetting it to No filter.
                    chosen_binding["comparator"] = existing_binding.get(
                        "comparator", NO_TIME_RANGE
                    )
            if existing_binding is not None:
                binding_index = next(
                    index
                    for index, filter_ in enumerate(merged_filters)
                    if filter_ is existing_binding
                )
                if chosen_binding is None:
                    merged_filters.pop(binding_index)
                else:
                    # A temporal override changes infrastructure in place instead
                    # of moving it past surrounding native filters.
                    merged_filters[binding_index] = chosen_binding
            elif chosen_binding is not None:
                merged_filters.append(chosen_binding)
    else:
        # An explicit filter array replaces the saved native sequence. The mapper
        # deliberately emits [] for an explicit clear; otherwise retain its
        # generated temporal binding after the replacement filters.
        merged_filters = list(incoming_user_filters)
        if incoming_user_filters or temporal_explicit:
            if subject_authoritative:
                chosen_binding = incoming_binding
                chosen_subject = incoming_subject
            elif range_explicit and existing_binding is not None:
                chosen_binding = dict(existing_binding)
                chosen_subject = existing_subject
            else:
                # A filter-only replacement keeps the saved provenance binding.
                # The mapper's incoming binding may merely be a dataset fallback
                # and must not reset the saved subject or active range.
                chosen_binding = existing_binding
                chosen_subject = existing_subject
            if chosen_binding is not None:
                chosen_binding = dict(chosen_binding)
                if range_explicit:
                    chosen_binding["comparator"] = (
                        getattr(config, "time_range", None) or NO_TIME_RANGE
                    )
                elif subject_authoritative and existing_binding is not None:
                    chosen_binding["comparator"] = existing_binding.get(
                        "comparator", NO_TIME_RANGE
                    )
            if chosen_binding is not None:
                _append_or_replace_filter(merged_filters, chosen_binding)

    # Materialize exactly when saved state had the key or the caller made the
    # controls authoritative. An omitted update must not turn a missing native
    # filter key into [] merely because its mapper proposed a neutral binding.
    if filters_explicit or "adhoc_filters" in existing_form_data or temporal_explicit:
        new_form_data["adhoc_filters"] = merged_filters
    else:
        new_form_data.pop("adhoc_filters", None)
    if chosen_binding is not None and isinstance(chosen_subject, str):
        new_form_data[MCP_DASHBOARD_TIME_FILTER_SUBJECT] = chosen_subject
    else:
        new_form_data.pop(MCP_DASHBOARD_TIME_FILTER_SUBJECT, None)

    merge_bullet_form_data(existing_form_data, new_form_data)


def _currency_form_value(value: CurrencyFormat | None) -> dict[str, str] | None:
    """Return the native value for an explicitly supplied currency control."""
    return value.to_form_data() if value is not None else None


def _column_names(value: Sequence[ColumnRef] | None) -> list[str | None] | None:
    """Return a native column-name list while retaining an explicit null."""
    return [column.name for column in value] if value is not None else None


def _table_sort_value(value: Sequence[str | SortByConfig] | None) -> list[str] | None:
    """Return the native Table sort control for an explicit typed value."""
    if value is None:
        return None
    return [
        json.dumps(
            [entry.column, entry.ascending]
            if isinstance(entry, SortByConfig)
            else [entry, False]
        )
        for entry in value
    ]


def _table_column_config_value(value: Any) -> dict[str, Any] | None:
    """Return Table column config without losing an explicit null or empty map."""
    if value is None:
        return None
    return {
        label: column.model_dump(by_alias=True, exclude_unset=True)
        for label, column in value.items()
    }


# Mappers intentionally omit optional controls so fresh charts use the frontend
# defaults. During a same-viz update, however, an explicitly supplied false,
# null, or empty value must block preservation of the saved native key. Keep the
# typed-to-native relationship declarative so every update path shares it.
_FormValueConverter = Callable[[Any], Any]
_FormControlMap = dict[str, tuple[str, _FormValueConverter]]

_COMMON_EXPLICIT_FORM_CONTROLS: _FormControlMap = {
    "color_scheme": ("color_scheme", lambda value: value),
    "currency_format": ("currency_format", _currency_form_value),
    "show_value": ("show_value", lambda value: value),
}

_CHART_EXPLICIT_FORM_CONTROLS: dict[str, _FormControlMap] = {
    "table": {
        "sort_by": ("order_by_cols", _table_sort_value),
        "column_config": ("column_config", _table_column_config_value),
    },
    "xy": {
        "group_by": ("groupby", _column_names),
        "series_limit": ("series_limit", lambda value: value),
        "stacked": ("stack", lambda value: "Stack" if value else None),
        "orientation": ("orientation", lambda value: value),
        "legend_orientation": ("legendOrientation", lambda value: value),
        "x_axis_time_format": ("x_axis_time_format", lambda value: value),
        "time_grain": ("time_grain_sqla", lambda value: value),
    },
    "mixed_timeseries": {
        "group_by": ("groupby", _column_names),
        "group_by_secondary": ("groupby_b", _column_names),
        "currency_format_secondary": (
            "currency_format_secondary",
            _currency_form_value,
        ),
        "time_grain": ("time_grain_sqla", lambda value: value),
    },
    "waterfall": {
        "time_grain": ("time_grain_sqla", lambda value: value),
    },
    "big_number": {
        "subheader": ("subheader", lambda value: value),
        "y_axis_format": ("y_axis_format", lambda value: value),
        "time_grain": ("time_grain_sqla", lambda value: value),
        "compare_lag": ("compare_lag", lambda value: value),
        "time_format": ("time_format", lambda value: value),
        "aggregation": ("aggregation", lambda value: value),
    },
    "handlebars": {
        "style_template": ("styleTemplate", lambda value: value),
        "columns": ("all_columns", _column_names),
        "groupby": ("groupby", _column_names),
        "metrics": ("metrics", _column_names),
    },
    "pivot_table": {
        "date_format": ("date_format", lambda value: value),
    },
    "interactive_pivot": {
        "time_grain": ("time_grain_sqla", lambda value: value),
        "series_limit": ("series_limit", lambda value: value),
        "date_format": ("date_format", lambda value: value),
        "column_sort": ("colOrder", lambda value: value),
    },
}


def _apply_explicit_form_controls(  # noqa: C901
    existing_form_data: Mapping[str, Any],
    new_form_data: Dict[str, Any],
    config: ChartConfig,
) -> None:
    """Apply typed controls whose mapper omission represents a native clear."""
    explicit_fields = set(getattr(config, "model_fields_set", set()))
    controls = {
        **_COMMON_EXPLICIT_FORM_CONTROLS,
        **_CHART_EXPLICIT_FORM_CONTROLS.get(config.chart_type, {}),
    }
    for field_name, (native_key, convert) in controls.items():
        if field_name in explicit_fields:
            converted = convert(getattr(config, field_name))
            is_clear = (
                converted is None
                or converted is False
                or converted == ""
                or converted in ([], {})
            )
            if is_clear:
                new_form_data[native_key] = converted

    axis_controls = {
        "xy": (
            ("x_axis", "x_axis_title", "x_axis_format", None),
            ("y_axis", "y_axis_title", "y_axis_format", "logAxis"),
        ),
        "mixed_timeseries": (
            ("x_axis", "xAxisTitle", "x_axis_time_format", None),
            ("y_axis", "yAxisTitle", "y_axis_format", "logAxis"),
            (
                "y_axis_secondary",
                "yAxisTitleSecondary",
                "y_axis_format_secondary",
                "logAxisSecondary",
            ),
        ),
    }
    if config.chart_type in axis_controls:
        for field_name, title_key, format_key, scale_key in axis_controls[
            config.chart_type
        ]:
            if field_name not in explicit_fields:
                continue
            axis = getattr(config, field_name)
            if axis is None:
                new_form_data[title_key] = None
                new_form_data[format_key] = None
                if scale_key:
                    new_form_data[scale_key] = None
                continue
            axis_fields = set(axis.model_fields_set)
            if "title" in axis_fields:
                new_form_data[title_key] = axis.title
            if "format" in axis_fields:
                new_form_data[format_key] = axis.format
            if scale_key and "scale" in axis_fields:
                new_form_data[scale_key] = (
                    None if axis.scale is None else axis.scale == "log"
                )

        if config.chart_type == "xy" and "legend" in explicit_fields:
            legend = config.legend
            if legend is None:
                new_form_data["show_legend"] = None
                new_form_data["legendOrientation"] = None
            else:
                legend_fields = set(legend.model_fields_set)
                if "show" in legend_fields:
                    new_form_data["show_legend"] = legend.show
                if "position" in legend_fields:
                    new_form_data["legendOrientation"] = legend.position

    if config.chart_type == "interactive_pivot":
        if "temporal_column" in explicit_fields and config.temporal_column is None:
            new_form_data["granularity_sqla"] = None
            new_form_data["temporal_columns_lookup"] = None
        if (
            "series_limit_metric" in explicit_fields
            and config.series_limit_metric is None
        ):
            new_form_data["series_limit_metric"] = None
        if "comparison_period" in explicit_fields and config.comparison_period is None:
            new_form_data["time_compare"] = None
        if "comparison_type" in explicit_fields and config.comparison_type is None:
            new_form_data["comparison_type"] = None

    # A Waterfall axis replacement cannot inherit a bucket belonging to the old
    # temporal subject. Grain omission preserves only while the axis is stable;
    # explicit null is already handled by the declarative control map above.
    if (
        config.chart_type == "waterfall"
        and existing_form_data.get("x_axis") != new_form_data.get("x_axis")
        and "time_grain" not in explicit_fields
    ):
        new_form_data["time_grain_sqla"] = None


def merge_same_viz_form_data(
    existing_form_data: Mapping[str, Any],
    new_form_data: Dict[str, Any],
    config: ChartConfig,
) -> None:
    """Preserve saved controls that the typed mapper does not represent.

    The typed MCP surface deliberately models a bounded subset of every Explore
    control panel. For a replacement within the exact same native ``viz_type``,
    keys absent from the mapper therefore represent omitted controls and retain
    their saved values. Mapper output and the chart-specific merge helpers run
    first and remain authoritative, including explicit empty, false, null, and
    nested values.

    No generic state crosses a visualization boundary. This prevents query-role
    keys from the previous plugin (for example ``metric`` or ``groupby``) from
    leaking into a different plugin whose role contract is unrelated.
    """
    existing_viz_type = existing_form_data.get("viz_type")
    if not isinstance(existing_viz_type, str) or existing_viz_type != new_form_data.get(
        "viz_type"
    ):
        return

    _apply_explicit_form_controls(existing_form_data, new_form_data, config)

    for key, value in existing_form_data.items():
        if key == MCP_DASHBOARD_TIME_FILTER_SUBJECT:
            # merge_update_form_data owns this provenance marker. Its absence
            # may be an intentional subject clear and must not be undone by the
            # generic preservation layer.
            continue
        if key not in new_form_data:
            new_form_data[key] = value


def validate_merged_bullet_form_data(
    form_data: Mapping[str, Any],
    update_config: ChartConfig | None = None,
) -> BulletChartConfig | None:
    """Validate final Bullet state without reclassifying preserved filters.

    The typed Bullet surface intentionally creates only SIMPLE WHERE filters,
    while saved Explore state may legitimately contain SQL WHERE or SIMPLE
    HAVING filters. When an update omitted ``filters``, those native objects
    came from the saved state and are validated by the form-data/query layer;
    removing them only from this schema-validation copy avoids pretending they
    were newly supplied typed filters. Explicit filter replacements, including
    ``[]``, still take the strict native-to-typed path.
    """
    if form_data.get("viz_type") != "bullet":
        return None
    validation_data = dict(form_data)
    preserves_native_filters = update_config is None or (
        isinstance(update_config, BulletChartConfig)
        and "filters" not in update_config.model_fields_set
    )
    if preserves_native_filters:
        validation_data.pop("adhoc_filters", None)
        validation_data.pop(MCP_DASHBOARD_TIME_FILTER_SUBJECT, None)
    return BulletChartConfig.model_validate(validation_data)


# The exact strings the frontend boxplotOperator understands; the percentile
# variant must match its PERCENTILE_REGEX: "<low>/<high> percentiles".
_WHISKER_TYPE_TO_OPTION = {
    "tukey": "Tukey",
    "min_max": "Min/max (no outliers)",
}


def map_box_plot_config(config: "BoxPlotChartConfig") -> Dict[str, Any]:
    """Map box plot config to Superset form_data (viz_type box_plot).

    Matches the frontend BoxPlot buildQuery contract: ``columns`` are the
    distribute-across values (one box per value), ``groupby`` the series
    dimensions, and ``whiskerOptions`` one of the strings the
    boxplotOperator post-processor parses.
    """
    if config.whisker_type == "percentile":
        whisker_options = (
            f"{config.percentile_low}/{config.percentile_high} percentiles"
        )
    else:
        whisker_options = _WHISKER_TYPE_TO_OPTION[config.whisker_type]

    form_data: Dict[str, Any] = {
        "viz_type": "box_plot",
        "columns": [c.name for c in config.distribute_across],
        "groupby": [d.name for d in (config.dimensions or [])],
        "metrics": [create_metric_object(m) for m in config.metrics],
        "whiskerOptions": whisker_options,
        "row_limit": config.row_limit,
        "number_format": config.number_format,
        "date_format": config.date_format,
    }
    _add_adhoc_filters(form_data, config.filters)
    return form_data


def map_waterfall_config(
    config: WaterfallChartConfig,
    dataset_id: int | str | None = None,
) -> Dict[str, Any]:
    """Map waterfall config to Superset form_data (viz_type waterfall).

    Matches the frontend Waterfall buildQuery contract: a single ``x_axis``
    column, an optional single-select ``groupby`` breakdown, and one
    ``metric``; the query orders by the axis columns ascending, which the
    frontend derives from these keys.
    """
    form_data: Dict[str, Any] = {
        "viz_type": "waterfall",
        "x_axis": config.x_axis.name,
        "groupby": [config.breakdown.name] if config.breakdown else [],
        "metric": create_metric_object(config.metric),
        "show_total": config.show_total,
        "show_legend": config.show_legend,
        "increase_label": config.increase_label,
        "decrease_label": config.decrease_label,
        "total_label": config.total_label,
        "x_axis_time_format": config.x_axis_time_format,
        "y_axis_format": config.y_axis_format,
        "row_limit": config.row_limit,
    }
    # A temporal x_axis remains the query granularity even when the caller omits
    # a grain. This makes an x-axis replacement authoritative before same-viz
    # state is merged and gives the dashboard-time binder the new subject.
    x_is_temporal = is_column_truly_temporal(config.x_axis.name or "", dataset_id)
    form_data["granularity_sqla"] = config.x_axis.name if x_is_temporal else None

    # Bucket a temporal x_axis: the grain (time_grain_sqla) needs the temporal
    # column it applies to (granularity_sqla), mirroring the XY path.
    if config.time_grain:
        form_data["time_grain_sqla"] = config.time_grain
    elif "time_grain" in config.model_fields_set:
        # An explicit null clears a saved bucket while the x-axis remains the
        # authoritative temporal subject for dashboard filter provenance.
        form_data["time_grain_sqla"] = None
    add_currency_format(form_data, config.currency_format)
    _add_adhoc_filters(form_data, config.filters)
    return form_data


def map_big_number_config(
    config: BigNumberChartConfig, dataset_id: int | str | None = None
) -> Dict[str, Any]:
    """Map big number chart config to Superset form_data."""
    # Determine viz_type: big_number (with trendline) or big_number_total
    if config.show_trendline and config.temporal_column:
        viz_type = "big_number"
    else:
        viz_type = "big_number_total"

    metric = create_metric_object(config.metric)
    form_data: Dict[str, Any] = {
        "viz_type": viz_type,
        "metric": metric,
    }

    if config.subheader:
        form_data["subheader"] = config.subheader

    if config.y_axis_format:
        form_data["y_axis_format"] = config.y_axis_format

    add_color_scheme(form_data, config.color_scheme)
    add_currency_format(form_data, config.currency_format)

    # Trendline-specific fields
    if viz_type == "big_number":
        # Big Number with trendline uses granularity_sqla for the temporal column
        # (unlike XY charts which use x_axis). This is how Superset's
        # big_number viz determines the time column for the trendline.
        form_data["granularity_sqla"] = config.temporal_column
        form_data["show_trend_line"] = True
        form_data["start_y_axis_at_zero"] = config.start_y_axis_at_zero

        if config.time_grain:
            form_data["time_grain_sqla"] = config.time_grain

        if config.compare_lag is not None:
            form_data["compare_lag"] = config.compare_lag

        if config.time_format:
            form_data["time_format"] = config.time_format

        if config.aggregation is not None:
            form_data["aggregation"] = config.aggregation

    _add_adhoc_filters(form_data, config.filters)

    # Bind a TEMPORAL_RANGE adhoc filter so dashboard time-range filters have
    # a column to apply to — mirrors the Explore UI's `BigNumberTotal` control
    # panel, which exposes an `adhoc_filters` control even though there's no
    # dedicated time-column control for the total variant.
    if temporal_column := _resolve_big_number_temporal_column(config, dataset_id):
        _ensure_generated_temporal_binding(form_data, temporal_column)

    return form_data


def _resolve_big_number_temporal_column(
    config: BigNumberChartConfig, dataset_id: int | str | None
) -> str | None:
    """Resolve the column to bind a Big Number's TEMPORAL_RANGE filter to.

    Matches the Explore UI default: use the dataset's main_dttm_col, or its
    first temporal column when no main column is configured. Guards candidates
    with is_column_truly_temporal (the same check map_xy_config applies to its
    x-axis) so a non-temporal column never gets a TEMPORAL_RANGE filter. The
    dataset is fetched at most once here and reused by the temporal checks
    instead of letting them re-query by dataset_id.
    """
    if config.temporal_column:
        if is_column_truly_temporal(config.temporal_column, dataset_id):
            return config.temporal_column
        return None

    try:
        dataset = _find_dataset_by_id_or_uuid(dataset_id)
    except SQLAlchemyError:
        logger.warning(
            "Unable to resolve a temporal column for dataset %s",
            dataset_id,
            exc_info=True,
        )
        return None
    if not dataset:
        return None

    candidates: list[str] = []
    if dataset.main_dttm_col:
        candidates.append(dataset.main_dttm_col)
    candidates.extend(
        column.column_name for column in dataset.columns if column.column_name
    )
    for temporal_column in dict.fromkeys(candidates):
        if is_column_truly_temporal(temporal_column, dataset_id, dataset=dataset):
            return temporal_column
    return None


def map_handlebars_config(config: HandlebarsChartConfig) -> Dict[str, Any]:
    """Map handlebars chart config to Superset form_data."""
    form_data: Dict[str, Any] = {
        "viz_type": "handlebars",
        # Persist under the camelCase key the Handlebars renderer reads
        # (`formData.handlebarsTemplate`); the snake_case `handlebars_template`
        # is the tool's request-contract field, not the persisted form_data key.
        "handlebarsTemplate": config.handlebars_template,
        "row_limit": config.row_limit,
        "order_desc": config.order_desc,
    }

    if config.style_template:
        form_data["styleTemplate"] = config.style_template

    if config.query_mode == "raw":
        form_data["query_mode"] = "raw"
        if config.columns:
            form_data["all_columns"] = [col.name for col in config.columns]
    else:
        form_data["query_mode"] = "aggregate"
        if config.groupby:
            form_data["groupby"] = [col.name for col in config.groupby]
        if config.metrics:
            form_data["metrics"] = [create_metric_object(col) for col in config.metrics]
    if config.filters:
        form_data["adhoc_filters"] = [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": filter_config.column,
                "operator": map_filter_operator(filter_config.op),
                "comparator": filter_config.value,
            }
            for filter_config in config.filters
            if filter_config is not None
        ]

    return form_data


def map_pivot_table_config(config: PivotTableChartConfig) -> Dict[str, Any]:
    """Map pivot table config to Superset form_data."""
    if not config.rows:
        raise ValueError("Pivot table must have at least one row grouping column")
    if not config.metrics:
        raise ValueError("Pivot table must have at least one metric")

    metrics = [create_metric_object(col) for col in config.metrics]

    form_data: Dict[str, Any] = {
        "viz_type": "pivot_table_v2",
        "groupbyRows": [col.name for col in config.rows],
        "groupbyColumns": [col.name for col in config.columns]
        if config.columns
        else [],
        "metrics": metrics,
        "aggregateFunction": config.aggregate_function,
        "rowTotals": config.show_row_totals,
        "colTotals": config.show_column_totals,
        "transposePivot": config.transpose,
        "combineMetric": config.combine_metric,
        "valueFormat": config.value_format,
        "metricsLayout": "COLUMNS",
        "rowOrder": "key_a_to_z",
        "colOrder": "key_a_to_z",
        "row_limit": config.row_limit,
    }

    if config.date_format:
        form_data["date_format"] = config.date_format

    add_currency_format(form_data, config.currency_format)
    _add_adhoc_filters(form_data, config.filters)

    return form_data


_MIXED_SERIES_TYPE_MAP = {
    "line": "line",
    "bar": "bar",
    "area": "line",  # area uses line type with area=True
    "scatter": "scatter",
}


def _apply_axis_to_form_data(
    form_data: Dict[str, Any],
    axis_config: Any,
    title_key: str,
    format_key: str,
    log_key: str | None = None,
) -> None:
    """Apply a single axis configuration to form_data."""
    if not axis_config:
        return
    if axis_config.title or "title" in axis_config.model_fields_set:
        form_data[title_key] = axis_config.title
    if axis_config.format or "format" in axis_config.model_fields_set:
        form_data[format_key] = axis_config.format
    if log_key and (
        axis_config.scale == "log" or "scale" in axis_config.model_fields_set
    ):
        form_data[log_key] = axis_config.scale == "log"


def _add_mixed_axis_config(
    form_data: Dict[str, Any],
    config: MixedTimeseriesChartConfig,
) -> None:
    """Add axis configurations to mixed timeseries form_data."""
    _apply_axis_to_form_data(
        form_data, config.x_axis, "xAxisTitle", "x_axis_time_format"
    )
    _apply_axis_to_form_data(
        form_data, config.y_axis, "yAxisTitle", "y_axis_format", "logAxis"
    )
    _apply_axis_to_form_data(
        form_data,
        config.y_axis_secondary,
        "yAxisTitleSecondary",
        "y_axis_format_secondary",
        "logAxisSecondary",
    )


def map_mixed_timeseries_config(  # noqa: C901
    config: MixedTimeseriesChartConfig,
    dataset_id: int | str | None = None,
) -> Dict[str, Any]:
    """Map mixed timeseries chart config to Superset form_data."""
    if not config.y:
        raise ValueError("Mixed timeseries must have at least one primary metric")
    if not config.y_secondary:
        raise ValueError("Mixed timeseries must have at least one secondary metric")

    # x rejects sql_expression at validation, so name is set.
    if config.x.name is None:
        raise ValueError("Mixed timeseries chart requires an x-axis column name")
    x_is_temporal = is_column_truly_temporal(config.x.name, dataset_id)

    form_data: Dict[str, Any] = {
        "viz_type": "mixed_timeseries",
        "x_axis": config.x.name,
        # Query A
        "metrics": [create_metric_object(col) for col in config.y],
        "seriesType": _MIXED_SERIES_TYPE_MAP.get(config.primary_kind, "line"),
        "area": config.primary_kind == "area",
        "yAxisIndex": 0,
        # Query B
        "metrics_b": [create_metric_object(col) for col in config.y_secondary],
        "seriesTypeB": _MIXED_SERIES_TYPE_MAP.get(config.secondary_kind, "bar"),
        "areaB": config.secondary_kind == "area",
        "yAxisIndexB": 1,
        # Display
        "show_legend": config.show_legend,
        "legendOrientation": config.legend_orientation,
        "zoomable": True,
        "rich_tooltip": True,
    }

    if config.show_value:
        form_data["show_value"] = True

    add_color_scheme(form_data, config.color_scheme)
    add_currency_format(form_data, config.currency_format)
    add_currency_format(
        form_data, config.currency_format_secondary, key="currency_format_secondary"
    )

    # Configure temporal handling
    configure_temporal_handling(form_data, x_is_temporal, config.time_grain)
    if "time_grain" in config.model_fields_set and config.time_grain is None:
        form_data["time_grain_sqla"] = None

    # Primary groupby (Query A)
    if config.group_by:
        groupby = [c.name for c in config.group_by if c.name != config.x.name]
        if groupby:
            form_data["groupby"] = groupby
    elif "group_by" in config.model_fields_set:
        form_data["groupby"] = []

    # Secondary groupby (Query B)
    if config.group_by_secondary:
        groupby_b = [
            c.name for c in config.group_by_secondary if c.name != config.x.name
        ]
        if groupby_b:
            form_data["groupby_b"] = groupby_b
    elif "group_by_secondary" in config.model_fields_set:
        form_data["groupby_b"] = []

    form_data["row_limit"] = config.row_limit

    _add_mixed_axis_config(form_data, config)

    _add_adhoc_filters(form_data, config.filters)

    return form_data


def map_filter_operator(op: str) -> str:
    """Map filter operator to Superset format."""
    operator_map = {
        "=": "==",
        ">": ">",
        "<": "<",
        ">=": ">=",
        "<=": "<=",
        "!=": "!=",
        "LIKE": "LIKE",
        "ILIKE": "ILIKE",
        "NOT LIKE": "NOT LIKE",
        "IN": "IN",
        "NOT IN": "NOT IN",
        "IS NULL": "IS NULL",
        "IS NOT NULL": "IS NOT NULL",
    }
    return operator_map.get(op, op)


def _humanize_column(col: ColumnRef) -> str:
    """Return a human-readable label for a column reference."""
    if col.label:
        return col.label
    if col.sql_expression:
        return col.sql_expression
    name = (col.name or "").replace("_", " ").title()
    if col.saved_metric:
        return name
    if col.aggregate:
        return f"{col.aggregate.capitalize()}({name})"
    return name


def _summarize_filters(
    filters: list[FilterConfig] | None,
) -> str | None:
    """Extract a short context string from filter configs."""
    if not filters:
        return None
    parts: list[str] = []
    for f in filters[:2]:
        col = getattr(f, "column", "")
        val = getattr(f, "value", "")
        if isinstance(val, list):
            val = ", ".join(str(v) for v in val[:3])
        parts.append(f"{str(col).replace('_', ' ').title()} {val}")
    return ", ".join(parts) if parts else None


def _truncate(name: str, max_length: int = 60) -> str:
    """Truncate to *max_length*, preserving the en-dash context portion."""
    if len(name) <= max_length:
        return name
    if " \u2013 " in name:
        what, _context = name.split(" \u2013 ", 1)
        if len(what) <= max_length:
            return what
    return name[: max_length - 1] + "\u2026"


def _table_chart_what(config: TableChartConfig, dataset_name: str | None) -> str:
    """Build the descriptive fragment for a table chart."""
    has_agg = any(col.is_metric for col in config.columns)
    if has_agg:
        metrics = [col for col in config.columns if col.is_metric]
        what = ", ".join(_humanize_column(m) for m in metrics[:2])
        return f"{what} Summary"
    if dataset_name:
        return f"{dataset_name} Records"
    cols = ", ".join(_humanize_column(c) for c in config.columns[:3])
    return f"{cols} Table"


def _xy_chart_what(config: XYChartConfig) -> str:
    """Build the descriptive fragment for an XY chart."""
    primary_metric = _humanize_column(config.y[0]) if config.y else "Value"
    dimension = _humanize_column(config.x) if config.x else "Dimension"

    if config.kind in ("line", "area") and not config.group_by:
        return f"{primary_metric} Over Time"
    if config.group_by:
        group_label = _humanize_column(config.group_by[0])
        return f"{primary_metric} by {group_label}"
    if config.kind == "scatter":
        return f"{primary_metric} vs {dimension}"
    return f"{primary_metric} by {dimension}"


_GRAIN_MAP: dict[str, str] = {
    "PT1H": "Hourly",
    "P1D": "Daily",
    "P1W": "Weekly",
    "P1M": "Monthly",
    "P3M": "Quarterly",
    "P1Y": "Yearly",
}


def _xy_chart_context(config: XYChartConfig) -> str | None:
    """Build context (time grain / filters) for an XY chart name."""
    parts: list[str] = []
    if config.time_grain:
        grain_val = (
            config.time_grain.value
            if hasattr(config.time_grain, "value")
            else str(config.time_grain)
        )
        grain_str = _GRAIN_MAP.get(grain_val, grain_val)
        parts.append(grain_str)
    if filter_ctx := _summarize_filters(config.filters):
        parts.append(filter_ctx)
    return ", ".join(parts) if parts else None


def _pie_chart_what(config: PieChartConfig) -> str:
    """Build the 'what' portion for a pie chart name."""
    dim = config.dimension.name
    metric_label = (
        config.metric.label or config.metric.name or config.metric.sql_expression
    )
    return f"{dim} by {metric_label}"


def _gauge_chart_what(config: GaugeChartConfig) -> str:
    """Build the 'what' portion for a gauge chart name."""
    metric_label = (
        config.metric.label or config.metric.name or config.metric.sql_expression
    )
    if config.groupby:
        dims = ", ".join(g.name for g in config.groupby if g.name)
        if dims:
            return f"{metric_label} by {dims}"
    return f"{metric_label}"


def _pivot_table_what(config: PivotTableChartConfig) -> str:
    """Build the 'what' portion for a pivot table chart name."""
    # Pivot rows reject sql_expression at validation, so name is set.
    row_names = ", ".join(r.name or "" for r in config.rows)
    return f"Pivot Table \u2013 {row_names}"


def _mixed_timeseries_what(config: MixedTimeseriesChartConfig) -> str:
    """Build the 'what' portion for a mixed timeseries chart name."""
    primary = (
        (config.y[0].label or config.y[0].name or config.y[0].sql_expression)
        if config.y
        else "primary"
    )
    secondary = (
        (
            config.y_secondary[0].label
            or config.y_secondary[0].name
            or config.y_secondary[0].sql_expression
        )
        if config.y_secondary
        else "secondary"
    )
    return f"{primary} + {secondary}"


def _handlebars_chart_what(config: HandlebarsChartConfig) -> str:
    """Build the 'what' portion for a handlebars chart name.

    Uses parentheses instead of en-dash to avoid collision with
    ``generate_chart_name``'s ``\u2013`` context separator.
    """
    if config.query_mode == "raw" and config.columns:
        # Raw columns reject sql_expression at validation, so col.name is set.
        cols = ", ".join(col.name or "" for col in config.columns[:3])
        return f"Handlebars ({cols})"
    elif config.metrics:
        # Prefer raw column name for back-compat with existing chart names;
        # SQL metrics fall back to label, then the expression itself.
        metrics = ", ".join(
            col.name or col.label or col.sql_expression or ""
            for col in config.metrics[:3]
        )
        return f"Handlebars ({metrics})"
    return "Handlebars Chart"


def _big_number_chart_what(config: BigNumberChartConfig) -> str:
    """Build the 'what' portion for a big number chart name.

    Uses parentheses instead of en-dash to avoid collision with
    ``generate_chart_name``'s ``\u2013`` context separator.
    """
    if config.metric.label:
        metric_label = config.metric.label
    elif config.metric.sql_expression:
        metric_label = config.metric.sql_expression
    elif config.metric.aggregate:
        metric_label = f"{config.metric.aggregate}({config.metric.name})"
    else:
        metric_label = config.metric.name or ""
    if config.show_trendline:
        return f"Big Number ({metric_label}, trendline)"
    return f"Big Number ({metric_label})"


def generate_chart_name(
    config: Any,
    dataset_name: str | None = None,
) -> str:
    """Generate a descriptive chart name following a standard format.

    Delegates to each plugin's ``generate_name()`` method.
    See each plugin's ``generate_name`` for chart-type-specific format conventions.
    An en-dash followed by context (filters / time grain) is appended by the plugin
    when such information is available.
    """
    from superset.mcp_service.chart.registry import get_registry

    plugin = get_registry().get(getattr(config, "chart_type", ""))
    if plugin is None:
        return "Chart"
    return _truncate(plugin.generate_name(config, dataset_name))


def _resolve_viz_type(config: Any) -> str:
    """Resolve the Superset viz_type from a chart config object."""
    from superset.mcp_service.chart.registry import get_registry

    plugin = get_registry().get(getattr(config, "chart_type", ""))
    if plugin is None:
        return "unknown"
    return plugin.resolve_viz_type(config)


TABLE_VIZ_TYPE_LABELS = {
    "table": "table chart",
    "ag-grid-table": "interactive table chart",
}


def get_table_chart_type_label(viz_type: str | None) -> str | None:
    """Return a user-facing label for table-family Superset viz types."""
    return TABLE_VIZ_TYPE_LABELS.get(viz_type) if viz_type is not None else None


def analyze_chart_capabilities(viz_type: str | None, config: Any) -> ChartCapabilities:
    """Analyze chart capabilities based on type and configuration."""
    if not viz_type:
        viz_type = _resolve_viz_type(config)

    # Determine interaction capabilities based on chart type
    interactive_types = [
        "echarts_timeseries_line",
        "echarts_timeseries_bar",
        "echarts_area",
        "echarts_timeseries_scatter",
        "deck_scatter",
        "deck_hex",
        "ag-grid-table",  # AG Grid tables are interactive
        "ag-grid-pivot-table",
    ]

    supports_interaction = viz_type == "bullet" or viz_type in interactive_types
    supports_drill_down = viz_type in [
        "table",
        "pivot_table_v2",
        "ag-grid-table",
        "ag-grid-pivot-table",
    ]
    supports_real_time = viz_type in [
        "echarts_timeseries_line",
        "echarts_timeseries_bar",
    ]

    # Determine optimal formats
    if viz_type == "bullet":
        # These are the formats implemented by both saved and transient Bullet
        # preview paths. Table explicitly rejects Bullet's layered semantics.
        optimal_formats = ["url", "vega_lite", "ascii"]
    else:
        optimal_formats = ["url"]  # Always include static image
        if supports_interaction:
            optimal_formats.extend(["interactive", "vega_lite"])
        optimal_formats.extend(["ascii", "table"])

    # Classify data types
    data_types = []
    if viz_type == "bullet":
        data_types.append("metric")
        if getattr(config, "dimensions", None):
            data_types.append("categorical")
    if hasattr(config, "x") and config.x:
        data_types.append("categorical" if not config.x.is_metric else "metric")
    if hasattr(config, "y") and config.y:
        data_types.extend(["metric"] * len(config.y))
    if "time" in viz_type or "timeseries" in viz_type:
        data_types.append("time_series")

    return ChartCapabilities(
        supports_interaction=supports_interaction,
        supports_real_time=supports_real_time,
        supports_drill_down=supports_drill_down,
        supports_export=True,  # All charts can be exported
        optimal_formats=optimal_formats,
        data_types=(
            list(dict.fromkeys(data_types))
            if viz_type == "bullet"
            else list(set(data_types))
        ),
    )


def analyze_chart_semantics(viz_type: str | None, config: Any) -> ChartSemantics:
    """Generate semantic understanding of the chart."""
    if not viz_type:
        viz_type = _resolve_viz_type(config)

    # Generate primary insight based on chart type
    insights_map = {
        "echarts_timeseries_line": "Shows trends and changes over time",
        "echarts_timeseries_bar": "Compares values across categories or time periods",
        "table": "Displays detailed data in tabular format",
        "ag-grid-table": (
            "Interactive table with advanced features like column resizing, "
            "sorting, filtering, and server-side pagination"
        ),
        "pie": "Shows proportional relationships within a dataset",
        "echarts_area": "Emphasizes cumulative totals and part-to-whole relationships",
        "pivot_table_v2": (
            "Cross-tabulates data with rows, columns, and aggregated metrics "
            "for multi-dimensional analysis"
        ),
        "ag-grid-pivot-table": (
            "Interactively cross-tabulates data with AG Grid row groups, pivot "
            "columns, value aggregation, and side-panel reconfiguration"
        ),
        "mixed_timeseries": (
            "Combines two different chart types on the same time axis "
            "for comparing related metrics with different scales"
        ),
        "handlebars": (
            "Renders data using a custom Handlebars HTML template for "
            "fully flexible layouts like KPI cards, leaderboards, and reports"
        ),
        "big_number": (
            "Displays a key metric with a trendline showing "
            "how the value changes over time"
        ),
        "big_number_total": (
            "Highlights a single key metric value as a prominent number"
        ),
    }

    primary_insight = insights_map.get(
        viz_type, f"Visualizes data using {viz_type} format"
    )

    # Generate data story
    columns = []
    if hasattr(config, "x") and config.x:
        columns.append(config.x.name)
    if hasattr(config, "y") and config.y:
        # SQL metrics have no name; fall back to label or the expression.
        columns.extend(
            [col.name or col.label or col.sql_expression for col in config.y]
        )

    if columns:
        ellipsis = "..." if len(columns) > 3 else ""
        data_story = (
            f"This {viz_type} chart analyzes {', '.join(columns[:3])}{ellipsis}"
        )
    else:
        data_story = "This chart provides insights into the selected dataset"

    # Generate recommended actions
    recommended_actions = [
        "Review data patterns and trends",
        "Consider filtering or drilling down for more detail",
        "Export chart for reporting or sharing",
    ]

    if viz_type in ["echarts_timeseries_line", "echarts_timeseries_bar"]:
        recommended_actions.append("Analyze seasonal patterns or cyclical trends")

    return ChartSemantics(
        primary_insight=primary_insight,
        data_story=data_story,
        recommended_actions=recommended_actions,
        anomalies=[],  # Would need actual data analysis to populate
        statistical_summary={},  # Would need actual data analysis to populate
    )
