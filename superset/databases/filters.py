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
from typing import Any, Set

from flask import g
from flask_babel import lazy_gettext as _
from sqlalchemy import or_
from sqlalchemy.orm import Query
from sqlalchemy.sql.expression import cast
from sqlalchemy.sql.functions import func
from sqlalchemy.sql.sqltypes import JSON

from superset import app, security_manager
from superset.models.core import Database
from superset.views.base import BaseFilter


class DatabaseFilter(BaseFilter):
    # TODO(bogdan): consider caching.

    def can_access_databases(  # noqa pylint: disable=no-self-use
        self,
        view_menu_name: str,
    ) -> Set[str]:
        return {
            security_manager.unpack_database_and_schema(vm).database
            for vm in security_manager.user_view_menu_names(view_menu_name)
        }

    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.can_access_all_databases():
            return query
        database_perms = security_manager.user_view_menu_names("database_access")
        schema_access_databases = self.can_access_databases("schema_access")

        datasource_access_databases = self.can_access_databases("datasource_access")

        return query.filter(
            or_(
                self.model.perm.in_(database_perms),
                self.model.database_name.in_(
                    [*schema_access_databases, *datasource_access_databases]
                ),
            )
        )


class DatabaseUploadEnabledFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all certified charts
    """

    name = _("Upload Enabled")
    arg_name = "upload_is_enabled"
    model = Database

    def apply(self, query: Query, value: any) -> Query:
        extra_allowed_databases = []
        if hasattr(g, "user"):
            extra_allowed_databases += app.config["ALLOWED_USER_CSV_SCHEMA_FUNC"](
                Database, g.user
            )
        # If the user has schemas in this config then we simplify this filter to only check for allow_file_upload
        if len(extra_allowed_databases):
            return query.filter(Database.allow_file_upload)
        filtered_query = query.filter(Database.allow_file_upload).filter(
            func.json_array_length(
                cast(Database.extra, JSON)["schemas_allowed_for_file_upload"]
            )
            > 0
        )

        if security_manager.can_access_all_datasources():
            return filtered_query

        perms = security_manager.user_view_menu_names("datasource_access")
        schema_perms = security_manager.user_view_menu_names("schema_access")
        return filtered_query.filter(
            or_(Database.perm.in_(perms), Database.schema_perm.in_(schema_perms))
        )
