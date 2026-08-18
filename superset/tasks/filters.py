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
    Filter for Task that shows tasks based on user subscriptions.

    Non-admins only see tasks they're subscribed to. Task creators are
    automatically subscribed when creating a task, so this covers both
    owned and shared tasks. Unsubscribing removes visibility.

    Admins see all tasks without filtering.

    This filter applies to request-scoped reads only -- the REST API and
    the MCP task tools -- where a task's visibility to the requesting
    principal matters. Internal task-executor and scheduler code that
    reads back the state of a task it already owns (e.g. polling for the
    terminal status of the task it is currently executing) calls the DAO
    with ``skip_base_filter=True`` instead: that code isn't presenting
    task data to a user, and the UUID it operates on is never
    caller-supplied, so the visibility check doesn't apply.
    """

    def apply(self, query: Query, value: Any) -> Query:
        """Apply the filter to the query."""
        from flask import has_request_context
        from sqlalchemy import and_, false, select

        from superset import security_manager
        from superset.models.task_subscribers import TaskSubscriber
        from superset.models.tasks import Task

        user_id = get_user_id()
        if not user_id:
            # Within a request, a principal without a user id gets no tasks;
            # background jobs run outside a request context and are unfiltered.
            if has_request_context():
                return query.filter(false())
            return query

        if security_manager.is_admin():
            return query

        is_subscribed = (
            select(TaskSubscriber.id)
            .where(
                and_(
                    TaskSubscriber.task_id == Task.id,
                    TaskSubscriber.user_id == user_id,
                )
            )
            .exists()
        )

        return query.filter(is_subscribed)
