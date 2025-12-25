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
from marshmallow import ValidationError

# Custom permission map that includes our custom method names
# All methods map to "read" or "write" which Admin role has access to
GENERATOR_PERMISSION_MAP = {
    "post": "write",
    "get": "read",
    "check_status": "read",
    "create_proposal": "write",
}
from superset.dashboard_generator.exceptions import (
    DatabaseReportNotFoundError,
    TemplateDashboardNotFoundError,
)
from superset.commands.dashboard_generator.llm_service import (
    DashboardGeneratorLLMService,
)
from superset.commands.dashboard_generator.mapping_service import MappingService
from superset.commands.dashboard_generator.template_analyzer import TemplateAnalyzer
from superset.dashboard_generator.schemas import (
    DashboardGeneratorPostSchema,
    DashboardGeneratorResponseSchema,
    DashboardGeneratorStatusResponseSchema,
    MappingProposalPostSchema,
    MappingProposalResponseSchema,
)
from superset.extensions import cache_manager, db, event_logger
from superset.models.dashboard import Dashboard
from superset.models.database_analyzer import DatabaseSchemaReport
from superset.tasks.dashboard_generator import (
    check_generation_status,
    kickstart_generation,
)
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics

# Cache key prefix for mapping proposals
PROPOSAL_CACHE_PREFIX = "dashboard_generator_proposal_"
PROPOSAL_CACHE_TIMEOUT = 3600  # 1 hour

logger = logging.getLogger(__name__)


