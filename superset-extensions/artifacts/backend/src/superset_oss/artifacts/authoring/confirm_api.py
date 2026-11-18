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
Where the user confirms publishing.

``POST /extensions/superset-oss/artifacts/publish/<artifact_id>/confirm`` with
``{"request_id": ...}``.

An agent can only ask (``artifact_request_publish``); the ``published`` ref
moves when the user, an editor of the artifact, confirms here, from
Superset's UI, under their own session, and once the version builds under the
policy in force (``publishing``). No MCP tool calls this. The renderer
learns of the request waiting for an editor from the artifact's frame link.

The confirmation refuses requests that authenticate with an ``Authorization``
header, so that it takes a browser session (with its CSRF token) rather than
a token an agent or script holds. That is a structural check on the channel;
it isn't proof that a person clicked.
"""

# TODO: the confirmation as a Superset screen that shows the diff from the
# published version, rather than a button by the artifact.
# TODO: an audit record of each confirmation, and per-workspace rules for
# publish consent.

from __future__ import annotations

from flask import request, Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from superset_core.rest_api.api import RestApi
from superset_core.rest_api.decorators import api
from superset_oss.artifacts.authoring.publishing import confirm_publish
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.gate import open_artifacts
from superset_oss.artifacts.web import current_actor, error_response, json_response


class ConfirmPublishRequest(BaseModel):
    """The body of a confirmation: which pending request the user confirms."""

    model_config = ConfigDict(extra="forbid")

    request_id: str = Field(min_length=1)


@api(
    id="publish",
    name="Artifact publish confirmation",
    description="Where the user confirms an agent's request to publish an artifact",
    resource_name="publish",
)
class ArtifactPublishRestApi(RestApi):
    """The user's confirmation of an agent's request to publish."""

    # Its own permission view; see ArtifactFramesRestApi. Roles need can_write
    # on ArtifactPublish.
    class_permission_name = "ArtifactPublish"
    openapi_spec_tag = "Artifacts"
    # The confirmation takes the user's browser session, so it needs the CSRF
    # token too; see ArtifactFramesRestApi.
    csrf_exempt = False

    @expose("/<artifact_id>/confirm", methods=("POST",))
    @protect()
    @safe
    @permission_name("write")
    def confirm(self, artifact_id: str) -> Response:
        """Confirm a pending publish request, as the signed-in user.
        ---
        post:
          summary: Publish the version an agent asked to publish
          parameters:
          - in: path
            name: artifact_id
            schema:
              type: string
          requestBody:
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    request_id:
                      type: string
          responses:
            200:
              description: The published version
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            artifacts = open_artifacts()
        except ArtifactError as ex:
            return error_response(ex)
        if request.headers.get("Authorization"):
            return self.response(
                403, message="Confirm publishing from Superset, signed in in a browser"
            )
        actor = current_actor()
        if actor is None:
            return self.response_401()
        try:
            body = ConfirmPublishRequest.model_validate(
                request.get_json(silent=True) or {}
            )
        except ValidationError as ex:
            return self.response_400(message=str(ex))
        try:
            version = confirm_publish(artifacts, actor, artifact_id, body.request_id)
        except ArtifactError as ex:
            return error_response(ex)
        return json_response(200, {"result": {"published_version": version}})
