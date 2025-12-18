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

import logging
from typing import Any

from flask import jsonify, request, Response
from flask_appbuilder.api import expose, protect, safe
from marshmallow import fields, Schema, ValidationError

# Custom permission map that includes our custom method names
# All methods map to "read" or "write" which Admin role has access to
ANALYZER_PERMISSION_MAP = {
    "post": "write",
    "get": "read",
    "check_status": "read",
    "get_report": "read",
}
from superset.extensions import db, event_logger
from superset.models.database_analyzer import DatabaseSchemaReport
from superset.tasks.database_analyzer import (
    check_analysis_status,
    kickstart_analysis,
)
from superset.utils import json
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics

logger = logging.getLogger(__name__)


class DatasourceAnalyzerPostSchema(Schema):
    """Schema for datasource analyzer request"""

    database_id = fields.Integer(
        required=True, metadata={"description": "The ID of the database connection"}
    )
    schema_name = fields.String(
        required=True,
        validate=lambda x: len(x) > 0,
        metadata={"description": "The name of the schema to analyze"},
    )
    catalog_name = fields.String(
        required=False,
        allow_none=True,
        metadata={"description": "The name of the catalog (optional)"},
    )
    force_reanalyze = fields.Boolean(
        required=False,
        load_default=False,
        metadata={
            "description": "Force re-analysis even if a completed report exists"
        },
    )


class DatasourceAnalyzerResponseSchema(Schema):
    """Schema for datasource analyzer response"""

    run_id = fields.String(
        required=True,
        metadata={"description": "The unique identifier for this analysis run"},
    )


class CheckStatusResponseSchema(Schema):
    """Schema for check status response"""

    run_id = fields.String(required=True)
    database_report_id = fields.Integer(allow_none=True)
    status = fields.String(required=True)
    database_id = fields.Integer(allow_none=True)
    schema_name = fields.String(allow_none=True)
    started_at = fields.DateTime(allow_none=True)
    completed_at = fields.DateTime(allow_none=True)
    failed_at = fields.DateTime(allow_none=True)
    error_message = fields.String(allow_none=True)
    tables_count = fields.Integer(allow_none=True)
    joins_count = fields.Integer(allow_none=True)
    confidence_score = fields.Float(allow_none=True)
    confidence_validation_notes = fields.String(allow_none=True)


