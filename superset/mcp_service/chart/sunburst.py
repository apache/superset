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

"""Shared native Sunburst result-role resolution and validation."""

import math
from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from superset.mcp_service.chart.schemas import ChartError
from superset.mcp_service.common.error_schemas import DatasetContext


@dataclass(frozen=True)
class SunburstResultRoles:
    """Resolved query-output fields required to render a Sunburst."""

    hierarchy: tuple[str, ...]
    primary_metric: str
    secondary_metric: str | None = None


def _column_result_label(column: Any) -> str | None:
    """Resolve a bounded native column reference to its query output label."""
    if isinstance(column, str) and column:
        return column
    if not isinstance(column, Mapping) or not 0 < len(column) <= 20:
        return None
    for key in ("label", "column_name", "columnName", "sqlExpression"):
        value = column.get(key)
        if isinstance(value, str) and value:
            return value
        if value not in (None, ""):
            return None
    return None


def _metric_result_label(metric: Any) -> str | None:
    """Resolve saved, SIMPLE, and SQL metric aliases like the frontend."""
    if isinstance(metric, str) and metric:
        return metric
    if not isinstance(metric, Mapping) or not 0 < len(metric) <= 20:
        return None

    label = metric.get("label")
    if isinstance(label, str) and label:
        return label
    if label not in (None, ""):
        return None

    expression_type = metric.get("expressionType")
    if expression_type == "SIMPLE":
        aggregate = metric.get("aggregate")
        column = metric.get("column")
        if (
            not isinstance(aggregate, str)
            or not aggregate
            or len(aggregate) > 100
            or not isinstance(column, Mapping)
            or not 0 < len(column) <= 50
        ):
            return None
        column_name = column.get("column_name") or column.get("columnName")
        if not isinstance(column_name, str) or not column_name:
            return None
        return f"{aggregate}({column_name})"
    if expression_type == "SQL":
        sql_expression = metric.get("sqlExpression")
        if (
            isinstance(sql_expression, str)
            and sql_expression
            and len(sql_expression) <= 2000
        ):
            return sql_expression
    return None


def resolve_sunburst_result_roles(
    form_data: Mapping[str, Any],
) -> tuple[SunburstResultRoles | None, ChartError | None]:
    """Resolve and validate all native Sunburst query-result roles."""
    columns = form_data.get("columns")
    if not isinstance(columns, list) or not columns:
        return None, ChartError(
            error="Sunburst form data requires one or more hierarchy columns.",
            error_type="InvalidSunburstFormData",
        )
    hierarchy: list[str] = []
    for index, column in enumerate(columns):
        label = _column_result_label(column)
        if label is None:
            return None, ChartError(
                error=f"Sunburst hierarchy column {index + 1} is malformed.",
                error_type="InvalidSunburstFormData",
            )
        hierarchy.append(label)

    primary = _metric_result_label(form_data.get("metric"))
    if primary is None:
        return None, ChartError(
            error="Sunburst primary metric is missing or malformed.",
            error_type="InvalidSunburstFormData",
        )
    secondary: str | None = None
    if form_data.get("secondary_metric") is not None:
        secondary = _metric_result_label(form_data.get("secondary_metric"))
        if secondary is None:
            return None, ChartError(
                error="Sunburst secondary metric is malformed.",
                error_type="InvalidSunburstFormData",
            )

    labels = [*hierarchy, primary, *([secondary] if secondary else [])]
    seen: dict[str, str] = {}
    for label in labels:
        folded = label.casefold()
        if previous := seen.get(folded):
            return None, ChartError(
                error=(
                    f"Sunburst result label {label!r} is ambiguous with {previous!r}."
                ),
                error_type="InvalidSunburstFormData",
            )
        seen[folded] = label

    return SunburstResultRoles(tuple(hierarchy), primary, secondary), None


def _finite_number(value: Any) -> bool:
    """Return whether a normalized database value is exactly numeric and finite."""
    value_type = type(value)
    if value_type is int:
        return True
    if value_type is float:
        return math.isfinite(value)
    if value_type is Decimal:
        return Decimal.is_finite(value)
    return False


def _valid_hierarchy_value(value: Any) -> bool:
    """Reject nested/container values that cannot form a stable node label."""
    return not isinstance(value, (Mapping, list, tuple, set))


