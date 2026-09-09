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
``.xlsx`` file, uploads it to S3, and emails the requesting user a pre-signed
download link.

The workbook itself is built by
:func:`superset.dashboards.excel_export.workbook.build_workbook`, which the
dashboard API also calls inline when no export storage is configured. This module
owns only the asynchronous concerns: the Celery task, the storage upload, email
delivery, and releasing the in-flight lock the API acquired before enqueueing.
"""

from __future__ import annotations

import logging
import os
import tempfile
from datetime import datetime, timedelta, timezone
from typing import Any

from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app

from superset import db, security_manager
from superset.commands.distributed_lock.release import ReleaseDistributedLock
from superset.dashboards.excel_export import email
from superset.dashboards.excel_export.workbook import build_workbook, EXPORT_MODE_DATA
from superset.extensions import celery_app
from superset.utils import s3
from superset.utils.core import override_user

logger = logging.getLogger(__name__)

EXPORT_SOFT_TIME_LIMIT = 600
EXPORT_HARD_TIME_LIMIT = 660

# Namespace + TTL for the per-user+dashboard in-flight lock the API acquires
# before either export path runs, released by this task when it settles (the
# synchronous path releases it in its own ``finally``). The lock uses the
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


def _send_failure_email(
    user: Any, dashboard_title: str, requested_at: datetime
) -> None:
    if not (user and getattr(user, "email", None)):
        return
    try:
        email.send_export_email(
            user.email,
            email.build_subject(dashboard_title, success=False),
            email.build_failure_email(dashboard_title, requested_at),
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to send export failure email")


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
    user_id: int,
    active_data_mask: dict[str, Any],
    job_id: str,
    mode: str = EXPORT_MODE_DATA,
) -> None:
    """
    Export a dashboard's charts to an ``.xlsx`` and email a download link.

    :param dashboard_id: The dashboard to export
    :param user_id: The requesting user (the task runs with their permissions)
    :param active_data_mask: Live dashboard filter state keyed by native filter id
    :param job_id: Correlation id, also the Celery task id and S3 object name
    :param mode: ``"data"`` streams every chart's tabular result; ``"images"``
        embeds non-table charts as rendered images and keeps tables tabular
    """
    # pylint: disable=import-outside-toplevel
    from superset.models.dashboard import Dashboard

    requested_at = datetime.now(tz=timezone.utc)
    user = security_manager.get_user_by_id(user_id)
    dashboard_title = ""
    tmp_path: str | None = None

    try:
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

            bucket = current_app.config["EXCEL_EXPORT_S3_BUCKET"]
            key = (
                f"{current_app.config['EXCEL_EXPORT_S3_KEY_PREFIX']}"
                f"{dashboard_id}/{job_id}.xlsx"
            )
            ttl = current_app.config["EXCEL_EXPORT_LINK_TTL_SECONDS"]

            s3.upload_file_to_s3(tmp_path, bucket, key)
            download_url = s3.generate_presigned_url(bucket, key, ttl)
            expires_at = datetime.now(tz=timezone.utc) + timedelta(seconds=ttl)

            if user and getattr(user, "email", None):
                try:
                    email.send_export_email(
                        user.email,
                        email.build_subject(dashboard_title, success=True),
                        email.build_success_email(
                            dashboard_title=dashboard_title,
                            download_url=download_url,
                            requested_at=requested_at,
                            expires_at=expires_at,
                            ttl_seconds=ttl,
                            errored=errored,
                        ),
                    )
                except Exception:  # pylint: disable=broad-except
                    # The file is already in S3; a send failure should not trigger
                    # a misleading failure email.
                    logger.exception("Failed to send export success email")
    except SoftTimeLimitExceeded:
        logger.warning("Dashboard excel export %s timed out", job_id)
        _send_failure_email(user, dashboard_title, requested_at)
        raise
    except Exception:
        logger.exception("Dashboard excel export %s failed", job_id)
        _send_failure_email(user, dashboard_title, requested_at)
        raise
    finally:
        try:
            ReleaseDistributedLock(
                EXPORT_LOCK_NAMESPACE,
                export_lock_params(user_id, dashboard_id),
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
