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

from sqlalchemy import or_
from sqlalchemy.orm import Query

from superset import security_manager
from superset.views.base import BaseFilter


class DatabaseFilter(BaseFilter):
    # TODO(bogdan): consider caching.

    def can_access_databases(  # noqa pylint: disable=no-self-use
        self, view_menu_name: str,
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
