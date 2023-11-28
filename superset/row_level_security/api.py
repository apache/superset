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
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError

from superset.commands.exceptions import (
    DatasourceNotFoundValidationError,
    RolesNotFoundValidationError,
)
from superset.commands.security.create import CreateRLSRuleCommand
from superset.commands.security.delete import DeleteRLSRuleCommand
from superset.commands.security.exceptions import RLSRuleNotFoundError
from superset.commands.security.update import UpdateRLSRuleCommand
from superset.connectors.sqla.models import RowLevelSecurityFilter
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.exceptions import DAOCreateFailedError, DAOUpdateFailedError
from superset.extensions import event_logger
from superset.row_level_security.schemas import (
    get_delete_ids_schema,
    openapi_spec_methods_override,
    RLSListSchema,
    RLSPostSchema,
    RLSPutSchema,
    RLSShowSchema,
)
from superset.views.base import DatasourceFilter
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    requires_json,
    statsd_metrics,
)
from superset.views.filters import BaseFilterRelatedRoles

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
    order_columns = [
        "name",
        "filter_type",
        "clause",
        "changed_on_delta_humanized",
        "group_key",
    ]
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
        "tables.schema",
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
    base_related_field_filters = {
        "tables": [["id", DatasourceFilter, lambda: []]],
        "roles": [["id", BaseFilterRelatedRoles, lambda: []]],
    }

    openapi_spec_methods = openapi_spec_methods_override
    """ Overrides GET methods OpenApi descriptions """

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        """Create a new RLS rule.
        ---
        post:
          summary: Create a new RLS rule
          requestBody:
            description: RLS schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: RLS Rule added
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
        except RolesNotFoundValidationError as ex:
            logger.error(
                "Role not found while creating RLS rule %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except DatasourceNotFoundValidationError as ex:
            logger.error(
                "Table not found while creating RLS rule %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except DAOCreateFailedError as ex:
            logger.error(
                "Error creating RLS rule %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, pk: int) -> Response:
        """Update an RLS rule.
        ---
        put:
          summary: Update an RLS rule
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The Rule pk
          requestBody:
            description: RLS schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Rule changed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
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
        except RolesNotFoundValidationError as ex:
            logger.error(
                "Role not found while updating RLS rule %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except DatasourceNotFoundValidationError as ex:
            logger.error(
                "Table not found while updating RLS rule %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except DAOUpdateFailedError as ex:
            logger.error(
                "Error updating RLS rule %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except RLSRuleNotFoundError as ex:
            return self.response_404()

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Bulk delete RLS rules.
        ---
        delete:
          summary: Bulk delete RLS rules
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: RLS Rule bulk delete
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
            DeleteRLSRuleCommand(item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d rules",
                    "Deleted %(num)d rules",
                    num=len(item_ids),
                ),
            )
        except RLSRuleNotFoundError:
            return self.response_404()
