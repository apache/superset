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
    "generate_dashboard": "write",
}
from superset.extensions import db, event_logger
from superset.models.database_analyzer import (
    AnalyzedColumn,
    AnalyzedTable,
    DatabaseSchemaReport,
)
from superset.tasks.dashboard_generator import kickstart_generation
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


class TableDescriptionPutSchema(Schema):
    """Schema for updating table description"""

    description = fields.String(
        required=True,
        allow_none=True,
        metadata={"description": "The AI-generated description for the table"},
    )


class ColumnDescriptionPutSchema(Schema):
    """Schema for updating column description"""

    description = fields.String(
        required=True,
        allow_none=True,
        metadata={"description": "The AI-generated description for the column"},
    )


class GenerateDashboardPostSchema(Schema):
    """Schema for triggering dashboard generation"""

    report_id = fields.Integer(
        required=True,
        metadata={"description": "The database schema report ID"},
    )
    dashboard_id = fields.Integer(
        required=True,
        metadata={"description": "The dashboard template ID to use for generation"},
    )


class GenerateDashboardResponseSchema(Schema):
    """Schema for dashboard generation response"""

    run_id = fields.String(
        required=True,
        metadata={"description": "The unique identifier for this generation run"},
    )


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
                            "is_primary_key": column.is_primary_key,
                            "is_foreign_key": column.is_foreign_key,
                        }
                    )

                result["tables"].append(table_data)

            # Add joins
            for join in report.joins:
                source_columns = (
                    json.loads(join.source_columns)
                    if isinstance(join.source_columns, str)
                    else join.source_columns
                )
                target_columns = (
                    json.loads(join.target_columns)
                    if isinstance(join.target_columns, str)
                    else join.target_columns
                )
                result["joins"].append(
                    {
                        "id": join.id,
                        "source_table": join.source_table.table_name,
                        "source_table_id": join.source_table_id,
                        "source_columns": source_columns,
                        "target_table": join.target_table.table_name,
                        "target_table_id": join.target_table_id,
                        "target_columns": target_columns,
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

    @expose("/table/<int:table_id>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.update_table",
        log_to_statsd=True,
    )
    def update_table(self, table_id: int) -> Response:
        """
        Update table description.
        ---
        put:
          summary: Update table AI description
          description: >-
            Updates the AI-generated description for an analyzed table
          parameters:
          - in: path
            name: table_id
            required: true
            schema:
              type: integer
            description: The table ID
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/TableDescriptionPutSchema'
          responses:
            200:
              description: Table description updated successfully
            400:
              $ref: '#/components/responses/400'
            404:
              description: Table not found
            500:
              description: Internal server error
        """
        try:
            schema = TableDescriptionPutSchema()
            data = schema.load(request.json)

            table = db.session.query(AnalyzedTable).get(table_id)
            if not table:
                return self.response_404(message="Table not found")

            table.ai_description = data["description"]
            db.session.commit()  # pylint: disable=consider-using-transaction

            return self.response(
                200,
                id=table.id,
                name=table.table_name,
                description=table.ai_description,
            )

        except ValidationError as error:
            return self.response_400(message=str(error.messages))
        except Exception as e:
            db.session.rollback()  # pylint: disable=consider-using-transaction
            logger.exception("Error updating table description")
            return self.response_500(message=str(e))

    @expose("/column/<int:column_id>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.update_column",
        log_to_statsd=True,
    )
    def update_column(self, column_id: int) -> Response:
        """
        Update column description.
        ---
        put:
          summary: Update column AI description
          description: >-
            Updates the AI-generated description for an analyzed column
          parameters:
          - in: path
            name: column_id
            required: true
            schema:
              type: integer
            description: The column ID
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ColumnDescriptionPutSchema'
          responses:
            200:
              description: Column description updated successfully
            400:
              $ref: '#/components/responses/400'
            404:
              description: Column not found
            500:
              description: Internal server error
        """
        try:
            schema = ColumnDescriptionPutSchema()
            data = schema.load(request.json)

            column = db.session.query(AnalyzedColumn).get(column_id)
            if not column:
                return self.response_404(message="Column not found")

            column.ai_description = data["description"]
            db.session.commit()  # pylint: disable=consider-using-transaction

            return self.response(
                200,
                id=column.id,
                name=column.column_name,
                description=column.ai_description,
            )

        except ValidationError as error:
            return self.response_400(message=str(error.messages))
        except Exception as e:
            db.session.rollback()  # pylint: disable=consider-using-transaction
            logger.exception("Error updating column description")
            return self.response_500(message=str(e))

    @expose("/report/<int:report_id>/join", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.create_join",
        log_to_statsd=True,
    )
    def create_join(self, report_id: int) -> Response:
        """Create a new join relationship.
        ---
        post:
          summary: Create join relationship
          description: Create a new join relationship between tables
          parameters:
          - in: path
            name: report_id
            required: true
            schema:
              type: integer
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  required: [source_table_id, target_table_id, source_columns, target_columns, join_type, cardinality]
                  properties:
                    source_table_id:
                      type: integer
                    target_table_id:
                      type: integer
                    source_columns:
                      type: array
                      items:
                        type: string
                    target_columns:
                      type: array
                      items:
                        type: string
                    join_type:
                      type: string
                      enum: [inner, left, right, full, cross]
                    cardinality:
                      type: string
                      enum: ["1:1", "1:N", "N:1", "N:M"]
                    semantic_context:
                      type: string
          responses:
            201:
              description: Join created successfully
            400:
              description: Bad request
            404:
              description: Report or table not found
            500:
              description: Internal server error
        """
        try:
            import json
            from superset.models.database_analyzer import (
                AnalyzedTable,
                InferredJoin,
                JoinType,
                Cardinality,
            )

            data = request.json or {}

            # Verify report exists
            report = db.session.query(DatabaseSchemaReport).get(report_id)
            if not report:
                return self.response_404(message="Report not found")

            # Verify tables belong to this report
            source_table = (
                db.session.query(AnalyzedTable)
                .filter_by(id=data["source_table_id"], report_id=report_id)
                .first()
            )
            target_table = (
                db.session.query(AnalyzedTable)
                .filter_by(id=data["target_table_id"], report_id=report_id)
                .first()
            )

            if not source_table or not target_table:
                return self.response_404(message="Table not found")

            # Create join
            join = InferredJoin(
                report_id=report_id,
                source_table_id=data["source_table_id"],
                target_table_id=data["target_table_id"],
                source_columns=json.dumps(data["source_columns"]),
                target_columns=json.dumps(data["target_columns"]),
                join_type=JoinType(data["join_type"]),
                cardinality=Cardinality(data["cardinality"]),
                semantic_context=data.get("semantic_context"),
            )

            db.session.add(join)
            db.session.commit()

            return self.response(
                201,
                id=join.id,
                source_table=source_table.table_name,
                source_columns=data["source_columns"],
                target_table=target_table.table_name,
                target_columns=data["target_columns"],
                join_type=join.join_type.value,
                cardinality=join.cardinality.value,
                semantic_context=join.semantic_context,
            )

        except Exception as e:
            logger.exception("Error creating join")
            db.session.rollback()
            return self.response_500(message=str(e))

    @expose("/report/<int:report_id>/join/<int:join_id>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.update_join",
        log_to_statsd=True,
    )
    def update_join(self, report_id: int, join_id: int) -> Response:
        """Update a join relationship.
        ---
        put:
          summary: Update join relationship
          description: Update an existing join relationship
          parameters:
          - in: path
            name: report_id
            required: true
            schema:
              type: integer
          - in: path
            name: join_id
            required: true
            schema:
              type: integer
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    source_table_id:
                      type: integer
                    target_table_id:
                      type: integer
                    source_columns:
                      type: array
                      items:
                        type: string
                    target_columns:
                      type: array
                      items:
                        type: string
                    join_type:
                      type: string
                      enum: [inner, left, right, full, cross]
                    cardinality:
                      type: string
                      enum: ["1:1", "1:N", "N:1", "N:M"]
                    semantic_context:
                      type: string
          responses:
            200:
              description: Join updated successfully
            404:
              description: Join not found
            500:
              description: Internal server error
        """
        try:
            import json
            from superset.models.database_analyzer import (
                AnalyzedTable,
                InferredJoin,
                JoinType,
                Cardinality,
            )

            data = request.json or {}

            join = (
                db.session.query(InferredJoin)
                .filter_by(id=join_id, report_id=report_id)
                .first()
            )

            if not join:
                return self.response_404(message="Join not found")

            # Update fields if provided
            if "source_table_id" in data:
                source_table = (
                    db.session.query(AnalyzedTable)
                    .filter_by(id=data["source_table_id"], report_id=report_id)
                    .first()
                )
                if not source_table:
                    return self.response_404(message="Source table not found")
                join.source_table_id = data["source_table_id"]

            if "target_table_id" in data:
                target_table = (
                    db.session.query(AnalyzedTable)
                    .filter_by(id=data["target_table_id"], report_id=report_id)
                    .first()
                )
                if not target_table:
                    return self.response_404(message="Target table not found")
                join.target_table_id = data["target_table_id"]

            if "source_columns" in data:
                join.source_columns = json.dumps(data["source_columns"])
            if "target_columns" in data:
                join.target_columns = json.dumps(data["target_columns"])
            if "join_type" in data:
                join.join_type = JoinType(data["join_type"])
            if "cardinality" in data:
                join.cardinality = Cardinality(data["cardinality"])
            if "semantic_context" in data:
                join.semantic_context = data["semantic_context"]

            db.session.commit()

            return self.response(
                200,
                id=join.id,
                source_table=join.source_table.table_name,
                source_columns=json.loads(join.source_columns),
                target_table=join.target_table.table_name,
                target_columns=json.loads(join.target_columns),
                join_type=join.join_type.value,
                cardinality=join.cardinality.value,
                semantic_context=join.semantic_context,
            )

        except Exception as e:
            logger.exception("Error updating join")
            db.session.rollback()
            return self.response_500(message=str(e))

    @expose("/report/<int:report_id>/join/<int:join_id>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete_join",
        log_to_statsd=True,
    )
    def delete_join(self, report_id: int, join_id: int) -> Response:
        """Delete a join relationship.
        ---
        delete:
          summary: Delete join relationship
          description: Delete an existing join relationship
          parameters:
          - in: path
            name: report_id
            required: true
            schema:
              type: integer
          - in: path
            name: join_id
            required: true
            schema:
              type: integer
          responses:
            204:
              description: Join deleted successfully
            404:
              description: Join not found
            500:
              description: Internal server error
        """
        try:
            from superset.models.database_analyzer import InferredJoin

            join = (
                db.session.query(InferredJoin)
                .filter_by(id=join_id, report_id=report_id)
                .first()
            )

            if not join:
                return self.response_404(message="Join not found")

            db.session.delete(join)
            db.session.commit()

            return self.response(204)

        except Exception as e:
            logger.exception("Error deleting join")
            db.session.rollback()
            return self.response_500(message=str(e))

    @expose("/generate", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.generate",
        log_to_statsd=True,
    )
    def generate_dashboard(self) -> Response:
        """
        Trigger dashboard generation from schema report.
        ---
        post:
          summary: Generate dashboard from analyzed schema
          description: >-
            Triggers the dashboard generation Celery job using the analyzed
            schema report and a dashboard template. Returns a run_id for
            tracking the generation progress.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/GenerateDashboardPostSchema'
          responses:
            200:
              description: Dashboard generation initiated successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/GenerateDashboardResponseSchema'
            400:
              $ref: '#/components/responses/400'
            404:
              description: Report or dashboard not found
            500:
              description: Internal server error
        """
        try:
            schema = GenerateDashboardPostSchema()
            data = schema.load(request.json)

            report_id = data["report_id"]
            dashboard_id = data["dashboard_id"]

            # Verify report exists
            report = db.session.query(DatabaseSchemaReport).get(report_id)
            if not report:
                return self.response_404(message="Report not found")

            result = kickstart_generation(
                database_report_id=report_id,
                template_dashboard_id=dashboard_id,
            )

            logger.info(
                "Dashboard generation requested for report_id=%s, dashboard_id=%s -> run_id=%s",
                report_id,
                dashboard_id,
                result.get("run_id"),
            )

            return self.response(200, result=result)

        except ValidationError as error:
            return self.response_400(message=str(error.messages))
        except Exception as e:
            logger.exception("Error initiating dashboard generation")
            return self.response_500(message=str(e))
