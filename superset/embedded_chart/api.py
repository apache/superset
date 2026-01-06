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

from flask import g, Response
from flask_appbuilder.api import expose, safe

from superset.daos.key_value import KeyValueDAO
from superset.embedded_chart.exceptions import (
    EmbeddedChartAccessDeniedError,
    EmbeddedChartPermalinkNotFoundError,
)
from superset.explore.permalink.schemas import ExplorePermalinkSchema
from superset.extensions import event_logger
from superset.key_value.shared_entries import get_permalink_salt
from superset.key_value.types import (
    KeyValueResource,
    MarshmallowKeyValueCodec,
    SharedKey,
)
from superset.key_value.utils import decode_permalink_id
from superset.security.guest_token import GuestTokenResourceType, GuestUser
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
