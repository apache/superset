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
from flask_appbuilder.security.sqla.models import Role

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.roles.filters import RoleFilter
from superset.views.base_api import BaseSupersetModelRestApi

logger = logging.getLogger(__name__)


class RolesRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Role)

    class_permission_name = "Role"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    resource_name = "role"

    allow_browser_login = True
    include_route_methods = {
        RouteMethod.GET,
        RouteMethod.GET_LIST,
    }

    show_columns = [
        "id",
        "name",
    ]

    list_columns = show_columns

    order_columns = [
        "name",
    ]

    search_columns = ["name"]
    search_filters = {"name": [RoleFilter]}
