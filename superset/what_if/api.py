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
from superset.daos.what_if_simulation import WhatIfSimulationDAO
from superset.extensions import event_logger
from superset.utils import json
from superset.views.base_api import BaseSupersetApi, statsd_metrics
from superset.what_if.commands.interpret import WhatIfInterpretCommand
from superset.what_if.commands.simulation_create import CreateWhatIfSimulationCommand
from superset.what_if.commands.simulation_delete import DeleteWhatIfSimulationCommand
from superset.what_if.commands.simulation_update import UpdateWhatIfSimulationCommand
from superset.what_if.commands.suggest_related import WhatIfSuggestRelatedCommand
from superset.what_if.exceptions import (
    OpenRouterAPIError,
    OpenRouterConfigError,
    WhatIfSimulationCreateFailedError,
    WhatIfSimulationDeleteFailedError,
    WhatIfSimulationForbiddenError,
    WhatIfSimulationInvalidError,
    WhatIfSimulationNotFoundError,
    WhatIfSimulationUpdateFailedError,
)
from superset.what_if.schemas import (
    WhatIfInterpretRequestSchema,
    WhatIfInterpretResponseSchema,
    WhatIfSimulationPostSchema,
    WhatIfSimulationPutSchema,
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
    @protect()
    @safe
    @event_logger.log_this
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
    @protect()
    @safe
    @event_logger.log_this
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

    # =========================================================================
    # Simulation CRUD Endpoints
    # =========================================================================

    @expose("/simulations", methods=("GET",))
    @protect()
    @safe
    @event_logger.log_this
    @statsd_metrics
    def list_all_simulations(self) -> Response:
        """List all saved simulations for the current user across all dashboards.
        ---
        get:
          summary: List all What-If simulations for current user
          responses:
            200:
              description: List of simulations
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
            401:
              $ref: '#/components/responses/401'
          security:
            - jwt: []
        """
        simulations = WhatIfSimulationDAO.find_all_for_user()
        result = [
            {
                "id": sim.id,
                "uuid": str(sim.uuid),
                "name": sim.name,
                "description": sim.description,
                "dashboard_id": sim.dashboard_id,
                "modifications": json.loads(sim.modifications_json),
                "cascading_effects_enabled": sim.cascading_effects_enabled,
                "created_on": sim.created_on.isoformat() if sim.created_on else None,
                "changed_on": sim.changed_on.isoformat() if sim.changed_on else None,
            }
            for sim in simulations
        ]
        return self.response(200, result=result)

    @expose("/simulations/dashboard/<int:dashboard_id>", methods=("GET",))
    @protect()
    @safe
    @event_logger.log_this
    @statsd_metrics
    def list_simulations(self, dashboard_id: int) -> Response:
        """List all saved simulations for a dashboard (current user only).
        ---
        get:
          summary: List What-If simulations for a dashboard
          parameters:
          - in: path
            name: dashboard_id
            schema:
              type: integer
            required: true
          responses:
            200:
              description: List of simulations
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
            401:
              $ref: '#/components/responses/401'
          security:
            - jwt: []
        """
        simulations = WhatIfSimulationDAO.find_by_dashboard_and_user(dashboard_id)
        result = [
            {
                "id": sim.id,
                "uuid": str(sim.uuid),
                "name": sim.name,
                "description": sim.description,
                "modifications": json.loads(sim.modifications_json),
                "cascading_effects_enabled": sim.cascading_effects_enabled,
                "created_on": sim.created_on.isoformat() if sim.created_on else None,
                "changed_on": sim.changed_on.isoformat() if sim.changed_on else None,
            }
            for sim in simulations
        ]
        return self.response(200, result=result)

    @expose("/simulations", methods=("POST",))
    @protect()
    @safe
    @event_logger.log_this
    @statsd_metrics
    def create_simulation(self) -> Response:
        """Create a new What-If simulation.
        ---
        post:
          summary: Save a new What-If simulation
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/WhatIfSimulationPostSchema'
          responses:
            201:
              description: Simulation created
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                      uuid:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
          security:
            - jwt: []
        """
        try:
            data = WhatIfSimulationPostSchema().load(request.json)
        except ValidationError as ex:
            logger.warning("Invalid request data: %s", ex.messages)
            return self.response_400(message=str(ex.messages))

        # Serialize modifications to JSON
        data["modifications_json"] = json.dumps(data.pop("modifications"))

        try:
            simulation = CreateWhatIfSimulationCommand(data).run()
            return self.response(
                201,
                id=simulation.id,
                uuid=str(simulation.uuid),
            )
        except WhatIfSimulationInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except WhatIfSimulationCreateFailedError as ex:
            logger.error("Error creating simulation: %s", ex)
            return self.response_422(message=str(ex))

    @expose("/simulations/<int:pk>", methods=("PUT",))
    @protect()
    @safe
    @event_logger.log_this
    @statsd_metrics
    def update_simulation(self, pk: int) -> Response:
        """Update a What-If simulation.
        ---
        put:
          summary: Update a What-If simulation
          parameters:
          - in: path
            name: pk
            schema:
              type: integer
            required: true
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/WhatIfSimulationPutSchema'
          responses:
            200:
              description: Simulation updated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
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
          security:
            - jwt: []
        """
        try:
            data = WhatIfSimulationPutSchema().load(request.json)
        except ValidationError as ex:
            logger.warning("Invalid request data: %s", ex.messages)
            return self.response_400(message=str(ex.messages))

        # Serialize modifications to JSON if present
        if "modifications" in data:
            data["modifications_json"] = json.dumps(data.pop("modifications"))

        try:
            simulation = UpdateWhatIfSimulationCommand(pk, data).run()
            return self.response(200, id=simulation.id)
        except WhatIfSimulationNotFoundError:
            return self.response_404()
        except WhatIfSimulationForbiddenError:
            return self.response_403()
        except WhatIfSimulationInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except WhatIfSimulationUpdateFailedError as ex:
            logger.error("Error updating simulation: %s", ex)
            return self.response_422(message=str(ex))

    @expose("/simulations/<int:pk>", methods=("DELETE",))
    @protect()
    @safe
    @event_logger.log_this
    @statsd_metrics
    def delete_simulation(self, pk: int) -> Response:
        """Delete a What-If simulation.
        ---
        delete:
          summary: Delete a What-If simulation
          parameters:
          - in: path
            name: pk
            schema:
              type: integer
            required: true
          responses:
            200:
              description: Simulation deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
          security:
            - jwt: []
        """
        try:
            DeleteWhatIfSimulationCommand([pk]).run()
            return self.response(200, message="OK")
        except WhatIfSimulationNotFoundError:
            return self.response_404()
        except WhatIfSimulationForbiddenError:
            return self.response_403()
        except WhatIfSimulationDeleteFailedError as ex:
            logger.error("Error deleting simulation: %s", ex)
            return self.response_422(message=str(ex))
