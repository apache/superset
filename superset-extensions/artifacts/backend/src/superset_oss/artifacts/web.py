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
What the REST endpoints and MCP tools share that needs Flask: who is calling,
the host's URL, the transfer links, and how an ``ArtifactError`` becomes an
HTTP answer.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from flask import current_app, g, has_request_context, jsonify, request, Response
from superset_artifacts_sdk.authoring import AuthoringErrorCode
from superset_oss.artifacts.authoring.transfer import TransferLinks, TransferSigner
from superset_oss.artifacts.constants import API_BASE_PATH
from superset_oss.artifacts.errors import ArtifactError, ErrorCode, ExtensionErrorCode

# The status of each code an endpoint can answer; any other code is a 400.
_HTTP_STATUS: Mapping[ErrorCode, int] = {
    AuthoringErrorCode.NOT_ENABLED: 404,
    AuthoringErrorCode.ARTIFACT_NOT_FOUND: 404,
    AuthoringErrorCode.VERSION_NOT_FOUND: 404,
    # A stored version whose manifest no longer validates.
    AuthoringErrorCode.INVALID_MANIFEST: 422,
    ExtensionErrorCode.PUBLISH_REQUEST_NOT_FOUND: 404,
    ExtensionErrorCode.TRANSFER_LINK_INVALID: 403,
    ExtensionErrorCode.PUBLISH_BUILD_FAILED: 422,
    AuthoringErrorCode.TOO_LARGE: 413,
}


def current_actor() -> str | None:
    """The signed-in user's id as a string, or ``None`` for anyone else."""
    user_id = getattr(getattr(g, "user", None), "id", None)
    return str(user_id) if user_id is not None else None


def current_is_guest() -> bool:
    """Whether the caller holds an embedded guest token, as its user says."""
    return getattr(getattr(g, "user", None), "is_guest_user", False) is True


def host_url() -> str:
    """The URL of this Superset as the server sees it, for allowed parents."""
    return request.host_url


def all_file_tools() -> bool:
    """Whether the deployment offers every file tool (``ARTIFACTS_ALL_FILE_TOOLS``)."""
    return bool(current_app.config.get("ARTIFACTS_ALL_FILE_TOOLS", False))


def transfer_signer() -> TransferSigner:
    """The signer of transfer links, on the deployment's secret key."""
    return TransferSigner(current_app.config["SECRET_KEY"])


def transfer_links() -> TransferLinks | None:
    """
    The transfer links under this Superset's user-facing URL, or ``None``
    without one. An MCP call has no request to read it from, so the URL the
    MCP tools put in every link they answer comes first.
    """
    config = current_app.config
    base_url = config.get("WEBDRIVER_BASEURL_USER_FRIENDLY") or (
        request.host_url if has_request_context() else None
    )
    if not base_url or not config.get("SECRET_KEY"):
        return None
    return TransferLinks(
        transfer_signer(),
        f"{str(base_url).rstrip('/')}{API_BASE_PATH}/transfer",
        uploads=True,
    )


def json_response(status: int, payload: Mapping[str, Any]) -> Response:
    """A JSON answer. ``RestApi.response`` can't carry a ``code`` field."""
    response = jsonify(dict(payload))
    response.status_code = status
    return response


def error_response(error: ArtifactError) -> Response:
    """The HTTP answer for ``error``: its fields, with the status of its code."""
    return json_response(_HTTP_STATUS.get(error.code, 400), error.to_dict())