def validate_sunburst_result_data(
    data: Any, form_data: Mapping[str, Any]
) -> tuple[SunburstResultRoles | None, ChartError | None]:
    """Validate every Sunburst row and all resolved result aliases."""
    roles, error = resolve_sunburst_result_roles(form_data)
    if error is not None:
        return None, error
    assert roles is not None
    if not isinstance(data, list):
        return None, ChartError(
            error="Sunburst query result data is not an array of rows.",
            error_type="InvalidSunburstResult",
        )

    required_fields = [
        *roles.hierarchy,
        roles.primary_metric,
        *([roles.secondary_metric] if roles.secondary_metric else []),
    ]
    for index, row in enumerate(data, start=1):
        if not isinstance(row, Mapping):
            return None, ChartError(
                error=f"Sunburst result row {index} is not an object.",
                error_type="InvalidSunburstResult",
            )
        missing = [field for field in required_fields if field not in row]
        if missing:
            return None, ChartError(
                error=(
                    f"Sunburst result row {index} is missing required field(s): "
                    f"{', '.join(str(field) for field in missing)}."
                ),
                error_type="InvalidSunburstResult",
            )
        for field in roles.hierarchy:
            if not _valid_hierarchy_value(row[field]):
                return None, ChartError(
                    error=(
                        f"Sunburst result row {index} has a malformed hierarchy "
                        f"value for {field!r}."
                    ),
                    error_type="InvalidSunburstResult",
                )
        for field in (
            roles.primary_metric,
            *([roles.secondary_metric] if roles.secondary_metric else []),
        ):
            assert field is not None
            if not _finite_number(row[field]):
                return None, ChartError(
                    error=(
                        f"Sunburst result row {index} field {field!r} must be a "
                        "finite numeric value."
                    ),
                    error_type="InvalidSunburstMetric",
                )
    return roles, None


def unsupported_sunburst_preview(preview_format: str) -> ChartError:
    """Return an explicit error instead of a misleading fallback chart."""
    return ChartError(
        error=(
            f"{preview_format} cannot faithfully represent a Sunburst hierarchy. "
            "Use the URL, ASCII, or table preview instead."
        ),
        error_type="UnsupportedFormat",
    )


def normalize_sunburst_form_data_references(  # noqa: C901
    form_data: Mapping[str, Any], dataset_context: DatasetContext
) -> dict[str, Any]:
    """Canonicalize every native Sunburst dataset reference in a copy."""
    from copy import deepcopy

    from superset.mcp_service.chart.validation.dataset_validator import (
        DatasetValidator,
    )

    normalized = deepcopy(dict(form_data))
    columns = normalized.get("columns")
    if isinstance(columns, list):
        for index, column in enumerate(columns):
            if isinstance(column, str):
                columns[index] = DatasetValidator.get_canonical_column_name(
                    column, dataset_context
                )
            elif isinstance(column, dict):
                for key in ("column_name", "columnName"):
                    if isinstance(column.get(key), str):
                        column[key] = DatasetValidator.get_canonical_column_name(
                            column[key], dataset_context
                        )

    for metric_key in ("metric", "secondary_metric"):
        metric = normalized.get(metric_key)
        if isinstance(metric, str):
            normalized[metric_key] = DatasetValidator.get_canonical_metric_name(
                metric, dataset_context
            )
        elif isinstance(metric, dict) and metric.get("expressionType") == "SIMPLE":
            column = metric.get("column")
            if isinstance(column, dict):
                for key in ("column_name", "columnName"):
                    if isinstance(column.get(key), str):
                        column[key] = DatasetValidator.get_canonical_column_name(
                            column[key], dataset_context
                        )

    filters = normalized.get("adhoc_filters")
    if isinstance(filters, list):
        for filter_ in filters:
            if (
                not isinstance(filter_, dict)
                or filter_.get("expressionType") not in (None, "SIMPLE")
                or not isinstance(filter_.get("subject"), str)
            ):
                continue
            filter_["subject"] = DatasetValidator.get_canonical_column_name(
                filter_["subject"], dataset_context
            )

    temporal_column = normalized.get("granularity_sqla")
    if isinstance(temporal_column, str):
        normalized["granularity_sqla"] = DatasetValidator.get_canonical_column_name(
            temporal_column, dataset_context
        )
    return normalized
