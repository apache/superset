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
Status tracking and long-lived download links for dashboard Excel exports.

The link model -- a Superset endpoint rather than a signed storage URL, with
its lifetime enforced through the ``key_value`` store, and keyed by the job id
the enqueue response hands back -- lives in ``superset.utils.export_links``,
which this module binds to the dashboard Excel export's own resource and path.

The download endpoint (``download_xlsx``) intentionally requires no login:
the access-control decision for the underlying dashboard was already enforced
once, when the export was originally requested (see
``security_manager.raise_for_access`` in
``superset.dashboards.api.export_xlsx``); the unguessable key handed only to
that requester is the "possession of the link is the credential" model.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from superset.key_value.types import KeyValueResource
from superset.utils.export_links import (
    CODEC,
    ExportDownloadLinks,
    STATUS_ERROR,
    STATUS_READY,
    STATUS_RUNNING,
)

__all__ = [
    "CODEC",
    "DOWNLOAD_PATH",
    "RESOURCE",
    "STATUS_ERROR",
    "STATUS_READY",
    "STATUS_RUNNING",
    "build_download_url",
    "create_download_link",
    "download_path",
    "get_export_status",
    "mark_export_failed",
    "mark_export_running",
    "resolve_download_link",
]

RESOURCE = KeyValueResource.EXCEL_EXPORT_DOWNLOAD

DOWNLOAD_PATH = "/api/v1/dashboard/export_xlsx/download/{job_id}/"

_LINKS = ExportDownloadLinks(RESOURCE, DOWNLOAD_PATH)


def download_path(job_id: UUID) -> str:
    """Root-relative path of the download endpoint for ``job_id``, including
    ``APPLICATION_ROOT`` when Superset is served under a subpath. Handed to the
    polling frontend, which resolves it against its own origin (the one host
    the user is provably reachable at)."""
    return _LINKS.download_path(job_id)


def build_download_url(job_id: UUID) -> str:
    """Absolute download URL for ``job_id``, for the email (which cannot be
    origin-relative)."""
    return _LINKS.build_download_url(job_id)


def create_download_link(
    job_id: UUID, bucket: str, key: str, expires_at: datetime, backend: str
) -> str:
    """Record that ``job_id``'s export succeeded and is downloadable from
    ``key`` in ``bucket`` until ``expires_at``, and return the download URL
    (used in the success email).

    ``backend`` is the dotted path of the ``ExportStorage`` class that
    uploaded the file; the download endpoint refuses to serve with a
    different backend (see ``download_xlsx``), failing clearly after a
    storage migration instead of reading the wrong provider's bucket.

    ``expires_at`` should be a naive datetime in the same timezone convention
    ``KeyValueEntry.is_expired()`` compares against (naive ``datetime.now()``).
    """
    return _LINKS.create_download_link(job_id, bucket, key, expires_at, backend)


def mark_export_running(job_id: UUID, expires_at: datetime) -> None:
    """Record that a worker has started executing ``job_id`` (as opposed to
    still sitting in the queue), so a polling client can wait out broker
    backlog without racing the task's execution budget, which only starts
    here. Overwritten by the terminal record; ``expires_at`` is the backstop
    if the worker dies first.
    """
    _LINKS.mark_export_running(job_id, expires_at)


def mark_export_failed(job_id: UUID, message: str, expires_at: datetime) -> None:
    """Record that ``job_id``'s export failed, so a polling client can
    distinguish "failed" from "still running" instead of retrying a missing
    key forever. ``message`` is shown to whoever is polling, so keep it
    generic rather than an internal exception string.
    """
    _LINKS.mark_export_failed(job_id, message, expires_at)


def get_export_status(job_id: UUID) -> dict[str, Any] | None:
    """The stored status payload for ``job_id``, or ``None`` if it is unknown
    (still running, or never existed) or has expired."""
    return _LINKS.get_export_status(job_id)


def resolve_download_link(job_id: UUID) -> tuple[str, str, str | None] | None:
    """The ``(bucket, object_key, backend_path)`` for a *ready* download, or
    ``None`` if it is missing, expired, still running, or errored."""
    payload = _LINKS.resolve_download(job_id)
    if payload is None:
        return None
    return payload["bucket"], payload["key"], payload.get("backend")
