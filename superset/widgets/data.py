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
Server-side data execution for widgets.

A widget's data is always produced by ``Widget.fetch_data`` /
``Widget.fetch_values`` on its registered type, from props the server holds (a
saved widget) or has validated (an inline spec). ``DataBindingWidget`` is the
implementation every built-in query-bound widget shares: the query is rebuilt
from ``props.dataBinding``, client filters are only structured column
comparisons ANDed on, and the ``QueryContext`` carries the ``WidgetContext`` so
``raise_for_access`` can authorize a guest on it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, TYPE_CHECKING

from flask import current_app
from superset_core.widgets import Widget

from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context_factory import QueryContextFactory
from superset.daos.datasource import DatasourceDAO
from superset.daos.exceptions import DatasourceNotFound
from superset.exceptions import SupersetSecurityException
from superset.utils.core import (
    apply_max_row_limit,
    DatasourceType,
    split_adhoc_filters_into_base_filters,
)

if TYPE_CHECKING:
    from superset.connectors.sqla.models import BaseDatasource

DEFAULT_ROW_LIMIT = 1000

FILTER_OPERATORS = frozenset(
    {"EQUALS", "NOT_EQUALS", "IN", "NOT_IN", "RANGE", "TIME_RANGE"}
)

GUEST_AGGREGATES = frozenset({"AVG", "COUNT", "COUNT_DISTINCT", "MAX", "MIN", "SUM"})


class WidgetDataError(ValueError):
    """The props cannot be executed (no binding, missing dataset, ...)."""


class FilterValidationError(ValueError):
    """A client-supplied filter is malformed or targets an unknown column."""


@dataclass(frozen=True)
class WidgetContext:
    """
    What a widget data request is served for: the dataset its props read and,
    for a saved widget, its uuid. Built only server-side, never from a request
    payload, so authorization can trust it.
    """

    dataset_id: int | None
    saved_widget_uuid: str | None = None

    @property
    def inline(self) -> bool:
        return self.saved_widget_uuid is None


def _int_or_none(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def props_dataset_id(props: Any) -> int | None:
    """The dataset props read: ``dataBinding.datasetId`` or ``datasetId``."""
    if not isinstance(props, dict):
        return None
    binding = props.get("dataBinding")
    if isinstance(binding, dict):
        return _int_or_none(binding.get("datasetId"))
    return _int_or_none(props.get("datasetId"))


def _is_scalar(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, float, bool))


def _simple_filter(column: str, operator: str, comparator: Any) -> dict[str, Any]:
    return {
        "expressionType": "SIMPLE",
        "clause": "WHERE",
        "subject": column,
        "operator": operator,
        "comparator": comparator,
    }


def _to_adhoc(
    column: str, operator: str, value: Any, index: int
) -> list[dict[str, Any]]:
    if operator in ("EQUALS", "NOT_EQUALS"):
        if value is None or not _is_scalar(value):
            raise FilterValidationError(f"filters[{index}]: value must be a scalar")
        return [_simple_filter(column, "==" if operator == "EQUALS" else "!=", value)]

    if operator in ("IN", "NOT_IN"):
        if not isinstance(value, list) or not all(_is_scalar(item) for item in value):
            raise FilterValidationError(
                f"filters[{index}]: value must be a list of scalars"
            )
        if not value:
            return []
        return [_simple_filter(column, "IN" if operator == "IN" else "NOT IN", value)]

    bounds = ("min", "max") if operator == "RANGE" else ("start", "end")
    if (
        not isinstance(value, dict)
        or set(value) - set(bounds)
        or not all(_is_scalar(item) for item in value.values())
    ):
        raise FilterValidationError(
            f"filters[{index}]: value must be an object with {bounds} scalars"
        )
    lower, upper = value.get(bounds[0]), value.get(bounds[1])
    upper_operator = "<=" if operator == "RANGE" else "<"
    filters = []
    if lower is not None:
        filters.append(_simple_filter(column, ">=", lower))
    if upper is not None:
        filters.append(_simple_filter(column, upper_operator, upper))
    return filters


