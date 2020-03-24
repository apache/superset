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

from flask import g, request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.charts.commands.create import CreateChartCommand
from superset.charts.commands.delete import DeleteChartCommand
from superset.charts.commands.exceptions import (
    ChartCreateFailedError,
    ChartDeleteFailedError,
    ChartForbiddenError,
    ChartInvalidError,
    ChartNotFoundError,
    ChartUpdateFailedError,
)
from superset.charts.commands.update import UpdateChartCommand
from superset.charts.filters import ChartFilter
from superset.charts.schemas import ChartPostSchema, ChartPutSchema
from superset.models.slice import Slice
from superset.views.base_api import BaseSupersetModelRestApi

logger = logging.getLogger(__name__)


class ChartRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Slice)

    resource_name = "chart"
    allow_browser_login = True

    class_permission_name = "SliceModelView"
    show_columns = [
        "slice_name",
        "description",
        "owners.id",
        "owners.username",
        "dashboards.id",
        "dashboards.dashboard_title",
        "viz_type",
        "params",
        "cache_timeout",
    ]
    list_columns = [
        "id",
        "slice_name",
        "url",
        "description",
        "changed_by.username",
        "changed_by_name",
        "changed_by_url",
        "changed_on",
        "datasource_name_text",
        "datasource_url",
        "viz_type",
        "params",
        "cache_timeout",
    ]
    order_columns = [
        "slice_name",
        "viz_type",
        "datasource_name",
        "changed_by_fk",
        "changed_on",
    ]
    search_columns = (
        "slice_name",
        "description",
        "viz_type",
        "datasource_name",
        "owners",
    )
    base_order = ("changed_on", "desc")
    base_filters = [["id", ChartFilter, lambda: []]]

    # Will just affect _info endpoint
    edit_columns = ["slice_name"]
    add_columns = edit_columns

    add_model_schema = ChartPostSchema()
    edit_model_schema = ChartPutSchema()

    openapi_spec_tag = "Charts"

    order_rel_fields = {
        "slices": ("slice_name", "asc"),
        "owners": ("first_name", "asc"),
    }
    filter_rel_fields_field = {"owners": "first_name"}
    allowed_rel_fields = {"owners"}

    @expose("/", methods=["POST"])
    @protect()
    @safe
    def post(self) -> Response:
        """Creates a new Chart
        ---
        post:
          description: >-
            Create a new Chart
          requestBody:
            description: Chart schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Chart added
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
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        if item.errors:
            return self.response_400(message=item.errors)
        try:
            new_model = CreateChartCommand(g.user, item.data).run()
            return self.response(201, id=new_model.id, result=item.data)
        except ChartInvalidError as e:
            return self.response_422(message=e.normalized_messages())
        except ChartCreateFailedError as e:
            logger.error(f"Error creating model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    def put(  # pylint: disable=too-many-return-statements, arguments-differ
        self, pk: int
    ) -> Response:
        """Changes a Chart
        ---
        put:
          description: >-
            Changes a Chart
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Chart schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Chart changed
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
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        item = self.edit_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        if item.errors:
            return self.response_400(message=item.errors)
        try:
            changed_model = UpdateChartCommand(g.user, pk, item.data).run()
            return self.response(200, id=changed_model.id, result=item.data)
        except ChartNotFoundError:
            return self.response_404()
        except ChartForbiddenError:
            return self.response_403()
        except ChartInvalidError as e:
            return self.response_422(message=e.normalized_messages())
        except ChartUpdateFailedError as e:
            logger.error(f"Error updating model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @safe
    def delete(self, pk: int) -> Response:  # pylint: disable=arguments-differ
        """Deletes a Chart
        ---
        delete:
          description: >-
            Deletes a Chart
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Chart delete
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
        try:
            DeleteChartCommand(g.user, pk).run()
            return self.response(200, message="OK")
        except ChartNotFoundError:
            return self.response_404()
        except ChartForbiddenError:
            return self.response_403()
        except ChartDeleteFailedError as e:
            logger.error(f"Error deleting model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))
