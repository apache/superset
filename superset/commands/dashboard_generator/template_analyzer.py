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
Template Analyzer for Dashboard Generation.

Extracts requirements from template dashboards including:
- Required columns per chart
- Required metrics with expressions
- Native filter configurations
- Dataset SQL if virtual
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from superset.connectors.sqla.models import (
    COLUMN_FORM_DATA_PARAMS,
    METRIC_FORM_DATA_PARAMS,
)
from superset.models.dashboard import Dashboard
from superset.utils import json
from superset.utils.core import (
    as_list,
    GenericDataType,
    get_column_name,
    get_metric_name,
    is_adhoc_metric,
)

logger = logging.getLogger(__name__)


@dataclass
class TemplateColumn:
    """Represents a column required by the template."""

    name: str
    type_generic: GenericDataType | None = None
    data_type: str | None = None
    role: str = "dimension"  # 'dimension', 'temporal', 'measure'
    used_by_charts: list[int] = field(default_factory=list)
    is_adhoc: bool = False
    sql_expression: str | None = None


@dataclass
class TemplateMetric:
    """Represents a metric required by the template."""

    name: str
    expression: str | None = None
    aggregate: str | None = None  # SUM, COUNT, AVG, etc.
    base_column: str | None = None
    used_by_charts: list[int] = field(default_factory=list)
    is_adhoc: bool = False


@dataclass
class TemplateFilter:
    """Represents a native filter in the template."""

    filter_id: str
    filter_type: str
    target_column: str | None = None
    default_value: Any = None
    config: dict[str, Any] = field(default_factory=dict)


@dataclass
class TemplateRequirements:
    """Complete requirements extracted from a template dashboard."""

    columns: list[TemplateColumn] = field(default_factory=list)
    metrics: list[TemplateMetric] = field(default_factory=list)
    filters: list[TemplateFilter] = field(default_factory=list)
    dataset_sql: str | None = None
    dataset_name: str | None = None
    chart_count: int = 0
    template_context: dict[str, Any] | None = None