class DashboardGeneratorRestApi(BaseSupersetApi):
    """API endpoints for dashboard generation from templates"""

    route_base = "/api/v1/dashboard/generation"
    resource_name = "dashboard_generation"
    allow_browser_login = True
    # Use existing "Dashboard" permission - Admin users can create/modify dashboards
    class_permission_name = "Dashboard"
    # Map custom methods to standard "read"/"write" permissions
    method_permission_name = GENERATOR_PERMISSION_MAP

    openapi_spec_tag = "Dashboard Generator"
    openapi_spec_component_schemas = (
        DashboardGeneratorPostSchema,
        DashboardGeneratorResponseSchema,
        DashboardGeneratorStatusResponseSchema,
        MappingProposalPostSchema,
        MappingProposalResponseSchema,
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

    def response_409(self, message: str = "Conflict") -> Response:
        """Helper method to create 409 responses."""
        return self.response(409, message=message)

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
        """Initiate dashboard generation from template.
        ---
        post:
          summary: Start dashboard generation
          description: >-
            Initiates a background job to generate a dashboard from a template
            using the analyzed database schema. Returns a run_id for polling.
            Can also be used to confirm a reviewed proposal by providing proposal_id.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/DashboardGeneratorPostSchema'
          responses:
            200:
              description: Generation job initiated successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/DashboardGeneratorResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            409:
              description: Generation already in progress
            500:
              $ref: '#/components/responses/500'
        """
        try:
            # Parse request body
            schema = DashboardGeneratorPostSchema()
            data = schema.load(request.json)

            # Handle proposal confirmation if proposal_id is provided
            proposal_id = data.get("proposal_id")
            if proposal_id:
                # Retrieve and validate cached proposal
                cache_key = f"{PROPOSAL_CACHE_PREFIX}{proposal_id}"
                cached_data = cache_manager.cache.get(cache_key)

                if not cached_data:
                    return self.response_404(
                        message="Proposal not found or expired. Please create a new proposal."
                    )

                # Clear cached proposal after use
                cache_manager.cache.delete(cache_key)

                # TODO: Apply adjusted_mappings to the generation process
                # adjusted_mappings = data.get("adjusted_mappings")

            # Validate database report exists
            report = db.session.query(DatabaseSchemaReport).get(
                data["database_report_id"]
            )
            if not report:
                raise DatabaseReportNotFoundError(data["database_report_id"])

            # Validate template dashboard exists
            dashboard = db.session.query(Dashboard).get(data["dashboard_id"])
            if not dashboard:
                raise TemplateDashboardNotFoundError(data["dashboard_id"])

            # Start the generation
            result = kickstart_generation(
                database_report_id=data["database_report_id"],
                template_dashboard_id=data["dashboard_id"],
            )

            return self.response(200, result=result)

        except ValidationError as error:
            return self.response_400(message=str(error.messages))
        except DatabaseReportNotFoundError as e:
            return self.response_404(message=str(e))
        except TemplateDashboardNotFoundError as e:
            return self.response_404(message=str(e))
        except Exception as e:
            logger.exception("Error starting dashboard generation")
            return self.response_500(message=str(e))

    @expose("/status/<string:run_id>", methods=("GET",))
    @protect()
    @safe
    def check_status(self, run_id: str) -> Response:
        """
        Check the status of a dashboard generation run.
        ---
        get:
          summary: Check generation status
          description: >-
            Poll the status of a dashboard generation job
          parameters:
          - in: path
            name: run_id
            required: true
            schema:
              type: string
            description: The run ID returned from the generate endpoint
          responses:
            200:
              description: Status retrieved
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/DashboardGeneratorStatusResponseSchema'
            404:
              description: Generation run not found
            500:
              description: Internal server error
        """
        try:
            result = check_generation_status(run_id)

            if result["status"] == "not_found":
                return self.response_404(
                    message=result.get("message", "Generation run not found")
                )

            return self.response(200, result=result)

        except Exception as e:
            logger.exception("Error checking generation status")
            return self.response_500(message=str(e))

    @expose("/proposals", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.create_proposal",
        log_to_statsd=True,
    )
    def create_proposal(self) -> Response:
        """Create mapping proposal and check if review is needed.
        ---
        post:
          summary: Propose column/metric mappings
          description: >-
            Analyzes the template and database schema to propose mappings.
            If all mappings have high confidence, automatically starts generation.
            If any mappings need review, returns the proposal for user approval.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/MappingProposalPostSchema'
          responses:
            200:
              description: Proposal generated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/MappingProposalResponseSchema'
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            schema = MappingProposalPostSchema()
            data = schema.load(request.json)

            # Validate database report exists
            report = db.session.query(DatabaseSchemaReport).get(
                data["database_report_id"]
            )
            if not report:
                raise DatabaseReportNotFoundError(data["database_report_id"])

            # Validate template dashboard exists
            dashboard = db.session.query(Dashboard).get(data["dashboard_id"])
            if not dashboard:
                raise TemplateDashboardNotFoundError(data["dashboard_id"])

            # Step 1: Analyze template requirements
            template_analyzer = TemplateAnalyzer()
            template_requirements = template_analyzer.analyze(dashboard)

            # Step 2: Generate initial proposal via rule-based matching
            mapping_service = MappingService()
            proposal = mapping_service.propose_mappings(
                template_requirements, report
            )

            # Step 3: ALWAYS refine with LLM (required step, not optional)
            # User review only happens if LLM also fails to find good mappings
            llm_service = DashboardGeneratorLLMService()
            if not llm_service.is_available():
                # LLM is required for this flow - cannot proceed without it
                return self.response_500(
                    message="LLM service is not available. Please configure LLM_API_KEY."
                )

            # LLM refinement - this is where the real mapping intelligence happens
            proposal = llm_service.refine_mappings_with_context(
                template_requirements, report, proposal
            )

            # Step 4: Check if review is needed (ONLY after LLM has tried)
            # Review is required only when LLM couldn't find good mappings
            if not proposal.requires_review:
                # Auto-start generation
                result = kickstart_generation(
                    database_report_id=data["database_report_id"],
                    template_dashboard_id=data["dashboard_id"],
                )
                return self.response(
                    200,
                    result={
                        "requires_review": False,
                        "run_id": result["run_id"],
                        "message": "High confidence mappings - generation started automatically",
                    },
                )

            # Cache proposal for later confirmation
            cache_key = f"{PROPOSAL_CACHE_PREFIX}{proposal.proposal_id}"
            cache_manager.cache.set(
                cache_key,
                {
                    "proposal": proposal.to_dict(),
                    "database_report_id": data["database_report_id"],
                    "dashboard_id": data["dashboard_id"],
                },
                timeout=PROPOSAL_CACHE_TIMEOUT,
            )

            # Return proposal for review
            return self.response(
                200,
                result={
                    "requires_review": True,
                    "proposal_id": proposal.proposal_id,
                    "column_mappings": [
                        {
                            "template_column": m.template_column,
                            "user_column": m.user_column,
                            "user_table": m.user_table,
                            "confidence": m.confidence,
                            "confidence_level": m.confidence_level.value,
                            "match_reasons": m.match_reasons,
                            "alternatives": m.alternatives,
                        }
                        for m in proposal.column_mappings
                    ],
                    "metric_mappings": [
                        {
                            "template_metric": m.template_metric,
                            "user_expression": m.user_expression,
                            "confidence": m.confidence,
                            "confidence_level": m.confidence_level.value,
                            "match_reasons": m.match_reasons,
                            "alternatives": m.alternatives,
                        }
                        for m in proposal.metric_mappings
                    ],
                    "unmapped_columns": proposal.unmapped_columns,
                    "unmapped_metrics": proposal.unmapped_metrics,
                    "review_reasons": proposal.review_reasons,
                    "overall_confidence": proposal.overall_confidence,
                },
            )

        except ValidationError as error:
            return self.response_400(message=str(error.messages))
        except DatabaseReportNotFoundError as e:
            return self.response_404(message=str(e))
        except TemplateDashboardNotFoundError as e:
            return self.response_404(message=str(e))
        except Exception as e:
            logger.exception("Error generating mapping proposal")
            return self.response_500(message=str(e))
