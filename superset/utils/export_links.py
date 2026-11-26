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
Status tracking and long-lived download links for background exports.

The download link shared with the requester is a Superset endpoint, never a
raw or signed storage URL: signed URLs are transferable bearer credentials
Superset cannot observe or revoke once issued, their real lifetime is bounded
by the signing credentials' own session (not just their nominal expiry), and
some ambient identities (e.g. direct workload identity federation) cannot
sign at all. The link's lifetime is enforced by this module via the
``key_value`` store's ``expires_on``, and the file itself streams through
Superset with the deployment's storage credentials at click time.

The download endpoints this backs intentionally require no login: the
access-control decision for the underlying resource was already enforced
once, when the export was originally requested; the unguessable key handed
only to that requester is the "possession of the link is the credential"
model.

Every entry is keyed by ``job_id`` -- the same id the enqueue response hands
back -- rather than a separately-generated identifier, so a caller that only
has the job id (e.g. a polling frontend for a session with no email on file,
such as an embedded/guest dashboard) can resolve both status and, once ready,
a download link from that one id.

Each export kind owns an :class:`ExportDownloadLinks` instance bound to its
own ``KeyValueResource`` and download path, so one kind's links can never
resolve through another kind's endpoint.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from flask import current_app
from werkzeug.wrappers import Response

from superset.daos.key_value import KeyValueDAO
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource
from superset.utils.decorators import transaction
from superset.utils.urls import headless_url

CODEC = JsonKeyValueCodec()

STATUS_READY = "ready"
STATUS_ERROR = "error"
STATUS_RUNNING = "running"
STATUS_PENDING = "pending"


@transaction()
def _sweep_and_upsert(
    resource: KeyValueResource,
    job_id: UUID,
    value: dict[str, Any],
    expires_at: datetime,
) -> None:
    # Lazily sweep expired entries each time one is written; there is no
    # dedicated cleanup job, so this resource keeps itself tidy on write.
    # upsert (not create) so a retried/duplicate write for the same job_id
    # overwrites cleanly instead of colliding on the primary key.
    # @transaction commits now; the worker session otherwise only commits when
    # the task settles, leaving statuses invisible to polling web pods.
    KeyValueDAO.delete_expired_entries(resource)
    KeyValueDAO.upsert_entry(
        resource=resource,
        value=value,
        codec=CODEC,
        key=job_id,
        expires_on=expires_at,
    )


class ExportDownloadLinks:
    """Status and download-link records for one kind of background export.

    :param resource: the ``key_value`` resource the records live under
    :param path_template: the download endpoint's root-relative path, with a
        single ``{job_id}`` placeholder
    """

    def __init__(self, resource: KeyValueResource, path_template: str) -> None:
        self.resource = resource
        self.path_template = path_template

    def download_path(self, job_id: UUID) -> str:
        """Root-relative path of the download endpoint for ``job_id``,
        including ``APPLICATION_ROOT`` when Superset is served under a subpath.
        Handed to the polling frontend, which resolves it against its own
        origin (the one host the user is provably reachable at)."""
        path = self.path_template.format(job_id=job_id)
        app_root = (current_app.config.get("APPLICATION_ROOT") or "/").rstrip("/")
        # Prepend unconditionally: a ``startswith`` guard would drop a root that
        # merely prefixes the API path, e.g. ``APPLICATION_ROOT="/api"``.
        return f"{app_root}{path}" if app_root else path

    def build_download_url(self, job_id: UUID) -> str:
        """Absolute download URL for ``job_id``, for the email (which cannot be
        origin-relative). Based on ``WEBDRIVER_BASEURL_USER_FRIENDLY``, with
        ``APPLICATION_ROOT`` preserved (a root-absolute path would otherwise
        replace the base URL's whole path in ``urljoin``)."""
        return headless_url(self.download_path(job_id), user_friendly=True)

    def create_download_link(  # pylint: disable=too-many-arguments
        self,
        job_id: UUID,
        bucket: str,
        key: str,
        expires_at: datetime,
        backend: str,
        **extra: Any,
    ) -> str:
        """Record that ``job_id``'s export succeeded and is downloadable from
        ``key`` in ``bucket`` until ``expires_at``, and return the download URL
        (used in the success email).

        ``backend`` is the dotted path of the ``ExportStorage`` class that
        uploaded the file; the download endpoint refuses to serve with a
        different backend, failing clearly after a storage migration instead
        of reading the wrong provider's bucket.

        ``extra`` carries kind-specific values the download endpoint needs,
        such as the file name and media type to serve the object under.

        ``expires_at`` should be a naive datetime in the same timezone
        convention ``KeyValueEntry.is_expired()`` compares against (naive
        ``datetime.now()``).
        """
        _sweep_and_upsert(
            self.resource,
            job_id,
            {
                "status": STATUS_READY,
                "bucket": bucket,
                "key": key,
                "backend": backend,
                **extra,
            },
            expires_at,
        )
        return self.build_download_url(job_id)

    def mark_export_running(self, job_id: UUID, expires_at: datetime) -> None:
        """Record that a worker has started executing ``job_id`` (as opposed to
        still sitting in the queue), so a polling client can wait out broker
        backlog without racing the task's execution budget, which only starts
        here. Overwritten by the terminal record; ``expires_at`` is the backstop
        if the worker dies first.
        """
        _sweep_and_upsert(self.resource, job_id, {"status": STATUS_RUNNING}, expires_at)

    def mark_export_failed(
        self, job_id: UUID, message: str, expires_at: datetime
    ) -> None:
        """Record that ``job_id``'s export failed, so a polling client can
        distinguish "failed" from "still running" instead of retrying a missing
        key forever. ``message`` is shown to whoever is polling, so keep it
        generic rather than an internal exception string.
        """
        _sweep_and_upsert(
            self.resource,
            job_id,
            {"status": STATUS_ERROR, "message": message},
            expires_at,
        )

    def get_export_status(self, job_id: UUID) -> dict[str, Any] | None:
        """The stored status payload for ``job_id``, or ``None`` if it is
        unknown (still running, or never existed) or has expired."""
        return KeyValueDAO.get_value(self.resource, job_id, CODEC)

    def resolve_download(self, job_id: UUID) -> dict[str, Any] | None:
        """The stored payload of a *ready* download, or ``None`` if it is
        missing, expired, still running, or errored."""
        payload = self.get_export_status(job_id)
        if payload is None or payload.get("status") != STATUS_READY:
            return None
        return payload


def link_backend_matches(uploaded_backend: str | None) -> bool:
    """Whether the configured export storage backend is the one that uploaded
    the linked file (links refuse to serve across a storage migration). An
    unconfigured backend is not a mismatch: that case is answered with the
    download endpoint's explicit 501."""
    storage_backend = current_app.config["EXPORT_STORAGE"].get("backend")
    if storage_backend is None or uploaded_backend is None:
        return True
    backend_cls = type(storage_backend)
    configured = f"{backend_cls.__module__}.{backend_cls.__qualname__}"
    return uploaded_backend == configured


def never_cache(response: Response) -> Response:
    """The download URL is a bearer credential with a TTL of its own, a cached
    status would strand a poller, and the file carries query results; keep all
    of them out of every cache."""
    response.cache_control.no_store = True
    response.cache_control.no_cache = True
    response.cache_control.private = True
    response.cache_control.max_age = 0
    response.headers["Pragma"] = "no-cache"
    return response
