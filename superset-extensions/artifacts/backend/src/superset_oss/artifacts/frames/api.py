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
The frame link endpoint, ``POST /extensions/superset-oss/artifacts/frames/``.

The artifact renderer calls it for a placement it draws. The server reads the
placement's artifact and version from the stored canvas, picks the version the
caller may see, and has the provider mint a short-lived, single-use link for
it, with the context taken from the request: the allowed parents (this
Superset's origin) and the grant (the manifest's capabilities, cut to the
canvas context).
"""

from __future__ import annotations

from flask import request, Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from superset_core.rest_api.api import RestApi
from superset_core.rest_api.decorators import api
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.frames.access import choose_version
from superset_oss.artifacts.frames.links import link_payload
from superset_oss.artifacts.frames.placement import (
    placement_artifact,
    PlacementNotFoundError,
)
from superset_oss.artifacts.gate import open_artifacts
from superset_oss.artifacts.web import (
    current_actor,
    error_response,
    host_url,
    json_response,
)

DRAFT_TOKEN_HEADER = "X-Canvas-Draft"  # noqa: S105


class FrameLinkRequest(BaseModel):
    """Which placement a frame link is for; the server reads the rest."""

    model_config = ConfigDict(extra="forbid")

    canvas_id: str | int
    placement_id: str = Field(min_length=1)
    # The owner's draft of the artifact, instead of its published version.
    draft: bool = False


@api(
    id="frames",
    name="Artifact frame links",
    description="Short-lived links that load an artifact's sandboxed frame",
    resource_name="frames",
)
class ArtifactFramesRestApi(RestApi):
    """Short-lived links that load an artifact placement's sandboxed frame."""

    # Its own permission view: sharing an existing one, such as Canvas, would
    # let Flask-AppBuilder prune that view's other permissions from every role
    # when this API registers. Roles need can_read on ArtifactFrame.
    class_permission_name = "ArtifactFrame"
    openapi_spec_tag = "Artifacts"

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @permission_name("read")
    def mint(self) -> Response:
        """Mint a frame link for an artifact placement.
        ---
        post:
          summary: Mint a short-lived link to an artifact placement's frame
          requestBody:
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    canvas_id:
                      type: string
                    placement_id:
                      type: string
                    draft:
                      type: boolean
          responses:
            200:
              description: The link, the version it loads and its grant
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            artifacts = open_artifacts()
        except ArtifactError as ex:
            return error_response(ex)
        try:
            body = FrameLinkRequest.model_validate(request.get_json(silent=True) or {})
        except ValidationError as ex:
            return self.response_400(message=str(ex))
        try:
            placement = placement_artifact(
                str(body.canvas_id),
                body.placement_id,
                request.headers.get(DRAFT_TOKEN_HEADER) or None,
            )
        except PlacementNotFoundError:
            return self.response_404()
        actor = current_actor()
        store = artifacts.store
        try:
            served = choose_version(
                store,
                actor,
                placement.artifact_id,
                placement.version,
                use_draft=body.draft,
            )
            # Owners see the publish request waiting for them, so that the
            # canvas can offer the confirmation where the artifact is placed.
            pending = (
                store.pending_publish(actor, served.artifact_id)
                if actor and served.can_edit
                else None
            )
            result = link_payload(
                artifacts.provider,
                store,
                served,
                "canvas",
                host_url(),
                artifacts.policy,
            )
        except ArtifactError as ex:
            return error_response(ex)
        result["pending_publish"] = pending.summary() if pending else None
        return json_response(200, {"result": result})
