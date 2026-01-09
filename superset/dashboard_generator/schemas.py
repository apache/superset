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
from __future__ import annotations

from marshmallow import fields, Schema


class DashboardGeneratorPostSchema(Schema):
    """Schema for initiating dashboard generation"""

    database_report_id = fields.Integer(
        required=True,
        metadata={
            "description": "The ID of the database schema report to use for generation"
        },
    )
    dashboard_id = fields.Integer(
        required=True,
        metadata={"description": "The ID of the template dashboard to generate from"},
    )
    proposal_id = fields.String(
        required=False,
        allow_none=True,
        metadata={
            "description": "Optional proposal ID when confirming a reviewed proposal"
        },
    )
    adjusted_mappings = fields.Dict(
        keys=fields.String(),
        values=fields.Dict(),
        required=False,
        allow_none=True,
        metadata={"description": "User-adjusted mappings when confirming a proposal"},
    )


class DashboardGeneratorResponseSchema(Schema):
    """Schema for dashboard generator initiation response"""

    run_id = fields.String(
        required=True,
        metadata={
            "description": "The unique identifier (UUID) for this generation run"
        },
    )


class DashboardGeneratorProgressSchema(Schema):
    """Schema for progress tracking"""

    charts_total = fields.Integer(allow_none=True)
    charts_completed = fields.Integer(allow_none=True)
    filters_total = fields.Integer(allow_none=True)
    filters_completed = fields.Integer(allow_none=True)


class DashboardGeneratorStatusResponseSchema(Schema):
    """Schema for status polling response"""

    run_id = fields.String(required=True)
    status = fields.String(required=True)
    current_phase = fields.String(allow_none=True)
    progress = fields.Nested(DashboardGeneratorProgressSchema, allow_none=True)
    started_at = fields.DateTime(allow_none=True)
    completed_at = fields.DateTime(allow_none=True)
    failed_at = fields.DateTime(allow_none=True)
    error_message = fields.String(allow_none=True)
    dashboard_id = fields.Integer(
        allow_none=True, metadata={"description": "Generated dashboard ID"}
    )
    dashboard_url = fields.String(
        allow_none=True, metadata={"description": "URL to the generated dashboard"}
    )
    dataset_id = fields.Integer(
        allow_none=True, metadata={"description": "Generated dataset ID"}
    )
    failed_items = fields.Dict(
        keys=fields.String(),
        values=fields.List(fields.Dict()),
        allow_none=True,
        metadata={"description": "Failed chart/filter items with error details"},
    )


class MappingProposalPostSchema(Schema):
    """Schema for requesting mapping proposal"""

    database_report_id = fields.Integer(
        required=True,
        metadata={"description": "The ID of the database schema report"},
    )
    dashboard_id = fields.Integer(
        required=True,
        metadata={"description": "The ID of the template dashboard"},
    )


class ColumnMappingSchema(Schema):
    """Schema for a column mapping"""

    template_column = fields.String(required=True)
    user_column = fields.String(allow_none=True)
    user_table = fields.String(allow_none=True)
    confidence = fields.Float(required=True)
    confidence_level = fields.String(required=True)
    match_reasons = fields.List(fields.String())
    alternatives = fields.List(fields.Dict())


class MetricMappingSchema(Schema):
    """Schema for a metric mapping"""

    template_metric = fields.String(required=True)
    user_expression = fields.String(allow_none=True)
    confidence = fields.Float(required=True)
    confidence_level = fields.String(required=True)
    match_reasons = fields.List(fields.String())
    alternatives = fields.List(fields.String())


class MappingProposalResponseSchema(Schema):
    """Schema for mapping proposal response"""

    requires_review = fields.Boolean(
        required=True,
        metadata={"description": "Whether user review is needed before generation"},
    )
    proposal_id = fields.String(
        allow_none=True,
        metadata={"description": "Proposal ID if review is needed"},
    )
    run_id = fields.String(
        allow_none=True,
        metadata={"description": "Run ID if generation started automatically"},
    )
    message = fields.String(allow_none=True)
    column_mappings = fields.List(
        fields.Nested(ColumnMappingSchema),
        allow_none=True,
    )
    metric_mappings = fields.List(
        fields.Nested(MetricMappingSchema),
        allow_none=True,
    )
    unmapped_columns = fields.List(fields.String(), allow_none=True)
    unmapped_metrics = fields.List(fields.String(), allow_none=True)
    review_reasons = fields.List(fields.String(), allow_none=True)
    overall_confidence = fields.Float(allow_none=True)


class MappingConfirmPostSchema(Schema):
    """Schema for confirming mappings and starting generation"""

    proposal_id = fields.String(
        required=True,
        metadata={"description": "The proposal ID to confirm"},
    )
    database_report_id = fields.Integer(
        required=True,
        metadata={"description": "The ID of the database schema report"},
    )
    dashboard_id = fields.Integer(
        required=True,
        metadata={"description": "The ID of the template dashboard"},
    )
    adjusted_mappings = fields.Dict(
        keys=fields.String(),
        values=fields.Dict(),
        allow_none=True,
        metadata={"description": "User-adjusted mappings"},
    )
