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
"""REST API for AI Assistant SQL generation."""

import logging

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe
from marshmallow import ValidationError

from superset import db, event_logger
from superset.aiassistant.schemas import (
    GenerateSQLResponseSchema,
    GenerateSQLSchema,
)
from superset.aiassistant.sql_generator import SQLGeneratorService
from superset.connectors.sqla.models import SqlaTable
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)


class AIAssistantRestApi(BaseSupersetApi):
    """REST API for AI-powered SQL generation."""

    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True
    class_permission_name = "AIAssistant"
    resource_name = "aiassistant"
    openapi_spec_tag = "AI Assistant"
    openapi_spec_component_schemas = (
        GenerateSQLSchema,
        GenerateSQLResponseSchema,
    )

    @expose("/generate_sql", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.generate_sql",
        log_to_statsd=False,
    )
    def generate_sql(self) -> Response:
        """Generate SQL from natural language query.
        ---
        post:
          summary: Generate SQL from natural language
          description: >-
            Uses AI to convert a natural language question into a SQL query
            based on the dataset schema and column descriptions.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/GenerateSQLSchema'
                examples:
                  simple_query:
                    summary: "Simple query example"
                    value:
                      dataset_id: 1
                      user_query: "Show me all active users"
                  complex_query:
                    summary: "Complex query with filters"
                    value:
                      dataset_id: 1
                      user_query: >
                        Get the top 10 users by login count
                        who were created in 2024
          responses:
            200:
              description: SQL generated successfully
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/GenerateSQLResponseSchema'
                  examples:
                    success:
                      value:
                        sql: "SELECT * FROM users WHERE active = true"
            400:
              description: Invalid request or AI generation failed
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/GenerateSQLResponseSchema'
                  examples:
                    error:
                      value:
                        error: "AI SQL generation is not configured"
            404:
              description: Dataset not found
            500:
              $ref: '#/components/responses/500'
        """
        try:
            # Validate request
            schema = GenerateSQLSchema()
            item = schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        dataset_id = item["dataset_id"]
        user_query = item["user_query"]

        # Fetch dataset information
        dataset = db.session.query(SqlaTable).filter_by(id=dataset_id).first()
        if not dataset:
            return self.response_404()

        # Build schema information from dataset
        schema_info = self._build_schema_info(dataset)

        # Get database dialect
        db_dialect = dataset.database.db_engine_spec.engine_name or "SQL"

        logger.info("AI SQL generation request for dataset %s", dataset_id)

        # Generate SQL using AI service
        result = SQLGeneratorService.generate_sql(user_query, schema_info, db_dialect)

        if "error" in result:
            logger.warning("AI SQL generation failed: %s", result["error"])
            return self.response_400(message=result)

        return self.response(200, **result)

    def _build_schema_info(self, dataset: SqlaTable) -> str:
        """
        Build schema information string from dataset.

        Args:
            dataset: The SqlaTable dataset

        Returns:
            Formatted schema information string for AI
        """
        dataset_name = dataset.table_name
        schema_info = f'The dataset "{dataset_name}" has the following columns:\n\n'

        for col in dataset.columns:
            schema_info += f"- {col.column_name} ({col.type})"
            if col.description:
                schema_info += f": {col.description}"
            schema_info += "\n"

        schema_info += (
            "\nGenerate a valid SQL SELECT query using ONLY these column names.\n"
        )
        schema_info += (
            "Return ONLY the SQL query on a single line, "
            "with no explanations or markdown formatting."
        )

        return schema_info
