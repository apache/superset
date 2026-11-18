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
The transfer routes, where an agent's shell moves an artifact's bytes with the
links that the authoring tools mint (``transfer``):

- ``PUT /extensions/superset-oss/artifacts/transfer/blobs/<token>``: the body
  is one blob's exact bytes, checked against the hash its link names, within
  the policy's size limit for a file;
- ``GET /extensions/superset-oss/artifacts/transfer/versions/<token>``: a tar
  of the version its link names, with the land sidecar.

The link's token is the only credential: the routes read no session and need
no role. So a cross-site request gains nothing from the viewer's cookies, and
the upload route can be exempt from CSRF checks, which it needs, as a shell
has no CSRF token: ``WTF_CSRF_EXEMPT_LIST`` names it (``UPLOAD_VIEW``). Until
a deployment exempts it, the tools offer no upload links, and agents upload
in a tool call instead.
"""

from __future__ import annotations

import logging
import tempfile

from flask import request, Response, send_file
from flask_appbuilder.api import expose, safe
from superset_core.rest_api.api import RestApi
from superset_core.rest_api.decorators import api
from superset_oss.artifacts.authoring.transfer import (
    InvalidTransferError,
    receive_blob,
)
from superset_oss.artifacts.errors import ArtifactError, ExtensionErrorCode
from superset_oss.artifacts.gate import open_artifacts
from superset_oss.artifacts.web import error_response, transfer_signer

logger = logging.getLogger(__name__)


def _invalid_link(ex: InvalidTransferError) -> Response:
    return error_response(
        ArtifactError(ExtensionErrorCode.TRANSFER_LINK_INVALID, str(ex))
    )


@api(
    id="transfer",
    name="Artifact transfers",
    description="Short-lived links that upload a blob or download a version",
    resource_name="transfer",
)
class ArtifactTransferRestApi(RestApi):
    """Uploads and downloads by link, for agents that move bytes with a shell."""

    openapi_spec_tag = "Artifacts"

    @expose("/blobs/<token>", methods=("PUT",))
    @safe
    def upload(self, token: str) -> Response:
        """Store one blob that a commit by hash lacks.
        ---
        put:
          summary: Upload one blob's bytes by link
          parameters:
          - in: path
            name: token
            schema:
              type: string
          requestBody:
            content:
              application/octet-stream:
                schema:
                  type: string
                  format: binary
          responses:
            200:
              description: The blob's SHA-256
            400:
              $ref: '#/components/responses/400'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            413:
              description: The blob is over the policy's size limit for a file
        """
        try:
            artifacts = open_artifacts()
            transfer = transfer_signer().verify(token, "blob")
            stored = receive_blob(
                artifacts.store,
                artifacts.policy,
                transfer,
                request.stream.read,
                request.content_length,
            )
        except ArtifactError as ex:
            return error_response(ex)
        except InvalidTransferError as ex:
            return _invalid_link(ex)
        logger.info(
            "Artifacts: user %s uploaded blob %s for artifact %s",
            transfer.actor,
            stored,
            transfer.artifact_id,
        )
        return self.response(200, result={"sha256": stored})

    @expose("/versions/<token>", methods=("GET",))
    @safe
    def download(self, token: str) -> Response:
        """A tar of one version, and the land sidecar.
        ---
        get:
          summary: Download a version as a tar by link
          parameters:
          - in: path
            name: token
            schema:
              type: string
          responses:
            200:
              description: The tar
              content:
                application/x-tar:
                  schema:
                    type: string
                    format: binary
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            artifacts = open_artifacts()
            transfer = transfer_signer().verify(token, "version")
        except ArtifactError as ex:
            return error_response(ex)
        except InvalidTransferError as ex:
            return _invalid_link(ex)
        archive = tempfile.TemporaryFile()  # noqa: SIM115 -- the response closes it
        try:
            artifacts.store.archive(transfer.artifact_id, transfer.target, archive)
        except ArtifactError as ex:
            archive.close()
            return error_response(ex)
        archive.seek(0)
        response = send_file(
            archive,
            mimetype="application/x-tar",
            as_attachment=True,
            download_name=f"artifact-{transfer.target[:12]}.tar",
        )
        response.headers["Cache-Control"] = "no-store"
        return response
