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

from superset.constants import RouteMethod
from superset.subjects.filters import SubjectAllTextFilter
from superset.subjects.models import Subject
from superset.subjects.schemas import openapi_spec_methods_override
from superset.views.base_api import BaseSupersetModelRestApi

logger = logging.getLogger(__name__)


class SubjectRestApi(BaseSupersetModelRestApi):
    """Read-only API for fetching and filtering Subjects.

    Subjects are an internal representation derived from Users, Roles, and
    Groups, so this API only exposes read operations (list, get, info, related,
    distinct). Access is gated by the ``Subject`` permission, which is granted to
    Admins by default.
    """

    datamodel = SQLAInterface(Subject)

    include_route_methods = {
        RouteMethod.GET,
        RouteMethod.GET_LIST,
        RouteMethod.INFO,
    }
    class_permission_name = "Subject"
    method_permission_name = {
        "get": "read",
        "get_list": "read",
        "info": "read",
    }

    resource_name = "security/subject"
    allow_browser_login = True
    openapi_spec_tag = "Security Subjects"
    openapi_spec_methods = openapi_spec_methods_override

    list_columns = [
        "id",
        "uuid",
        "label",
        "secondary_label",
        "type",
        "active",
        "extra_search",
        "img",
        "user_id",
        "role_id",
        "group_id",
        "created_on",
        "changed_on",
        "changed_by.first_name",
        "changed_by.last_name",
    ]
    show_columns = [
        "id",
        "uuid",
        "label",
        "secondary_label",
        "type",
        "active",
        "extra_search",
        "img",
        "user_id",
        "role_id",
        "group_id",
        # Full principal detail — only the relationship matching ``type`` is set
        "user.id",
        "user.username",
        "user.first_name",
        "user.last_name",
        "user.email",
        "user.active",
        "role.id",
        "role.name",
        "group.id",
        "group.name",
        "group.label",
        "group.description",
        "created_on",
        "changed_on",
        "changed_by.first_name",
        "changed_by.last_name",
    ]
    order_columns = [
        "label",
        "type",
        "active",
        "created_on",
        "changed_on",
    ]

    search_columns = [
        "label",
        "secondary_label",
        "extra_search",
        "type",
        "active",
        "user_id",
        "role_id",
        "group_id",
    ]
    search_filters = {"label": [SubjectAllTextFilter]}
