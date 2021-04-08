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
from flask import Response, request, g
from flask_appbuilder.api import expose, protect, safe, rison, permission_name, merge_response_func, \
    get_list_schema, API_ORDER_COLUMNS_RIS_KEY, API_LABEL_COLUMNS_RIS_KEY, \
    API_DESCRIPTION_COLUMNS_RIS_KEY, API_LIST_COLUMNS_RIS_KEY, API_LIST_TITLE_RIS_KEY, ModelRestApi
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError
from superset import is_feature_enabled
from superset.commands.exceptions import ObjectNotFoundError
from superset.dashboards.commands.exceptions import DashboardNotFoundError
from superset.dashboards.filter_sets.commands.exceptions import FilterSetForbiddenError, FilterSetUpdateFailedError, FilterSetDeleteFailedError, FilterSetCreateFailedError
from superset.dashboards.filter_sets.commands.create import CreateFilterSetCommand
from superset.dashboards.filter_sets.commands.update import UpdateFilterSetCommand
from superset.dashboards.filter_sets.filters import FilterSetFilter
from superset.dashboards.filter_sets.schemas import FilterSetPostSchema, FilterSetPutSchema
from superset.extensions import event_logger
from superset.models.filter_set import FilterSet
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics
from superset.dashboards.dao import DashboardDAO
from superset.dashboards.filter_sets.consts import OWNER_OBJECT_FIELD, DASHBOARD_FIELD, \
    FILTER_SET_API_PERMISSIONS_NAME, NAME_FIELD, DESCRIPTION_FIELD, OWNER_TYPE_FIELD, OWNER_ID_FIELD, DASHBOARD_ID_FIELD, JSON_METADATA_FIELD

logger = logging.getLogger(__name__)


class FilterSetRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(FilterSet)
    resource_name = "dashboard"
    class_permission_name = FILTER_SET_API_PERMISSIONS_NAME
    allow_browser_login = True
    csrf_exempt = True
    add_exclude_columns = ['id', OWNER_OBJECT_FIELD, DASHBOARD_FIELD]
    add_model_schema = FilterSetPostSchema()
    edit_model_schema = FilterSetPutSchema()
    edit_exclude_columns = ['id', OWNER_OBJECT_FIELD, DASHBOARD_FIELD]
    list_columns = ['created_on', 'changed_on', 'created_by_fk', 'changed_by_fk', NAME_FIELD,
                    DESCRIPTION_FIELD, OWNER_TYPE_FIELD, OWNER_ID_FIELD, DASHBOARD_ID_FIELD, JSON_METADATA_FIELD]
    show_exclude_columns = [OWNER_OBJECT_FIELD, DASHBOARD_FIELD]
    search_columns = ['id', NAME_FIELD, OWNER_ID_FIELD, DASHBOARD_ID_FIELD]
    base_filters = [[OWNER_ID_FIELD, FilterSetFilter, '']]

    def __init__(self) -> None:
        self.datamodel.get_search_columns_list = lambda: []
        if is_feature_enabled("THUMBNAILS"):
            self.include_route_methods = self.include_route_methods | {"thumbnail"}
        super().__init__()

    def _init_properties(self) -> None:
        super(BaseSupersetModelRestApi, self)._init_properties()

    @expose("/<dashboard_id>/filtersets", methods=["GET"])
    @protect()
    @safe
    @permission_name("get")
    @rison(get_list_schema)
    @merge_response_func(ModelRestApi.merge_order_columns, API_ORDER_COLUMNS_RIS_KEY)
    @merge_response_func(ModelRestApi.merge_list_label_columns, API_LABEL_COLUMNS_RIS_KEY)
    @merge_response_func(ModelRestApi.merge_description_columns, API_DESCRIPTION_COLUMNS_RIS_KEY)
    @merge_response_func(ModelRestApi.merge_list_columns, API_LIST_COLUMNS_RIS_KEY)
    @merge_response_func(ModelRestApi.merge_list_title, API_LIST_TITLE_RIS_KEY)
    def get_list(self, dashboard_id: int, **kwargs) -> Response:
        if not DashboardDAO.find_by_id(dashboard_id):
            return self.response(404, message="dashboard '%s' not found" % dashboard_id)
        rison_data = kwargs.setdefault('rison', {})
        rison_data.setdefault('filters', [])
        rison_data['filters'].append({'col': 'dashboard_id', 'opr': 'eq', 'value': str(dashboard_id)})
        return self.get_list_headless(**kwargs)

    @expose("/<dashboard_id>/filtersets", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self, dashboard_id: int) -> Response:
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.add_model_schema.load(request.json)
            new_model = CreateFilterSetCommand(g.user, dashboard_id, item).run()
            return self.response(201, id=new_model.id, result=item)
        except (ValidationError, FilterSetCreateFailedError) as error:
            return self.response_400(message=error.message)
        except DashboardNotFoundError:
            return self.response_404()

    @expose("/<dashboard_id>/filtersets/<pk>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, dashboard_id: int, pk: int) -> Response:
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.edit_model_schema.load(request.json)
            changed_model = UpdateFilterSetCommand(g.user, dashboard_id, pk, item).run()
            return self.response(200, id=changed_model.id, result=item)
        except ValidationError as error:
            return self.response_400(message=error.message)
        except (ObjectNotFoundError, FilterSetForbiddenError, FilterSetUpdateFailedError) as e:
            logger.error(e)
            return self.response(e.status)


    @expose("/<dashboard_id>/filtersets/<pk>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, dashboard_id: int, pk: int) -> Response:
        try:
            changed_model = UpdateFilterSetCommand(g.user, dashboard_id, pk).run()
            return self.response(200, id=changed_model.id)
        except ValidationError as error:
            return self.response_400(message=error.message)
        except (ObjectNotFoundError, FilterSetForbiddenError, FilterSetDeleteFailedError) as e:
            logger.error(e)
            return self.response(e.status)
