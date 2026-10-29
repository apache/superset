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
Celery task that exports every chart on a dashboard to a single multi-sheet
``.xlsx`` file, uploads it to the configured export storage (see
``EXPORT_STORAGE``), and records a download link (see
``superset.dashboards.excel_export.download_link``) that emails to the
requesting user when they have an address on file, and/or is resolved by
polling ``GET .../export_xlsx/status/<job_id>/`` when they don't.

In ``"data"`` mode the task re-runs each chart's saved query context under the
requesting user, applies the live dashboard filter state, and streams the results
row-by-row into a constant-memory workbook so large dashboards never load all
data at once. In ``"images"`` mode non-table charts are instead rendered to
images (through the same headless path as scheduled reports, reflecting the live
filters) and embedded, while table-like charts stay tabular.
"""

from __future__ import annotations

import hashlib
import logging
import os
import tempfile
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, cast

from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app

from superset import db, security_manager
from superset.commands.distributed_lock.release import ReleaseDistributedLock
from superset.dashboards.excel_export import email
from superset.dashboards.excel_export.download_link import (
    create_download_link,
    get_export_status,
    mark_export_failed,
    mark_export_running,
    STATUS_READY,
)
from superset.dashboards.excel_export.storage import is_export_storage_configured
from superset.dashboards.excel_export.workbook import build_workbook, EXPORT_MODE_DATA
from superset.exceptions import SupersetException
from superset.extensions import celery_app
from superset.security.guest_token import GuestToken
from superset.utils import json
from superset.utils.core import override_user
from superset.utils.export_storage import ExportStorage

logger = logging.getLogger(__name__)

EXPORT_SOFT_TIME_LIMIT = 600
EXPORT_HARD_TIME_LIMIT = 660

# Guest-initiated exports cap their download-link lifetime: guests retrieve the
# file through the polling window right after the export and have no email to
# revisit a link from later, so the link should not outlive by a day the
# short-lived credential that authorized it.
GUEST_LINK_TTL_SECONDS = 60 * 60

# Namespace + TTL for the per-user+dashboard in-flight lock the API acquires
# before enqueue and this task releases when it settles. The lock uses the
# shared, atomic DistributedLock backend (Redis when configured, the metadata
# DB otherwise) so it actually synchronizes across the web server and workers —
# unlike a plain cache, which is a no-op under the default ``NullCache``.
# The TTL outlives the hard time limit so a worker killed at that limit (which
# skips the ``finally`` release) cannot hold the lock forever; the release in
# ``finally`` is the fast path that frees it as soon as the task settles.
EXPORT_LOCK_NAMESPACE = "excel_export"
EXPORT_LOCK_TTL_SECONDS = EXPORT_HARD_TIME_LIMIT + 60


def export_lock_params(user_id: int, dashboard_id: int) -> dict[str, int]:
    """Key parameters identifying the per-user+dashboard in-flight lock."""
    return {"user_id": user_id, "dashboard_id": dashboard_id}


def guest_lock_slot(guest_token: GuestToken | None) -> int:
    """A stable per-guest lock slot derived from the token's identity
    (username, resources, RLS rules, and dataset allowlist), so concurrent
    guests on the same dashboard throttle independently instead of all sharing
    slot 0 (where the second guest's export is refused with no job id and no
    email fallback). RLS rules and the ``datasets`` allowlist are part of the
    fingerprint because they are what distinguish embedded guests sharing a
    dashboard when the username is shared or absent. Anonymous requesters (no
    token) share 0.
    """
    if not guest_token:
        return 0
    user = guest_token.get("user") or {}
    fingerprint = json.dumps(
        {
            "username": user.get("username"),
            "resources": guest_token.get("resources") or [],
            "rls": guest_token.get("rls_rules") or [],
            "datasets": guest_token.get("datasets") or [],
        },
        sort_keys=True,
        default=str,
    )
    digest = hashlib.sha256(fingerprint.encode()).digest()
    return int.from_bytes(digest[:8], "big")


_GENERIC_FAILURE_MESSAGE = (
    "An error occurred while generating the file. Please try again, or "
    "contact your administrator if the problem persists."
)


def _handle_export_failure(
    user: Any, dashboard_title: str, requested_at: datetime, job_id: str, ttl: int
) -> None:
    """Notify the requester their export failed: email them if they have an
    address on file, and record a pollable failure status either way (a
    session with no email, e.g. an embedded/guest dashboard, has no other way
    to learn the export failed than polling ``export_xlsx/status/<job_id>/``).
    """
    # A soft time limit can land after the upload and its link were recorded;
    # replacing that record would strand a file that is already downloadable.
    try:
        current = get_export_status(uuid.UUID(job_id))
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to read export status for %s", job_id)
        current = None
    if current and current.get("status") == STATUS_READY:
        logger.warning(
            "Dashboard excel export %s completed before its failure was handled; "
            "keeping the download link",
            job_id,
        )
        return
    # Status first: on a soft timeout only 60s remain before the hard kill,
    # and a slow SMTP send must not cost pollers the failure status.
    try:
        # Naive local time: KeyValueEntry.is_expired() compares against naive
        # datetime.now(), like every other writer into this store.
        mark_export_failed(
            uuid.UUID(job_id),
            _GENERIC_FAILURE_MESSAGE,
            datetime.now() + timedelta(seconds=ttl),
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to record export failure status for %s", job_id)
    if user and getattr(user, "email", None):
        try:
            email.send_export_email(
                user.email,
                email.build_subject(dashboard_title, success=False),
                email.build_failure_email(dashboard_title, requested_at),
            )
        except Exception:  # pylint: disable=broad-except
            logger.exception("Failed to send export failure email")


def _resolve_export_storage(
    dashboard_id: int, job_id: str
) -> tuple[ExportStorage, str, str]:
    """The configured storage backend, bucket, and this export's object key.

    The API only queues this task when ``is_export_storage_configured()``
    holds, so reaching this unconfigured normally means EXPORT_STORAGE was
    cleared after the job was enqueued (or the task was invoked directly,
    bypassing the API). Fail with a clear message instead of an opaque
    storage-SDK error.
    """
    # Same predicate the API uses to choose the queued path.
    if not is_export_storage_configured():
        raise SupersetException(
            "Excel export is not configured on this server: "
            "EXPORT_STORAGE needs both a 'bucket' and a 'backend' "
            "(e.g. superset.utils.s3.S3ExportStorage())."
        )
    storage_config = current_app.config["EXPORT_STORAGE"]
    key_prefix = storage_config.get("key_prefix", "dashboard-exports/")
    if callable(key_prefix):
        # A callable prefix is resolved per export, for deployments where it
        # is only known in task context (e.g. a multi-tenant installation
        # scoping a shared bucket per tenant).
        key_prefix = key_prefix()
    return (
        storage_config["backend"],
        storage_config["bucket"],
        f"{key_prefix}{dashboard_id}/{job_id}.xlsx",
    )


def _mark_running(job_id: str) -> None:
    """Tell pollers execution has begun (vs. queued); best-effort, the export
    must not fail over a status write."""
    try:
        expires_at = datetime.now() + timedelta(seconds=EXPORT_HARD_TIME_LIMIT + 300)
        mark_export_running(uuid.UUID(job_id), expires_at)
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to record running status for %s", job_id)


def _resolve_requesting_user(
    user_id: int | None, guest_token: GuestToken | None
) -> Any:
    if user_id is not None:
        return security_manager.get_user_by_id(user_id)
    if guest_token:
        # The token's signature/exp were verified at request time, but the
        # export can sit queued: re-run the request-path guest checks so a
        # token that has since expired or been revoked cannot execute chart
        # queries. (Such a guest can no longer reach the @protect-ed status
        # endpoint to retrieve the result anyway, and has no email fallback,
        # so nothing servable is lost.)
        exp = guest_token.get("exp")
        if exp is not None and exp < time.time():
            raise SupersetException("The guest token has expired.")
        if security_manager._is_guest_token_revoked(  # noqa: SLF001
            cast(dict[str, Any], guest_token)
        ):
            raise SupersetException("The guest token has been revoked.")
        return security_manager.get_guest_user_from_token(guest_token)
    # Anonymous requester: run under the anonymous principal so the Public
    # role applies, mirroring superset.tasks.async_queries.
    return security_manager.get_anonymous_user()


@celery_app.task(
    name="export_dashboard_excel",
    bind=True,
    soft_time_limit=EXPORT_SOFT_TIME_LIMIT,
    time_limit=EXPORT_HARD_TIME_LIMIT,
    max_retries=0,
)
def export_dashboard_excel(
    self: Any,  # pylint: disable=unused-argument
    dashboard_id: int,
    user_id: int | None,
    active_data_mask: dict[str, Any],
    job_id: str,
    mode: str = EXPORT_MODE_DATA,
    guest_token: GuestToken | None = None,
    lock_token: str | None = None,
) -> None:
    """
    Export a dashboard's charts to an ``.xlsx`` and record a download link.

    :param dashboard_id: The dashboard to export
    :param user_id: The requesting user (the task runs with their permissions),
        or ``None`` for a guest/embedded requester
    :param active_data_mask: Live dashboard filter state keyed by native filter id
    :param job_id: Correlation id, also the Celery task id and storage object name
    :param mode: ``"data"`` streams every chart's tabular result; ``"images"``
        embeds non-table charts as rendered images and keeps tables tabular
    :param guest_token: The guest token payload when the requester is an
        embedded guest; the guest user is reconstructed from it so the export
        runs under the token's RLS rules and resource claims, never under an
        elevated identity
    :param lock_token: The API's in-flight lock acquisition token, matched on
        release so a task that outlives the TTL cannot free a later holder's
        lock. ``None`` releases unconditionally, for tasks enqueued before the
        token was threaded through.
    """
    # pylint: disable=import-outside-toplevel
    from superset.models.dashboard import Dashboard

    requested_at = datetime.now(tz=timezone.utc)
    user = None
    dashboard_title = ""
    tmp_path: str | None = None
    ttl = current_app.config["EXCEL_EXPORT_LINK_TTL_SECONDS"]

    try:
        _mark_running(job_id)
        # Resolve the user inside the protected block: if this raises (e.g. the
        # guest role lookup fails), the ``finally`` below must still release the
        # lock the API acquired, and the failure status must still be recorded
        # for pollers.
        user = _resolve_requesting_user(user_id, guest_token)
        with override_user(user, force=False):
            dashboard = (
                db.session.query(Dashboard).filter_by(id=dashboard_id).one_or_none()
            )
            if dashboard is None:
                raise ValueError(f"Dashboard {dashboard_id} not found")
            dashboard_title = dashboard.dashboard_title or f"Dashboard {dashboard_id}"

            file_descriptor, tmp_path = tempfile.mkstemp(
                suffix=".xlsx", prefix=f"dash-export-{job_id}-"
            )
            os.close(file_descriptor)

            errored = build_workbook(
                tmp_path, dashboard, active_data_mask, job_id, mode, user
            )

            storage_backend, bucket, key = _resolve_export_storage(dashboard_id, job_id)
            storage_backend.upload_file(tmp_path, bucket, key)
            # Naive local time to match KeyValueEntry.is_expired(). A session
            # with no user id (guest or Public) retrieves the file inside the
            # polling window and has no email to revisit a link from.
            link_ttl = min(ttl, GUEST_LINK_TTL_SECONDS) if user_id is None else ttl
            expires_at = datetime.now() + timedelta(seconds=link_ttl)
            backend_cls = type(storage_backend)
            download_url = create_download_link(
                uuid.UUID(job_id),
                bucket,
                key,
                expires_at,
                backend=f"{backend_cls.__module__}.{backend_cls.__qualname__}",
            )

            if user and getattr(user, "email", None):
                try:
                    email.send_export_email(
                        user.email,
                        email.build_subject(dashboard_title, success=True),
                        email.build_success_email(
                            dashboard_title=dashboard_title,
                            download_url=download_url,
                            requested_at=requested_at,
                            # Stored naive-local to match is_expired(); the email
                            # labels its timestamps "UTC", so convert for display.
                            expires_at=expires_at.astimezone(timezone.utc),
                            ttl_seconds=link_ttl,
                            errored=errored,
                        ),
                    )
                except Exception:  # pylint: disable=broad-except
                    # The file is already uploaded; a send failure should not trigger
                    # a misleading failure email.
                    logger.exception("Failed to send export success email")
    except SoftTimeLimitExceeded:
        logger.warning("Dashboard excel export %s timed out", job_id)
        _handle_export_failure(user, dashboard_title, requested_at, job_id, ttl)
        raise
    except Exception:
        logger.exception("Dashboard excel export %s failed", job_id)
        _handle_export_failure(user, dashboard_title, requested_at, job_id, ttl)
        raise
    finally:
        try:
            ReleaseDistributedLock(
                EXPORT_LOCK_NAMESPACE,
                # Must mirror the key the API acquired: guests get a stable
                # slot from their token identity, anonymous sessions share 0.
                export_lock_params(
                    user_id or guest_lock_slot(guest_token), dashboard_id
                ),
                # Compare-and-delete on the API's acquisition token: if the
                # lock's TTL expired and another export reacquired the key,
                # this release must not delete the new holder's lock.
                token=lock_token,
            ).run()
        except Exception:  # pylint: disable=broad-except
            # Best-effort: the lock's TTL is the backstop if this fails.
            logger.exception(
                "Failed to release in-flight export lock for user %s dashboard %s",
                user_id,
                dashboard_id,
            )
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
