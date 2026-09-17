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
from typing import Any

from flask import current_app, g
from flask_babel import lazy_gettext as _
from sqlalchemy import or_
from sqlalchemy.orm import Query
from sqlalchemy.sql.expression import cast
from sqlalchemy.sql.sqltypes import JSON

from superset import app, security_manager
from superset.models.core import Database
from superset.views.base import BaseFilter


def can_access_databases(view_menu_name: str) -> set[str]:
    """
    Return names of databases available in `view_menu_name`.
    """
    return {
        vm.split(".")[0][1:-1]
        for vm in security_manager.user_view_menu_names(view_menu_name)
    }


class DatabaseFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    # TODO(bogdan): consider caching.

    def apply(self, query: Query, value: Any) -> Query:
        """
        Dynamic Filters need to be applied to the Query before we filter
        databases with anything else. This way you can show/hide databases using
        Feature Flags for example in conjuction with the regular role filtering.
        If not, if an user has access to all Databases it would skip this dynamic
        filtering.
        """

        if dynamic_filters := current_app.config["EXTRA_DYNAMIC_QUERY_FILTERS"]:
            if dynamic_databases_filter := dynamic_filters.get("databases"):
                query = dynamic_databases_filter(query)

        # We can proceed with default filtering now
        if security_manager.can_access_all_databases():
            return query

        database_perms = security_manager.user_view_menu_names("database_access")
        catalog_access_databases = can_access_databases("catalog_access")
        schema_access_databases = can_access_databases("schema_access")
        datasource_access_databases = can_access_databases("datasource_access")
        database_names = sorted(
            catalog_access_databases
            | schema_access_databases
            | datasource_access_databases
        )

        return query.filter(
            or_(
                self.model.perm.in_(database_perms),
                self.model.database_name.in_(database_names),
            )
        )


class DatabaseUploadEnabledFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all databases based on allow_file_upload
    """

    name = _("Upload Enabled")
    arg_name = "upload_is_enabled"

    def apply(self, query: Query, value: Any) -> Query:
        filtered_query = query.filter(Database.allow_file_upload)

        datasource_access_databases = can_access_databases("datasource_access")

        if hasattr(g, "user"):
            allowed_schemas = [
                app.config["ALLOWED_USER_CSV_SCHEMA_FUNC"](database, g.user)
                for database in datasource_access_databases
            ]

            if len(allowed_schemas):
                return filtered_query

        return filtered_query.filter(
            or_(
                cast(Database.extra, JSON)["schemas_allowed_for_file_upload"]
                is not None,
                cast(Database.extra, JSON)["schemas_allowed_for_file_upload"] != [],
            )
        )