def resolved_filters_to_adhoc(
    filters: Any, allowed_columns: set[str]
) -> list[dict[str, Any]]:
    """
    Convert client-supplied resolved filters (the dashboard bus vocabulary) to
    SIMPLE adhoc filters. Only structured column comparisons are accepted, so a
    client can narrow a widget's rows but never inject SQL or reshape the query.
    """
    if filters is None:
        return []
    if not isinstance(filters, list):
        raise FilterValidationError("filters must be a list")
    adhoc: list[dict[str, Any]] = []
    for index, resolved in enumerate(filters):
        if not isinstance(resolved, dict):
            raise FilterValidationError(f"filters[{index}] must be an object")
        column = resolved.get("column")
        operator = resolved.get("operator")
        if not isinstance(column, str) or column not in allowed_columns:
            raise FilterValidationError(f"filters[{index}]: unknown column {column!r}")
        if operator not in FILTER_OPERATORS:
            raise FilterValidationError(
                f"filters[{index}]: unsupported operator {operator!r}"
            )
        adhoc.extend(_to_adhoc(column, operator, resolved.get("value"), index))
    return adhoc


def build_widget_query(
    props: dict[str, Any],
    extra_adhoc_filters: list[dict[str, Any]],
) -> tuple[int, dict[str, Any], dict[str, Any]]:
    """
    Build ``(dataset_id, query, form_data)`` from a widget's stored
    ``dataBinding``, mirroring the frontend's ``fetchQueryData``. Authored
    filters come only from the stored props; ``extra_adhoc_filters`` are ANDed on.
    """
    binding = props.get("dataBinding")
    dataset_id = (
        _int_or_none(binding.get("datasetId")) if isinstance(binding, dict) else None
    )
    if not isinstance(binding, dict) or dataset_id is None:
        raise WidgetDataError("This widget has no data binding.")

    metrics = [
        metric for metric in binding.get("metrics") or [] if metric not in (None, "")
    ]
    dimensions = [
        dimension
        for dimension in binding.get("dimensions") or []
        if isinstance(dimension, str) and dimension
    ]
    authored_filters = [
        adhoc
        for adhoc in binding.get("filters") or []
        if isinstance(adhoc, dict) and ("clause" in adhoc or "expressionType" in adhoc)
    ]
    row_limit = _int_or_none(binding.get("rowLimit"))
    if row_limit is None or row_limit < 1:
        row_limit = DEFAULT_ROW_LIMIT

    adhoc_filters = [*authored_filters, *extra_adhoc_filters]
    form_data: dict[str, Any] = {
        "datasource": f"{dataset_id}__table",
        "metrics": metrics,
        "groupby": dimensions,
        "adhoc_filters": adhoc_filters,
        "row_limit": row_limit,
        "result_format": "json",
        "result_type": "full",
    }
    base_filters: dict[str, Any] = {"adhoc_filters": adhoc_filters}
    split_adhoc_filters_into_base_filters(base_filters)
    query = {
        "metrics": metrics,
        "columns": dimensions,
        "filters": base_filters["filters"],
        "extras": {"where": base_filters["where"], "having": base_filters["having"]},
        "row_limit": row_limit,
    }
    return dataset_id, query, form_data


def get_table(dataset_id: int) -> BaseDatasource:
    try:
        return DatasourceDAO.get_datasource(DatasourceType.TABLE, dataset_id)
    except DatasourceNotFound as ex:
        raise WidgetDataError("The widget's dataset does not exist.") from ex


def _require_guest_metric(
    metric: Any, saved_metrics: set[str], columns: set[str]
) -> None:
    if isinstance(metric, str):
        if metric not in saved_metrics:
            raise WidgetDataError(f"Unknown metric {metric!r}.")
        return
    column = metric.get("column") if isinstance(metric, dict) else None
    if (
        not isinstance(metric, dict)
        or metric.get("expressionType") != "SIMPLE"
        or metric.get("sqlExpression")
        or str(metric.get("aggregate", "")).upper() not in GUEST_AGGREGATES
        or not isinstance(column, dict)
        or column.get("column_name") not in columns
    ):
        raise WidgetDataError(
            "Guest metrics must be saved metrics or simple aggregates of a column."
        )


