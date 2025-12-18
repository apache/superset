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
"""What-If Analysis REST API."""

from __future__ import annotations

import logging

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe
from marshmallow import ValidationError

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetApi, statsd_metrics
from superset.what_if.commands.interpret import WhatIfInterpretCommand
from superset.what_if.commands.suggest_related import WhatIfSuggestRelatedCommand
from superset.what_if.exceptions import OpenRouterAPIError, OpenRouterConfigError
from superset.what_if.schemas import (
    WhatIfInterpretRequestSchema,
    WhatIfInterpretResponseSchema,
    WhatIfSuggestRelatedRequestSchema,
    WhatIfSuggestRelatedResponseSchema,
)

logger = logging.getLogger(__name__)


class WhatIfRestApi(BaseSupersetApi):
    """REST API for What-If Analysis features."""

    resource_name = "what_if"
    allow_browser_login = True
    openapi_spec_tag = "What-If Analysis"

    # Use Dashboard permissions since what-if is a dashboard feature
    class_permission_name = "Dashboard"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    @expose("/interpret", methods=("POST",))
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    def interpret(self) -> Response:
        """Generate AI interpretation of what-if analysis results.
        ---
        post:
          summary: Generate AI interpretation of what-if changes
          description: >-
            Sends what-if modification data to an LLM for business interpretation.
            Returns a summary and actionable insights.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/WhatIfInterpretRequestSchema'
          responses:
            200:
              description: AI interpretation generated successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/WhatIfInterpretResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
            502:
              description: Error communicating with AI service
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
          security:
            - jwt: []
        """
        try:
            request_data = WhatIfInterpretRequestSchema().load(request.json)
        except ValidationError as ex:
            logger.warning("Invalid request data: %s", ex.messages)
            return self.response_400(message=str(ex.messages))

        try:
            command = WhatIfInterpretCommand(request_data)
            result = command.run()
            return self.response(
                200, result=WhatIfInterpretResponseSchema().dump(result)
            )
        except OpenRouterConfigError as ex:
            logger.error("OpenRouter configuration error: %s", ex)
            return self.response(500, message="AI interpretation is not configured")
        except OpenRouterAPIError as ex:
            logger.error("OpenRouter API error: %s", ex)
            return self.response(502, message=str(ex))
        except ValueError as ex:
            logger.warning("Invalid request: %s", ex)
            return self.response_400(message=str(ex))

    @expose("/suggest_related", methods=("POST",))
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    def suggest_related(self) -> Response:
        """Get AI suggestions for related column modifications.
        ---
        post:
          summary: Get AI-suggested cascading column modifications
          description: >-
            Analyzes column relationships and suggests related columns
            that should be modified when a user modifies a specific column.
            Uses AI to infer causal, mathematical, and domain-specific relationships.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/WhatIfSuggestRelatedRequestSchema'
          responses:
            200:
              description: Related column suggestions generated successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/WhatIfSuggestRelatedResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
            502:
              description: Error communicating with AI service
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
          security:
            - jwt: []
        """
        try:
            request_data = WhatIfSuggestRelatedRequestSchema().load(request.json)
        except ValidationError as ex:
            logger.warning("Invalid request data: %s", ex.messages)
            return self.response_400(message=str(ex.messages))

        try:
            command = WhatIfSuggestRelatedCommand(request_data)
            result = command.run()
            return self.response(
                200, result=WhatIfSuggestRelatedResponseSchema().dump(result)
            )
        except OpenRouterConfigError as ex:
            logger.error("OpenRouter configuration error: %s", ex)
            return self.response(500, message="AI suggestions are not configured")
        except OpenRouterAPIError as ex:
            logger.error("OpenRouter API error: %s", ex)
            return self.response(502, message=str(ex))
        except ValueError as ex:
            logger.warning("Invalid request: %s", ex)
            return self.response_400(message=str(ex))
