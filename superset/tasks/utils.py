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
import traceback
from datetime import datetime, timezone
from http.client import HTTPResponse
from typing import Any, cast, Final, TYPE_CHECKING
from urllib import request
from uuid import UUID, uuid4

from celery.utils.log import get_task_logger
from flask import current_app, g
from superset_core.tasks.types import TaskProperties, TaskScope

from superset.tasks.exceptions import ExecutorNotFoundError, InvalidExecutorError
from superset.tasks.types import (
    ChosenExecutor,
    Executor,
    ExecutorType,
    FixedExecutor,
)
from superset.utils import json
from superset.utils.hashing import hash_from_str
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
    types extract the user from the underlying object (e.g. CREATOR), a fixed user
    account, or the user that initiated the request.

    The CREATOR_EDITOR, MODIFIER_EDITOR, and EDITOR types additionally require the
    resolved user (the model's creator or modifier) to be an editor of the model,
    directly (user-type subject) or indirectly (through a role/group subject). They
    never resolve to any *other* attached editor: editor subjects can be attached to
    a model by whoever creates or edits it with no consent from the attached user, so
    resolving to an arbitrary attached editor would let a low-privileged creator or
    modifier arrange for the task to execute as a different, potentially
    higher-privileged, user.

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
    from superset.subjects.utils import get_user_subject_ids

    # Build set of all subject IDs that are editors of this model
    editor_subject_ids = {e.id for e in getattr(model, "editors", [])}

    def _is_editor(user_id: int) -> bool:
        """Check if user is an editor directly or via role/group membership."""
        if not user_id or not editor_subject_ids:
            return False
        return bool(set(get_user_subject_ids(user_id)) & editor_subject_ids)

    for executor in executors:
        if isinstance(executor, FixedExecutor):
            return ExecutorType.FIXED_USER, executor.username
        if executor == ExecutorType.FIXED_USER:
            raise InvalidExecutorError()
        if executor == ExecutorType.CURRENT_USER and current_user:
            return executor, current_user
        if executor == ExecutorType.CREATOR_EDITOR:
            if (user := model.created_by) and user.is_active and _is_editor(user.id):
                return executor, user.username
        if executor == ExecutorType.CREATOR:
            if (user := model.created_by) and user.is_active:
                return executor, user.username
        if executor == ExecutorType.MODIFIER_EDITOR:
            if (user := model.changed_by) and user.is_active and _is_editor(user.id):
                return executor, user.username
        if executor == ExecutorType.MODIFIER:
            if (user := model.changed_by) and user.is_active:
                return executor, user.username
        if executor == ExecutorType.EDITOR:
            # Priority: modifier -> creator. Resolves only to whoever authored
            # the model's current state -- changed_by/created_by are set by the
            # framework from the authenticated session on write, so a caller
            # who edits the object becomes changed_by themselves and cannot
            # point this at a victim. Deliberately does NOT fall through to an
            # arbitrary other attached editor (direct or via role/group
            # membership): that would let a low-privileged creator/modifier
            # attach a higher-privileged user as an editor with no consent and
            # have the task execute with that victim's credentials.
            if (
                (modifier := model.changed_by)
                and modifier.is_active
                and _is_editor(modifier.id)
            ):
                return executor, modifier.username
            if (
                (creator := model.created_by)
                and creator.is_active
                and _is_editor(creator.id)
            ):
                return executor, creator.username

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
        session_cookie: str | None = None
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


def naive_utcnow() -> datetime:
    """Return the current UTC time with the tzinfo stripped.

    Task timestamp columns (``started_at``, ``ended_at``, ``subscribed_at``) are
    naive ``DateTime`` columns holding UTC. Writing a tz-aware value to a naive
    column lets some DB drivers convert it to the session-local timezone, which
    would skew every duration computed from those columns by the local UTC
    offset — so the offset is dropped here, once, before the value reaches the DB.

    :returns: Current UTC time as a naive ``datetime``
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def floored_status_cursor() -> datetime:
    """Return the current wall-clock time floored to whole seconds.

    Used as the ``status_changes`` poll cursor. ``changed_on`` (FAB AuditMixin,
    naive local) is stored at the metastore column's precision, and MySQL
    ``DATETIME`` truncates to whole seconds — so a sub-second cursor could sit
    *after* a same-second change and miss it under the ``changed_on >= cursor``
    bound. Flooring keeps ``>=`` inclusive on every backend; re-delivering an
    earlier same-second change is idempotent for the client. All producers of a
    status cursor (the 202 handshake and each poll response) share this helper so
    the precision contract lives in one place.

    Known limitation: this cursor is stamped on the web tier's clock, while a
    task's ``changed_on`` on a terminal transition is stamped by whichever worker
    committed it. If a worker's clock trails the web tier by more than the floored
    second, that completion can sit just under the ``>=`` bound and be skipped by
    every poll, so a poll-mode client resolves the chart only at its stale timeout
    (the websocket transport is unaffected — it delivers completion directly). Keep
    the web and worker tiers clock-synced (e.g. NTP). The robust fix is a
    DB-stamped status timestamp — as the orphan reaper already uses the DB clock
    rather than the app clock — which is tracked as a follow-up.

    :returns: Current naive-local time with sub-second precision dropped
    """
    return datetime.now().replace(microsecond=0)


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
    user_id: int | None = None,
) -> str:
    """
    Build a deduplication key for active tasks.

    The dedup_key enforces uniqueness at the database level via a unique index.
    Active tasks use a composite key based on scope, which is then hashed using
    the configured HASH_ALGORITHM to produce a fixed-length key.

    The composite key format before hashing is:
    - Private: private|task_type|task_key|user_id
    - Shared: shared|task_type|task_key
    - System: system|task_type|task_key

    The final key is a hash digest (64 chars for sha256, 32 chars for md5).

    :param scope: Task scope (PRIVATE/SHARED/SYSTEM) as TaskScope enum or string
    :param task_type: Type of task (e.g., 'sql_execution')
    :param task_key: Task identifier for deduplication
    :param user_id: User ID (required for private tasks)
    :returns: Hashed deduplication key string
    :raises ValueError: If user_id is missing for private scope
    """
    # Convert string to TaskScope if needed
    if isinstance(scope, str):
        scope = TaskScope(scope)

    # Build composite key
    match scope:
        case TaskScope.PRIVATE:
            if user_id is None:
                raise ValueError("user_id required for private tasks")
            composite_key = f"{scope.value}|{task_type}|{task_key}|{user_id}"
        case TaskScope.SHARED:
            composite_key = f"{scope.value}|{task_type}|{task_key}"
        case TaskScope.SYSTEM:
            composite_key = f"{scope.value}|{task_type}|{task_key}"
        case _:
            raise ValueError(f"Invalid scope: {scope}")

    # Hash the composite key to produce a fixed-length dedup_key
    # Truncate to 64 chars max to fit the database column in case
    # a hash algo is used that generates hashes that exceed 64 chars
    return hash_from_str(composite_key)[:64]


def get_finished_dedup_key(task_uuid: UUID) -> str:
    """
    Build a deduplication key for finished tasks.

    When a task completes (success, failure, or abort), its dedup_key is
    changed to its UUID. This frees up the slot so new tasks with the same
    parameters can be created.

    :param task_uuid: Task UUID (native UUID type)
    :returns: The task UUID string as the dedup key

    Example:
        >>> from uuid import UUID
        >>> get_finished_dedup_key(UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890"))
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    """
    return str(task_uuid)


# -----------------------------------------------------------------------------
# TaskProperties helper functions
# -----------------------------------------------------------------------------


def progress_update(progress: float | int | tuple[int, int]) -> TaskProperties:
    """
    Create a properties update dict for progress values.

    :param progress: One of:
        - float (0.0-1.0): Percentage only
        - int: Count only (total unknown)
        - tuple[int, int]: (current, total) with auto-computed percentage
    :returns: TaskProperties dict with appropriate progress fields set

    Example:
        task.update_properties(progress_update((50, 100)))
    """
    if isinstance(progress, float):
        return {"progress_percent": progress}
    if isinstance(progress, int):
        return {"progress_current": progress}
    # tuple
    current, total = progress
    result: TaskProperties = {
        "progress_current": current,
        "progress_total": total,
    }
    if total > 0:
        result["progress_percent"] = current / total
    return result


def error_update(exception: BaseException) -> TaskProperties:
    """
    Create a properties update dict from an exception.

    ``error_message`` is the consumer-facing failure reason (public); the
    exception class and traceback are internal debug detail and go under
    ``private["framework"]`` (visible only in debug mode). The nested ``private``
    key is merged recursively by ``Task.update_properties`` so it does not clobber
    other framework/task handles.

    :param exception: The exception that caused the failure
    :returns: TaskProperties dict with error fields populated
    """
    return cast(
        TaskProperties,
        {
            "error_message": str(exception),
            "private": {
                "framework": {
                    "exception_type": type(exception).__name__,
                    "stack_trace": traceback.format_exc(),
                }
            },
        },
    )


def task_internals_visible() -> bool:
    """Whether internal (``private``) task properties may be surfaced to API
    consumers. Single source of truth for the visibility gate: internal task
    state (framework orchestration handles, error tracebacks, task-execution
    handles) is exposed only in debug mode.
    """
    return bool(current_app.debug)


def merge_private_subtree(
    current_private: Any, updates_private: dict[str, Any]
) -> dict[str, Any]:
    """Recursively merge the ``private`` properties subtree, per namespace.

    Each namespace (``framework``, ``task``, ``subscription``) is a dict merged
    independently, so a write to one never clobbers the others or drops earlier
    keys — this is what structurally isolates task-owned freeform keys from
    framework orchestration keys and from subscription-policy bookkeeping.
    Defensive against a malformed persisted value: a non-dict subtree or a
    non-dict namespace is treated as empty rather than raising ``TypeError`` on
    unpacking (``private`` is framework-managed, so this only guards corrupted or
    externally-tampered rows).
    """
    merged: dict[str, Any] = (
        dict(current_private) if isinstance(current_private, dict) else {}
    )
    for namespace, ns_updates in updates_private.items():
        existing = merged.get(namespace)
        if isinstance(ns_updates, dict) and isinstance(existing, dict):
            merged[namespace] = {**existing, **ns_updates}
        else:
            merged[namespace] = ns_updates
    return merged


# ``private`` namespace owned by a task type's subscription policy (per-client
# bookkeeping such as chart-data's per-tab consumer list). Written only from the
# policy hooks, under the submit/cancel lock; the executor never writes it, and
# its whole-blob writes carry the row's current value through
# :func:`preserve_subscription_state`.
SUBSCRIPTION_PRIVATE_NAMESPACE: Final = "subscription"


def preserve_subscription_state(
    incoming: TaskProperties, current: TaskProperties | None
) -> TaskProperties:
    """Return ``incoming`` with ``private.subscription`` taken from ``current``.

    The executor writes the complete property blob from an in-memory cache it
    snapshotted when it picked the task up, and does not hold the submit/cancel
    lock. A client that subscribed since the snapshot (a second browser tab
    joining a SHARED chart-data task) would be silently dropped by such a write,
    after which the first tab's detach would abort work the second still awaits,
    and per-tab status fanout would skip it. Whole-blob writers run their value
    through this helper with the row's current properties (read under the same
    row lock as the UPDATE) so that subtree always reflects the policy's latest
    write, whatever the executor's cache holds.
    """
    result: dict[str, Any] = dict(incoming)
    private_value = result.get("private")
    private: dict[str, Any] = (
        dict(private_value) if isinstance(private_value, dict) else {}
    )
    current_private = current.get("private") if isinstance(current, dict) else None
    current_subtree = (
        current_private.get(SUBSCRIPTION_PRIVATE_NAMESPACE)
        if isinstance(current_private, dict)
        else None
    )
    if isinstance(current_subtree, dict):
        private[SUBSCRIPTION_PRIVATE_NAMESPACE] = current_subtree
    else:
        private.pop(SUBSCRIPTION_PRIVATE_NAMESPACE, None)
    if private or "private" in result:
        result["private"] = private
    return cast(TaskProperties, result)


def merge_properties(
    current: TaskProperties | None, updates: TaskProperties
) -> TaskProperties:
    """Merge ``updates`` into ``current`` with task-properties semantics.

    Top-level keys are shallow-merged; the ``private`` subtree merges recursively
    (see :func:`merge_private_subtree`), so writing one namespace never clobbers
    the others. This is the pure form of
    :meth:`superset.models.tasks.Task.update_properties` — use it to build a
    complete properties dict for a zero-read write (e.g. a terminal FAILURE that
    must preserve the executor's runtime state while adding error detail) without
    loading the ORM entity.
    """
    merged: dict[str, Any] = dict(current or {})
    incoming: dict[str, Any] = dict(updates)
    if "private" in incoming:
        merged["private"] = merge_private_subtree(
            merged.get("private"), incoming.pop("private")
        )
    merged.update(incoming)
    return cast(TaskProperties, merged)


def parse_properties(json_str: str | None) -> TaskProperties:
    """
    Parse JSON string into TaskProperties dict.

    Returns empty dict on parse errors. Unknown keys are preserved
    for forward compatibility (allows adding new properties without
    breaking existing code).

    :param json_str: JSON string or None
    :returns: TaskProperties dict (sparse - only contains keys that were set)
    """
    return cast(TaskProperties, _parse_json_dict(json_str))


def parse_payload(json_str: str | None) -> dict[str, Any]:
    """
    Parse a task's ``payload`` column into a dict.

    The payload counterpart of :func:`parse_properties`; task code owns the
    payload's shape, so it stays an untyped mapping.

    :param json_str: JSON string or None
    :returns: Payload dict, empty when absent or unparseable
    """
    return _parse_json_dict(json_str)


def _parse_json_dict(json_str: str | None) -> dict[str, Any]:
    """Decode a JSON object column, tolerating absent or malformed values.

    ``properties`` and ``payload`` are free-form JSON text columns, so a
    non-object value has to degrade to an empty dict rather than raise: these
    are read on polling paths where one bad row must not fail the response.
    """
    if not json_str:
        return {}

    try:
        raw = json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return {}
    return raw if isinstance(raw, dict) else {}


def serialize_properties(props: TaskProperties) -> str:
    """
    Serialize TaskProperties to JSON string.

    :param props: TaskProperties dict
    :returns: JSON string
    """
    return json.dumps(props)