def validate_guest_inline_props(
    props: dict[str, Any], datasource: BaseDatasource
) -> None:
    """
    Restrict an inline spec a guest sends to what the dataset already exposes:
    saved metrics or simple aggregates, groupable dimensions, and SIMPLE
    filters on existing columns. Nothing that carries SQL gets through.
    """
    columns = set(datasource.column_names)
    groupable = {
        column.column_name
        for column in datasource.columns
        if getattr(column, "groupby", True)
    }
    saved_metrics = {metric.metric_name for metric in datasource.metrics}

    binding = props.get("dataBinding")
    if isinstance(binding, dict):
        for metric in binding.get("metrics") or []:
            _require_guest_metric(metric, saved_metrics, columns)
        for dimension in binding.get("dimensions") or []:
            if dimension not in groupable:
                raise WidgetDataError(f"Unknown dimension {dimension!r}.")
        for adhoc in binding.get("filters") or []:
            if (
                not isinstance(adhoc, dict)
                or adhoc.get("expressionType") != "SIMPLE"
                or adhoc.get("sqlExpression")
                or adhoc.get("subject") not in columns
            ):
                raise WidgetDataError(
                    "Guest filters must be simple comparisons on dataset columns."
                )

    column = props.get("column")
    if column is not None and column not in columns:
        raise WidgetDataError(f"Unknown column {column!r}.")


def raise_for_widget_datasource_access(
    context: Any, datasource: BaseDatasource
) -> None:
    """
    Datasource access for a request that has no ``QueryContext`` of its own
    (column values): a guest is authorized by the widget rule, anyone else by
    the datasource's own permissions.
    """
    # pylint: disable=import-outside-toplevel
    from superset import security_manager

    if security_manager.is_guest_user():
        if not security_manager.guest_widget_grants_datasource(context, datasource):
            raise SupersetSecurityException(
                security_manager.get_datasource_access_error_object(datasource)
            )
        security_manager.raise_for_guest_dataset_allowlist(datasource)
    else:
        datasource.raise_for_access()


def fetch_column_values(dataset_id: int, column: str, context: Any) -> list[Any]:
    """Distinct values of one column, the way the datasource values API serves them."""
    datasource = get_table(dataset_id)
    raise_for_widget_datasource_access(context, datasource)
    row_limit = apply_max_row_limit(current_app.config["FILTER_SELECT_ROW_LIMIT"])
    try:
        return datasource.values_for_column(
            column_name=column,
            limit=row_limit,
            denormalize_column=not datasource.normalize_columns,
        )
    except KeyError as ex:
        raise WidgetDataError(f"Column {column} does not exist") from ex


class DataBindingWidget(Widget):
    """``fetch_data`` for any widget whose props carry a ``dataBinding``."""

    @classmethod
    def fetch_data(
        cls,
        props: dict[str, Any],
        filters: list[dict[str, Any]],
        context: Any,
    ) -> dict[str, Any]:
        dataset_id = (
            _int_or_none(props["dataBinding"].get("datasetId"))
            if isinstance(props.get("dataBinding"), dict)
            else None
        )
        if dataset_id is None:
            raise WidgetDataError("This widget has no data binding.")
        datasource = get_table(dataset_id)
        extra_filters = resolved_filters_to_adhoc(filters, set(datasource.column_names))
        _, query, form_data = build_widget_query(props, extra_filters)

        query_context = QueryContextFactory().create(
            datasource={"id": dataset_id, "type": DatasourceType.TABLE.value},
            queries=[query],
            form_data=form_data,
            result_type=ChartDataResultType.FULL,
            result_format=ChartDataResultFormat.JSON,
        )
        query_context.widget_context = context
        command = ChartDataCommand(query_context)
        command.validate()
        result = command.run()
        first = result["queries"][0] if result["queries"] else {}
        return {"columns": first.get("colnames") or [], "rows": first.get("data") or []}
