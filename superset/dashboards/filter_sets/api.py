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
from typing import Any, cast

from flask import g, request, Response
from flask_appbuilder.api import (
    expose,
    get_list_schema,
    permission_name,
    protect,
    rison,
    safe,
)
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset.commands.exceptions import ObjectNotFoundError
from superset.dashboards.commands.exceptions import DashboardNotFoundError
from superset.dashboards.dao import DashboardDAO
from superset.dashboards.filter_sets.commands.create import CreateFilterSetCommand
from superset.dashboards.filter_sets.commands.delete import DeleteFilterSetCommand
from superset.dashboards.filter_sets.commands.exceptions import (
    FilterSetCreateFailedError,
    FilterSetDeleteFailedError,
    FilterSetForbiddenError,
    FilterSetNotFoundError,
    FilterSetUpdateFailedError,
    UserIsNotDashboardOwnerError,
)
from superset.dashboards.filter_sets.commands.update import UpdateFilterSetCommand
from superset.dashboards.filter_sets.consts import (
    DASHBOARD_FIELD,
    DASHBOARD_ID_FIELD,
    DESCRIPTION_FIELD,
    FILTER_SET_API_PERMISSIONS_NAME,
    JSON_METADATA_FIELD,
    NAME_FIELD,
    OWNER_ID_FIELD,
    OWNER_OBJECT_FIELD,
    OWNER_TYPE_FIELD,
    PARAMS_PROPERTY,
)
from superset.dashboards.filter_sets.filters import FilterSetFilter
from superset.dashboards.filter_sets.schemas import (
    FilterSetPostSchema,
    FilterSetPutSchema,
)
from superset.extensions import event_logger
from superset.models.filter_set import FilterSet
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class FilterSetRestApi(BaseSupersetModelRestApi):
    # pylint: disable=arguments-differ
    include_route_methods = {"get_list", "put", "post", "delete"}
    datamodel = SQLAInterface(FilterSet)
    resource_name = "dashboard"
    class_permission_name = FILTER_SET_API_PERMISSIONS_NAME
    allow_browser_login = True
    csrf_exempt = False
    add_exclude_columns = [
        "id",
        OWNER_OBJECT_FIELD,
        DASHBOARD_FIELD,
        JSON_METADATA_FIELD,
    ]
    add_model_schema = FilterSetPostSchema()
    edit_model_schema = FilterSetPutSchema()
    edit_exclude_columns = [
        "id",
        OWNER_OBJECT_FIELD,
        DASHBOARD_FIELD,
        JSON_METADATA_FIELD,
    ]
    list_columns = [
        "created_on",
        "changed_on",
        "created_by_fk",
        "changed_by_fk",
        NAME_FIELD,
        DESCRIPTION_FIELD,
        OWNER_TYPE_FIELD,
        OWNER_ID_FIELD,
        DASHBOARD_ID_FIELD,
        PARAMS_PROPERTY,
    ]
    show_exclude_columns = [OWNER_OBJECT_FIELD, DASHBOARD_FIELD, JSON_METADATA_FIELD]
    search_columns = ["id", NAME_FIELD, OWNER_ID_FIELD, DASHBOARD_ID_FIELD]
    base_filters = [[OWNER_ID_FIELD, FilterSetFilter, ""]]

    def __init__(self) -> None:
        self.datamodel.get_search_columns_list = lambda: []
        super().__init__()

    def _init_properties(self) -> None:
        # pylint: disable=bad-super-call
        super(BaseSupersetModelRestApi, self)._init_properties()

    @expose("/<int:dashboard_id>/filtersets", methods=["GET"])
    @protect()
    @safe
    @permission_name("get")
    @rison(get_list_schema)
    def get_list(self, dashboard_id: int, **kwargs: Any) -> Response:
        """
            Gets a dashboard's Filter sets
         ---
        get:
          description: >-
            Get a dashboard's list of filter sets
          parameters:
          - in: path
            schema:
              type: integer
            name: dashboard_id
            description: The id of the dashboard
          responses:
            200:
              description: FilterSets
              content:
                application/json:
                  schema:
                    type: array
                    items:
                      type: object
                      properties:
                        name:
                          description: Name of the Filter set
                          type: string
                        json_metadata:
                          description: metadata of the filter set
                          type: string
                        description:
                          description: A description field of the filter set
                          type: string
                        owner_id:
                          description: A description field of the filter set
                          type: integer
                        owner_type:
                          description: the Type of the owner ( Dashboard/User)
                          type: integer
                        parameters:
                          description: JSON schema defining the needed parameters
            302:
              description: Redirects to the current digest
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        if not DashboardDAO.find_by_id(cast(int, dashboard_id)):
            return self.response(404, message="dashboard '%s' not found" % dashboard_id)
        rison_data = kwargs.setdefault("rison", {})
        rison_data.setdefault("filters", [])
        rison_data["filters"].append(
            {"col": "dashboard_id", "opr": "eq", "value": str(dashboard_id)}
        )
        return self.get_list_headless(**kwargs)

    @expose("/<int:dashboard_id>/filtersets", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self, dashboard_id: int) -> Response:
        """
            Creates a new Dashboard's Filter Set
        ---
        post:
          description: >-
            Create a new Dashboard's Filter Set.
          parameters:
          - in: path
            schema:
              type: integer
            name: dashboard_id
            description: The id of the dashboard
          requestBody:
            description: Filter set schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Filter set added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
            302:
              description: Redirects to the current digest
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.add_model_schema.load(request.json)
            new_model = CreateFilterSetCommand(g.user, dashboard_id, item).run()
            return self.response(201, id=new_model.id, result=item)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        except UserIsNotDashboardOwnerError:
            return self.response_403()
        except FilterSetCreateFailedError as error:
            return self.response_400(message=error.message)
        except DashboardNotFoundError:
            return self.response_404()

    @expose("/<int:dashboard_id>/filtersets/<int:pk>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, dashboard_id: int, pk: int) -> Response:
        """Changes a Dashboard's Filter set
        ---
        put:
          description: >-
            Changes a Dashboard's Filter set.
          parameters:
          - in: path
            schema:
              type: integer
            name: dashboard_id
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Filter set schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Filter set changed
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
        try:
            item = self.edit_model_schema.load(request.json)
            changed_model = UpdateFilterSetCommand(g.user, dashboard_id, pk, item).run()
            return self.response(200, id=changed_model.id, result=item)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        except (
            ObjectNotFoundError,
            FilterSetForbiddenError,
            FilterSetUpdateFailedError,
        ) as err:
            logger.error(err)
            return self.response(err.status)

    @expose("/<int:dashboard_id>/filtersets/<int:pk>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, dashboard_id: int, pk: int) -> Response:
        """
            Deletes a Dashboard's FilterSet
        ---
        delete:
          description: >-
            Deletes a Dashboard.
          parameters:
          - in: path
            schema:
              type: integer
            name: dashboard_id
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Filter set deleted
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
            changed_model = DeleteFilterSetCommand(g.user, dashboard_id, pk).run()
            return self.response(200, id=changed_model.id)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        except FilterSetNotFoundError:
            return self.response(200)
        except (
            ObjectNotFoundError,
            FilterSetForbiddenError,
            FilterSetDeleteFailedError,
        ) as err:
            logger.error(err)
            return self.response(err.status)
