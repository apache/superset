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
LLM Service for Dashboard Generator.

Provides AI-powered features for dashboard generation:
- Virtual dataset SQL generation
- Column/metric mapping refinement
- Chart parameter mapping
"""
from __future__ import annotations

import logging
from typing import Any

from superset.commands.dashboard_generator.mapping_service import (
    ConfidenceLevel,
    MappingProposal,
)
from superset.commands.dashboard_generator.template_analyzer import (
    TemplateRequirements,
)
from superset.llm.base import BaseLLMClient, LLMConfig
from superset.models.database_analyzer import DatabaseSchemaReport
from superset.utils import json

logger = logging.getLogger(__name__)

class DashboardGeneratorLLMService(BaseLLMClient):
    """
    LLM service for dashboard generation tasks.

    Extends BaseLLMClient with domain-specific methods for:
    - Generating virtual dataset SQL from template requirements
    - Refining column/metric mappings with semantic understanding
    - Mapping chart parameters to new datasets

    Uses the "dashboard_generator" feature configuration, which defaults to
    a model with strong reasoning capabilities (anthropic/claude-3.5-sonnet)
    optimized for SQL generation and complex mappings.
    """

    # Feature name for automatic configuration
    feature_name = "dashboard_generator"

    def __init__(self, config: LLMConfig | None = None) -> None:
        """
        Initialize the dashboard generator LLM service.

        :param config: Optional LLM configuration. If None, loads from environment.
        """
        super().__init__(config)

    def generate_dataset_sql(
        self,
        database_report: dict[str, Any],
        template_dataset: dict[str, Any],
        chart_requirements: list[dict[str, Any]],
        pre_matched_columns: dict[str, Any] | None = None,
        previous_errors: list[str] | None = None,
        required_columns: list[str] | None = None,
        template_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Generate a virtual dataset SQL and column/metric mappings.

        :param database_report: Full database report with tables, columns, joins
        :param template_dataset: Template dataset with columns, metrics, and SQL
        :param chart_requirements: List of chart requirements (columns, metrics needed)
        :param pre_matched_columns: Pre-computed column candidates from MappingService
        :param previous_errors: Errors from previous generation attempts for refinement
        :return: Dict with sql, table_name, column_mappings, metric_mappings
        """
        if not self.is_available():
            raise ValueError("LLM service is not available")

        prompt = self._build_dataset_generation_prompt(
            database_report,
            template_dataset,
            chart_requirements,
            pre_matched_columns,
            previous_errors,
            required_columns=required_columns,
            template_context=template_context,
        )

        response = self.chat_json(
            prompt=prompt,
            system_prompt=self._get_dataset_system_prompt(),
        )

        if not response.success:
            raise ValueError(f"LLM error: {response.error}")

        return self._parse_dataset_response(response.json_content)

    def refine_dataset_for_filters(
        self,
        current_dataset_sql: str,
        column_mappings: dict[str, str],
        native_filters: list[dict[str, Any]],
        database_report: dict[str, Any],
        required_columns: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Refine the dataset SQL to support native filter requirements.

        :param current_dataset_sql: The SQL from the initial dataset generation
        :param column_mappings: Existing column mappings
        :param native_filters: Native filter configurations
        :param database_report: Full database report
        :return: Dict with needs_revision, revised_sql, filter_column_mappings
        """
        if not self.is_available():
            raise ValueError("LLM service is not available")

        prompt = self._build_filter_refinement_prompt(
            current_dataset_sql, column_mappings, native_filters, database_report
        )

        response = self.chat_json(
            prompt=prompt,
            system_prompt=self._get_filter_system_prompt(),
        )

        if not response.success:
            raise ValueError(f"LLM error: {response.error}")

        return self._parse_filter_response(response.json_content)

    def map_chart_params(
        self,
        chart_params: dict[str, Any],
        column_mappings: dict[str, str],
        metric_mappings: dict[str, str],
        viz_type: str,
        available_columns: list[str] | None = None,
        previous_errors: list[str] | None = None,
        datetime_column: str | None = None,
        template_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Map chart parameters from template to new dataset.

        :param chart_params: Original chart params (form_data)
        :param column_mappings: Column name mappings
        :param metric_mappings: Metric mappings
        :param viz_type: Visualization type
        :param available_columns: List of columns available in the new dataset
        :param previous_errors: Errors from previous mapping attempts for refinement
        :param datetime_column: The dataset's main datetime column (for time-series charts)
        :return: Updated chart params
        """
        if not self.is_available():
            # Fallback to simple mapping without LLM
            result = self._simple_param_mapping(
                chart_params, column_mappings, metric_mappings
            )
            # Ensure datetime column is set for time-series charts
            if datetime_column:
                result = self._ensure_datetime_column(result, datetime_column, viz_type)
            return result

        prompt = self._build_chart_mapping_prompt(
            chart_params,
            column_mappings,
            metric_mappings,
            viz_type,
            available_columns,
            previous_errors,
            datetime_column,
            template_context,
        )

        response = self.chat_json(
            prompt=prompt,
            system_prompt=self._get_chart_system_prompt(),
        )

        if not response.success or not response.json_content:
            logger.warning(
                "LLM chart mapping failed, using simple mapping: %s", response.error
            )
            result = self._simple_param_mapping(
                chart_params, column_mappings, metric_mappings
            )
            if datetime_column:
                result = self._ensure_datetime_column(result, datetime_column, viz_type)
            return result

        # Post-process to ensure datetime column is set
        result = response.json_content
        if datetime_column:
            result = self._ensure_datetime_column(result, datetime_column, viz_type)
        return result

    def _ensure_datetime_column(
        self,
        params: dict[str, Any],
        datetime_column: str,
        viz_type: str,
    ) -> dict[str, Any]:
        """
        Ensure the chart params have the datetime column properly set.

        This is a safety net for time-series charts that require a datetime column.
        """
        # Chart types that typically require a datetime column
        time_series_types = {
            "line",
            "area",
            "bar",
            "scatter",
            "echarts_timeseries",
            "echarts_timeseries_line",
            "echarts_timeseries_bar",
            "echarts_timeseries_scatter",
            "echarts_area",
            "mixed_timeseries",
            "big_number_total",
            "big_number",
            "calendar_heatmap",
            "table",
            "pivot_table",
        }

        is_time_series = any(ts in viz_type.lower() for ts in time_series_types)

        if is_time_series:
            # Ensure granularity_sqla is set
            if not params.get("granularity_sqla"):
                params["granularity_sqla"] = datetime_column
                logger.debug(
                    "Set granularity_sqla to %s for chart type %s",
                    datetime_column,
                    viz_type,
                )

            # For ECharts-based visualizations, also ensure x_axis is set
            if "echarts" in viz_type.lower() or viz_type in {"line", "bar", "area"}:
                if not params.get("x_axis"):
                    params["x_axis"] = datetime_column
                    logger.debug("Set x_axis to %s for chart type %s", datetime_column, viz_type)

        return params

    def suggest_filter_column(
        self,
        filter_name: str,
        original_column: str,
        available_columns: list[str],
        previous_errors: list[str] | None = None,
    ) -> str | None:
        """
        Suggest an alternative column for a filter when the original is not available.

        :param filter_name: Name of the filter
        :param original_column: Original column name from template
        :param available_columns: List of columns available in the new dataset
        :param previous_errors: Errors from previous suggestions
        :return: Suggested column name or None if no good match
        """
        if not self.is_available() or not available_columns:
            return None

        prompt = f"""Suggest the best column to use for a filter.

## Filter Details
- Filter Name: {filter_name}
- Original Column: {original_column}

## Available Columns in Dataset
{json.dumps(available_columns, indent=2)}

"""
        if previous_errors:
            prompt += f"""## Previous Errors
{chr(10).join(f'- {e}' for e in previous_errors)}

"""

        prompt += """## Task
Select the most appropriate column from the available columns that could serve the same purpose as the original column. Consider semantic meaning, data type compatibility, and naming patterns.

Return as JSON:
{
  "suggested_column": "column_name_or_null",
  "confidence": 0.0-1.0,
  "reason": "explanation"
}
"""

        response = self.chat_json(
            prompt=prompt,
            system_prompt="You are a BI expert mapping filter columns between datasets.",
        )

        if not response.success or not response.json_content:
            return None

        result = response.json_content
        if isinstance(result, dict):
            suggested = result.get("suggested_column")
            confidence = result.get("confidence", 0)
            # Only return if confidence is reasonable
            if suggested and confidence >= 0.5:
                return suggested

        return None

    def refine_mappings_with_context(
        self,
        template_requirements: TemplateRequirements,
        database_report: DatabaseSchemaReport,
        pre_computed_proposal: MappingProposal,
    ) -> MappingProposal:
        """
        Refine mappings using LLM with pre-computed candidates.

        This is the CRITICAL step where the LLM attempts to find the best
        possible mappings. User review should ONLY be triggered if the LLM
        cannot find good mappings (confidence < 60%).

        Uses structured prompts with:
        1. Pre-computed candidate matches (reduces LLM work)
        2. Explicit constraints
        3. Required confidence scores
        4. Semantic analysis of column meanings

        :param template_requirements: Extracted template requirements
        :param database_report: Analyzed user database schema
        :param pre_computed_proposal: Initial proposal from rule-based matching
        :return: Refined MappingProposal with LLM-improved mappings
        :raises ValueError: If LLM service is not available
        """
        if not self.is_available():
            raise ValueError(
                "LLM service is required for mapping refinement. "
                "Please configure SUPERSET_LLM_API_KEY."
            )

        prompt = self._build_structured_mapping_prompt(
            template_requirements,
            database_report,
            pre_computed_proposal,
        )

        response = self.chat_json(
            prompt=prompt,
            system_prompt=self._get_structured_mapping_system_prompt(),
        )

        if not response.success or not response.json_content:
            logger.warning(
                "LLM refinement failed, using pre-computed proposal: %s", response.error
            )
            return pre_computed_proposal

        return self._parse_refined_mapping_response(
            response.json_content, pre_computed_proposal
        )

    def generate_dataset_sql_with_mappings(
        self,
        template_requirements: TemplateRequirements,
        database_report: DatabaseSchemaReport,
        confirmed_mappings: MappingProposal,
    ) -> dict[str, Any]:
        """
        Generate dataset SQL using confirmed/refined mappings.

        :param template_requirements: Template requirements
        :param database_report: Database schema report
        :param confirmed_mappings: Confirmed column/metric mappings
        :return: Dict with sql, table_name, column_mappings, metric_mappings
        """
        if not self.is_available():
            raise ValueError("LLM service is not available")

        prompt = self._build_sql_generation_prompt(
            template_requirements,
            database_report,
            confirmed_mappings,
        )

        response = self.chat_json(
            prompt=prompt,
            system_prompt=self._get_sql_generation_system_prompt(),
        )

        if not response.success:
            raise ValueError(f"LLM error: {response.error}")

        return self._parse_dataset_response(response.json_content)

    def suggest_column_fallbacks(
        self,
        missing_columns: list[str],
        available_columns: list[str],
    ) -> dict[str, str | None]:
        """
        Ask LLM for closest available columns for missing template fields.

        Returns mapping of template column -> suggested available column (or None).
        """
        if not self.is_available() or not missing_columns:
            return {}

        prompt = f"""Suggest replacements for missing template columns.

Missing Columns: {json.dumps(missing_columns)}
Available Columns: {json.dumps(available_columns)}

Rules:
- Only pick from available columns.
- If nothing is appropriate, return null for that column.

Return JSON: {{"template_col": "available_col_or_null"}}.
"""
        response = self.chat_json(
            prompt=prompt,
            system_prompt="You are a BI mapping expert choosing the closest available columns.",
        )
        if not response.success or not isinstance(response.json_content, dict):
            return {}
        return {k: v for k, v in response.json_content.items() if isinstance(k, str)}

    # =========================================================================
    # Prompt Building Methods
    # =========================================================================

    def _build_structured_mapping_prompt(
        self,
        template_requirements: TemplateRequirements,
        database_report: DatabaseSchemaReport,
        pre_computed: MappingProposal,
    ) -> str:
        """Build structured prompt for LLM mapping refinement."""
        prompt = """## TASK
Refine column and metric mappings for a dashboard dataset.

## TEMPLATE REQUIREMENTS
"""
        # Template columns
        prompt += "\n### Required Columns:\n"
        for col in template_requirements.columns:
            type_str = col.data_type or "unknown"
            prompt += f"- {col.name} ({type_str}, role: {col.role})\n"

        # Template metrics
        prompt += "\n### Required Metrics:\n"
        for metric in template_requirements.metrics:
            expr = metric.expression or "N/A"
            prompt += f"- {metric.name}: {expr}\n"

        # User database schema
        prompt += "\n## USER DATABASE SCHEMA\n"
        for table in database_report.tables:
            prompt += f"\n### Table: {table.table_name}\n"
            if table.ai_description:
                prompt += f"Description: {table.ai_description}\n"
            prompt += "Columns:\n"
            for col in table.columns:
                type_str = col.data_type or "unknown"
                desc = col.ai_description or ""
                prompt += f"  - {col.column_name} ({type_str})"
                if desc:
                    prompt += f" - {desc}"
                prompt += "\n"

        # Pre-computed candidates
        prompt += "\n## PRE-COMPUTED CANDIDATES (from rule-based matching)\n"
        prompt += "\n### Column Mappings:\n"
        for mapping in pre_computed.column_mappings:
            conf_pct = int(mapping.confidence * 100)
            alt_str = ", ".join(
                [f"{a['column']} ({a['table']})" for a in mapping.alternatives[:3]]
            )
            prompt += f"- {mapping.template_column} → "
            prompt += f"{mapping.user_column or 'UNMAPPED'} "
            prompt += f"({conf_pct}% confidence)\n"
            if alt_str:
                prompt += f"  Alternatives: {alt_str}\n"
            prompt += f"  Reasons: {', '.join(mapping.match_reasons)}\n"

        prompt += "\n### Metric Mappings:\n"
        for mapping in pre_computed.metric_mappings:
            conf_pct = int(mapping.confidence * 100)
            prompt += f"- {mapping.template_metric} → "
            prompt += f"{mapping.user_expression or 'UNMAPPED'} "
            prompt += f"({conf_pct}% confidence)\n"

        # Constraints
        prompt += """

## CONSTRAINTS
1. Use ONLY tables and columns from the schema above
2. For columns with <60% confidence, provide a better match if possible
3. For metrics, use appropriate aggregation functions (SUM, COUNT, AVG, etc.)
4. Provide confidence score (0-100) for each mapping
5. If no good match exists, explain why

## OUTPUT FORMAT (strict JSON)
{
  "column_mappings": [
    {"template": "order_date", "user_column": "transaction_date", "user_table": "transactions", "confidence": 95, "reason": "Same type, similar name"},
    {"template": "customer_name", "user_column": null, "user_table": null, "confidence": 0, "reason": "No matching column found"}
  ],
  "metric_mappings": [
    {"template": "total_sales", "expression": "SUM(amount)", "confidence": 90, "reason": "Amount column is numeric measure"}
  ],
  "warnings": ["Low confidence on X mapping"]
}
"""
        return prompt

    def _build_sql_generation_prompt(
        self,
        template_requirements: TemplateRequirements,
        database_report: DatabaseSchemaReport,
        confirmed_mappings: MappingProposal,
    ) -> str:
        """Build prompt for SQL generation with confirmed mappings."""
        prompt = """## TASK
Generate SQL for a virtual dataset using the confirmed column mappings.

## CONFIRMED COLUMN MAPPINGS
"""
        for mapping in confirmed_mappings.column_mappings:
            if mapping.user_column:
                prompt += f"- {mapping.template_column} → "
                prompt += f"{mapping.user_table}.{mapping.user_column}\n"

        prompt += "\n## CONFIRMED METRIC MAPPINGS\n"
        for mapping in confirmed_mappings.metric_mappings:
            if mapping.user_expression:
                prompt += f"- {mapping.template_metric} → {mapping.user_expression}\n"

        # Add join information
        prompt += "\n## AVAILABLE JOINS\n"
        for join in database_report.joins:
            src_cols = (
                json.loads(join.source_columns)
                if isinstance(join.source_columns, str)
                else join.source_columns
            )
            tgt_cols = (
                json.loads(join.target_columns)
                if isinstance(join.target_columns, str)
                else join.target_columns
            )
            prompt += f"- {join.source_table.table_name}.{src_cols} → "
            prompt += f"{join.target_table.table_name}.{tgt_cols} "
            prompt += f"({join.cardinality.value if join.cardinality else 'N:1'})\n"

        # Original template SQL if available
        if template_requirements.dataset_sql:
            prompt += f"\n## REFERENCE: Template Dataset SQL\n```sql\n{template_requirements.dataset_sql}\n```\n"

        prompt += """

## CONSTRAINTS
1. Use ONLY the confirmed mappings above
2. Include ALL mapped columns in the SELECT clause
3. Use appropriate JOINs based on the available join paths
4. Alias columns to match template column names

## OUTPUT FORMAT (strict JSON)
{
  "sql": "SELECT t.column AS template_name, ... FROM table t JOIN ...",
  "table_name": "generated_dashboard_dataset",
  "column_mappings": {"template_column": "alias_in_sql", ...},
  "metric_mappings": {"template_metric": "SQL_EXPRESSION", ...}
}
"""
        return prompt

    def _build_dataset_generation_prompt(
        self,
        database_report: dict[str, Any],
        template_dataset: dict[str, Any],
        chart_requirements: list[dict[str, Any]],
        pre_matched_columns: dict[str, Any] | None = None,
        previous_errors: list[str] | None = None,
        required_columns: list[str] | None = None,
        template_context: dict[str, Any] | None = None,
    ) -> str:
        """Build prompt for dataset SQL generation."""
        # First, build a complete list of all available columns for reference
        all_columns_by_table: dict[str, list[str]] = {}
        for table in database_report.get("tables", []):
            table_name = table["name"]
            all_columns_by_table[table_name] = [
                col["name"] for col in table.get("columns", [])
            ]

        prompt = """You are a database expert creating a virtual dataset SQL query.

## CRITICAL: AVAILABLE COLUMNS ONLY
You MUST ONLY use the exact column names listed below. DO NOT invent or guess column names.
If a column name is not in this list, it does NOT exist.

### Complete Column Inventory:
"""
        # List ALL available columns first for clarity
        for table_name, columns in all_columns_by_table.items():
            prompt += f"\nTable `{table_name}`: {', '.join(columns)}\n"

        prompt += """
---

## Database Schema Details

### Tables:
"""
        for table in database_report.get("tables", []):
            prompt += f"\n**{table['name']}** ({table.get('type', 'table')})"
            if table.get("description"):
                prompt += f": {table['description']}"
            prompt += "\nColumns:\n"
            for col in table.get("columns", []):
                prompt += f"  - `{col['name']}` ({col['type']})"
                if col.get("description"):
                    prompt += f" - {col['description']}"
                prompt += "\n"

        prompt += "\n### Available Joins:\n"
        for join in database_report.get("joins", []):
            prompt += (
                f"- `{join['source_table']}`.`{join['source_columns']}` → "
                f"`{join['target_table']}`.`{join['target_columns']}` "
                f"({join.get('join_type', 'inner')}, {join.get('cardinality', 'N:1')})\n"
            )

        prompt += "\n## Template Dataset (reference only - don't use template column names directly)\n"
        prompt += f"Name: {template_dataset.get('name', 'Unknown')}\n"

        if template_dataset.get("sql"):
            prompt += f"Original SQL (for structure reference):\n```sql\n{template_dataset['sql']}\n```\n"

        prompt += "\nTemplate Columns (need to map to YOUR schema):\n"
        for col in template_dataset.get("columns", []):
            prompt += f"  - {col.get('name', col)} ({col.get('type', 'unknown')})\n"

        prompt += "\nTemplate Metrics (need to recreate with YOUR columns):\n"
        for metric in template_dataset.get("metrics", []):
            if isinstance(metric, dict):
                name = metric.get("metric_name", metric.get("name", str(metric)))
                prompt += f"  - {name}: {metric.get('expression', 'N/A')}\n"
            else:
                prompt += f"  - {metric}\n"

        prompt += "\n## Chart Requirements\n"
        for req in chart_requirements:
            prompt += f"\nChart (viz_type: {req.get('viz_type', 'unknown')}):\n"
            prompt += f"  Required columns: {req.get('required_columns', [])}\n"
            prompt += f"  Required metrics: {req.get('required_metrics', [])}\n"
            if req.get("filter_columns"):
                prompt += f"  Filter columns: {req.get('filter_columns', [])}\n"

        # Add pre-matched column candidates from MappingService
        if pre_matched_columns:
            prompt += "\n## RECOMMENDED MAPPINGS (use these!)\n"
            prompt += "These mappings were pre-computed from your actual schema:\n\n"

            for candidate in pre_matched_columns.get("column_candidates", []):
                conf_pct = int(candidate.get("confidence", 0) * 100)
                suggested = candidate.get("suggested", "UNMAPPED")
                table = candidate.get("table", "")
                prompt += f"- Template `{candidate['template']}` → "
                if suggested and suggested != "UNMAPPED":
                    prompt += f"Use `{table}`.`{suggested}`"
                else:
                    prompt += "No direct match - find best alternative"
                prompt += f" [{conf_pct}% confidence]\n"

            prompt += "\n### Metric Mappings:\n"
            for candidate in pre_matched_columns.get("metric_candidates", []):
                conf_pct = int(candidate.get("confidence", 0) * 100)
                prompt += f"- Template `{candidate['template']}` → "
                prompt += f"Suggested: {candidate.get('suggested', 'UNMAPPED')}"
                prompt += f" [{conf_pct}% confidence]\n"

        # Add previous errors for refinement
        if previous_errors:
            prompt += "\n## ⚠️ PREVIOUS ERRORS - YOU MUST FIX THESE\n"
            for i, error in enumerate(previous_errors, 1):
                prompt += f"{i}. {error}\n"
            prompt += "\nIMPORTANT: The previous SQL failed. Fix the issues above.\n"

        if required_columns:
            prompt += "\n## REQUIRED OUTPUT COLUMNS (must appear in SELECT)\n"
            prompt += ", ".join(required_columns)
            prompt += "\nIf a required column does not exist, map it to the closest available column and expose it with the required alias.\n"

        if template_context:
            prompt += "\n## TEMPLATE CONTEXT (business/domain intent)\n"
            prompt += json.dumps(template_context, indent=2)
            prompt += "\nUse this context to select the most semantically appropriate columns and joins.\n"

        prompt += """

## CONSTRAINTS
1. ONLY use column names from the "Complete Column Inventory" above
2. ONLY use JOIN paths from "Available Joins" above
3. Use column aliases to create semantic names (e.g., AS order_date, AS customer_name)
4. Do NOT invent columns that don't exist
5. If you can't find a matching column after checking all tables, clearly mark it in column_mappings with null and choose the closest available alternative so downstream steps can adapt
6. Prefer producing a working SQL with slightly reduced scope over failing entirely

## OUTPUT FORMAT (strict JSON)
{
  "sql": "SELECT table.column AS alias, ... FROM table JOIN ...",
  "table_name": "generated_dashboard_dataset",
  "column_mappings": {"template_column": "your_alias_in_sql", ...},
  "metric_mappings": {"template_metric": "SUM(your_column)", ...}
}

IMPORTANT: In column_mappings, the values must match the aliases you used in your SELECT clause.
"""
        return prompt

    def _build_filter_refinement_prompt(
        self,
        current_sql: str,
        column_mappings: dict[str, str],
        native_filters: list[dict[str, Any]],
        database_report: dict[str, Any],
        required_columns: list[str] | None = None,
    ) -> str:
        """Build prompt for filter refinement."""
        prompt = f"""You are a database expert helping to ensure a dataset supports native filters.

## Current Dataset SQL
```sql
{current_sql}
```

## Current Column Mappings
{json.dumps(column_mappings, indent=2)}

## Native Filters to Support
"""
        for f in native_filters:
            prompt += f"\n- Filter ID: {f.get('filter_id', 'unknown')}\n"
            prompt += f"  Type: {f.get('filter_type', 'unknown')}\n"
            prompt += f"  Target Column: {f.get('target_column', 'unknown')}\n"

        prompt += "\n## Available Tables/Columns\n"
        for table in database_report.get("tables", []):
            prompt += f"\n**{table['name']}**:\n"
            for col in table.get("columns", []):
                prompt += f"  - {col['name']} ({col['type']})\n"

        prompt += """

## Your Task

Check if the current SQL and column mappings support all the native filters.
If any filter columns are missing, provide a revised SQL that includes them.
If you need to add columns, extend the SELECT with aliases; do not remove existing fields.

Return as JSON:
{
  "needs_revision": true/false,
  "revised_sql": "SELECT ... (or null if no revision needed)",
  "filter_column_mappings": {"template_filter_column": "new_column_name", ...}
}
"""
        if required_columns:
            prompt += "\nRequired filter columns (must appear with aliases): "
            prompt += ", ".join(required_columns)
            prompt += "\nIf a required column is unavailable, map it to the closest available column and expose it with that alias.\n"
        return prompt

    def _build_chart_mapping_prompt(
        self,
        chart_params: dict[str, Any],
        column_mappings: dict[str, str],
        metric_mappings: dict[str, str],
        viz_type: str,
        available_columns: list[str] | None = None,
        previous_errors: list[str] | None = None,
        datetime_column: str | None = None,
        template_context: dict[str, Any] | None = None,
    ) -> str:
        """Build prompt for chart parameter mapping with grounding techniques."""
        prompt = f"""You are mapping chart parameters from an old dataset to a new one.

## CRITICAL: AVAILABLE COLUMNS (ONLY use these exact names)
"""
        if available_columns:
            prompt += f"""Available columns: {', '.join(f'`{c}`' for c in available_columns)}

⚠️ You MUST ONLY use column names from this list. Any column not in this list DOES NOT EXIST.
"""
        else:
            prompt += "No column list provided - use column_mappings values.\n"

        if datetime_column:
            prompt += f"""
## REQUIRED: DateTime Configuration
Primary datetime column: `{datetime_column}`

For this {viz_type} chart, you MUST set:
- "granularity_sqla": "{datetime_column}"
- "x_axis": "{datetime_column}" (for ECharts/time-series charts)
"""

        prompt += f"""
---

## Chart Type: {viz_type}

## Column Mappings (template column → your column):
"""
        for old, new in column_mappings.items():
            prompt += f"- `{old}` → `{new}`\n"

        prompt += "\n## Metric Mappings (template metric → your expression):\n"
        for old, new in metric_mappings.items():
            prompt += f"- `{old}` → `{new}`\n"

        prompt += f"""
## Original Chart Parameters to Update:
```json
{json.dumps(chart_params, indent=2)}
```

"""
        if previous_errors:
            prompt += "## ⚠️ PREVIOUS ERRORS - YOU MUST FIX THESE:\n"
            for i, error in enumerate(previous_errors, 1):
                prompt += f"{i}. {error}\n"
            prompt += "\n"

        prompt += """## GROUNDING EXAMPLE

### Example: Mapping a groupby parameter
Original: {"groupby": ["old_category", "old_region"]}
Mappings: {"old_category": "product_type", "old_region": "store_location"}
Result: {"groupby": ["product_type", "store_location"]}

### Example: Mapping metrics
Original: {"metrics": ["count", {"expressionType": "SIMPLE", "column": {"column_name": "old_amount"}, "aggregate": "SUM"}]}
Mappings column: {"old_amount": "total_sales"}, metric: {"count": "COUNT(*)"}
Result: {"metrics": ["COUNT(*)", {"expressionType": "SIMPLE", "column": {"column_name": "total_sales"}, "aggregate": "SUM"}]}

## CONSTRAINTS
1. ONLY use column names from the available columns list
2. Replace ALL occurrences of old column names with new names
3. Keep non-column settings (colors, labels, formatting) unchanged
4. For nested objects like adhoc_filters, update the column_name field inside
5. If a column doesn't exist in available columns, either swap in the closest available alternative or remove it and leave a helpful comment in an `explain` field
6. If required metrics are missing, choose the safest aggregate on an available numeric column rather than failing
7. Return COMPLETE params object (not just changed fields)
8. If you rescope the chart (remove/change columns/metrics), include a short `title_suggestion` string that reflects the new scope

## OUTPUT: Return the updated parameters as valid JSON object
"""

        if template_context:
            prompt += "\n## TEMPLATE CONTEXT (business/domain intent)\n"
            prompt += json.dumps(template_context, indent=2)
            prompt += "\nUse this context when choosing columns/metrics.\n"
        return prompt

    # =========================================================================
    # System Prompts
    # =========================================================================

    def _get_structured_mapping_system_prompt(self) -> str:
        return (
            "You are a database schema mapping expert. "
            "Analyze column and table relationships to find the best matches. "
            "Consider data types, naming conventions, and semantic meaning. "
            "Be conservative with confidence scores."
        )

    def _get_sql_generation_system_prompt(self) -> str:
        return (
            "You are a SQL expert creating virtual datasets for BI dashboards. "
            "Generate efficient, valid SQL using the confirmed mappings. "
            "Use proper JOINs and column aliases."
        )

    def _get_dataset_system_prompt(self) -> str:
        return (
            "You are a SQL and BI expert. Generate valid SQL for virtual datasets. "
            "Be precise with column names and SQL syntax."
        )

    def _get_filter_system_prompt(self) -> str:
        return "You are a BI dashboard expert. Ensure datasets support all required filters."

    def _get_chart_system_prompt(self) -> str:
        return (
            "You are a visualization expert. Map chart configurations accurately. "
            "Preserve all chart settings."
        )

    # =========================================================================
    # Response Parsing Methods
    # =========================================================================

    def _parse_refined_mapping_response(
        self,
        result: dict[str, Any] | list[Any] | None,
        original_proposal: MappingProposal,
    ) -> MappingProposal:
        """Parse LLM response and update the proposal."""
        if not result or not isinstance(result, dict):
            return original_proposal

        # Update column mappings
        llm_col_mappings = {
            m["template"]: m for m in result.get("column_mappings", [])
        }

        for mapping in original_proposal.column_mappings:
            if mapping.template_column in llm_col_mappings:
                llm_mapping = llm_col_mappings[mapping.template_column]
                new_col = llm_mapping.get("user_column")
                new_conf = llm_mapping.get("confidence", 0) / 100.0

                # Only update if LLM provides better confidence
                if new_col and new_conf > mapping.confidence:
                    mapping.user_column = new_col
                    mapping.user_table = llm_mapping.get("user_table")
                    mapping.confidence = new_conf
                    mapping.match_reasons = [llm_mapping.get("reason", "LLM refined")]
                    mapping.confidence_level = self._score_to_confidence_level(new_conf)

        # Update metric mappings
        llm_metric_mappings = {
            m["template"]: m for m in result.get("metric_mappings", [])
        }

        for mapping in original_proposal.metric_mappings:
            if mapping.template_metric in llm_metric_mappings:
                llm_mapping = llm_metric_mappings[mapping.template_metric]
                new_expr = llm_mapping.get("expression")
                new_conf = llm_mapping.get("confidence", 0) / 100.0

                if new_expr and new_conf > mapping.confidence:
                    mapping.user_expression = new_expr
                    mapping.confidence = new_conf
                    mapping.match_reasons = [llm_mapping.get("reason", "LLM refined")]
                    mapping.confidence_level = self._score_to_confidence_level(new_conf)

        # Re-check if review is needed
        original_proposal.requires_review = self._check_requires_review_after_llm(
            original_proposal
        )
        original_proposal.review_reasons = self._get_review_reasons_after_llm(
            original_proposal
        )

        return original_proposal

    def _parse_dataset_response(
        self, result: dict[str, Any] | list[Any] | None
    ) -> dict[str, Any]:
        """Parse the LLM response for dataset generation."""
        if not result or not isinstance(result, dict):
            raise ValueError("Invalid LLM response format")

        return {
            "sql": result.get("sql", ""),
            "table_name": result.get("table_name", "generated_dataset"),
            "column_mappings": result.get("column_mappings", {}),
            "metric_mappings": result.get("metric_mappings", {}),
        }

    def _parse_filter_response(
        self, result: dict[str, Any] | list[Any] | None
    ) -> dict[str, Any]:
        """Parse the LLM response for filter refinement."""
        # If parsing failed, return safe defaults (no revision needed)
        if not result or not isinstance(result, dict):
            logger.warning("Filter response parsing failed, skipping revision")
            return {
                "needs_revision": False,
                "revised_sql": None,
                "filter_column_mappings": {},
            }

        return {
            "needs_revision": result.get("needs_revision", False),
            "revised_sql": result.get("revised_sql"),
            "filter_column_mappings": result.get("filter_column_mappings", {}),
        }

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _score_to_confidence_level(self, score: float) -> ConfidenceLevel:
        """Convert numeric score to confidence level."""
        if score >= 0.85:
            return ConfidenceLevel.HIGH
        if score >= 0.60:
            return ConfidenceLevel.MEDIUM
        if score > 0:
            return ConfidenceLevel.LOW
        return ConfidenceLevel.FAILED

    def _check_requires_review_after_llm(self, proposal: MappingProposal) -> bool:
        """Check if review is needed after LLM refinement."""
        for mapping in proposal.column_mappings:
            if mapping.confidence_level in (ConfidenceLevel.LOW, ConfidenceLevel.FAILED):
                return True
        for mapping in proposal.metric_mappings:
            if mapping.confidence_level in (ConfidenceLevel.LOW, ConfidenceLevel.FAILED):
                return True
        return False

    def _get_review_reasons_after_llm(self, proposal: MappingProposal) -> list[str]:
        """Get review reasons after LLM refinement."""
        reasons = []
        low_cols = [
            m.template_column
            for m in proposal.column_mappings
            if m.confidence_level in (ConfidenceLevel.LOW, ConfidenceLevel.FAILED)
        ]
        if low_cols:
            reasons.append(f"Low confidence columns: {', '.join(low_cols)}")

        low_metrics = [
            m.template_metric
            for m in proposal.metric_mappings
            if m.confidence_level in (ConfidenceLevel.LOW, ConfidenceLevel.FAILED)
        ]
        if low_metrics:
            reasons.append(f"Low confidence metrics: {', '.join(low_metrics)}")

        return reasons

    def _simple_param_mapping(
        self,
        params: dict[str, Any],
        column_mappings: dict[str, str],
        metric_mappings: dict[str, str],
    ) -> dict[str, Any]:
        """Simple string replacement mapping without LLM."""
        params_str = json.dumps(params)

        # Replace column names
        for old_col, new_col in column_mappings.items():
            params_str = params_str.replace(f'"{old_col}"', f'"{new_col}"')

        # Replace metric names
        for old_metric, new_metric in metric_mappings.items():
            params_str = params_str.replace(f'"{old_metric}"', f'"{new_metric}"')

        try:
            return json.loads(params_str)
        except json.JSONDecodeError:
            return params
