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

The artifact's renderer calls it for the artifact it draws, by its widget's
UUID: on a canvas placement, or on a page of its own. On a canvas, the server
reads the placement from the stored canvas (or the caller's own draft of it),
so a canvas reader sees the published artifact it places; elsewhere, the
caller must be able to read the artifact's widget. The server then picks the
version the caller may see, and has the provider mint a short-lived,
single-use link for it, with the context taken from the request: the allowed
parents (this Superset's origin) and the grant, manifest ∩ policy ∩ context.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from flask import request, Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from pydantic import BaseModel, ConfigDict, Field, model_validator, ValidationError
from superset_core.rest_api.api import RestApi
from superset_core.rest_api.decorators import api
from superset_oss.artifacts.access import require_read
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
    """Which artifact a frame link is for, and where; the server reads the rest."""

    model_config = ConfigDict(extra="forbid")

    widget_id: UUID
    # The placement that shows it on a canvas; without one, a page of its own.
    canvas_id: str | int | None = None
    placement_id: str | None = Field(default=None, min_length=1)
    page: Literal["standalone", "embedded"] = "standalone"

    @model_validator(mode="after")
    def _a_whole_placement(self) -> FrameLinkRequest:
        if (self.canvas_id is None) != (self.placement_id is None):
            raise ValueError("canvas_id and placement_id name a placement together")
        return self


@api(
    id="frames",
    name="Artifact frame links",
    description="Short-lived links that load an artifact's sandboxed frame",
    resource_name="frames",
)
class ArtifactFramesRestApi(RestApi):
    """Short-lived links that load an artifact's sandboxed frame."""

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
        """Mint a frame link for an artifact.
        ---
        post:
          summary: Mint a short-lived link to an artifact's frame
          requestBody:
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    widget_id:
                      type: string
                      format: uuid
                    canvas_id:
                      type: string
                    placement_id:
                      type: string
                    page:
                      type: string
                      enum: [standalone, embedded]
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
        artifact_id = str(body.widget_id)
        draft_token = None
        if body.canvas_id is not None and body.placement_id is not None:
            draft_token = request.headers.get(DRAFT_TOKEN_HEADER) or None
            try:
                placed = placement_artifact(
                    str(body.canvas_id), body.placement_id, draft_token
                )
            except PlacementNotFoundError:
                return self.response_404()
            if placed != body.widget_id:
                return self.response_404()
        actor = current_actor()
        store = artifacts.store
        try:
            if body.canvas_id is None:
                require_read(artifacts.access, artifact_id)
            can_edit = actor is not None and artifacts.access.can_edit(artifact_id)
            # An editor sees the draft exactly while the canvas shows a draft,
            # as the placement data does, so the frame and its data agree.
            served = choose_version(
                store,
                artifact_id,
                can_edit=can_edit,
                use_draft=draft_token is not None,
            )
            # Editors see the publish request waiting for them, so that the
            # renderer can offer the confirmation where the artifact is shown.
            pending = store.pending_publish(served.artifact_id) if can_edit else None
            result = link_payload(
                artifacts.provider,
                store,
                served,
                "canvas" if body.canvas_id is not None else body.page,
                host_url(),
                artifacts.policy,
            )
        except ArtifactError as ex:
            return error_response(ex)
        result["pending_publish"] = pending.summary() if pending else None
        return json_response(200, {"result": result})
