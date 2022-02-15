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
from typing import Any

from flask import current_app as app
from flask.wrappers import Response
from flask_appbuilder.api import BaseApi, expose, permission_name, protect, rison, safe
from flask_babel import lazy_gettext as _

from superset.business_type.business_type_response import BusinessTypeResponse
from superset.business_type.schemas import business_type_convert_schema
from superset.extensions import event_logger

config = app.config
BUSINESS_TYPE_ADDONS = config["BUSINESS_TYPE_ADDONS"]


class BusinessTypeRestApi(BaseApi):
    """
    Business Type Rest API
    -Will return available business types when the /types endpoint is accessed
    -Will return a BusinessTypeResponse object when the /convert endpoint is accessed
    and is passed in valid arguments
    """

    allow_browser_login = True
    include_route_methods = {"get", "get_types"}
    resource_name = "business_type"

    openapi_spec_tag = "Business Type"
    apispec_parameter_schemas = {
        "business_type_convert_schema": business_type_convert_schema,
    }

    @protect()
    @safe
    @expose("/convert", methods=["GET"])
    @permission_name("get")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,  # pylint: disable-arguments-renamed
    )
    @rison()
    def get(self, **kwargs: Any) -> Response:
        """Returns a BusinessTypeResponse object populated with the passed in args
        ---
        get:
          description: >-
            Returns a BusinessTypeResponse object populated with the passed in args.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/business_type_convert_schema'
          responses:
            200:
              description: >-
                BusinessTypeResponse object has been returned.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
                      values:
                        type: array
                      formatted_value:
                        type: string
                      error_message:
                        type: string
                      valid_filter_operators:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        items = kwargs["rison"]
        business_type = items.get("type")
        if not business_type:
            return self.response(400, message=_("Missing business type in request"))
        values = items["values"]
        if not values:
            return self.response(400, message=_("Missing values in request"))
        addon = BUSINESS_TYPE_ADDONS.get(business_type)
        if not addon:
            return self.response(
                400,
                message=_(
                    "Invalid business type: %(business_type)s",
                    business_type=business_type,
                ),
            )
        bus_resp: BusinessTypeResponse = addon.translate_type(
            {"values": values,}
        )
        return self.response(200, result=bus_resp)

    @protect()
    @safe
    @expose("/types", methods=["GET"])
    @permission_name("get")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,  # pylint: disable-arguments-renamed
    )
    def get_types(self) -> Response:
        """Returns a list of available business types
        ---
        get:
          description: >-
            Returns a list of available business types.
          responses:
            200:
              description: >-
                a successful return of the available
                business types has taken place.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """

        return self.response(200, result=list(BUSINESS_TYPE_ADDONS.keys()))
