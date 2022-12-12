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

from flask import request, Response
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.filters import FilterStartsWith
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError

from superset import app
from superset.connectors.sqla.models import RowLevelSecurityFilter
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.dao.exceptions import DAOCreateFailedError
from superset.extensions import event_logger
from superset.row_level_security.commands.bulk_delete import BulkDeleteRLSRuleCommand
from superset.row_level_security.commands.create import CreateRLSRuleCommand
from superset.row_level_security.commands.exceptions import RLSRuleNotFoundError
from superset.row_level_security.commands.update import UpdateRLSRuleCommand
from superset.row_level_security.schemas import (
    get_delete_ids_schema,
    RLSListSchema,
    RLSPostSchema,
    RLSPutSchema,
    RLSShowSchema,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    requires_form_data,
    requires_json,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


class RLSRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(RowLevelSecurityFilter)
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
        "bulk_delete",
    }
    resource_name = "rowlevelsecurity"
    class_permission_name = "Row Level Security"
    openapi_spec_tag = "Row Level Security"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True

    list_columns = [
        "id",
        "name",
        "filter_type",
        "tables.id",
        "tables.table_name",
        "roles.id",
        "roles.name",
        "clause",
        "changed_on_delta_humanized",
        "group_key",
    ]
    order_columns = ["name", "filter_type", "clause", "modified"]
    add_columns = [
        "name",
        "description",
        "filter_type",
        "tables",
        "roles",
        "group_key",
        "clause",
    ]
    show_columns = [
        "name",
        "description",
        "filter_type",
        "tables.id",
        "tables.table_name",
        "roles.id",
        "roles.name",
        "group_key",
        "clause",
    ]
    search_columns = (
        "name",
        "description",
        "filter_type",
        "tables",
        "roles",
        "group_key",
        "clause",
    )
    edit_columns = add_columns

    show_model_schema = RLSShowSchema()
    list_model_schema = RLSListSchema()
    add_model_schema = RLSPostSchema()
    edit_model_schema = RLSPutSchema()

    allowed_rel_fields = {"tables", "roles"}
    filter_rel_fields = app.config["RLS_FILTER_RELATED_FIELDS"]

    @expose("/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        """Creates a new RLS rule
        ---
        post:
          description: >-
            Create a new RLS Rule
          requestBody:
            description: RLS schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Report schedule added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
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
            item = self.add_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            new_model = CreateRLSRuleCommand(item).run()
            return self.response(201, id=new_model.id, result=item)
        except DAOCreateFailedError as ex:
            logger.error(
                "Error creating RLS rule %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, pk: int) -> Response:
        """Creates a new RLS rule
        ---
        post:
          description: >-
            Create a new RLS Rule
          requestBody:
            description: RLS schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Report schedule added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
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
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            new_model = UpdateRLSRuleCommand(pk, item).run()
            return self.response(201, id=new_model.id, result=item)
        except DAOCreateFailedError as ex:
            logger.error(
                "Error creating RLS rule %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except RLSRuleNotFoundError as ex:
            return self.response_404()

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Delete bulk Report Schedule layers
        ---
        delete:
          description: >-
            Deletes multiple report schedules in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Report Schedule bulk delete
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
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            BulkDeleteRLSRuleCommand(item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d report schedule",
                    "Deleted %(num)d report schedules",
                    num=len(item_ids),
                ),
            )
        except RLSRuleNotFoundError:
            return self.response_404()
