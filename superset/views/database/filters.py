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
from sqlalchemy import or_

from superset import security_manager
from superset.views.base import BaseFilter


class DatabaseFilter(BaseFilter):
    # TODO(bogdan): consider caching.
    def schema_access_databases(self):  # noqa pylint: disable=no-self-use
        found_databases = set()
        for vm in security_manager.user_view_menu_names("schema_access"):
            database_name, _ = security_manager.unpack_schema_perm(vm)
            found_databases.add(database_name)
        return found_databases

    def apply(
        self, query, func
    ):  # noqa pylint: disable=unused-argument,arguments-differ
        if security_manager.all_database_access():
            return query
        database_perms = security_manager.user_view_menu_names("database_access")
        # TODO(bogdan): consider adding datasource access here as well.
        schema_access_databases = self.schema_access_databases()
        return query.filter(
            or_(
                self.model.perm.in_(database_perms),
                self.model.database_name.in_(schema_access_databases),
            )
        )
