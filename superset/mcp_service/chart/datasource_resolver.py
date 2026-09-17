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
"""Resolve authorized semantic chart targets and validate saved references."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast, TYPE_CHECKING
from uuid import UUID

from superset.daos.datasource import DatasourceDAO
from superset.daos.exceptions import DatasourceNotFound, DatasourceValueIsIncorrect
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.chart.schemas import ChartConfig, ColumnRef
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    DatasetContext,
)
from superset.utils import json
from superset.utils.core import DatasourceType

if TYPE_CHECKING:
    from superset.semantic_layers.models import SemanticView

SEMANTIC_VIEW_ADHOC_ERROR: str = "semantic_view_adhoc_not_supported"
VIEW_NOT_FOUND_ERROR: str = "view_not_found"


@dataclass(frozen=True)
class ChartDatasource:
    """Carry an authorized semantic view and its family-qualified identity."""

    explorable: SemanticView
    datasource_type: DatasourceType
    id: int
    name: str

    @property
    def form_data_datasource(self) -> str:
        """Return the source identity expected by Explore."""
        return f"{self.id}__{self.datasource_type.value}"

    @property
    def explore_url_path(self) -> str:
        """Return the basic Explore path for the resolved source."""
        return (
            f"/explore/?datasource_type={self.datasource_type.value}"
            f"&datasource_id={self.id}"
        )


def resolve_semantic_view(view_id: int | str | UUID) -> ChartDatasource | None:
    """Resolve and authorize a view before exposing metadata."""
    # The registry's selected model is SemanticView; no cross-family fallback.
    try:
        view: SemanticView = cast(
            "SemanticView",
            DatasourceDAO.get_datasource(
                DatasourceType.SEMANTIC_VIEW,
                str(view_id) if isinstance(view_id, UUID) else view_id,
            ),
        )
        view.raise_for_access()
    except (DatasourceNotFound, DatasourceValueIsIncorrect, SupersetSecurityException):
        return None

    return ChartDatasource(
        explorable=view,
        datasource_type=DatasourceType.SEMANTIC_VIEW,
        id=view.id,
        name=view.name,
    )


def build_context_from_explorable(target: ChartDatasource) -> DatasetContext:
    """Adapt authorized host metadata without assuming table columns."""
    view: SemanticView = target.explorable
    return DatasetContext(
        id=target.id,
        table_name=target.name,
        schema=None,
        database_name="",
        available_columns=[
            {
                "name": column.column_name,
                "type": column.type,
                "is_temporal": column.is_dttm,
                "is_numeric": False,
            }
            for column in view.columns
        ],
        available_metrics=[
            {
                "name": metric.metric_name,
                "expression": metric.expression,
                "description": metric.description,
            }
            for metric in view.metrics
        ],
    )


def view_not_found_error(view_id: int | str | UUID) -> ChartGenerationError:
    """Describe a missing or inaccessible view without protected metadata."""
    return ChartGenerationError(
        error_type=VIEW_NOT_FOUND_ERROR,
        error_code="MCP_SEMANTIC_VIEW_NOT_FOUND",
        message=f"Semantic view not found: {view_id}.",
        details=(
            "No matching semantic view is visible to you; "
            "view and dataset IDs are unrelated."
        ),
        suggestions=[
            "Use the view_id returned by list_metrics for the semantic view",
            "Check that you have access to the semantic view",
        ],
    )


def validate_semantic_view_config(
    config: ChartConfig, target: ChartDatasource
) -> tuple[bool, ChartGenerationError | None, DatasetContext]:
    """Reject ad-hoc expressions and validate saved names against the view."""
    context: DatasetContext = build_context_from_explorable(target)
    ref: ColumnRef
    for ref in DatasetValidator._extract_column_references(config):
        if ref.aggregate or ref.sql_expression:
            expression: str = (
                f"{ref.aggregate}({ref.name})"
                if ref.aggregate
                else str(ref.sql_expression)
            )
            return (
                False,
                ChartGenerationError(
                    error_type=SEMANTIC_VIEW_ADHOC_ERROR,
                    error_code="MCP_SEMANTIC_VIEW_ADHOC_NOT_SUPPORTED",
                    message=(
                        f"Ad-hoc expression '{expression}' is not supported "
                        "on semantic views."
                    ),
                    details="Use the view's predefined metrics and dimensions.",
                    suggestions=[
                        'Use {"name": "<metric>", "saved_metric": true}',
                        "Use get_compatible_dimensions to select dimensions",
                        "Saved metrics: "
                        + ", ".join(
                            metric["name"] for metric in context.available_metrics[:15]
                        ),
                    ],
                ),
                context,
            )
    valid: bool
    error: ChartGenerationError | None
    valid, error = DatasetValidator.validate_against_dataset(
        config, target.id, dataset_context=context
    )
    return valid, error, context


def validate_semantic_view_form_data(
    form_data: dict[str, Any], target: ChartDatasource
) -> ChartGenerationError | None:
    """Validate retained query roles before a semantic rebind or preview."""
    context: DatasetContext = build_context_from_explorable(target)
    metrics: set[str] = {metric["name"] for metric in context.available_metrics}
    columns: set[str] = {column["name"] for column in context.available_columns}
    filter_error: ChartGenerationError | None = _validate_semantic_filters(form_data)
    if filter_error is not None:
        return filter_error
    metric_values: list[object] = list(form_data.get("metrics") or []) + [
        form_data[key]
        for key in ("metric", "secondary_metric", "timeseries_limit_metric")
        if form_data.get(key) is not None
    ]
    if any(
        not isinstance(value, str) or value not in metrics for value in metric_values
    ):
        return ChartGenerationError(
            error_type=SEMANTIC_VIEW_ADHOC_ERROR,
            error_code="MCP_SEMANTIC_VIEW_ADHOC_NOT_SUPPORTED",
            message="The chart must use saved metrics from the selected view.",
            details="A retained metric is not a saved metric on the selected view.",
            suggestions=["Provide a complete configuration valid for the target view"],
        )
    dimensions: list[object] = [
        dimension
        for key in ("groupby", "groupby_b", "columns", "all_columns")
        for dimension in form_data.get(key) or []
    ] + [form_data[key] for key in ("x_axis", "granularity_sqla") if form_data.get(key)]
    if any(not isinstance(value, str) or value not in columns for value in dimensions):
        return ChartGenerationError(
            error_type="column_not_found",
            message="The chart contains dimensions not available on the target view.",
            details="A retained dimension is absent from the selected view.",
            suggestions=["Provide a complete configuration valid for the target view"],
        )
    ordering_error: ChartGenerationError | None = _validate_semantic_ordering(
        form_data, columns | metrics
    )
    if ordering_error is not None:
        return ordering_error
    # avoid circular import: compile imports schemas, whose plugins load validators.
    from superset.mcp_service.chart.compile import _validate_adhoc_filter_columns

    return _validate_adhoc_filter_columns(form_data, context)


def _validate_semantic_filters(
    form_data: dict[str, Any],
) -> ChartGenerationError | None:
    """Reject retained SQL expressions before validating dimension references."""
    if form_data.get("where") or form_data.get("having"):
        return ChartGenerationError(
            error_type=SEMANTIC_VIEW_ADHOC_ERROR,
            error_code="MCP_SEMANTIC_VIEW_ADHOC_NOT_SUPPORTED",
            message="SQL WHERE/HAVING expressions are not supported on semantic views.",
            details="Replace SQL expressions with simple dimension filters.",
        )
    filter_value: object
    for filter_value in form_data.get("adhoc_filters") or []:
        if (
            not isinstance(filter_value, dict)
            or filter_value.get("expressionType") not in (None, "SIMPLE")
            or filter_value.get("sqlExpression")
        ):
            return ChartGenerationError(
                error_type=SEMANTIC_VIEW_ADHOC_ERROR,
                error_code="MCP_SEMANTIC_VIEW_ADHOC_NOT_SUPPORTED",
                message="SQL filters are not supported on semantic views.",
                details="Replace SQL expressions with simple dimension filters.",
                suggestions=["Use simple filters on saved dimensions"],
            )
    return None


def _validate_semantic_ordering(
    form_data: dict[str, Any], names: set[str]
) -> ChartGenerationError | None:
    """Accept only named saved references in retained native sort controls."""
    entry: object
    for entry in [
        *(form_data.get("order_by_cols") or []),
        *(form_data.get("orderby") or []),
    ]:
        try:
            ordering: object = json.loads(entry) if isinstance(entry, str) else entry
        except ValueError:
            ordering = None
        if (
            not isinstance(ordering, (list, tuple))
            or len(ordering) != 2
            or not isinstance(ordering[0], str)
            or ordering[0] not in names
            or not isinstance(ordering[1], bool)
        ):
            return ChartGenerationError(
                error_type=SEMANTIC_VIEW_ADHOC_ERROR,
                error_code="MCP_SEMANTIC_VIEW_ADHOC_NOT_SUPPORTED",
                message="Semantic sorting requires a saved metric or dimension.",
                details="Replace retained sort expressions with target view names.",
            )
    return None
