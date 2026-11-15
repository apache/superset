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
The standalone artifact host (E9; DR-14, DR-15). A scaffold.

``GET /extensions/superset-oss/artifacts/embedded/artifact/<uuid>`` answers
what the thin host page needs to open one artifact's box: a short-lived frame
link from the provider, the grant and the manifest to check requests against.
The login sits with the host page, under the viewer's own session (logged-in
mode, R11); the box never gets it.

The proposal's path is ``/embedded/artifact/<uuid>``; an extension can only
mount its routes under ``/extensions/<publisher>/<name>/``.
"""

# TODO(S14): guest-token mode (R13): an ``artifact`` resource type in guest
# tokens, ``embedArtifact()`` in the embedded SDK, and this endpoint accepting
# a guest token scoped to the artifact. Guests are refused until then.
# TODO(S14): an HTML route at /embedded/artifact/<uuid> that serves the
# extension's HostPage; extensions can't contribute pages or routes.
# TODO(5.2): artifact viewers. Without them, only owners open the standalone
# page; on canvases, viewers reach artifacts through placements.
# TODO(P10): the embedding's allowed domains as allowed parents, and Manager
# OAuth for logged-in embedding on the embedded host.
# TODO(S8, S14): bindings on a standalone page need a data endpoint that runs
# an artifact's binding without a canvas placement.
# Review findings T4 (no identity fallback), T11 (Safari and iOS) and T15 (an
# abuse programme before sharing) are pending.

from __future__ import annotations

from flask import Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from superset_core.artifacts.authoring import AuthoringErrorCode
from superset_core.artifacts.provider import ArtifactRef
from superset_core.rest_api.api import RestApi
from superset_core.rest_api.decorators import api
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.frames.access import choose_version
from superset_oss.artifacts.frames.grants import frame_context, host_manifest
from superset_oss.artifacts.gate import open_artifacts
from superset_oss.artifacts.web import (
    current_actor,
    error_response,
    host_url,
    json_response,
)


@api(
    id="embedded",
    name="Standalone artifact host",
    description="What the standalone host page needs to open one artifact",
    resource_name="embedded",
)
class ArtifactEmbedRestApi(RestApi):
    # Its own permission view; see ArtifactFramesRestApi. Roles need can_read
    # on ArtifactEmbed (G2).
    class_permission_name = "ArtifactEmbed"
    openapi_spec_tag = "Artifacts"

    @expose("/artifact/<artifact_id>", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    def artifact(self, artifact_id: str) -> Response:
        """Open one artifact on a standalone page.
        ---
        get:
          summary: Get a frame link for a standalone artifact page
          parameters:
          - in: path
            name: artifact_id
            schema:
              type: string
          responses:
            200:
              description: The link, the version it loads and its grant
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            artifacts = open_artifacts()
        except ArtifactError as ex:
            return error_response(ex)
        actor = current_actor()
        if actor is None:
            # Guests (S14) and anonymous viewers have no artifact access yet.
            return self.response_401()
        store = artifacts.store
        try:
            if not store.is_owner(actor, artifact_id):
                raise ArtifactError(
                    AuthoringErrorCode.ARTIFACT_NOT_FOUND,
                    f"artifact {artifact_id!r} not found",
                )
            served = choose_version(store, actor, artifact_id)
            manifest = store.manifest_at(served.artifact_id, served.version)
        except ArtifactError as ex:
            return error_response(ex)
        context = frame_context("standalone", manifest, host_url())
        link = artifacts.provider.mint_frame_link(
            ArtifactRef(served.artifact_id, served.version), context
        )
        return json_response(
            200,
            {
                "result": {
                    "url": link.url,
                    "expires_at": link.expires_at.isoformat(),
                    "artifact_id": served.artifact_id,
                    "version": served.version,
                    "is_draft": served.is_draft,
                    "capabilities": sorted(context.capabilities),
                    "manifest": host_manifest(manifest),
                }
            },
        )
