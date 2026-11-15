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
The standalone artifact host. A scaffold.

``GET /extensions/superset-oss/artifacts/embedded/artifact/<uuid>/page`` is the
thin host page that opens one artifact's box: Superset's app shell, rendering
the extension's ``HostPage``. The page then fetches
``GET /extensions/superset-oss/artifacts/embedded/artifact/<uuid>``: a
short-lived frame link from the provider, the grant and the manifest to check
requests against. Both answer only callers that ``standalone_version`` lets
in. The login sits with the host page, under the viewer's own session; the box
never gets it.

The page belongs at ``/embedded/artifact/<uuid>``, but an extension can only
mount its routes under ``/extensions/<publisher>/<name>/``.
"""

# TODO: guest-token mode: an ``artifact`` resource type in guest tokens,
# ``embedArtifact()`` in the embedded SDK, and these endpoints accepting a
# guest token scoped to the artifact. Guests are refused until then.
# TODO: artifact viewers. Without them, only owners open the standalone page;
# on canvases, viewers reach artifacts through placements.
# TODO: the embedding's allowed domains as allowed parents, and a sign-in for
# logged-in embedding on an embedded host.
# TODO: bindings on a standalone page need a data endpoint that runs an
# artifact's binding without a canvas placement.
# TODO: never fall back to another identity than the viewer's, a policy for
# Safari and iOS, and abuse handling before artifacts are shared.

from __future__ import annotations

from flask import Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from superset_core.extensions.pages import render_page
from superset_core.rest_api.api import RestApi
from superset_core.rest_api.decorators import api
from superset_oss.artifacts.constants import STANDALONE_PAGE
from superset_oss.artifacts.embedding.access import standalone_version
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.frames.access import ServedVersion
from superset_oss.artifacts.frames.links import link_payload
from superset_oss.artifacts.gate import Artifacts, open_artifacts
from superset_oss.artifacts.web import (
    current_actor,
    error_response,
    host_url,
    json_response,
)


@api(
    id="embedded",
    name="Standalone artifact host",
    description="The standalone host page for one artifact, and what it needs",
    resource_name="embedded",
)
class ArtifactEmbedRestApi(RestApi):
    """The standalone host page for one artifact, and what it needs to open it."""

    # Its own permission view; see ArtifactFramesRestApi. Roles need can_read
    # on ArtifactEmbed.
    class_permission_name = "ArtifactEmbed"
    openapi_spec_tag = "Artifacts"

    def _open(self, artifact_id: str) -> tuple[Artifacts, ServedVersion] | Response:
        """
        What a standalone page for ``artifact_id`` serves the caller, or the
        answer that refuses them: the checks the page and its link share.
        """
        try:
            artifacts = open_artifacts()
        except ArtifactError as ex:
            return error_response(ex)
        actor = current_actor()
        if actor is None:
            # Guests and anonymous viewers have no artifact access yet.
            return self.response_401()
        try:
            return artifacts, standalone_version(artifacts.store, actor, artifact_id)
        except ArtifactError as ex:
            return error_response(ex)

    @expose("/artifact/<artifact_id>", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    def artifact(self, artifact_id: str) -> Response:
        """Get what a standalone page needs to open one artifact.
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
            422:
              $ref: '#/components/responses/422'
        """
        opened = self._open(artifact_id)
        if isinstance(opened, Response):
            return opened
        artifacts, served = opened
        try:
            result = link_payload(
                artifacts.provider, artifacts.store, served, "standalone", host_url()
            )
        except ArtifactError as ex:
            return error_response(ex)
        return json_response(200, {"result": result})

    @expose("/artifact/<artifact_id>/page", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    def page(self, artifact_id: str) -> Response:
        """Open one artifact on a standalone page.
        ---
        get:
          summary: Open the standalone page for one artifact
          parameters:
          - in: path
            name: artifact_id
            schema:
              type: string
          responses:
            200:
              description: The page, which then fetches the artifact's frame link
              content:
                text/html:
                  schema:
                    type: string
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        opened = self._open(artifact_id)
        if isinstance(opened, Response):
            return opened
        _, served = opened
        # Only the artifact's id: the page fetches its single-use frame link
        # itself, so a page load that never renders spends none.
        return render_page(STANDALONE_PAGE, {"artifactId": served.artifact_id})
