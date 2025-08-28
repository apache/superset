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
# pylint: disable=invalid-name
from __future__ import annotations

import logging
from datetime import datetime
from pprint import pformat
from typing import Any, NamedTuple, TYPE_CHECKING

from flask import g
from flask_babel import gettext as _
from jinja2.exceptions import TemplateError
from pandas import DataFrame

from superset import feature_flag_manager
from superset.common.chart_data import ChartDataResultType
from superset.exceptions import (
    InvalidPostProcessingError,
    QueryClauseValidationException,
    QueryObjectValidationError,
)
from superset.extensions import event_logger
from superset.sql.parse import sanitize_clause
from superset.superset_typing import Column, Metric, OrderBy
from superset.utils import json, pandas_postprocessing
from superset.utils.core import (
    DTTM_ALIAS,
    find_duplicates,
    get_column_names,
    get_metric_names,
    is_adhoc_metric,
    QueryObjectFilterClause,
)
from superset.utils.hashing import md5_sha_from_dict
from superset.utils.json import json_int_dttm_ser

if TYPE_CHECKING:
    from superset.connectors.sqla.models import BaseDatasource

logger = logging.getLogger(__name__)

# TODO: Type Metrics dictionary with TypedDict when it becomes a vanilla python type
#  https://github.com/python/mypy/issues/5288


class DeprecatedField(NamedTuple):
    old_name: str
    new_name: str


DEPRECATED_FIELDS = (
    DeprecatedField(old_name="granularity_sqla", new_name="granularity"),
    DeprecatedField(old_name="groupby", new_name="columns"),
    DeprecatedField(old_name="timeseries_limit", new_name="series_limit"),
    DeprecatedField(old_name="timeseries_limit_metric", new_name="series_limit_metric"),
)

DEPRECATED_EXTRAS_FIELDS = (
    DeprecatedField(old_name="where", new_name="where"),
    DeprecatedField(old_name="having", new_name="having"),
)


