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

from flask import g
from flask_sqlalchemy import BaseQuery

from superset import security_manager
from superset.models.sql_lab import Query
from superset.views.base import BaseFilter


class QueryFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    def apply(self, query: BaseQuery, value: Any) -> BaseQuery:
        """
        Filter queries to only those owned by current user. If
        can_access_all_queries permission is set a user can list all queries

        :returns: query
        """
        if not security_manager.can_access_all_queries():
            query = query.filter(Query.user_id == g.user.get_user_id())
        return query
