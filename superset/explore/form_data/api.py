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
from abc import ABC

from flask import g, request, Response
from flask_appbuilder.api import BaseApi, expose, protect, safe
from marshmallow import ValidationError

from superset.charts.commands.exceptions import (
    ChartAccessDeniedError,
    ChartNotFoundError,
)
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.datasets.commands.exceptions import (
    DatasetAccessDeniedError,
    DatasetNotFoundError,
)
from superset.explore.form_data.commands.create import CreateFormDataCommand
from superset.explore.form_data.commands.delete import DeleteFormDataCommand
from superset.explore.form_data.commands.get import GetFormDataCommand
from superset.explore.form_data.commands.parameters import CommandParameters
from superset.explore.form_data.commands.update import UpdateFormDataCommand
from superset.explore.form_data.schemas import FormDataPostSchema, FormDataPutSchema
from superset.extensions import event_logger
from superset.temporary_cache.commands.exceptions import TemporaryCacheAccessDeniedError
from superset.views.base_api import requires_json

logger = logging.getLogger(__name__)


class ExploreFormDataRestApi(BaseApi, ABC):
    add_model_schema = FormDataPostSchema()
    edit_model_schema = FormDataPutSchema()
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = {
        RouteMethod.POST,
        RouteMethod.PUT,
        RouteMethod.GET,
        RouteMethod.DELETE,
    }
    allow_browser_login = True
    class_permission_name = "ExploreFormDataRestApi"
    resource_name = "explore"
    openapi_spec_tag = "Explore Form Data"
    openapi_spec_component_schemas = (FormDataPostSchema, FormDataPutSchema)

    @expose("/form_data", methods=["POST"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @requires_json
    def post(self) -> Response:
        """Stores a new form_data.
        ---
        post:
          description: >-
            Stores a new form_data.
          parameters:
          - in: query
            schema:
              type: integer
            name: tab_id
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FormDataPostSchema'
          responses:
            201:
              description: The form_data was stored successfully.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      key:
                        type: string
                        description: The key to retrieve the form_data.
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.add_model_schema.load(request.json)
            tab_id = request.args.get("tab_id")
            args = CommandParameters(
                actor=g.user,
                dataset_id=item["dataset_id"],
                chart_id=item.get("chart_id"),
                tab_id=tab_id,
                form_data=item["form_data"],
            )
            key = CreateFormDataCommand(args).run()
            return self.response(201, key=key)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        except (
            ChartAccessDeniedError,
            DatasetAccessDeniedError,
            TemporaryCacheAccessDeniedError,
        ) as ex:
            return self.response(403, message=str(ex))
        except (ChartNotFoundError, DatasetNotFoundError) as ex:
            return self.response(404, message=str(ex))

    @expose("/form_data/<string:key>", methods=["PUT"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, key: str) -> Response:
        """Updates an existing form_data.
        ---
        put:
          description: >-
            Updates an existing form_data.
          parameters:
          - in: path
            schema:
              type: string
            name: key
          - in: query
            schema:
              type: integer
            name: tab_id
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FormDataPutSchema'
          responses:
            200:
              description: The form_data was stored successfully.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      key:
                        type: string
                        description: The key to retrieve the form_data.
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.edit_model_schema.load(request.json)
            tab_id = request.args.get("tab_id")
            args = CommandParameters(
                actor=g.user,
                dataset_id=item["dataset_id"],
                chart_id=item.get("chart_id"),
                tab_id=tab_id,
                key=key,
                form_data=item["form_data"],
            )
            result = UpdateFormDataCommand(args).run()
            if not result:
                return self.response_404()
            return self.response(200, key=result)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        except (
            ChartAccessDeniedError,
            DatasetAccessDeniedError,
            TemporaryCacheAccessDeniedError,
        ) as ex:
            return self.response(403, message=str(ex))
        except (ChartNotFoundError, DatasetNotFoundError) as ex:
            return self.response(404, message=str(ex))

    @expose("/form_data/<string:key>", methods=["GET"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def get(self, key: str) -> Response:
        """Retrives a form_data.
        ---
        get:
          description: >-
            Retrives a form_data.
          parameters:
          - in: path
            schema:
              type: string
            name: key
          responses:
            200:
              description: Returns the stored form_data.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      form_data:
                        type: string
                        description: The stored form_data
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            args = CommandParameters(actor=g.user, key=key)
            form_data = GetFormDataCommand(args).run()
            if not form_data:
                return self.response_404()
            return self.response(200, form_data=form_data)
        except (
            ChartAccessDeniedError,
            DatasetAccessDeniedError,
            TemporaryCacheAccessDeniedError,
        ) as ex:
            return self.response(403, message=str(ex))
        except (ChartNotFoundError, DatasetNotFoundError) as ex:
            return self.response(404, message=str(ex))

    @expose("/form_data/<string:key>", methods=["DELETE"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, key: str) -> Response:
        """Deletes a form_data.
        ---
        delete:
          description: >-
            Deletes a form_data.
          parameters:
          - in: path
            schema:
              type: string
            name: key
            description: The form_data key.
          responses:
            200:
              description: Deleted the stored form_data.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
                        description: The result of the operation
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            args = CommandParameters(actor=g.user, key=key)
            result = DeleteFormDataCommand(args).run()
            if not result:
                return self.response_404()
            return self.response(200, message="Deleted successfully")
        except (
            ChartAccessDeniedError,
            DatasetAccessDeniedError,
            TemporaryCacheAccessDeniedError,
        ) as ex:
            return self.response(403, message=str(ex))
        except (ChartNotFoundError, DatasetNotFoundError) as ex:
            return self.response(404, message=str(ex))
