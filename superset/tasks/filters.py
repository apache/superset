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
"""Filters for Task model"""

from typing import Any

from sqlalchemy.orm.query import Query

from superset.utils.core import get_user_id
from superset.views.base import BaseFilter


class TaskFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Filter for Task that shows tasks based on scope and user permissions.

    Filtering rules:
    - Admins: See all tasks (private, shared, system)
    - Non-admins:
      - Private tasks: Only their own tasks
      - Shared tasks: Tasks they're subscribed to
      - System tasks: None (admin-only)
    """

    def apply(self, query: Query, value: Any) -> Query:
        """Apply the filter to the query."""
        from flask import g, has_request_context
        from sqlalchemy import or_

        from superset import security_manager
        from superset.models.task_subscribers import TaskSubscriber
        from superset.models.tasks import Task

        # If no request context or no user, return unfiltered query
        # (this handles background tasks and system operations)
        if not has_request_context() or not hasattr(g, "user"):
            return query

        # If user is admin, return unfiltered query
        if security_manager.is_admin():
            return query

        # For non-admins, filter by scope and permissions
        user_id = get_user_id()

        # Build filter conditions:
        # 1. Private tasks created by current user
        # 2. Shared tasks where user is subscribed
        # 3. System tasks are excluded (admin-only)

        filters = [
            # Own private tasks
            ((Task.scope == "private") & (Task.created_by_fk == user_id)),
            # Shared tasks where user is subscribed
            (
                (Task.scope == "shared")
                & (Task.id == TaskSubscriber.task_id)
                & (TaskSubscriber.user_id == user_id)
            ),
        ]

        return query.outerjoin(
            TaskSubscriber,
            (Task.id == TaskSubscriber.task_id) & (TaskSubscriber.user_id == user_id),
        ).filter(or_(*filters))
