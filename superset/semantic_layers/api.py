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

from flask import request, Response
from flask_appbuilder.api import expose, protect
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset import event_logger
from superset.commands.semantic_layer.exceptions import (
    SemanticViewForbiddenError,
    SemanticViewInvalidError,
    SemanticViewNotFoundError,
    SemanticViewUpdateFailedError,
)
from superset.commands.semantic_layer.update import UpdateSemanticViewCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.semantic_layers.models import SemanticView
from superset.semantic_layers.schemas import SemanticViewPutSchema
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    requires_json,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


class SemanticViewRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(SemanticView)

    resource_name = "semantic_view"
    allow_browser_login = True
    class_permission_name = "SemanticView"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = {"put"}

    edit_model_schema = SemanticViewPutSchema()

    @expose("/<pk>", methods=("PUT",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, pk: int) -> Response:
        """Update a semantic view.
        ---
        put:
          summary: Update a semantic view
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Semantic view schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Semantic view changed
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
            changed_model = UpdateSemanticViewCommand(pk, item).run()
            response = self.response(200, id=changed_model.id, result=item)
        except SemanticViewNotFoundError:
            response = self.response_404()
        except SemanticViewForbiddenError:
            response = self.response_403()
        except SemanticViewInvalidError as ex:
            response = self.response_422(message=ex.normalized_messages())
        except SemanticViewUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            response = self.response_422(message=str(ex))
        return response
