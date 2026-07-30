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

from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.canvas.filters import CanvasAccessFilter
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.models.canvas import Canvas
from superset.views.base_api import BaseSupersetModelRestApi, RelatedFieldFilter
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedUsers

logger = logging.getLogger(__name__)


class CanvasRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Canvas)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {RouteMethod.RELATED}
    class_permission_name = "Canvas"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "canvas"
    allow_browser_login = True

    base_filters = [["id", CanvasAccessFilter, lambda: []]]

    show_columns = [
        "id",
        "name",
        "definition",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "changed_on_delta_humanized",
    ]
    list_columns = [
        "id",
        "name",
        "changed_on_delta_humanized",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
    ]
    add_columns = ["name", "definition"]
    edit_columns = add_columns
    order_columns = ["name", "changed_on_delta_humanized"]

    allowed_rel_fields = {"created_by", "changed_by"}
    related_field_filters = {
        "created_by": RelatedFieldFilter("first_name", FilterRelatedUsers),
    }
    base_related_field_filters = {
        "created_by": [["id", BaseFilterRelatedUsers, lambda: []]],
    }
    openapi_spec_tag = "Canvas"
