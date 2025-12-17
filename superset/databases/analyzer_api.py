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
from flask_appbuilder.api import BaseApi, expose, protect, safe
from marshmallow import fields, Schema, ValidationError

from superset.extensions import db
from superset.models.database_analyzer import DatabaseSchemaReport
from superset.tasks.database_analyzer import (
    check_analysis_status,
    kickstart_analysis,
)

logger = logging.getLogger(__name__)


class AnalyzeSchemaRequestSchema(Schema):
    """Schema for analyze schema request"""

    database_id = fields.Integer(required=True)
    schema_name = fields.String(required=True, validate=lambda x: len(x) > 0)


class AnalyzeSchemaResponseSchema(Schema):
    """Schema for analyze schema response"""

    run_id = fields.String(required=True)
    database_report_id = fields.Integer(required=True)
    status = fields.String(required=True)


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


class DatabaseAnalyzerApi(BaseApi):
    """API endpoints for database schema analyzer"""

    route_base = "/api/v1/database_analyzer"
    resource_name = "database_analyzer"
    allow_browser_login = True

    openapi_spec_tag = "Database Analyzer"

    def response(self, status_code: int, **kwargs: Any) -> Response:
        """Helper method to create JSON responses."""
        return jsonify(kwargs), status_code

    def response_400(self, message: str = "Bad request") -> Response:
        """Helper method to create 400 responses."""
        return jsonify({"message": message}), 400

    def response_404(self, message: str = "Not found") -> Response:
        """Helper method to create 404 responses."""
        return jsonify({"message": message}), 404

    def response_500(self, message: str = "Internal server error") -> Response:
        """Helper method to create 500 responses."""
        return jsonify({"message": message}), 500

    openapi_spec_methods = {
        "analyze_schema": {
            "post": {
                "description": "Start a new database schema analysis",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": AnalyzeSchemaRequestSchema,
                        },
                    },
                },
                "responses": {
                    "200": {
                        "description": "Analysis started successfully",
                        "content": {
                            "application/json": {
                                "schema": AnalyzeSchemaResponseSchema,
                            },
                        },
                    },
                    "400": {"description": "Bad request"},
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Internal server error"},
                },
            },
        },
        "check_status": {
            "get": {
                "description": "Check the status of a running analysis",
                "parameters": [
                    {
                        "in": "path",
                        "name": "run_id",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "The run ID returned from analyze_schema",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Status retrieved successfully",
                        "content": {
                            "application/json": {
                                "schema": CheckStatusResponseSchema,
                            },
                        },
                    },
                    "404": {"description": "Analysis not found"},
                    "500": {"description": "Internal server error"},
                },
            },
        },
    }

    @expose("/analyze", methods=("POST",))
    @protect()
    @safe
    def analyze_schema(self) -> Response:
        """
        Start a new database schema analysis.
        ---
        post:
          description: >-
            Kickstart a Celery job to analyze database schema
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/AnalyzeSchemaRequestSchema'
          responses:
            200:
              description: Analysis started
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/AnalyzeSchemaResponseSchema'
            400:
              description: Bad request
            401:
              description: Unauthorized
            500:
              description: Internal server error
        """
        try:
            # Parse request body
            schema = AnalyzeSchemaRequestSchema()
            data = schema.load(request.json)

            # Start the analysis
            result = kickstart_analysis(
                database_id=data["database_id"],
                schema_name=data["schema_name"],
            )

            return self.response(200, **result)

        except ValidationError as e:
            return self.response_400(message=str(e.messages))
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

            return self.response(200, **result)

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
