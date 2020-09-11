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
from superset.models.sql_lab import SavedQuery
from superset.views.base_api import BaseSupersetModelRestApi

logger = logging.getLogger(__name__)


class SavedQueryRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(SavedQuery)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
        RouteMethod.DISTINCT,
    }
    class_permission_name = "SavedQueryView"
    resource_name = "saved_query"
    allow_browser_login = True
    show_columns = [
        "id",
        "schema",
        "label",
        "description",
        "sql",
        "user.first_name",
        "user.last_name",
        "user.id",
        "database.database_name",
        "database.id",
    ]
    list_columns = [
        "user_id",
        "db_id",
        "schema",
        "label",
        "description",
        "sql",
        "user.first_name",
        "user.last_name",
        "user.id",
        "database.database_name",
        "database.id",
    ]
    add_columns = [
        "schema",
        "label",
        "description",
        "sql",
        "user_id",
        "db_id",
    ]
    edit_columns = add_columns
    order_columns = [
        "schema",
        "label",
        "description",
        "sql",
        "user.first_name",
        "database.database_name",
    ]

    openapi_spec_tag = "Queries"
    openapi_spec_methods = {
        "get": {"get": {"description": "Get a saved query",}},
        "get_list": {
            "get": {
                "description": "Get a list of saved queries, use Rison or JSON "
                "query parameters for filtering, sorting,"
                " pagination and for selecting specific"
                " columns and metadata.",
            }
        },
        "post": {"post": {"description": "Create a saved query"}},
        "put": {"put": {"description": "Update a saved query"}},
        "delete": {"delete": {"description": "Delete saved query"}},
    }

    related_field_filters = {
        "database": "database_name",
    }
    filter_rel_fields = {"database": [["id", DatabaseFilter, lambda: []]]}
    allowed_rel_fields = {"database"}
    allowed_distinct_fields = {"schema"}
