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
Status polling and downloads for full data exports.

One pair of endpoints serves both kinds of full export (a chart's data and a
SQL Lab result): what they do depends only on the job id, not on what was
exported, and the requester's access to the chart or query was already
checked when they asked for the export.
"""

from __future__ import annotations

import logging
import uuid

from flask import after_this_request, current_app, Response, stream_with_context
from flask_appbuilder.api import expose, protect, safe
from werkzeug.wrappers import Response as WerkzeugResponse

from superset.data_export.links import LINKS
from superset.data_export.schemas import (
    ChartFullExportPostSchema,
    FullExportQueuedResponseSchema,
    FullExportStatusResponseSchema,
)
from superset.utils.export_links import (
    link_backend_matches,
    never_cache,
    STATUS_ERROR,
    STATUS_PENDING,
    STATUS_READY,
    STATUS_RUNNING,
)
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)

EXPIRED_MESSAGE = "This download link has expired."


class DataExportRestApi(BaseSupersetApi):
    """Delivery endpoints for uncapped exports.

    The export itself is requested from the endpoint that owns the data --
    ``/api/v1/chart/data/full_export/`` or
    ``/api/v1/sqllab/full_export/<client_id>/`` -- which is where the access
    check for that data belongs. Both hand back a job id resolved here.
    """

    resource_name = "data_export"
    allow_browser_login = True
    class_permission_name = "DataExport"
    method_permission_name = {"status": "read"}
    openapi_spec_tag = "Data Export"
    openapi_spec_component_schemas = (
        ChartFullExportPostSchema,
        FullExportQueuedResponseSchema,
        FullExportStatusResponseSchema,
    )

    def get_method_permission(self, method_name: str) -> str:
        # ``download`` is intentionally login-free (no @protect): the
        # unguessable job id is the credential, and access to the exported
        # chart or query was already checked when the export was requested.
        # Map it to no permission so FAB neither requires auth nor advertises
        # a security requirement for it in the OpenAPI spec.
        if method_name == "download":
            return ""
        return super().get_method_permission(method_name)

    @expose("/status/<uuid:job_id>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def status(self, job_id: uuid.UUID) -> WerkzeugResponse:
        """Poll the status of an in-flight or completed full data export.
        ---
        get:
          summary: Poll the status of a full data export job
          description: >-
            The requester's own session polls this instead of waiting for the
            email, so the file downloads as soon as it is ready. Behind the
            same login as the export request itself, unlike the login-free
            download stream (which also has to work when clicked from a plain
            email link, possibly with no active session at all).
          parameters:
          - in: path
            schema:
              type: string
              format: uuid
            name: job_id
            description: The job_id from the export request's response
          responses:
            200:
              description: The job's status
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/FullExportStatusResponseSchema'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        after_this_request(never_cache)
        payload = LINKS.get_export_status(job_id)
        if payload is None:
            # Unknown: still queued, already expired, or never existed. A
            # poller distinguishes the first from the others by its own
            # timeout, as it does for the dashboard Excel export.
            return self.response(200, status=STATUS_PENDING)
        status = payload.get("status")
        if status == STATUS_READY:
            # Never report ready for a link the download endpoint will refuse:
            # an unset backend (config cleared since upload) 501s there, and a
            # mismatched backend 410s. Both mean the file cannot be served.
            storage_backend = current_app.config["EXPORT_STORAGE"].get("backend")
            if storage_backend is None or not link_backend_matches(
                payload.get("backend")
            ):
                return self.response(200, status=STATUS_ERROR, message=EXPIRED_MESSAGE)
            return self.response(
                200,
                status=STATUS_READY,
                download_url=LINKS.download_path(job_id),
                row_count=payload.get("row_count"),
            )
        if status == STATUS_ERROR:
            return self.response(
                200, status=STATUS_ERROR, message=payload.get("message")
            )
        if status == STATUS_RUNNING:
            return self.response(200, status=STATUS_RUNNING)
        return self.response(200, status=STATUS_PENDING)

    @expose("/download/<uuid:job_id>/", methods=("GET",))
    @safe
    @statsd_metrics
    def download(self, job_id: uuid.UUID) -> WerkzeugResponse:
        """Stream a completed full data export from storage.
        ---
        get:
          summary: Download a completed full data export
          security: []
          description: >-
            Intentionally requires no login: the unguessable job_id, emailed
            only to the original requester (or handed to their own session via
            the status endpoint), is the credential. Access to the exported
            chart or query was checked once, when the export was requested.
            The file streams through Superset with the deployment's own storage
            credentials instead of redirecting to a signed storage URL, so it
            works for ambient identities that cannot sign (e.g. workload
            identity federation) and never mints a bearer URL Superset cannot
            observe or revoke.
          parameters:
          - in: path
            schema:
              type: string
              format: uuid
            name: job_id
            description: The job_id from the export request's response
          responses:
            200:
              description: The .csv file as an attachment
            410:
              description: The link is unknown, expired, or the export failed
            501:
              description: Full data export is not configured on this server
        """
        after_this_request(never_cache)
        payload = LINKS.resolve_download(job_id)
        if payload is None:
            return self.response(410, message=EXPIRED_MESSAGE)
        storage_backend = current_app.config["EXPORT_STORAGE"].get("backend")
        if storage_backend is None:
            # A link can only exist if a backend was configured when the
            # export ran, so reaching this means the config was cleared since.
            return self.response(
                501, message="Full data export is not configured on this server."
            )
        if not link_backend_matches(payload.get("backend")):
            # Don't read another backend's upload; expire the link instead.
            return self.response(410, message=EXPIRED_MESSAGE)
        try:
            # Existence is checked eagerly, so a missing object is a clean 410.
            size, chunks = storage_backend.download(payload["bucket"], payload["key"])
        except FileNotFoundError:
            return self.response(410, message=EXPIRED_MESSAGE)
        filename = payload.get("filename") or f"{job_id}.csv"
        return Response(
            stream_with_context(chunks),
            mimetype=payload.get("mimetype") or "text/csv",
            headers={
                # With a declared length, a stream that dies midway is a
                # failed download in the browser, not a truncated file.
                "Content-Length": str(size),
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
