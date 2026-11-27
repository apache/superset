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
"""
The guards every full export request passes, and the enqueue itself.

Shared by the chart endpoint and the SQL Lab endpoint so the two cannot drift
on who may ask for an uncapped export, or on what the response looks like.
Each endpoint keeps its own access check for the thing being exported -- that
check is about the chart or the query, not about exporting.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

from flask import current_app
from flask_babel import gettext as __

from superset import is_feature_enabled
from superset.commands.distributed_lock.acquire import AcquireDistributedLock
from superset.data_export.sources import KIND_CHART, KIND_QUERY
from superset.data_export.storage import is_full_export_available
from superset.exceptions import LockAlreadyHeldException
from superset.tasks.export_full_data import (
    export_full_data,
    EXPORT_LOCK_NAMESPACE,
    export_lock_params,
    release_lock,
)
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)

FEATURE_FLAG = "ALLOW_UNCAPPED_DATA_EXPORT"


@dataclass
class EnqueueRefusal:
    """Why a full export was not queued, as an HTTP status and a message."""

    status: int
    message: str


@dataclass
class EnqueueAccepted:
    """The queued job's id, which the requester polls for status."""

    job_id: str


def is_full_export_enabled() -> bool:
    """Whether this deployment offers uncapped exports at all.

    Both halves have to hold: the operator turned the feature on *and* the
    deployment can actually deliver one. The UI hides the action on the same
    predicate, through the bootstrap payload's ``common.conf``.
    """
    return is_feature_enabled(FEATURE_FLAG) and is_full_export_available()


def enqueue_full_export(
    *,
    kind: str,
    target: str,
    payload: dict[str, Any],
) -> EnqueueAccepted | EnqueueRefusal:
    """Queue a full export of ``payload`` for the current user.

    :param kind: ``"chart"`` or ``"query"``
    :param target: identifies the exported object within its kind, for the
        one-export-at-a-time lock
    :param payload: handed to the task, which rebuilds the export from it
    :returns: the job id, or the refusal to turn into a response
    """
    if not is_feature_enabled(FEATURE_FLAG):
        return EnqueueRefusal(
            404, __("Uncapped data exports are not enabled on this server.")
        )
    if not is_full_export_available():
        # Deliberately not a direct download fallback: a response-bound
        # download is bounded by the request timeout, which is the limit this
        # feature exists to remove. Say what is missing instead.
        return EnqueueRefusal(
            400,
            __(
                "Uncapped data exports need background exports to be "
                "configured. Ask an administrator to set up export storage "
                "and a Celery worker."
            ),
        )

    user_id = get_user_id()
    if user_id is None:
        # A guest or anonymous session has no address to send the link to and
        # no durable identity to run an uncapped query under.
        return EnqueueRefusal(
            403, __("Uncapped data exports require a signed-in user.")
        )

    lock_params = export_lock_params(user_id, kind, target)
    hard_limit = int(current_app.config["FULL_DATA_EXPORT_HARD_TIME_LIMIT"])
    acquire_lock = AcquireDistributedLock(
        EXPORT_LOCK_NAMESPACE,
        lock_params,
        # Outlives the hard time limit so a worker killed at that limit (which
        # skips the task's release) cannot hold the lock forever.
        ttl_seconds=hard_limit + 60,
    )
    try:
        acquire_lock.run()
    except LockAlreadyHeldException:
        return EnqueueRefusal(
            409, __("A full export of this data is already in progress.")
        )

    job_id = str(uuid.uuid4())
    try:
        export_full_data.apply_async(
            kwargs={
                "kind": kind,
                "payload": payload,
                "user_id": user_id,
                "job_id": job_id,
                "lock_params": lock_params,
                # Every release is checked against this token, so an export
                # that outlives the TTL cannot delete the lock of whoever
                # acquired next.
                "lock_token": acquire_lock.token,
            },
            task_id=job_id,
            soft_time_limit=int(current_app.config["FULL_DATA_EXPORT_SOFT_TIME_LIMIT"]),
            time_limit=hard_limit,
        )
    except Exception:
        # No task will release the lock if enqueueing fails.
        release_lock(lock_params, acquire_lock.token)
        raise
    return EnqueueAccepted(job_id)


__all__ = [
    "EnqueueAccepted",
    "EnqueueRefusal",
    "FEATURE_FLAG",
    "KIND_CHART",
    "KIND_QUERY",
    "enqueue_full_export",
    "is_full_export_enabled",
]
