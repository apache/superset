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
"""What-If Analysis schemas for request/response validation."""

from marshmallow import fields, Schema


class ChartMetricComparisonSchema(Schema):
    """Schema for a single metric comparison within a chart."""

    metric_name = fields.String(
        required=True,
        metadata={"description": "Name of the metric being compared"},
    )
    original_value = fields.Float(
        required=True,
        metadata={"description": "Original metric value before modification"},
    )
    modified_value = fields.Float(
        required=True,
        metadata={"description": "Modified metric value after what-if applied"},
    )
    percentage_change = fields.Float(
        required=True,
        metadata={"description": "Percentage change from original to modified"},
    )


class ChartComparisonSchema(Schema):
    """Schema for chart-level comparison data."""

    chart_id = fields.Integer(
        required=True,
        metadata={"description": "Unique identifier for the chart"},
    )
    chart_name = fields.String(
        required=True,
        metadata={"description": "Display name of the chart"},
    )
    chart_type = fields.String(
        required=True,
        metadata={"description": "Visualization type (e.g., bar, line, pie)"},
    )
    metrics = fields.List(
        fields.Nested(ChartMetricComparisonSchema),
        required=True,
        metadata={"description": "List of metric comparisons for this chart"},
    )


class WhatIfFilterSchema(Schema):
    """Schema for a what-if filter condition."""

    col = fields.String(
        required=True,
        metadata={"description": "Column name to filter on"},
    )
    op = fields.String(
        required=True,
        metadata={
            "description": "Filter operator: ==, !=, >, <, >=, <=, IN, NOT IN, TEMPORAL_RANGE"
        },
    )
    val = fields.Raw(
        required=True,
        metadata={
            "description": "Filter value (string, number, or array for IN/NOT IN operators)"
        },
    )


class ModificationSchema(Schema):
    """Schema for a single what-if modification."""

    column = fields.String(
        required=True,
        metadata={"description": "Column name being modified"},
    )
    multiplier = fields.Float(
        required=True,
        metadata={
            "description": "Multiplier applied to the column (e.g., 1.1 for +10%)"
        },
    )
    filters = fields.List(
        fields.Nested(WhatIfFilterSchema),
        required=False,
        load_default=None,
        metadata={
            "description": "Optional filters to apply modification conditionally"
        },
    )


class WhatIfInterpretRequestSchema(Schema):
    """Schema for what-if interpretation request."""

    modifications = fields.List(
        fields.Nested(ModificationSchema),
        required=True,
        metadata={"description": "List of column modifications applied"},
    )
    charts = fields.List(
        fields.Nested(ChartComparisonSchema),
        required=True,
        metadata={"description": "List of charts with comparison data"},
    )
    dashboard_name = fields.String(
        required=False,
        load_default=None,
        metadata={"description": "Name of the dashboard for context"},
    )


class InsightSchema(Schema):
    """Schema for a single AI-generated insight."""

    title = fields.String(
        required=True,
        metadata={"description": "Short title summarizing the insight"},
    )
    description = fields.String(
        required=True,
        metadata={"description": "Detailed description of the insight"},
    )
    type = fields.String(
        required=True,
        metadata={
            "description": "Type of insight: observation, implication, or recommendation"
        },
    )


class WhatIfInterpretResponseSchema(Schema):
    """Schema for what-if interpretation response."""

    summary = fields.String(
        required=True,
        metadata={"description": "Executive summary of the what-if analysis"},
    )
    insights = fields.List(
        fields.Nested(InsightSchema),
        required=True,
        metadata={"description": "List of AI-generated insights"},
    )
    raw_response = fields.String(
        required=False,
        metadata={"description": "Raw AI response (only in debug mode)"},
    )


# Schemas for suggest_related endpoint


class AvailableColumnSchema(Schema):
    """Schema for an available column with metadata."""

    column_name = fields.String(
        required=True,
        metadata={"description": "Name of the column"},
    )
    description = fields.String(
        required=False,
        load_default=None,
        metadata={"description": "Column description/documentation"},
    )
    verbose_name = fields.String(
        required=False,
        load_default=None,
        metadata={"description": "Human-readable column name"},
    )
    datasource_id = fields.Integer(
        required=True,
        metadata={"description": "ID of the datasource containing this column"},
    )


class WhatIfSuggestRelatedRequestSchema(Schema):
    """Schema for suggest_related request."""

    selected_column = fields.String(
        required=True,
        metadata={"description": "The column the user selected to modify"},
    )
    user_multiplier = fields.Float(
        required=True,
        metadata={
            "description": "The multiplier the user applied (e.g., 1.1 for +10%)"
        },
    )
    available_columns = fields.List(
        fields.Nested(AvailableColumnSchema),
        required=True,
        metadata={"description": "All numeric columns available in the dashboard"},
    )
    dashboard_name = fields.String(
        required=False,
        load_default=None,
        metadata={"description": "Name of the dashboard for context"},
    )


class SuggestedModificationSchema(Schema):
    """Schema for a single AI-suggested modification."""

    column = fields.String(
        required=True,
        metadata={"description": "Column name to modify"},
    )
    multiplier = fields.Float(
        required=True,
        metadata={"description": "Suggested multiplier for this column"},
    )
    reasoning = fields.String(
        required=True,
        metadata={"description": "Brief explanation of why this column is related"},
    )
    confidence = fields.String(
        required=True,
        metadata={"description": "Confidence level: high, medium, or low"},
    )


class WhatIfSuggestRelatedResponseSchema(Schema):
    """Schema for suggest_related response."""

    suggested_modifications = fields.List(
        fields.Nested(SuggestedModificationSchema),
        required=True,
        metadata={"description": "List of AI-suggested column modifications"},
    )
    explanation = fields.String(
        required=False,
        load_default=None,
        metadata={"description": "Overall explanation of the relationship analysis"},
    )
