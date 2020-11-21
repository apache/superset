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
from superset.databases.filters import DatabaseFilter
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
        "id",
        "changed_on",
        "database.database_name",
        "executed_sql",
        "rows",
        "schema",
        "sql",
        "sql_tables",
        "status",
        "tab_name",
        "user.first_name",
        "user.id",
        "user.last_name",
        "user.username",
        "start_time",
        "end_time",
        "tmp_table_name",
        "tracking_url",
    ]
    show_columns = [
        "id",
        "changed_on",
        "client_id",
        "database.id",
        "end_result_backend_time",
        "end_time",
        "error_message",
        "executed_sql",
        "limit",
        "progress",
        "results_key",
        "rows",
        "schema",
        "select_as_cta",
        "select_as_cta_used",
        "select_sql",
        "sql",
        "sql_editor_id",
        "start_running_time",
        "start_time",
        "status",
        "tab_name",
        "tmp_schema_name",
        "tmp_table_name",
        "tracking_url",
    ]
    base_filters = [["id", QueryFilter, lambda: []]]
    base_order = ("changed_on", "desc")

    openapi_spec_tag = "Queries"
    openapi_spec_methods = openapi_spec_methods_override

    order_columns = [
        "changed_on",
        "database.database_name",
        "rows",
        "schema",
        "start_time",
        "sql",
        "tab_name",
        "user.first_name",
    ]

    related_field_filters = {
        "created_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }

    search_columns = ["changed_on", "database", "sql", "status", "user"]

    filter_rel_fields = {"database": [["id", DatabaseFilter, lambda: []]]}
    allowed_rel_fields = {"database", "user"}
