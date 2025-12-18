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
"""Filters for AsyncTask model"""

from typing import Any

from sqlalchemy.orm.query import Query

from superset.utils.core import get_user_id


class AsyncTaskFilter:
    """
    Filter for AsyncTask that shows all tasks for admins,
    but only user-owned tasks for regular users.
    """

    def apply(self, query: Query, value: Any) -> Query:
        """Apply the filter to the query."""
        from superset import security_manager
        from superset.models.async_tasks import AsyncTask

        # If user is admin, return unfiltered query
        if security_manager.is_admin():
            return query

        # Otherwise, filter to only show tasks created by current user
        return query.filter(AsyncTask.created_by_fk == get_user_id())
