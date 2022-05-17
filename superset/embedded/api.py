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
from typing import Optional

from flask import Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.hooks import before_request
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset import is_feature_enabled
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.dashboards.schemas import EmbeddedDashboardResponseSchema
from superset.embedded.dao import EmbeddedDAO
from superset.embedded_dashboard.commands.exceptions import (
    EmbeddedDashboardNotFoundError,
)
from superset.extensions import event_logger
from superset.models.embedded_dashboard import EmbeddedDashboard
from superset.reports.logs.schemas import openapi_spec_methods_override
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class EmbeddedDashboardRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(EmbeddedDashboard)

    @before_request
    def ensure_embedded_enabled(self) -> Optional[Response]:
        if not is_feature_enabled("EMBEDDED_SUPERSET"):
            return self.response_404()
        return None

    include_route_methods = RouteMethod.GET
    class_permission_name = "EmbeddedDashboard"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "embedded_dashboard"
    allow_browser_login = True

    openapi_spec_tag = "Embedded Dashboard"
    openapi_spec_methods = openapi_spec_methods_override

    embedded_response_schema = EmbeddedDashboardResponseSchema()

    @expose("/<uuid>", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_embedded",
        log_to_statsd=False,
    )
    # pylint: disable=arguments-differ, arguments-renamed)
    def get(self, uuid: str) -> Response:
        """Response
        Returns the dashboard's embedded configuration
        ---
        get:
          description: >-
            Returns the dashboard's embedded configuration
          parameters:
          - in: path
            schema:
              type: string
            name: uuid
            description: The embedded configuration uuid
          responses:
            200:
              description: Result contains the embedded dashboard configuration
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/EmbeddedDashboardResponseSchema'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            embedded = EmbeddedDAO.find_by_id(uuid)
            if not embedded:
                raise EmbeddedDashboardNotFoundError()
            result = self.embedded_response_schema.dump(embedded)
            return self.response(200, result=result)
        except EmbeddedDashboardNotFoundError:
            return self.response_404()