class QueryObject:  # pylint: disable=too-many-instance-attributes
    """
    The query objects are constructed on the client.
    """

    annotation_layers: list[dict[str, Any]]
    applied_time_extras: dict[str, str]
    apply_fetch_values_predicate: bool
    columns: list[Column]
    datasource: BaseDatasource | None
    columns_by_name: dict[str, Any]
    metrics_by_name: dict[str, Any]
    extras: dict[str, Any]
    filter: list[QueryObjectFilterClause]
    from_dttm: datetime | None
    granularity: str | None
    inner_from_dttm: datetime | None
    inner_to_dttm: datetime | None
    is_rowcount: bool
    is_timeseries: bool
    metrics: list[Metric]
    order_desc: bool
    orderby: list[OrderBy]
    post_processing: list[dict[str, Any]]
    result_type: ChartDataResultType | None
    row_limit: int | None
    row_offset: int
    series_columns: list[Column]
    series_limit: int
    series_limit_metric: Metric | None
    time_offsets: list[str]
    time_shift: str | None
    time_range: str | None
    to_dttm: datetime | None

    def __init__(  # pylint: disable=too-many-locals, too-many-arguments
        self,
        *,
        annotation_layers: list[dict[str, Any]] | None = None,
        applied_time_extras: dict[str, str] | None = None,
        apply_fetch_values_predicate: bool = False,
        columns: list[Column] | None = None,
        datasource: BaseDatasource | None = None,
        extras: dict[str, Any] | None = None,
        filters: list[QueryObjectFilterClause] | None = None,
        granularity: str | None = None,
        is_rowcount: bool = False,
        is_timeseries: bool | None = None,
        metrics: list[Metric] | None = None,
        order_desc: bool = True,
        orderby: list[OrderBy] | None = None,
        post_processing: list[dict[str, Any] | None] | None = None,
        row_limit: int | None = None,
        row_offset: int | None = None,
        series_columns: list[Column] | None = None,
        series_limit: int = 0,
        series_limit_metric: Metric | None = None,
        group_others_when_limit_reached: bool = False,
        time_range: str | None = None,
        time_shift: str | None = None,
        **kwargs: Any,
    ):
        self._set_annotation_layers(annotation_layers)
        self.applied_time_extras = applied_time_extras or {}
        self.apply_fetch_values_predicate = apply_fetch_values_predicate or False
        self.columns = columns or []
        self.datasource = datasource

        # Build datasource mappings for easy lookup
        self.columns_by_name: dict[str, Any] = {}
        self.metrics_by_name: dict[str, Any] = {}

        if datasource:
            try:
                if hasattr(datasource, "columns") and datasource.columns is not None:
                    self.columns_by_name = {
                        col.column_name: col for col in datasource.columns
                    }
            except (TypeError, AttributeError):
                # Handle mocked datasources or other non-iterable cases
                pass

            try:
                if hasattr(datasource, "metrics") and datasource.metrics is not None:
                    self.metrics_by_name = {
                        metric.metric_name: metric for metric in datasource.metrics
                    }
            except (TypeError, AttributeError):
                # Handle mocked datasources or other non-iterable cases
                pass

        self.extras = extras or {}
        self.filter = filters or []
        self.granularity = granularity
        self.is_rowcount = is_rowcount
        self._set_is_timeseries(is_timeseries)
        self._set_metrics(metrics)
        self.order_desc = order_desc
        self.orderby = orderby or []
        self._set_post_processing(post_processing)
        self.row_limit = row_limit
        self.row_offset = row_offset or 0
        self._init_series_columns(series_columns, metrics, is_timeseries)
        self.series_limit = series_limit
        self.series_limit_metric = series_limit_metric
        self.group_others_when_limit_reached = group_others_when_limit_reached
        self.time_range = time_range
        self.time_shift = time_shift
        self.from_dttm = kwargs.get("from_dttm")
        self.to_dttm = kwargs.get("to_dttm")
        self.result_type = kwargs.get("result_type")
        self.time_offsets = kwargs.get("time_offsets", [])
        self.inner_from_dttm = kwargs.get("inner_from_dttm")
        self.inner_to_dttm = kwargs.get("inner_to_dttm")
        self._rename_deprecated_fields(kwargs)
        self._move_deprecated_extra_fields(kwargs)

    def _set_annotation_layers(
        self, annotation_layers: list[dict[str, Any]] | None
    ) -> None:
        self.annotation_layers = [
            layer
            for layer in (annotation_layers or [])
            # formula annotations don't affect the payload, hence can be dropped
            if layer["annotationType"] != "FORMULA"
        ]

    def _set_is_timeseries(self, is_timeseries: bool | None) -> None:
        # is_timeseries is True if time column is in either columns or groupby
        # (both are dimensions)
        self.is_timeseries = (
            is_timeseries if is_timeseries is not None else DTTM_ALIAS in self.columns
        )

    def _set_metrics(self, metrics: list[Metric] | None = None) -> None:
        # Support metric reference/definition in the format of
        #   1. 'metric_name'   - name of predefined metric
        #   2. { label: 'label_name' }  - legacy format for a predefined metric
        #   3. { expressionType: 'SIMPLE' | 'SQL', ... } - adhoc metric
        def is_str_or_adhoc(metric: Metric) -> bool:
            return isinstance(metric, str) or is_adhoc_metric(metric)

        # Track whether metrics was originally None (for need_groupby logic)
        self._metrics_is_not_none = metrics is not None

        self.metrics = [
            x if is_str_or_adhoc(x) else x["label"]  # type: ignore
            for x in (metrics or [])
        ]

    def _set_post_processing(
        self, post_processing: list[dict[str, Any] | None] | None
    ) -> None:
        post_processing = post_processing or []
        self.post_processing = [post_proc for post_proc in post_processing if post_proc]

    def _init_series_columns(
        self,
        series_columns: list[Column] | None,
        metrics: list[Metric] | None,
        is_timeseries: bool | None,
    ) -> None:
        if series_columns:
            self.series_columns = series_columns
        elif is_timeseries and metrics:
            self.series_columns = self.columns
        else:
            self.series_columns = []

    def _rename_deprecated_fields(self, kwargs: dict[str, Any]) -> None:
        # rename deprecated fields
        for field in DEPRECATED_FIELDS:
            if field.old_name in kwargs:
                logger.warning(
                    "The field `%s` is deprecated, please use `%s` instead.",
                    field.old_name,
                    field.new_name,
                )
                value = kwargs[field.old_name]
                if value is not None:
                    # Only override if the new field is not already populated with data
                    current_value = getattr(self, field.new_name, None)
                    if (
                        current_value
                    ):  # If field already has truthy data, don't override
                        logger.warning(
                            "The field `%s` is already populated, "
                            "not replacing with contents from deprecated `%s`.",
                            field.new_name,
                            field.old_name,
                        )
                    else:
                        setattr(self, field.new_name, value)

    def _move_deprecated_extra_fields(self, kwargs: dict[str, Any]) -> None:
        # move deprecated extras fields to extras
        for field in DEPRECATED_EXTRAS_FIELDS:
            if field.old_name in kwargs:
                logger.warning(
                    "The field `%s` is deprecated and should "
                    "be passed to `extras` via the `%s` property.",
                    field.old_name,
                    field.new_name,
                )
                value = kwargs[field.old_name]
                if value is not None and value != "":  # Don't add empty string values
                    if field.new_name in self.extras:
                        logger.warning(
                            "The field `%s` is already populated in "
                            "`extras`, replacing value with contents "
                            "from `%s`.",
                            field.new_name,
                            field.old_name,
                        )
                    self.extras[field.new_name] = value

    @property
    def metric_names(self) -> list[str]:
        """Return metrics names (labels), coerce adhoc metrics to strings."""
        return get_metric_names(
            self.metrics,
            (
                self.datasource.verbose_map
                if self.datasource and hasattr(self.datasource, "verbose_map")
                else None
            ),
        )

    @property
    def column_names(self) -> list[str]:
        """Return column names (labels). Gives priority to groupbys if both groupbys
        and metrics are non-empty, otherwise returns column labels."""
        return get_column_names(self.columns)

    @property
    def time_grain(self) -> str | None:
        """Get time grain from extras."""
        return (self.extras or {}).get("time_grain_sqla")

    @property
    def need_groupby(self) -> bool:
        """Determine if GROUP BY is needed based on metrics and columns."""
        # GROUP BY is needed when there are metrics or when metrics is explicitly
        # provided (even as empty list). When metrics=None, columns are just for
        # selection without aggregation, so no GROUP BY needed.
        return self._metrics_is_not_none

    @property
    def groupby(self) -> list[Column]:
        """Alias for columns (for backward compatibility/clarity)."""
        return self.columns or []

    def get_series_limit_prequery_obj(
        self,
        granularity: str | None,
        inner_from_dttm: datetime | None,
        inner_to_dttm: datetime | None,
        orderby: list[OrderBy] | None = None,
    ) -> dict[str, Any]:
        """Build prequery object for series limit queries.

        This is used to determine top groups when series_limit is set.

        Args:
            granularity: The time column name
            inner_from_dttm: Inner from datetime (if different from main query)
            inner_to_dttm: Inner to datetime (if different from main query)
            orderby: Optional orderby to override (for series_limit_metric)

        Returns:
            Dictionary suitable for passing to query()
        """
        from superset.utils.core import get_non_base_axis_columns

        return {
            "is_timeseries": False,
            "row_limit": self.series_limit,
            "metrics": self.metrics,
            "granularity": granularity,
            "groupby": self.groupby,
            "from_dttm": inner_from_dttm or self.from_dttm,
            "to_dttm": inner_to_dttm or self.to_dttm,
            "filter": self.filter,
            "orderby": orderby or [],
            "extras": self.extras or {},
            "columns": get_non_base_axis_columns(self.columns),
            "order_desc": True,
        }

    def build_select_expressions(  # noqa: C901
        self,
        granularity: str | None,
        series_column_labels: set[str],
        datasource: Any,  # BaseDatasource
        template_processor: Any,
    ) -> tuple[list[Any], dict[str, Any], dict[str, Any]]:
        """Build SELECT expressions for the query.

        Args:
            granularity: The time column name
            series_column_labels: Labels of series columns
            datasource: The datasource being queried
            template_processor: Template processor for SQL templating

        Returns:
            Tuple of (select_exprs, groupby_all_columns, groupby_series_columns)
        """
        from sqlalchemy import literal_column

        from superset.utils.core import (
            DTTM_ALIAS,
            is_adhoc_column,
        )

        select_exprs = []
        groupby_all_columns = {}
        groupby_series_columns = {}

        # Filter out the pseudo column __timestamp from columns
        columns = [col for col in self.columns if col != DTTM_ALIAS]

        if self.need_groupby:
            # dedup columns while preserving order
            columns = self.groupby or self.columns
            for selected in columns:
                if isinstance(selected, str):
                    # if groupby field/expr equals granularity field/expr
                    if selected == granularity:
                        table_col = self.columns_by_name[selected]
                        outer = table_col.get_timestamp_expression(
                            time_grain=self.time_grain,
                            label=selected,
                            template_processor=template_processor,
                        )
                    # if groupby field equals a selected column
                    elif selected in self.columns_by_name:
                        outer = datasource.convert_tbl_column_to_sqla_col(
                            self.columns_by_name[selected],
                            template_processor=template_processor,
                        )
                    else:
                        # Import here to avoid circular imports
                        from superset.models.helpers import validate_adhoc_subquery

                        selected = validate_adhoc_subquery(
                            selected,
                            datasource.database,
                            datasource.catalog,
                            datasource.schema,
                            datasource.database.db_engine_spec.engine,
                        )
                        outer = literal_column(f"({selected})")
                        outer = datasource.make_sqla_column_compatible(outer, selected)
                else:
                    outer = datasource.adhoc_column_to_sqla(
                        col=selected,
                        template_processor=template_processor,
                    )
                groupby_all_columns[outer.name] = outer
                if (
                    self.is_timeseries and not series_column_labels
                ) or outer.name in series_column_labels:
                    groupby_series_columns[outer.name] = outer
                select_exprs.append(outer)
        elif self.columns:
            with datasource.database.get_sqla_engine() as engine:
                quote = engine.dialect.identifier_preparer.quote

            for selected in self.columns:
                if is_adhoc_column(selected):
                    _sql = selected["sqlExpression"]
                    _column_label = selected["label"]
                elif isinstance(selected, str):
                    _sql = quote(selected)
                    _column_label = selected

                # Import here to avoid circular imports
                from superset.models.helpers import validate_adhoc_subquery

                selected = validate_adhoc_subquery(
                    _sql,
                    datasource.database,
                    datasource.catalog,
                    datasource.schema,
                    datasource.database.db_engine_spec.engine,
                )

                select_exprs.append(
                    datasource.convert_tbl_column_to_sqla_col(
                        self.columns_by_name[selected],
                        template_processor=template_processor,
                        label=_column_label,
                    )
                    if selected in self.columns_by_name
                    else datasource.make_sqla_column_compatible(
                        literal_column(selected), _column_label
                    )
                )

        return select_exprs, groupby_all_columns, groupby_series_columns

    def build_filter_clauses(  # noqa: C901
        self,
        datasource: Any,  # BaseDatasource
        template_processor: Any,
        time_filters: list[Any],
        removed_filters: set[str],
        applied_adhoc_filters_columns: list[Any],
        rejected_adhoc_filters_columns: list[Any],
        is_timeseries: bool,
        dttm_col: Any,
    ) -> tuple[list[Any], list[Any]]:
        """Build WHERE and HAVING filter clauses for the query.

        Args:
            datasource: The datasource being queried
            template_processor: Template processor for SQL templating
            time_filters: Time-based filters to apply
            removed_filters: Set of filter column names handled by Jinja templates
            applied_adhoc_filters_columns: List to track applied adhoc filters
            rejected_adhoc_filters_columns: List to track rejected adhoc filters
            is_timeseries: Whether this is a timeseries query
            dttm_col: The datetime column object

        Returns:
            Tuple of (where_clause_and, having_clause_and)
        """
        from flask import current_app
        from sqlalchemy import or_

        from superset import feature_flag_manager
        from superset.common.utils.time_range_utils import (
            get_since_until_from_time_range,
        )
        from superset.exceptions import QueryObjectValidationError
        from superset.utils.core import (
            DTTM_ALIAS,
            FilterOperator,
            GenericDataType,
            get_column_name,
            is_adhoc_column,
        )

        where_clause_and = []
        having_clause_and = []

        # Process regular filters
        for flt in self.filter:
            if not all(flt.get(s) for s in ["col", "op"]):
                continue
            flt_col = flt["col"]
            val = flt.get("val")
            flt_grain = flt.get("grain")
            op = FilterOperator(flt["op"].upper())
            col_obj = None
            sqla_col = None

            if flt_col == DTTM_ALIAS and is_timeseries and dttm_col:
                col_obj = dttm_col
            elif is_adhoc_column(flt_col):
                try:
                    sqla_col = datasource.adhoc_column_to_sqla(
                        flt_col, force_type_check=True
                    )
                    applied_adhoc_filters_columns.append(flt_col)
                except Exception:  # ColumnNotFoundException
                    rejected_adhoc_filters_columns.append(flt_col)
                    continue
            else:
                col_obj = self.columns_by_name.get(str(flt_col))
            filter_grain = flt.get("grain")

            if get_column_name(flt_col) in removed_filters:
                # Skip generating SQLA filter when the jinja template handles it.
                continue

            if col_obj or sqla_col is not None:
                db_engine_spec = datasource.database.db_engine_spec

                if sqla_col is not None:
                    pass
                elif col_obj and filter_grain:
                    sqla_col = col_obj.get_timestamp_expression(
                        time_grain=filter_grain, template_processor=template_processor
                    )
                elif col_obj:
                    sqla_col = datasource.convert_tbl_column_to_sqla_col(
                        tbl_column=col_obj, template_processor=template_processor
                    )

                col_type = col_obj.type if col_obj else None
                col_spec = db_engine_spec.get_column_spec(native_type=col_type)
                is_list_target = op in (
                    FilterOperator.IN,
                    FilterOperator.NOT_IN,
                )

                col_advanced_data_type = col_obj.advanced_data_type if col_obj else ""

                if col_spec and not col_advanced_data_type:
                    target_generic_type = col_spec.generic_type
                else:
                    target_generic_type = GenericDataType.STRING

                eq = datasource.filter_values_handler(
                    values=val,
                    operator=op,
                    target_generic_type=target_generic_type,
                    target_native_type=col_type,
                    is_list_target=is_list_target,
                    db_engine_spec=db_engine_spec,
                )

                # Get ADVANCED_DATA_TYPES from config when needed
                ADVANCED_DATA_TYPES = current_app.config.get("ADVANCED_DATA_TYPES", {})  # noqa: N806

                if (
                    col_advanced_data_type != ""
                    and feature_flag_manager.is_feature_enabled(
                        "ENABLE_ADVANCED_DATA_TYPES"
                    )
                    and col_advanced_data_type in ADVANCED_DATA_TYPES
                    and eq is not None
                ):
                    where_clause_and.append(
                        datasource._apply_advanced_data_type_filter(
                            sqla_col, col_advanced_data_type, op, eq
                        )
                    )
                elif is_list_target:
                    assert isinstance(eq, (tuple, list))
                    if len(eq) == 0:
                        raise QueryObjectValidationError(
                            "Filter value list cannot be empty"
                        )
                    if len(eq) > len(
                        eq_without_none := [x for x in eq if x is not None]
                    ):
                        is_null_cond = sqla_col.is_(None)
                        if eq:
                            cond = or_(is_null_cond, sqla_col.in_(eq_without_none))
                        else:
                            cond = is_null_cond
                    else:
                        cond = sqla_col.in_(eq)
                    if op == FilterOperator.NOT_IN:
                        cond = ~cond
                    where_clause_and.append(cond)
                elif op in {
                    FilterOperator.IS_NULL,
                    FilterOperator.IS_NOT_NULL,
                }:
                    where_clause_and.append(
                        db_engine_spec.handle_null_filter(sqla_col, op)
                    )
                elif op == FilterOperator.IS_TRUE:
                    where_clause_and.append(
                        db_engine_spec.handle_boolean_filter(sqla_col, op, True)
                    )
                elif op == FilterOperator.IS_FALSE:
                    where_clause_and.append(
                        db_engine_spec.handle_boolean_filter(sqla_col, op, False)
                    )
                else:
                    if (
                        op
                        not in {
                            FilterOperator.EQUALS,
                            FilterOperator.NOT_EQUALS,
                        }
                        and eq is None
                    ):
                        raise QueryObjectValidationError(
                            "Must specify a value for filters with comparison operators"
                        )
                    if op in {
                        FilterOperator.EQUALS,
                        FilterOperator.NOT_EQUALS,
                        FilterOperator.GREATER_THAN,
                        FilterOperator.LESS_THAN,
                        FilterOperator.GREATER_THAN_OR_EQUALS,
                        FilterOperator.LESS_THAN_OR_EQUALS,
                    }:
                        where_clause_and.append(
                            db_engine_spec.handle_comparison_filter(sqla_col, op, eq)
                        )
                    elif op in {
                        FilterOperator.ILIKE,
                        FilterOperator.LIKE,
                    }:
                        if target_generic_type != GenericDataType.STRING:
                            import sqlalchemy as sa

                            sqla_col = sa.cast(sqla_col, sa.String)

                        if op == FilterOperator.LIKE:
                            where_clause_and.append(sqla_col.like(eq))
                        else:
                            where_clause_and.append(sqla_col.ilike(eq))
                    elif op in {FilterOperator.NOT_LIKE}:
                        if target_generic_type != GenericDataType.STRING:
                            import sqlalchemy as sa

                            sqla_col = sa.cast(sqla_col, sa.String)

                        where_clause_and.append(sqla_col.not_like(eq))
                    elif (
                        op == FilterOperator.TEMPORAL_RANGE
                        and isinstance(eq, str)
                        and col_obj is not None
                    ):
                        _since, _until = get_since_until_from_time_range(
                            time_range=eq,
                            time_shift=self.time_shift,
                            extras=self.extras or {},
                        )
                        where_clause_and.append(
                            datasource.get_time_filter(
                                time_col=col_obj,
                                start_dttm=_since,
                                end_dttm=_until,
                                time_grain=flt_grain,
                                label=sqla_col.key,
                                template_processor=template_processor,
                            )
                        )
                    else:
                        raise QueryObjectValidationError(
                            f"Invalid filter operation type: {op}"
                        )

        # Process WHERE and HAVING extras
        if self.extras:
            where = self.extras.get("where")
            if where:
                where = datasource._process_sql_expression(
                    expression=where,
                    database_id=datasource.database_id,
                    engine=datasource.database.backend,
                    schema=datasource.schema,
                    template_processor=template_processor,
                )
                where_clause_and += [datasource.text(where)]
            having = self.extras.get("having")
            if having:
                having = datasource._process_sql_expression(
                    expression=having,
                    database_id=datasource.database_id,
                    engine=datasource.database.backend,
                    schema=datasource.schema,
                    template_processor=template_processor,
                )
                having_clause_and += [datasource.text(having)]

        return where_clause_and, having_clause_and

    def validate(
        self, raise_exceptions: bool | None = True
    ) -> QueryObjectValidationError | None:
        """Validate query object"""
        try:
            self._validate_there_are_no_missing_series()
            self._validate_no_have_duplicate_labels()
            self._validate_time_offsets()
            self._sanitize_filters()
            return None
        except QueryObjectValidationError as ex:
            if raise_exceptions:
                raise
            return ex

    def _validate_no_have_duplicate_labels(self) -> None:
        all_labels = self.metric_names + self.column_names
        if len(set(all_labels)) < len(all_labels):
            dup_labels = find_duplicates(all_labels)
            raise QueryObjectValidationError(
                _(
                    "Duplicate column/metric labels: %(labels)s. Please make "
                    "sure all columns and metrics have a unique label.",
                    labels=", ".join(f'"{x}"' for x in dup_labels),
                )
            )

    def _validate_time_offsets(self) -> None:
        """Validate time_offsets configuration"""
        if not self.time_offsets:
            return

        for offset in self.time_offsets:
            # Check if this is a date range offset (YYYY-MM-DD : YYYY-MM-DD format)
            if self._is_valid_date_range(offset):
                if not feature_flag_manager.is_feature_enabled(
                    "DATE_RANGE_TIMESHIFTS_ENABLED"
                ):
                    raise QueryObjectValidationError(
                        "Date range timeshifts are not enabled. "
                        "Please contact your administrator to enable the "
                        "DATE_RANGE_TIMESHIFTS_ENABLED feature flag."
                    )

    def _is_valid_date_range(self, date_range: str) -> bool:
        """Check if string is a valid date range in YYYY-MM-DD : YYYY-MM-DD format"""
        try:
            # Attempt to parse the string as a date range in the format
            # YYYY-MM-DD:YYYY-MM-DD
            start_date, end_date = date_range.split(":")
            datetime.strptime(start_date.strip(), "%Y-%m-%d")
            datetime.strptime(end_date.strip(), "%Y-%m-%d")
            return True
        except ValueError:
            # If parsing fails, it's not a valid date range in the format
            # YYYY-MM-DD:YYYY-MM-DD
            return False

    def _sanitize_filters(self) -> None:
        from superset.jinja_context import get_template_processor

        for param in ("where", "having"):
            clause = self.extras.get(param)
            if clause and self.datasource:
                try:
                    database = self.datasource.database
                    processor = get_template_processor(database=database)
                    try:
                        clause = processor.process_template(clause, force=True)
                    except TemplateError as ex:
                        raise QueryObjectValidationError(
                            _(
                                "Error in jinja expression in WHERE clause: %(msg)s",
                                msg=ex.message,
                            )
                        ) from ex
                    engine = database.db_engine_spec.engine
                    sanitized_clause = sanitize_clause(clause, engine)
                    if sanitized_clause != clause:
                        self.extras[param] = sanitized_clause
                except QueryClauseValidationException as ex:
                    raise QueryObjectValidationError(ex.message) from ex

    def _validate_there_are_no_missing_series(self) -> None:
        missing_series = [col for col in self.series_columns if col not in self.columns]
        if missing_series:
            raise QueryObjectValidationError(
                _(
                    "The following entries in `series_columns` are missing "
                    "in `columns`: %(columns)s. ",
                    columns=", ".join(f'"{x}"' for x in missing_series),
                )
            )

    def to_dict(self) -> dict[str, Any]:
        query_object_dict = {
            "apply_fetch_values_predicate": self.apply_fetch_values_predicate,
            "columns": self.columns,
            "extras": self.extras,
            "filter": self.filter,
            "from_dttm": self.from_dttm,
            "granularity": self.granularity,
            "inner_from_dttm": self.inner_from_dttm,
            "inner_to_dttm": self.inner_to_dttm,
            "is_rowcount": self.is_rowcount,
            "is_timeseries": self.is_timeseries,
            "metrics": self.metrics if self.metrics else None,
            "order_desc": self.order_desc,
            "orderby": self.orderby,
            "row_limit": self.row_limit,
            "row_offset": self.row_offset,
            "series_columns": self.series_columns,
            "series_limit": self.series_limit,
            "series_limit_metric": self.series_limit_metric,
            "group_others_when_limit_reached": self.group_others_when_limit_reached,
            "to_dttm": self.to_dttm,
            "time_shift": self.time_shift,
        }
        return query_object_dict

    def __repr__(self) -> str:
        # we use `print` or `logging` output QueryObject
        return json.dumps(
            self.to_dict(),
            sort_keys=True,
            default=str,
        )

    def cache_key(self, **extra: Any) -> str:  # noqa: C901
        """
        The cache key is made out of the key/values from to_dict(), plus any
        other key/values in `extra`
        We remove datetime bounds that are hard values, and replace them with
        the use-provided inputs to bounds, which may be time-relative (as in
        "5 days ago" or "now").
        """
        cache_dict = self.to_dict()
        cache_dict.update(extra)

        # TODO: the below KVs can all be cleaned up and moved to `to_dict()` at some
        #  predetermined point in time when orgs are aware that the previously
        #  cached results will be invalidated.
        if not self.apply_fetch_values_predicate:
            del cache_dict["apply_fetch_values_predicate"]
        if self.datasource:
            cache_dict["datasource"] = self.datasource.uid
        if self.result_type:
            cache_dict["result_type"] = self.result_type
        if self.time_range:
            cache_dict["time_range"] = self.time_range
        if self.post_processing:
            cache_dict["post_processing"] = self.post_processing
        if self.time_offsets:
            cache_dict["time_offsets"] = self.time_offsets

        for k in ["from_dttm", "to_dttm"]:
            del cache_dict[k]

        annotation_fields = [
            "annotationType",
            "descriptionColumns",
            "intervalEndColumn",
            "name",
            "overrides",
            "sourceType",
            "timeColumn",
            "titleColumn",
            "value",
        ]
        annotation_layers = [
            {field: layer[field] for field in annotation_fields if field in layer}
            for layer in self.annotation_layers
        ]
        # only add to key if there are annotations present that affect the payload
        if annotation_layers:
            cache_dict["annotation_layers"] = annotation_layers

        # Add an impersonation key to cache if impersonation is enabled on the db
        # or if the CACHE_QUERY_BY_USER flag is on
        try:
            database = self.datasource.database  # type: ignore
            if (
                feature_flag_manager.is_feature_enabled("CACHE_IMPERSONATION")
                and database.impersonate_user
            ) or feature_flag_manager.is_feature_enabled("CACHE_QUERY_BY_USER"):
                if key := database.db_engine_spec.get_impersonation_key(
                    getattr(g, "user", None)
                ):
                    logger.debug(
                        "Adding impersonation key to QueryObject cache dict: %s", key
                    )

                    cache_dict["impersonation_key"] = key
        except AttributeError:
            # datasource or database do not exist
            pass

        return md5_sha_from_dict(cache_dict, default=json_int_dttm_ser, ignore_nan=True)

    def exec_post_processing(self, df: DataFrame) -> DataFrame:
        """
        Perform post processing operations on DataFrame.

        :param df: DataFrame returned from database model.
        :return: new DataFrame to which all post processing operations have been
                 applied
        :raises QueryObjectValidationError: If the post processing operation
                 is incorrect
        """
        logger.debug("post_processing: \n %s", pformat(self.post_processing))
        with event_logger.log_context(f"{self.__class__.__name__}.post_processing"):
            for post_process in self.post_processing:
                operation = post_process.get("operation")
                if not operation:
                    raise InvalidPostProcessingError(
                        _("`operation` property of post processing object undefined")
                    )
                if not hasattr(pandas_postprocessing, operation):
                    raise InvalidPostProcessingError(
                        _(
                            "Unsupported post processing operation: %(operation)s",
                            type=operation,
                        )
                    )
                options = post_process.get("options", {})
                df = getattr(pandas_postprocessing, operation)(df, **options)
            return df