class TemplateAnalyzer:
    """
    Analyzes template dashboards to extract requirements.

    Uses existing Superset utilities for column/metric extraction:
    - METRIC_FORM_DATA_PARAMS, COLUMN_FORM_DATA_PARAMS for param keys
    - get_metric_name, get_column_name for extracting names
    - is_adhoc_metric for detecting computed metrics
    """

    def analyze(self, dashboard: Dashboard) -> TemplateRequirements:
        """
        Analyze a template dashboard and extract all requirements.

        :param dashboard: The template dashboard to analyze
        :return: TemplateRequirements with columns, metrics, filters
        """
        logger.info("Analyzing template dashboard %s", dashboard.id)

        requirements = TemplateRequirements(chart_count=len(dashboard.slices))

        # Extract from charts
        column_map: dict[str, TemplateColumn] = {}
        metric_map: dict[str, TemplateMetric] = {}

        for chart in dashboard.slices:
            self._extract_chart_requirements(chart, column_map, metric_map)

        requirements.columns = list(column_map.values())
        requirements.metrics = list(metric_map.values())

        # Extract native filters
        requirements.filters = self._extract_native_filters(dashboard)

        # Extract dataset info
        requirements.dataset_sql, requirements.dataset_name = (
            self._extract_dataset_info(dashboard)
        )

        # Extract template context if present
        metadata = json.loads(dashboard.json_metadata or "{}")
        template_info = metadata.get("template_info", {}) if isinstance(metadata, dict) else {}
        if isinstance(template_info, dict) and "template_context" in template_info:
            requirements.template_context = template_info.get("template_context")

        logger.info(
            "Template analysis complete: %d columns, %d metrics, %d filters",
            len(requirements.columns),
            len(requirements.metrics),
            len(requirements.filters),
        )

        return requirements

    def _extract_chart_requirements(
        self,
        chart: Any,
        column_map: dict[str, TemplateColumn],
        metric_map: dict[str, TemplateMetric],
    ) -> None:
        """Extract column and metric requirements from a chart."""
        params = json.loads(chart.params or "{}")
        chart_id = chart.id
        datasource = chart.datasource

        # Build verbose map for name resolution
        verbose_map = {}
        if datasource:
            verbose_map = getattr(datasource, "verbose_map", {}) or {}

        # Extract columns using existing params list
        for param_key in COLUMN_FORM_DATA_PARAMS:
            for column in as_list(params.get(param_key) or []):
                col_name = get_column_name(column, verbose_map)
                if not col_name:
                    continue

                if col_name in column_map:
                    if chart_id not in column_map[col_name].used_by_charts:
                        column_map[col_name].used_by_charts.append(chart_id)
                else:
                    template_col = self._create_template_column(
                        column, col_name, chart_id, datasource
                    )
                    column_map[col_name] = template_col

        # Extract metrics using existing params list
        for param_key in METRIC_FORM_DATA_PARAMS:
            for metric in as_list(params.get(param_key) or []):
                metric_name = get_metric_name(metric, verbose_map)
                if not metric_name:
                    continue

                if metric_name in metric_map:
                    if chart_id not in metric_map[metric_name].used_by_charts:
                        metric_map[metric_name].used_by_charts.append(chart_id)
                else:
                    template_metric = self._create_template_metric(
                        metric, metric_name, chart_id, datasource
                    )
                    metric_map[metric_name] = template_metric

        # Extract temporal column from x_axis if present
        if x_axis := params.get("x_axis"):
            col_name = get_column_name(x_axis, verbose_map)
            if col_name:
                if col_name in column_map:
                    column_map[col_name].role = "temporal"
                else:
                    template_col = self._create_template_column(
                        x_axis, col_name, chart_id, datasource
                    )
                    template_col.role = "temporal"
                    column_map[col_name] = template_col

        # Check granularity_sqla for temporal
        if granularity := params.get("granularity_sqla"):
            if isinstance(granularity, str) and granularity in column_map:
                column_map[granularity].role = "temporal"

    def _create_template_column(
        self,
        column: Any,
        col_name: str,
        chart_id: int,
        datasource: Any,
    ) -> TemplateColumn:
        """Create a TemplateColumn from raw column data."""
        template_col = TemplateColumn(
            name=col_name,
            used_by_charts=[chart_id],
        )

        # Check if adhoc column
        if isinstance(column, dict):
            if "sqlExpression" in column:
                template_col.is_adhoc = True
                template_col.sql_expression = column.get("sqlExpression")

        # Get type info from datasource if available
        if datasource:
            for ds_col in getattr(datasource, "columns", []):
                if ds_col.column_name == col_name:
                    template_col.data_type = ds_col.type
                    template_col.type_generic = getattr(
                        ds_col, "type_generic", None
                    )
                    # Infer role from type
                    if template_col.type_generic == GenericDataType.TEMPORAL:
                        template_col.role = "temporal"
                    elif template_col.type_generic == GenericDataType.NUMERIC:
                        template_col.role = "measure"
                    break

        return template_col

    def _create_template_metric(
        self,
        metric: Any,
        metric_name: str,
        chart_id: int,
        datasource: Any,
    ) -> TemplateMetric:
        """Create a TemplateMetric from raw metric data."""
        template_metric = TemplateMetric(
            name=metric_name,
            used_by_charts=[chart_id],
        )

        if is_adhoc_metric(metric):
            template_metric.is_adhoc = True
            expression_type = metric.get("expressionType")

            if expression_type == "SQL":
                template_metric.expression = metric.get("sqlExpression")
            elif expression_type == "SIMPLE":
                template_metric.aggregate = metric.get("aggregate")
                column_info = metric.get("column", {})
                if isinstance(column_info, dict):
                    template_metric.base_column = column_info.get("column_name")
        else:
            # Named metric - look up in datasource
            if datasource:
                for ds_metric in getattr(datasource, "metrics", []):
                    if ds_metric.metric_name == metric_name:
                        template_metric.expression = ds_metric.expression
                        # Try to parse aggregate from expression
                        template_metric.aggregate = self._parse_aggregate(
                            ds_metric.expression
                        )
                        break

        return template_metric

    def _parse_aggregate(self, expression: str | None) -> str | None:
        """Parse aggregate function from metric expression."""
        if not expression:
            return None

        expression_upper = expression.upper().strip()
        for agg in ["COUNT", "SUM", "AVG", "MIN", "MAX", "COUNT_DISTINCT"]:
            if expression_upper.startswith(agg + "("):
                return agg
        return None

    def _extract_native_filters(
        self, dashboard: Dashboard
    ) -> list[TemplateFilter]:
        """Extract native filter configurations from dashboard metadata."""
        metadata = json.loads(dashboard.json_metadata or "{}")
        native_filter_config = metadata.get("native_filter_configuration", [])

        filters = []
        for f in native_filter_config:
            template_filter = TemplateFilter(
                filter_id=f.get("id", ""),
                filter_type=f.get("filterType", ""),
                config=f,
            )

            # Extract target column
            targets = f.get("targets", [])
            if targets and isinstance(targets, list):
                first_target = targets[0]
                if isinstance(first_target, dict):
                    column_info = first_target.get("column", {})
                    if isinstance(column_info, dict):
                        template_filter.target_column = column_info.get("name")

            # Extract default value
            template_filter.default_value = f.get("defaultDataMask", {}).get(
                "filterState", {}
            ).get("value")

            filters.append(template_filter)

        return filters

    def _extract_dataset_info(
        self, dashboard: Dashboard
    ) -> tuple[str | None, str | None]:
        """Extract dataset SQL and name from first chart's datasource."""
        if not dashboard.slices:
            return None, None

        first_slice = dashboard.slices[0]
        datasource = first_slice.datasource

        if not datasource:
            return None, None

        dataset_sql = getattr(datasource, "sql", None)
        dataset_name = getattr(datasource, "name", None)

        return dataset_sql, dataset_name


def analyze_template(dashboard: Dashboard) -> TemplateRequirements:
    """
    Convenience function to analyze a template dashboard.

    :param dashboard: The template dashboard to analyze
    :return: TemplateRequirements with extracted requirements
    """
    return TemplateAnalyzer().analyze(dashboard)