class DatasourceAnalyzerRestApi(BaseSupersetApi):
    """API endpoints for database schema analyzer"""

    route_base = "/api/v1/datasource/analysis"
    resource_name = "datasource_analysis"
    allow_browser_login = True
    # Use existing "Database" permission - Admin users can access database features
    class_permission_name = "Database"
    # Map custom methods to standard "read"/"write" permissions
    method_permission_name = ANALYZER_PERMISSION_MAP

    openapi_spec_tag = "Datasource Analyzer"
    openapi_spec_component_schemas = (
        DatasourceAnalyzerPostSchema,
        DatasourceAnalyzerResponseSchema,
    )

    def response(self, status_code: int, **kwargs: Any) -> Response:
        """Helper method to create JSON responses."""
        resp = jsonify(kwargs)
        resp.status_code = status_code
        return resp

    def response_400(self, message: str = "Bad request") -> Response:
        """Helper method to create 400 responses."""
        return self.response(400, message=message)

    def response_404(self, message: str = "Not found") -> Response:
        """Helper method to create 404 responses."""
        return self.response(404, message=message)

    def response_500(self, message: str = "Internal server error") -> Response:
        """Helper method to create 500 responses."""
        return self.response(500, message=message)

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=True,
    )
    def post(self) -> Response:
        """Initiate a datasource analysis job.
        ---
        post:
          summary: Initiate datasource analysis
          description: >-
            Initiates a background job to analyze a database schema.
            Returns a run_id that can be used to track the job status.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/DatasourceAnalyzerPostSchema'
          responses:
            200:
              description: Analysis job initiated successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/DatasourceAnalyzerResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            # Parse request body
            schema = DatasourceAnalyzerPostSchema()
            data = schema.load(request.json)

            # Start the analysis (catalog_name ignored for compatibility)
            result = kickstart_analysis(
                database_id=data["database_id"],
                schema_name=data["schema_name"],
            )

            return self.response(200, result=result)

        except ValidationError as error:
            return self.response_400(message=error.messages)
        except Exception as e:
            logger.exception("Error starting database analysis")
            return self.response_500(message=str(e))

    @expose("/status/<string:run_id>", methods=("GET",))
    @protect()
    @safe
    def check_status(self, run_id: str) -> Response:
        """
        Check the status of a running analysis.
        ---
        get:
          description: >-
            Poll the status of a database schema analysis job
          parameters:
          - in: path
            name: run_id
            required: true
            schema:
              type: string
            description: The run ID returned from analyze endpoint
          responses:
            200:
              description: Status retrieved
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/CheckStatusResponseSchema'
            404:
              description: Analysis not found
            500:
              description: Internal server error
        """
        try:
            result = check_analysis_status(run_id)

            if result["status"] == "not_found":
                return self.response_404(
                    message=result.get("message", "Analysis not found")
                )

            # Wrap in 'result' to match usePolling expectations
            return self.response(200, result=result)

        except Exception as e:
            logger.exception("Error checking analysis status")
            return self.response_500(message=str(e))

    @expose("/report/<int:report_id>", methods=("GET",))
    @protect()
    @safe
    def get_report(self, report_id: int) -> Response:
        """
        Get the full analysis report.
        ---
        get:
          description: >-
            Retrieve the complete analysis report with tables, columns, and joins
          parameters:
          - in: path
            name: report_id
            required: true
            schema:
              type: integer
            description: The database_report_id
          responses:
            200:
              description: Report retrieved
            404:
              description: Report not found
            500:
              description: Internal server error
        """
        try:
            report = db.session.query(DatabaseSchemaReport).get(report_id)

            if not report:
                return self.response_404(message="Report not found")

            # Build the response
            result = {
                "id": report.id,
                "database_id": report.database_id,
                "schema_name": report.schema_name,
                "status": report.status,
                "created_at": report.created_on.isoformat()
                if report.created_on
                else None,
                "confidence_score": report.confidence_score,
                "confidence_breakdown": json.loads(report.confidence_breakdown or "{}"),
                "confidence_recommendations": json.loads(
                    report.confidence_recommendations or "[]"
                ),
                "confidence_validation_notes": report.confidence_validation_notes,
                "tables": [],
                "joins": [],
            }

            # Add tables and columns
            for table in report.tables:
                table_data = {
                    "id": table.id,
                    "name": table.table_name,
                    "type": table.table_type,
                    "description": table.ai_description or table.db_comment,
                    "columns": [],
                }

                for column in table.columns:
                    table_data["columns"].append(
                        {
                            "id": column.id,
                            "name": column.column_name,
                            "type": column.data_type,
                            "position": column.ordinal_position,
                            "description": column.ai_description or column.db_comment,
                        }
                    )

                result["tables"].append(table_data)

            # Add joins
            for join in report.joins:
                result["joins"].append(
                    {
                        "id": join.id,
                        "source_table": join.source_table.table_name,
                        "source_columns": join.source_columns,
                        "target_table": join.target_table.table_name,
                        "target_columns": join.target_columns,
                        "join_type": join.join_type,
                        "cardinality": join.cardinality,
                        "semantic_context": join.semantic_context,
                    }
                )

            return self.response(200, **result)

        except Exception as e:
            logger.exception("Error retrieving report")
            return self.response_500(message=str(e))

    @expose("/", methods=("GET",))
    @protect()
    @safe
    def get(self) -> Response:
        """
        Check if a completed report exists for a database/schema combination.
        ---
        get:
          description: >-
            Check if a completed database schema analysis report already exists
            for the given database and schema. This allows the frontend to skip
            the analysis step if a report is already available.
          parameters:
          - in: query
            name: database_id
            required: true
            schema:
              type: integer
            description: The database ID
          - in: query
            name: schema_name
            required: true
            schema:
              type: string
            description: The schema name
          responses:
            200:
              description: Check completed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      exists:
                        type: boolean
                        description: Whether a completed report exists
                      report_id:
                        type: integer
                        description: The report ID if exists
                      created_at:
                        type: string
                        description: When the report was created
                      tables_count:
                        type: integer
                        description: Number of tables in the report
            400:
              description: Missing required parameters
            500:
              description: Internal server error
        """
        try:
            database_id = request.args.get("database_id", type=int)
            schema_name = request.args.get("schema_name", type=str)

            if not database_id or not schema_name:
                return self.response_400(
                    message="Both database_id and schema_name are required"
                )

            # Check for existing completed report
            from superset.models.database_analyzer import AnalysisStatus

            report = (
                db.session.query(DatabaseSchemaReport)
                .filter(
                    DatabaseSchemaReport.database_id == database_id,
                    DatabaseSchemaReport.schema_name == schema_name,
                    DatabaseSchemaReport.status == AnalysisStatus.COMPLETED,
                )
                .first()
            )

            if report:
                return self.response(
                    200,
                    exists=True,
                    report_id=report.id,
                    created_at=report.created_on.isoformat()
                    if report.created_on
                    else None,
                    tables_count=len(report.tables) if report.tables else 0,
                )

            return self.response(200, exists=False, report_id=None)

        except Exception as e:
            logger.exception("Error checking for existing report")
            return self.response_500(message=str(e))
