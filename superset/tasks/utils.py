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

from __future__ import annotations

import logging
from http.client import HTTPResponse
from typing import Optional, TYPE_CHECKING
from urllib import request
from uuid import uuid4

from celery.utils.log import get_task_logger
from flask import g
from superset_core.api.tasks import TaskScope

from superset.tasks.exceptions import ExecutorNotFoundError, InvalidExecutorError
from superset.tasks.types import ChosenExecutor, Executor, ExecutorType, FixedExecutor
from superset.utils import json
from superset.utils.urls import get_url_path

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.reports.models import ReportSchedule


logger = get_task_logger(__name__)
logger.setLevel(logging.INFO)


# pylint: disable=too-many-branches
def get_executor(  # noqa: C901
    executors: list[Executor],
    model: Dashboard | ReportSchedule | Slice,
    current_user: str | None = None,
) -> ChosenExecutor:
    """
    Extract the user that should be used to execute a scheduled task. Certain executor
    types extract the user from the underlying object (e.g. CREATOR), the constant
    Selenium user (SELENIUM), or the user that initiated the request.

    :param executors: The requested executor in descending order. When the
           first user is found it is returned.
    :param model: The underlying object
    :param current_user: The username of the user that initiated the task. For
           thumbnails this is the user that requested the thumbnail, while for alerts
           and reports this is None (=initiated by Celery).
    :return: User to execute the execute the async task as. The first element of the
             tuple represents the type of the executor, and the second represents the
             username of the executor.
    :raises ExecutorNotFoundError: If no users were found in after
            iterating through all entries in `executors`
    """
    owners = model.owners
    owner_dict = {owner.id: owner for owner in owners}
    for executor in executors:
        if isinstance(executor, FixedExecutor):
            return ExecutorType.FIXED_USER, executor.username
        if executor == ExecutorType.FIXED_USER:
            raise InvalidExecutorError()
        if executor == ExecutorType.CURRENT_USER and current_user:
            return executor, current_user
        if executor == ExecutorType.CREATOR_OWNER:
            if (user := model.created_by) and (owner := owner_dict.get(user.id)):
                return executor, owner.username
        if executor == ExecutorType.CREATOR:
            if user := model.created_by:
                return executor, user.username
        if executor == ExecutorType.MODIFIER_OWNER:
            if (user := model.changed_by) and (owner := owner_dict.get(user.id)):
                return executor, owner.username
        if executor == ExecutorType.MODIFIER:
            if user := model.changed_by:
                return executor, user.username
        if executor == ExecutorType.OWNER:
            owners = model.owners
            if len(owners) == 1:
                return executor, owners[0].username
            if len(owners) > 1:
                if modifier := model.changed_by:
                    if modifier and (user := owner_dict.get(modifier.id)):
                        return executor, user.username
                if creator := model.created_by:
                    if creator and (user := owner_dict.get(creator.id)):
                        return executor, user.username
                return executor, owners[0].username

    raise ExecutorNotFoundError()


def get_current_user() -> str | None:
    user = g.user if hasattr(g, "user") and g.user else None
    if user and not user.is_anonymous:
        return user.username

    return None


def fetch_csrf_token(
    headers: dict[str, str], session_cookie_name: str = "session"
) -> dict[str, str]:
    """
    Fetches a CSRF token for API requests

    :param headers: A map of headers to use in the request, including the session cookie
    :returns: A map of headers, including the session cookie and csrf token
    """
    url = get_url_path("SecurityRestApi.csrf_token")
    logger.info("Fetching %s", url)
    req = request.Request(url, headers=headers, method="GET")  # noqa: S310
    response: HTTPResponse
    with request.urlopen(req, timeout=600) as response:  # noqa: S310
        body = response.read().decode("utf-8")
        session_cookie: Optional[str] = None
        cookie_headers = response.headers.get_all("set-cookie")
        if cookie_headers:
            for cookie in cookie_headers:
                cookie = cookie.split(";", 1)[0]
                name, value = cookie.split("=", 1)
                if name == session_cookie_name:
                    session_cookie = value
                    break

        if response.status == 200:
            data = json.loads(body)
            res = {"X-CSRF-Token": data["result"]}
            if session_cookie is not None:
                res["Cookie"] = f"{session_cookie_name}={session_cookie}"
            return res

    logger.error("Error fetching CSRF token, status code: %s", response.status)
    return {}


def generate_random_task_key() -> str:
    """
    Generate a random task key.

    This is the default behavior - each task submission gets a unique UUID
    unless an explicit task_key is provided in TaskOptions.

    :returns: A random UUID string
    """
    return str(uuid4())


def get_active_dedup_key(
    scope: TaskScope | str,
    task_type: str,
    task_key: str,
) -> str:
    """
    Build a deduplication key for active tasks.

    The dedup_key enforces uniqueness at the database level via a unique index.
    Active tasks use a composite key based on scope, while finished tasks use
    their UUID to free up the slot for new tasks.

    Format by scope:
    - Private: private|task_type|task_key|user_id
    - Shared: shared|task_type|task_key
    - System: system|task_type|task_key

    :param scope: Task scope (PRIVATE/SHARED/SYSTEM) as TaskScope enum or string
    :param task_type: Type of task (e.g., 'sql_execution')
    :param task_key: Task identifier for deduplication
    :returns: Deduplication key string
    :raises ValueError: If user_id is missing for private scope

    Example:
        >>> from superset_core.api.tasks import TaskScope
        >>> get_active_dedup_key(TaskScope.PRIVATE, "sql_exec", "chart_123")
        'private|sql_exec|chart_123|gamma'
        >>> get_active_dedup_key("private", "sql_exec", "chart_123")
        'private|sql_exec|chart_123|gamma'
        >>> get_active_dedup_key(TaskScope.SHARED, "report", "monthly")
        'shared|report|monthly'
    """
    # Convert string to TaskScope if needed
    if isinstance(scope, str):
        scope = TaskScope(scope)

    match scope:
        case TaskScope.PRIVATE:
            username = get_current_user()
            if username is None:
                raise ValueError("username required for private tasks")
            return f"{scope.value}|{task_type}|{task_key}|{username}"
        case TaskScope.SHARED:
            return f"{scope.value}|{task_type}|{task_key}"
        case TaskScope.SYSTEM:
            return f"{scope.value}|{task_type}|{task_key}"
        case _:
            raise ValueError(f"Invalid scope: {scope}")


def get_finished_dedup_key(task_uuid: str) -> str:
    """
    Build a deduplication key for finished tasks.

    When a task completes (success, failure, or abort), its dedup_key is
    changed to its UUID. This frees up the slot so new tasks with the same
    parameters can be created.

    :param task_uuid: Task UUID
    :returns: The task UUID as the dedup key

    Example:
        >>> get_finished_dedup_key("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    """
    return task_uuid
