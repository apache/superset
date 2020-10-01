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
from typing import Any

from flask import g, Response
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext

from superset.constants import RouteMethod
from superset.databases.filters import DatabaseFilter
from superset.models.sql_lab import SavedQuery
from superset.queries.saved_queries.commands.bulk_delete import (
    BulkDeleteSavedQueryCommand,
)
from superset.queries.saved_queries.commands.exceptions import (
    SavedQueryBulkDeleteFailedError,
    SavedQueryNotFoundError,
)
from superset.queries.saved_queries.filters import (
    SavedQueryAllTextFilter,
    SavedQueryFavoriteFilter,
    SavedQueryFilter,
)
from superset.queries.saved_queries.schemas import (
    get_delete_ids_schema,
    openapi_spec_methods_override,
)
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class SavedQueryRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(SavedQuery)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
        RouteMethod.DISTINCT,
        "bulk_delete",  # not using RouteMethod since locally defined
    }
    class_permission_name = "SavedQueryView"
    resource_name = "saved_query"
    allow_browser_login = True

    base_filters = [["id", SavedQueryFilter, lambda: []]]

    show_columns = [
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "database.database_name",
        "database.id",
        "description",
        "id",
        "label",
        "schema",
        "sql",
        "sql_tables",
    ]
    list_columns = [
        "changed_on_delta_humanized",
        "created_on",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "database.database_name",
        "database.id",
        "db_id",
        "description",
        "id",
        "label",
        "schema",
        "sql",
        "sql_tables",
    ]
    add_columns = ["db_id", "description", "label", "schema", "sql"]
    edit_columns = add_columns
    order_columns = [
        "schema",
        "label",
        "description",
        "sql",
        "created_by.first_name",
        "database.database_name",
        "created_on",
        "changed_on_delta_humanized",
    ]

    search_columns = ["id", "label"]
    search_filters = {
        "id": [SavedQueryFavoriteFilter],
        "label": [SavedQueryAllTextFilter],
    }

    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
    }
    openapi_spec_tag = "Queries"
    openapi_spec_methods = openapi_spec_methods_override

    related_field_filters = {
        "database": "database_name",
    }
    filter_rel_fields = {"database": [["id", DatabaseFilter, lambda: []]]}
    allowed_rel_fields = {"database"}
    allowed_distinct_fields = {"schema"}

    def pre_add(self, item: SavedQuery) -> None:
        item.user = g.user

    def pre_update(self, item: SavedQuery) -> None:
        self.pre_add(item)

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Delete bulk Saved Queries
        ---
        delete:
          description: >-
            Deletes multiple saved queries in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Saved queries bulk delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            BulkDeleteSavedQueryCommand(g.user, item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d saved query",
                    "Deleted %(num)d saved queries",
                    num=len(item_ids),
                ),
            )
        except SavedQueryNotFoundError:
            return self.response_404()
        except SavedQueryBulkDeleteFailedError as ex:
            return self.response_422(message=str(ex))
