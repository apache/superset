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

A raw S3 pre-signed URL is only valid for as long as *both* its own
``ExpiresIn`` window and the credentials that signed it remain valid.
Deployments whose S3 client authenticates via short-lived, auto-refreshed
credentials (e.g. an EKS IRSA role assumed through
``AssumeRoleWithWebIdentity``, which AWS caps at 12 hours and many clusters
default to far less) can silently invalidate a pre-signed URL long before the
``EXCEL_EXPORT_LINK_TTL_SECONDS`` window promised in the export email elapses,
since the *credentials'* session -- not just the URL's own ``ExpiresIn`` --
bounds how long it actually works.

To keep that promise regardless of credential lifetime, the email links to a
small Superset redirect endpoint instead of a raw S3 URL. The link's own
lifetime is enforced by this module via the ``key_value`` store's
``expires_on`` (independent of any credential session), and the actual
pre-signed URL is generated fresh -- with then-current credentials -- at click
time, valid only long enough to complete a single download.

The redirect endpoint (``download_xlsx``) intentionally requires no login: a
pre-signed S3 URL never did either, and the access-control decision for the
underlying dashboard was already enforced once, when the export was
originally requested (see ``security_manager.raise_for_access`` in
``superset.dashboards.api.export_xlsx``). The unguessable key emailed only to
that requester's own address is the same "possession of the link is the
credential" model the raw pre-signed URL had; this module just re-signs it
closer to when it is actually used.

Every entry is keyed by ``job_id`` -- the same id the ``export_xlsx`` POST
response hands back -- rather than a separately-generated identifier, so a
caller that only has the job id (e.g. a polling frontend for a session with
no email on file, such as an embedded/guest dashboard) can resolve both
status and, once ready, a download link from that one id.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from superset.daos.key_value import KeyValueDAO
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource
from superset.utils.decorators import transaction
from superset.utils.urls import headless_url

RESOURCE = KeyValueResource.EXCEL_EXPORT_DOWNLOAD
CODEC = JsonKeyValueCodec()

# The fresh pre-signed URL generated at click time only needs to outlive the
# redirect and the browser/S3 handshake that follows it, not the link's own
# multi-hour lifetime.
PRESIGNED_URL_TTL_SECONDS = 300

DOWNLOAD_PATH = "/api/v1/dashboard/export_xlsx/download/{job_id}/"

STATUS_READY = "ready"
STATUS_ERROR = "error"
STATUS_RUNNING = "running"


@transaction()
def _sweep_and_upsert(
    job_id: UUID, value: dict[str, Any], expires_at: datetime
) -> None:
    # Lazily sweep expired entries each time one is written; there is no
    # dedicated cleanup job, so this resource keeps itself tidy on write.
    # upsert (not create) so a retried/duplicate write for the same job_id
    # overwrites cleanly instead of colliding on the primary key.
    # @transaction commits now; the worker session otherwise only commits when
    # the task settles, leaving statuses invisible to polling web pods.
    KeyValueDAO.delete_expired_entries(RESOURCE)
    KeyValueDAO.upsert_entry(
        resource=RESOURCE,
        value=value,
        codec=CODEC,
        key=job_id,
        expires_on=expires_at,
    )


def build_download_url(job_id: UUID) -> str:
    """The browser-facing URL that redirects to a freshly pre-signed S3 URL
    for ``job_id``, once its export is ready."""
    return headless_url(DOWNLOAD_PATH.format(job_id=job_id), user_friendly=True)


def create_download_link(
    job_id: UUID, bucket: str, key: str, expires_at: datetime, backend: str
) -> str:
    """Record that ``job_id``'s export succeeded and is downloadable from
    ``key`` in ``bucket`` until ``expires_at``, and return the download URL
    (used in the success email).

    ``backend`` is the dotted path of the ``ExportStorage`` class that
    uploaded the file; the download redirect refuses to sign with a different
    backend (see ``download_xlsx``), failing clearly after a storage migration
    instead of minting a URL for the wrong provider.

    ``expires_at`` should be a naive datetime in the same timezone convention
    ``KeyValueEntry.is_expired()`` compares against (naive ``datetime.now()``).
    """
    _sweep_and_upsert(
        job_id,
        {"status": STATUS_READY, "bucket": bucket, "key": key, "backend": backend},
        expires_at,
    )
    return build_download_url(job_id)


def mark_export_running(job_id: UUID, expires_at: datetime) -> None:
    """Record that a worker has started executing ``job_id`` (as opposed to
    still sitting in the queue), so a polling client can wait out broker
    backlog without racing the task's execution budget, which only starts
    here. Overwritten by the terminal record; ``expires_at`` is the backstop
    if the worker dies first.
    """
    _sweep_and_upsert(job_id, {"status": STATUS_RUNNING}, expires_at)


def mark_export_failed(job_id: UUID, message: str, expires_at: datetime) -> None:
    """Record that ``job_id``'s export failed, so a polling client can
    distinguish "failed" from "still running" instead of retrying a missing
    key forever. ``message`` is shown to whoever is polling, so keep it
    generic rather than an internal exception string.
    """
    _sweep_and_upsert(job_id, {"status": STATUS_ERROR, "message": message}, expires_at)


def get_export_status(job_id: UUID) -> dict[str, Any] | None:
    """The stored status payload for ``job_id``, or ``None`` if it is unknown
    (still running, or never existed) or has expired."""
    return KeyValueDAO.get_value(RESOURCE, job_id, CODEC)


def resolve_download_link(job_id: UUID) -> tuple[str, str, str | None] | None:
    """The ``(bucket, object_key, backend_path)`` for a *ready* download, or
    ``None`` if it is missing, expired, still running, or errored.
    ``backend_path`` is ``None`` for records written before it was tracked."""
    payload = get_export_status(job_id)
    if payload is None or payload.get("status") != STATUS_READY:
        return None
    return payload["bucket"], payload["key"], payload.get("backend")
