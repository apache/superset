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
import logging
from typing import Any

from flask import request
from flask_appbuilder import permission_name
from flask_appbuilder.api import expose
from flask_appbuilder.security.decorators import has_access

from superset import event_logger
from superset.aiassistant.sql_generator import SQLGeneratorService
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.superset_typing import FlaskResponse

from .base import BaseSupersetView

logger = logging.getLogger(__name__)


class AIAssistantView(BaseSupersetView):
    """View for the AI Assistant page."""

    route_base = "/aiassistant"
    class_permission_name = "AIAssistant"

    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    @expose("/", methods=["GET"])
    @has_access
    @permission_name("read")
    @event_logger.log_this
    def root(self, **kwargs: Any) -> FlaskResponse:
        """Handles the AI Assistant page."""
        return self.render_app_template()

    @expose("/generate_sql", methods=["POST"])
    @has_access
    @permission_name("read")
    @event_logger.log_this
    def generate_sql(self) -> FlaskResponse:
        """
        Generate SQL from natural language query using AI.

        Expected JSON payload:
        {
            "user_query": "Show me all active users",
            "schema_info": "The dataset 'users' has columns: id (INTEGER), ..."
        }

        Returns:
            JSON response with 'sql' or 'error' key
        """
        try:
            data = request.get_json(force=True)
            user_query = data.get("user_query")
            schema_info = data.get("schema_info")

            if not user_query or not schema_info:
                return self.json_response(
                    {"error": "Missing required fields: user_query and schema_info"},
                    status=400,
                )

            logger.info(f"AI SQL generation request for query: {user_query[:50]}...")

            # Generate SQL using the AI service
            result = SQLGeneratorService.generate_sql(user_query, schema_info)

            if "error" in result:
                logger.warning(f"AI SQL generation failed: {result['error']}")
                return self.json_response(result, status=400)

            return self.json_response(result)

        except Exception as e:
            logger.exception("Error in AI SQL generation endpoint")
            return self.json_response({"error": str(e)}, status=500)
