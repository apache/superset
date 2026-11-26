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
Celery task that exports every row a chart's or a SQL Lab query's SQL returns
to a CSV file, uploads it to the configured export storage (see
``EXPORT_STORAGE``), and records a download link (see
``superset.data_export.links``) that is emailed to the requesting user and
resolved by polling ``GET /api/v1/data_export/status/<job_id>/``.

Neither ``ROW_LIMIT`` nor ``SQL_MAX_ROW`` is applied: the point of this path
is to be the one export that is not bounded by them. What *is* bounded is the
task's own execution budget (``FULL_DATA_EXPORT_SOFT_TIME_LIMIT``), and the
export's memory: rows are fetched in batches from a server-side cursor and
appended to a file on disk, so a worker's footprint does not grow with the
size of the result.

The query runs under the requesting user, and its SQL is generated here
rather than carried through the broker, so the export sees exactly the
datasets and row-level-security rules they would see on screen.
"""

from __future__ import annotations

import logging
import os
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app

from superset import security_manager
from superset.commands.distributed_lock.release import ReleaseDistributedLock
from superset.commands.streaming_export.base import encode_csv_stream
from superset.data_export import email
from superset.data_export.links import LINKS
from superset.data_export.sources import FullExportSource, resolve_source
from superset.data_export.storage import is_full_export_available, resolve_object_key
from superset.exceptions import SupersetErrorException, SupersetException
from superset.extensions import celery_app, event_logger
from superset.utils.core import override_user
from superset.utils.export_links import STATUS_READY

logger = logging.getLogger(__name__)

# Defaults for the decorator, which is evaluated at import time and so cannot
# read config. The enqueueing API passes the configured
# ``FULL_DATA_EXPORT_SOFT_TIME_LIMIT`` / ``FULL_DATA_EXPORT_HARD_TIME_LIMIT``
# per call, which is what actually takes effect.
DEFAULT_SOFT_TIME_LIMIT = 3600
DEFAULT_HARD_TIME_LIMIT = 3660

# Namespace for the per-user+target in-flight lock the API acquires before
# enqueue and this task releases when it settles. The lock uses the shared,
# atomic DistributedLock backend (Redis when configured, the metadata DB
# otherwise) so it actually synchronizes across the web server and workers --
# unlike a plain cache, which is a no-op under the default ``NullCache``.
EXPORT_LOCK_NAMESPACE = "full_data_export"

CSV_MIMETYPE = "text/csv"

_GENERIC_FAILURE_MESSAGE = (
    "An error occurred while generating the file. Please try again, or "
    "contact your administrator if the problem persists."
)
_TIMEOUT_FAILURE_MESSAGE = (
    "The export took too long to finish and was stopped. Try narrowing the "
    "query, or ask an administrator to raise the export time limit."
)


def export_lock_params(user_id: int, kind: str, target: str) -> dict[str, Any]:
    """Key parameters identifying the per-user+target in-flight lock.

    ``target`` is whatever identifies the thing being exported within its kind
    (a chart id, a SQL Lab client id), so one user can export two different
    charts at once but cannot queue the same one twice.
    """
    return {"user_id": user_id, "kind": kind, "target": target}


def release_lock(lock_params: dict[str, Any], lock_token: str | None) -> None:
    """Release the in-flight lock, best effort: its TTL is the backstop.

    The token is compared on delete, so a task that outlived the TTL cannot
    free the lock of whoever acquired it next.
    """
    try:
        ReleaseDistributedLock(
            EXPORT_LOCK_NAMESPACE, lock_params, token=lock_token
        ).run()
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to release in-flight full export lock %s", lock_params)


def _link_ttl() -> int:
    return int(current_app.config["FULL_DATA_EXPORT_LINK_TTL_SECONDS"])


def _csv_encoding() -> str:
    return current_app.config["CSV_EXPORT"].get("encoding", "utf-8")


def _mark_running(job_id: str) -> None:
    """Tell pollers execution has begun (vs. queued); best-effort, the export
    must not fail over a status write."""
    try:
        hard_limit = int(current_app.config["FULL_DATA_EXPORT_HARD_TIME_LIMIT"])
        # Naive local time: KeyValueEntry.is_expired() compares against naive
        # datetime.now(), like every other writer into this store.
        LINKS.mark_export_running(
            uuid.UUID(job_id), datetime.now() + timedelta(seconds=hard_limit + 300)
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to record running status for %s", job_id)


def _actionable_reason(error: BaseException) -> str | None:
    """The requester-facing explanation for ``error``, if it has one.

    A ``SupersetErrorException`` raised with a 4xx status is something the
    requester can act on (e.g. a query whose row cap cannot be removed), so
    its message is worth repeating back. Everything else stays generic rather
    than leaking an internal error into an email.
    """
    if isinstance(error, SupersetErrorException) and 400 <= error.status < 500:
        return str(error.error.message)
    return None


def _handle_failure(  # pylint: disable=too-many-arguments
    *,
    job_id: str,
    user: Any,
    label: str,
    requested_at: datetime,
    message: str,
    reason: str | None,
) -> None:
    """Notify the requester their export failed and record it.

    Recorded for pollers first: on a soft timeout only the gap to the hard
    limit remains, and a slow SMTP send must not cost them the status.
    """
    # A soft time limit can land after the upload and its link were recorded;
    # replacing that record would strand a file that is already downloadable.
    try:
        current = LINKS.get_export_status(uuid.UUID(job_id))
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to read export status for %s", job_id)
        current = None
    if current and current.get("status") == STATUS_READY:
        logger.warning(
            "Full data export %s completed before its failure was handled; "
            "keeping the download link",
            job_id,
        )
        return
    try:
        LINKS.mark_export_failed(
            uuid.UUID(job_id),
            reason or message,
            datetime.now() + timedelta(seconds=_link_ttl()),
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to record export failure status for %s", job_id)
    if user and getattr(user, "email", None):
        try:
            email.send_export_email(
                user.email,
                email.build_subject(label, success=False),
                email.build_failure_email(label, requested_at, reason),
            )
        except Exception:  # pylint: disable=broad-except
            logger.exception("Failed to send full export failure email")


def _audit(
    *,
    action: str,
    job_id: str,
    source: FullExportSource | None,
    kind: str,
    duration: timedelta,
    **extra: Any,
) -> None:
    """Record the export in the audit log.

    Written from the worker because the row count -- the one number an
    operator reviewing an uncapped export actually wants -- is only known once
    the file is complete. The request that queued the job is logged separately,
    by the endpoint's own ``log_this_with_context``.

    Best effort: an export that succeeded must not be reported as failed
    because the log write did.
    """
    try:
        event_logger.log_with_context(
            action=action,
            duration=duration,
            include_request_data=False,
            job_id=job_id,
            export_kind=kind,
            export_label=source.label if source else None,
            **(source.audit if source else {}),
            **extra,
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to write the audit log entry for export %s", job_id)


def _resolve_user(user_id: int) -> Any:
    user = security_manager.get_user_by_id(user_id)
    if user is None:
        # The requester was deleted while the job sat queued. Running the
        # query as nobody would run it unfiltered, so refuse.
        raise SupersetException(f"User {user_id} no longer exists")
    return user


def _stream_to_file(source: FullExportSource, path: str, encoding: str) -> None:
    """Run the export and write its CSV to ``path``.

    The chunks are encoded with the configured ``CSV_EXPORT`` encoding, the
    same way the response-bound streaming export encodes them, so a codec
    with a preamble (the default ``utf-8-sig``) writes its byte order mark
    once at the start of the file.
    """
    stream = source.command.run()
    with open(path, "wb") as handle:
        for chunk in encode_csv_stream(stream(), encoding):
            handle.write(chunk)


@celery_app.task(
    name="export_full_data",
    bind=True,
    soft_time_limit=DEFAULT_SOFT_TIME_LIMIT,
    time_limit=DEFAULT_HARD_TIME_LIMIT,
    max_retries=0,
)
def export_full_data(  # pylint: disable=too-many-locals,too-many-statements
    self: Any,  # pylint: disable=unused-argument
    kind: str,
    payload: dict[str, Any],
    user_id: int,
    job_id: str,
    lock_params: dict[str, Any] | None = None,
    lock_token: str | None = None,
) -> None:
    """
    Export every row of a chart's or a SQL Lab query's result to a CSV and
    record a download link.

    :param kind: ``"chart"`` or ``"query"`` (see ``superset.data_export.sources``)
    :param payload: the JSON description of what to export, rebuilt into a
        streaming command inside this task
    :param user_id: the requesting user; the query runs with their permissions
    :param job_id: correlation id, also the Celery task id and storage object name
    :param lock_params: the API's in-flight lock key, released when the task
        settles
    :param lock_token: the API's lock acquisition token, matched on release so
        a task that outlives the TTL cannot free a later holder's lock
    """
    requested_at = datetime.now(tz=timezone.utc)
    started_at = datetime.now()
    user: Any = None
    source: FullExportSource | None = None
    label = ""
    tmp_path: str | None = None
    rows_written = 0
    bytes_written = 0

    def progress(rows: int, written: int) -> None:
        nonlocal rows_written, bytes_written
        rows_written, bytes_written = rows, written

    try:
        _mark_running(job_id)
        # Resolve the user inside the protected block: if this raises, the
        # ``finally`` below must still release the lock the API acquired, and
        # the failure must still be recorded for pollers.
        user = _resolve_user(user_id)
        with override_user(user, force=False):
            if not is_full_export_available():
                # The API only queues when this holds, so reaching it here
                # means EXPORT_STORAGE was cleared after the job was enqueued
                # (or the task was invoked directly). Fail with a clear
                # message instead of an opaque storage-SDK error.
                raise SupersetException(
                    "Full data exports are not configured on this server: "
                    "EXPORT_STORAGE needs both a 'bucket' and a 'backend' "
                    "(e.g. superset.utils.s3.S3ExportStorage())."
                )

            chunk_size = int(current_app.config["FULL_DATA_EXPORT_CHUNK_SIZE"])
            source = resolve_source(kind, payload, chunk_size, progress)
            label = source.label
            # Re-check access here, not only at request time: the job may have
            # sat queued while the user's roles, the dataset's permissions or
            # its RLS rules changed.
            source.command.validate()

            file_descriptor, tmp_path = tempfile.mkstemp(
                suffix=".csv", prefix=f"full-export-{job_id}-"
            )
            os.close(file_descriptor)
            encoding = _csv_encoding()
            _stream_to_file(source, tmp_path, encoding)

            storage_config = current_app.config["EXPORT_STORAGE"]
            storage_backend = storage_config["backend"]
            bucket = storage_config["bucket"]
            key = resolve_object_key(source.kind, job_id)
            storage_backend.upload_file(tmp_path, bucket, key)

            ttl = _link_ttl()
            # Naive local time to match KeyValueEntry.is_expired().
            expires_at = datetime.now() + timedelta(seconds=ttl)
            backend_cls = type(storage_backend)
            download_url = LINKS.create_download_link(
                uuid.UUID(job_id),
                bucket,
                key,
                expires_at,
                backend=f"{backend_cls.__module__}.{backend_cls.__qualname__}",
                filename=f"{source.filename}.csv",
                mimetype=f"{CSV_MIMETYPE}; charset={encoding}",
                row_count=rows_written,
            )

            _audit(
                action="full_data_export",
                job_id=job_id,
                source=source,
                kind=kind,
                duration=datetime.now() - started_at,
                row_count=rows_written,
                byte_count=bytes_written,
                status="success",
            )

            if getattr(user, "email", None):
                try:
                    email.send_export_email(
                        user.email,
                        email.build_subject(label, success=True),
                        email.build_success_email(
                            label=label,
                            download_url=download_url,
                            row_count=rows_written,
                            requested_at=requested_at,
                            # Stored naive-local to match is_expired(); the
                            # email labels its timestamps "UTC", so convert.
                            expires_at=expires_at.astimezone(timezone.utc),
                            ttl_seconds=ttl,
                            partial_note=payload.get("partial_note"),
                        ),
                    )
                except Exception:  # pylint: disable=broad-except
                    # The file is uploaded and the link recorded; a send
                    # failure must not trigger a misleading failure email.
                    logger.exception("Failed to send full export success email")
    except SoftTimeLimitExceeded:
        logger.warning(
            "Full data export %s timed out after %s rows", job_id, rows_written
        )
        _audit(
            action="full_data_export",
            job_id=job_id,
            source=source,
            kind=kind,
            duration=datetime.now() - started_at,
            row_count=rows_written,
            byte_count=bytes_written,
            status="timeout",
        )
        _handle_failure(
            job_id=job_id,
            user=user,
            label=label,
            requested_at=requested_at,
            message=_TIMEOUT_FAILURE_MESSAGE,
            reason=_TIMEOUT_FAILURE_MESSAGE,
        )
        raise
    except Exception as ex:
        logger.exception("Full data export %s failed", job_id)
        _audit(
            action="full_data_export",
            job_id=job_id,
            source=source,
            kind=kind,
            duration=datetime.now() - started_at,
            row_count=rows_written,
            byte_count=bytes_written,
            status="error",
            error_type=type(ex).__name__,
        )
        _handle_failure(
            job_id=job_id,
            user=user,
            label=label,
            requested_at=requested_at,
            message=_GENERIC_FAILURE_MESSAGE,
            reason=_actionable_reason(ex),
        )
        raise
    finally:
        if lock_params is not None:
            release_lock(lock_params, lock_token)
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
