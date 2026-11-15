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
What the REST endpoints and MCP tools share: who is calling, the gate, and
how a store error becomes an HTTP answer. Needs Flask, unlike the pure modules.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from flask import g, jsonify, request, Response
from superset_core.artifacts.authoring import AuthoringErrorCode
from superset_core.artifacts.provider import (
    ArtifactRuntimeProvider,
    artifacts_available,
    get_provider,
)
from superset_oss.artifacts.store.errors import (
    ArtifactStoreError,
    ErrorCode,
    ExtensionErrorCode,
)

NOT_ENABLED_MESSAGE = (
    "Artifacts are off here: no artifact runtime provider is registered (DR-18)."
)

_STATUS: dict[ErrorCode, int] = {
    AuthoringErrorCode.NOT_ENABLED: 404,
    AuthoringErrorCode.STALE_BASE_VERSION: 409,
    AuthoringErrorCode.FILE_NOT_FOUND: 404,
    AuthoringErrorCode.TOO_LARGE: 413,
    ExtensionErrorCode.ARTIFACT_NOT_FOUND: 404,
    ExtensionErrorCode.VERSION_NOT_FOUND: 404,
    ExtensionErrorCode.PUBLISH_REQUEST_NOT_FOUND: 404,
}


def current_actor() -> str | None:
    """The signed-in user's id as a string, or ``None`` for anyone else."""
    user_id = getattr(getattr(g, "user", None), "id", None)
    return str(user_id) if user_id is not None else None


def enabled_provider() -> ArtifactRuntimeProvider | None:
    """The provider when artifacts are on (DR-18), otherwise ``None``."""
    return get_provider() if artifacts_available() else None


def host_url() -> str:
    """The URL of this Superset as the server sees it, for allowed parents."""
    return request.host_url


def json_response(status: int, payload: Mapping[str, Any]) -> Response:
    """A JSON answer. ``RestApi.response`` can't carry a ``code`` field."""
    response = jsonify(dict(payload))
    response.status_code = status
    return response


def not_enabled() -> Response:
    return json_response(
        404,
        {
            "code": AuthoringErrorCode.NOT_ENABLED.value,
            "message": NOT_ENABLED_MESSAGE,
            "current_version": None,
        },
    )


def store_error(error: ArtifactStoreError) -> Response:
    return json_response(_STATUS.get(error.code, 400), error.to_dict())
