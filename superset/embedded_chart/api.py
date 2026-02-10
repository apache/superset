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
from datetime import datetime, timedelta, timezone
from typing import Any

from flask import g, request, Response
from flask_appbuilder.api import expose, protect, safe

from superset.commands.explore.permalink.create import CreateExplorePermalinkCommand
from superset.daos.key_value import KeyValueDAO
from superset.embedded_chart.exceptions import (
    EmbeddedChartAccessDeniedError,
    EmbeddedChartPermalinkNotFoundError,
)
from superset.explore.permalink.schemas import ExplorePermalinkSchema
from superset.extensions import event_logger, security_manager
from superset.key_value.shared_entries import get_permalink_salt
from superset.key_value.types import (
    KeyValueResource,
    MarshmallowKeyValueCodec,
    SharedKey,
)
from superset.key_value.utils import decode_permalink_id
from superset.security.guest_token import (
    GuestTokenResource,
    GuestTokenResourceType,
    GuestTokenRlsRule,
    GuestTokenUser,
    GuestUser,
)
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)


class EmbeddedChartRestApi(BaseSupersetApi):
    """REST API for embedded chart data retrieval."""

    resource_name = "embedded_chart"
    allow_browser_login = True
    openapi_spec_tag = "Embedded Chart"

    def _validate_guest_token_access(self, permalink_key: str) -> bool:
        """
        Validate that the guest token grants access to this permalink.

        Guest tokens contain a list of resources the user can access.
        For embedded charts, we check that the permalink_key is in that list.
        """
        user = g.user
        if not isinstance(user, GuestUser):
            return False

        for resource in user.resources:
            if (
                resource.get("type") == GuestTokenResourceType.CHART_PERMALINK.value
                and str(resource.get("id")) == permalink_key
            ):
                return True
        return False

    def _get_permalink_value(self, permalink_key: str) -> dict[str, Any] | None:
        """
        Get permalink value without access checks.

        For embedded charts, access is controlled via guest token validation,
        so we skip the normal dataset/chart access checks.
        """
        # Use the same salt, resource, and codec as the explore permalink command
        salt = get_permalink_salt(SharedKey.EXPLORE_PERMALINK_SALT)
        codec = MarshmallowKeyValueCodec(ExplorePermalinkSchema())
        key = decode_permalink_id(permalink_key, salt=salt)
        return KeyValueDAO.get_value(
            KeyValueResource.EXPLORE_PERMALINK,
            key,
            codec,
        )

    @expose("/<permalink_key>", methods=("GET",))
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def get(self, permalink_key: str) -> Response:
        """Get chart form_data from permalink key.
        ---
        get:
          summary: Get embedded chart configuration
          description: >-
            Retrieves the form_data for rendering an embedded chart.
            This endpoint is used by the embedded chart iframe to load
            the chart configuration.
          parameters:
          - in: path
            schema:
              type: string
            name: permalink_key
            description: The chart permalink key
            required: true
          responses:
            200:
              description: Chart permalink state
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      state:
                        type: object
                        properties:
                          formData:
                            type: object
                            description: The chart configuration formData
                          allowedDomains:
                            type: array
                            items:
                              type: string
                            description: Domains allowed to embed this chart
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            # Validate guest token grants access to this permalink
            if not self._validate_guest_token_access(permalink_key):
                raise EmbeddedChartAccessDeniedError()

            # Get permalink value without access checks (guest token already validated)
            permalink_value = self._get_permalink_value(permalink_key)
            if not permalink_value:
                raise EmbeddedChartPermalinkNotFoundError()

            # Return state in the format expected by the frontend:
            # { state: { formData: {...}, allowedDomains: [...] } }
            state = permalink_value.get("state", {})

            return self.response(
                200,
                state=state,
            )
        except EmbeddedChartAccessDeniedError:
            return self.response_401()
        except EmbeddedChartPermalinkNotFoundError:
            return self.response_404()
        except Exception:
            logger.exception("Error fetching embedded chart")
            return self.response_500()

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        """Create an embeddable chart with guest token.
        ---
        post:
          summary: Create embeddable chart
          description: >-
            Creates an embeddable chart configuration with a guest token.
            The returned iframe_url and guest_token can be used to embed
            the chart in external applications.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  required:
                    - form_data
                  properties:
                    form_data:
                      type: object
                      description: Chart form_data configuration
                    allowed_domains:
                      type: array
                      items:
                        type: string
                      description: Domains allowed to embed this chart
                    ttl_minutes:
                      type: integer
                      default: 60
                      description: Time-to-live for the embed in minutes
          responses:
            200:
              description: Embeddable chart created
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      iframe_url:
                        type: string
                        description: URL to use in iframe src
                      guest_token:
                        type: string
                        description: Guest token for authentication
                      permalink_key:
                        type: string
                        description: Permalink key for the chart
                      expires_at:
                        type: string
                        format: date-time
                        description: When the embed expires
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            body = request.json or {}
            form_data = body.get("form_data", {})
            allowed_domains: list[str] = body.get("allowed_domains", [])
            ttl_minutes: int = body.get("ttl_minutes", 60)

            if not form_data:
                return self.response_400(message="form_data is required")

            # Validate required form_data structure
            if not form_data.get("datasource"):
                return self.response_400(
                    message="form_data must include 'datasource' field"
                )

            # Create permalink with the form_data
            state = {
                "formData": form_data,
                "allowedDomains": allowed_domains,
            }
            permalink_key = CreateExplorePermalinkCommand(state).run()

            # Calculate expiration
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)

            # Generate guest token
            username = g.user.username if hasattr(g, "user") and g.user else "anonymous"
            guest_user: GuestTokenUser = {
                "username": f"embed_{username}",
                "first_name": "Embed",
                "last_name": "User",
            }

            resources: list[GuestTokenResource] = [
                {
                    "type": GuestTokenResourceType.CHART_PERMALINK,
                    "id": permalink_key,
                }
            ]

            rls_rules: list[GuestTokenRlsRule] = []

            guest_token_result = security_manager.create_guest_access_token(
                user=guest_user,
                resources=resources,
                rls=rls_rules,
            )

            # Handle both bytes (older PyJWT) and string (PyJWT 2.0+)
            guest_token = (
                guest_token_result.decode("utf-8")
                if isinstance(guest_token_result, bytes)
                else guest_token_result
            )

            # Build iframe URL using request host
            base_url = request.host_url.rstrip("/")
            iframe_url = f"{base_url}/embedded/chart/?permalink_key={permalink_key}"

            return self.response(
                200,
                iframe_url=iframe_url,
                guest_token=guest_token,
                permalink_key=permalink_key,
                expires_at=expires_at.isoformat(),
            )

        except Exception:
            logger.exception("Error creating embedded chart")
            return self.response_500()
