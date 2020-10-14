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
from superset.models.sql_lab import Query
from superset.queries.filters import QueryFilter
from superset.queries.schemas import openapi_spec_methods_override
from superset.views.base_api import BaseSupersetModelRestApi, RelatedFieldFilter
from superset.views.filters import FilterRelatedOwners

logger = logging.getLogger(__name__)


class QueryRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Query)

    resource_name = "query"
    allow_browser_login = True
    include_route_methods = {RouteMethod.GET, RouteMethod.GET_LIST, RouteMethod.RELATED}

    class_permission_name = "QueryView"
    list_columns = [
        "user.username",
        "database.database_name",
        "status",
        "start_time",
        "end_time",
    ]
    show_columns = [
        "client_id",
        "tmp_table_name",
        "tmp_schema_name",
        "status",
        "tab_name",
        "sql_editor_id",
        "database.id",
        "schema",
        "sql",
        "select_sql",
        "executed_sql",
        "limit",
        "select_as_cta",
        "select_as_cta_used",
        "progress",
        "rows",
        "error_message",
        "results_key",
        "start_time",
        "start_running_time",
        "end_time",
        "end_result_backend_time",
        "tracking_url",
        "changed_on",
    ]
    base_filters = [["id", QueryFilter, lambda: []]]
    base_order = ("changed_on", "desc")

    openapi_spec_tag = "Queries"
    openapi_spec_methods = openapi_spec_methods_override

    related_field_filters = {
        "created_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }
    allowed_rel_fields = {"user"}
