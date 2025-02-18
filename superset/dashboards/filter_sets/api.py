# dodo added 44211751
import logging
from typing import Any

from flask import request, Response
from flask_appbuilder.api import (
    expose,
    get_list_schema,
    permission_name,
    protect,
    rison,
    safe,
)
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import Schema, ValidationError

from superset import db
from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.dashboard.filter_set.create import CreateFilterSetCommand
from superset.commands.dashboard.filter_set.delete import DeleteFilterSetCommand
from superset.commands.dashboard.filter_set.exceptions import (
    FilterSetCreateFailedError,
    FilterSetDeleteFailedError,
    FilterSetForbiddenError,
    FilterSetNotFoundError,
    FilterSetUpdateFailedError,
    UserIsNotDashboardOwnerError,
)
from superset.commands.dashboard.filter_set.update import UpdateFilterSetCommand
from superset.commands.exceptions import ObjectNotFoundError
from superset.daos.dashboard import DashboardDAO
from superset.dashboards.filter_sets.consts import (
    DASHBOARD_FIELD,
    DASHBOARD_ID_FIELD,
    DESCRIPTION_FIELD,
    FILTER_SET_API_PERMISSIONS_NAME,
    IS_PRIMARY,
    JSON_METADATA_FIELD,
    NAME_FIELD,
    OWNER_ID_FIELD,
    OWNER_OBJECT_FIELD,
    OWNER_TYPE_FIELD,
    OWNER_USER_ID,
    PARAMS_PROPERTY,
)
from superset.dashboards.filter_sets.filters import FilterSetFilterByUser
from superset.dashboards.filter_sets.schemas import (
    FilterSetPostSchema,
    FilterSetPutSchema,
)
from superset.extensions import event_logger
from superset.models.filter_set import FilterSet
from superset.utils.core import get_user_id
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    requires_json,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


def get_primary_filtersets(dashboard_id: int) -> list[FilterSet] | None:
    if user_id := get_user_id():
        primary_filtersets = (
            db.session.query(FilterSet)
            .filter(FilterSet.user_id == user_id)
            .filter(FilterSet.dashboard_id == dashboard_id)
            .all()
        )
        return primary_filtersets
    return None


def unset_primary_filterset(item: Schema, dashboard_id: int) -> None:
    if item.get(IS_PRIMARY):
        primary_filtersets = get_primary_filtersets(dashboard_id)
        if primary_filtersets:
            for filterset in primary_filtersets:
                query = {"is_primary": False}
                UpdateFilterSetCommand(dashboard_id, filterset.id, query).run()


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
        "id",
        "created_on",
        "changed_on",
        "created_by_fk",
        "changed_by_fk",
        "is_primary",
        OWNER_USER_ID,
        NAME_FIELD,
        DESCRIPTION_FIELD,
        OWNER_TYPE_FIELD,
        OWNER_ID_FIELD,
        DASHBOARD_ID_FIELD,
        PARAMS_PROPERTY,
    ]
    show_columns = [
        "id",
        NAME_FIELD,
        DESCRIPTION_FIELD,
        OWNER_TYPE_FIELD,
        OWNER_ID_FIELD,
        DASHBOARD_ID_FIELD,
        PARAMS_PROPERTY,
    ]
    search_columns = [
        "id",
        NAME_FIELD,
        OWNER_ID_FIELD,
        DASHBOARD_ID_FIELD,
        OWNER_USER_ID,
    ]
    base_filters = [[OWNER_USER_ID, FilterSetFilterByUser, ""]]

    def __init__(self) -> None:
        self.datamodel.get_search_columns_list = lambda: []
        super().__init__()

    def _init_properties(self) -> None:
        super(BaseSupersetModelRestApi, self)._init_properties()

    @expose("/<id_or_slug>/filtersets", methods=("GET",))
    @protect()
    @safe
    @permission_name("get")
    @rison(get_list_schema)
    def get_list(self, id_or_slug: str, **kwargs: Any) -> Response:
        """Get a dashboard's list of filter sets.
        ---
        get:
          summary: Get a dashboard's list of filter sets
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
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
        try:
            dashboard = DashboardDAO.get_by_id_or_slug(id_or_slug)
        except DashboardNotFoundError:
            return self.response(404, message=f"dashboard '{id_or_slug}' not found")
        rison_data = kwargs.setdefault("rison", {})
        rison_data.setdefault("filters", [])
        rison_data["filters"].append(
            {"col": "dashboard_id", "opr": "eq", "value": str(dashboard.id)}
        )
        return self.get_list_headless(**kwargs)

    @expose("/<int:dashboard_id>/filtersets", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @requires_json
    def post(self, dashboard_id: int) -> Response:
        """Create a new dashboard's filter set.
        ---
        post:
          summary: Create a new dashboard's filter set
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
        try:
            item = self.add_model_schema.load(request.json)
            unset_primary_filterset(item, dashboard_id)
            new_model = CreateFilterSetCommand(dashboard_id, item).run()
            return self.response(
                201, **self.show_model_schema.dump(new_model, many=False)
            )
        except ValidationError as error:
            return self.response_400(message=error.messages)
        except UserIsNotDashboardOwnerError:
            return self.response_403()
        except FilterSetCreateFailedError as error:
            return self.response_400(message=error.message)
        except DashboardNotFoundError:
            return self.response_404()

    @expose("/<int:dashboard_id>/filtersets/<int:pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, dashboard_id: int, pk: int) -> Response:
        """Update a dashboard's filter set.
        ---
        put:
          summary: Update a dashboard's filter set
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
        try:
            item = self.edit_model_schema.load(request.json)
            unset_primary_filterset(item, dashboard_id)
            changed_model = UpdateFilterSetCommand(dashboard_id, pk, item).run()
            return self.response(
                200, **self.show_model_schema.dump(changed_model, many=False)
            )
        except ValidationError as error:
            return self.response_400(message=error.messages)
        except (
            ObjectNotFoundError,
            FilterSetForbiddenError,
            FilterSetUpdateFailedError,
        ) as err:
            logger.error(err)
            return self.response(err.status)

    @expose("/<int:dashboard_id>/filtersets/<int:pk>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, dashboard_id: int, pk: int) -> Response:
        """Delete a dashboard's filter set.
        ---
        delete:
          summary: Delete a dashboard's filter set
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
            DeleteFilterSetCommand(dashboard_id, pk).run()
            return self.response(200, id=dashboard_id)
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
