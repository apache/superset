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

        from superset import db, security_manager
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

        # Use subquery for shared tasks to avoid join ambiguity
        shared_task_ids_query = (
            db.session.query(Task.id)
            .join(TaskSubscriber, Task.id == TaskSubscriber.task_id)
            .filter(
                Task.scope == "shared",
                TaskSubscriber.user_id == user_id,
            )
        )

        # Build filter conditions:
        # 1. Private tasks created by current user
        # 2. Shared tasks where user is subscribed (via subquery)
        # 3. System tasks are excluded (admin-only)
        return query.filter(
            or_(
                # Own private tasks
                (Task.scope == "private") & (Task.created_by_fk == user_id),
                # Shared tasks where user is subscribed
                Task.id.in_(shared_task_ids_query),
            )
        )


class TaskSubscriberFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Filter tasks by subscriber user ID.

    This filter allows finding tasks where a specific user is subscribed.
    Used by the frontend for the subscribers filter dropdown.
    """

    def apply(self, query: Query, value: Any) -> Query:
        """Apply the filter to the query."""
        from superset import db
        from superset.models.task_subscribers import TaskSubscriber
        from superset.models.tasks import Task

        if not value:
            return query

        # Handle both single ID and list of IDs
        if isinstance(value, (list, tuple)):
            user_ids = [int(v) for v in value]
        else:
            user_ids = [int(value)]

        # Find tasks where any of these users are subscribers
        subscribed_task_ids = db.session.query(TaskSubscriber.task_id).filter(
            TaskSubscriber.user_id.in_(user_ids)
        )

        return query.filter(Task.id.in_(subscribed_task_ids))
