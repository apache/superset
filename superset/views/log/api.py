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
from typing import Any, Optional

from flask import current_app as app
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.hooks import before_request
from flask_appbuilder.models.sqla.interface import SQLAInterface

import superset.models.core as models
from superset import event_logger, security_manager
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.daos.log import LogDAO
from superset.exceptions import SupersetSecurityException
from superset.superset_typing import FlaskResponse
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics
from superset.views.log import LogMixin
from superset.views.log.schemas import (
    get_recent_activity_schema,
    openapi_spec_methods_override,
    RecentActivityResponseSchema,
    RecentActivitySchema,
)


class LogRestApi(LogMixin, BaseSupersetModelRestApi):
    datamodel = SQLAInterface(models.Log)
    include_route_methods = {"get_list", "get", "post", "recent_activity"}
    class_permission_name = "Log"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    resource_name = "log"
    allow_browser_login = True
    list_columns = [
        "user.username",
        "action",
        "dttm",
        "json",
        "slice_id",
        "dashboard_id",
        "user_id",
        "duration_ms",
        "referrer",
    ]
    show_columns = list_columns
    page_size = 20
    apispec_parameter_schemas = {
        "get_recent_activity_schema": get_recent_activity_schema,
    }
    openapi_spec_component_schemas = (
        RecentActivityResponseSchema,
        RecentActivitySchema,
    )

    openapi_spec_methods = openapi_spec_methods_override
    """ Overrides GET methods OpenApi descriptions """

    @staticmethod
    def is_enabled() -> bool:
        return app.config["FAB_ADD_SECURITY_VIEWS"] and app.config["SUPERSET_LOG_VIEW"]

    @before_request(only=["get_list", "get", "post"])
    def ensure_enabled(self) -> None:
        if not self.is_enabled():
            return self.response_404()
        return None

    def get_user_activity_access_error(self, user_id: int) -> Optional[FlaskResponse]:
        try:
            security_manager.raise_for_user_activity_access(user_id)
        except SupersetSecurityException as ex:
            return self.response(403, message=ex.message)
        return None

    @expose("/recent_activity/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_recent_activity_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".recent_activity",
        log_to_statsd=False,
    )
    def recent_activity(self, **kwargs: Any) -> FlaskResponse:
        """Get recent activity data for a user.
        ---
        get:
          summary: Get recent activity data for a user
          parameters:
          - in: path
            schema:
              type: integer
            name: user_id
            description: The id of the user
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_recent_activity_schema'
          responses:
            200:
              description: A List of recent activity objects
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/RecentActivityResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        args = kwargs["rison"]
        page, page_size = self._sanitize_page_args(*self._handle_page_args(args))
        actions = args.get("actions", ["mount_explorer", "mount_dashboard"])
        distinct = args.get("distinct", True)

        payload = LogDAO.get_recent_activity(actions, distinct, page, page_size)

        return self.response(200, result=payload)
