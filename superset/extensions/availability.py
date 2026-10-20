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

"""Runtime availability of extensions, independent of user permissions.

Two decisions combine here. Loading extension code happens once, at app
startup, and only when ``ENABLE_EXTENSIONS`` is on at that moment. Exposing
extensions is decided per request, so a deployment that loaded extensions
can still hide them from a request whose feature decision is off.
"""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING

from flask import Blueprint, current_app, Flask, jsonify
from flask_appbuilder import AppBuilder
from flask_appbuilder.api import BaseApi

from superset.extensions.utils import get_extensions
from superset.superset_typing import FlaskResponse

if TYPE_CHECKING:
    from superset.extensions.types import LoadedExtension

EXTENSIONS_LOADED_KEY = "superset_extensions_loaded"

EXTENSION_CONTRIBUTION_PREFIX = "extensions."

NOT_LOADED_MESSAGE = (
    "Extensions are enabled but were not loaded when this server started. "
    "Restart the server to load them."
)


class ExtensionsStatus(str, Enum):
    """Availability of extensions for the current request."""

    DISABLED = "disabled"
    LOADED = "loaded"
    NOT_LOADED = "not_loaded"


def mark_extensions_loaded(app: Flask) -> None:
    """Record that this app initialized its extensions at startup."""
    app.extensions[EXTENSIONS_LOADED_KEY] = True


def are_extensions_loaded() -> bool:
    """Whether this app initialized its extensions at startup."""
    return bool(current_app.extensions.get(EXTENSIONS_LOADED_KEY))


def is_extensions_enabled() -> bool:
    """Evaluate the host's extensions feature decision on every call."""
    from superset import feature_flag_manager

    return feature_flag_manager.is_feature_enabled("ENABLE_EXTENSIONS")


def get_extensions_status() -> ExtensionsStatus:
    """Combine the per-request feature decision with the startup load state."""
    if not is_extensions_enabled():
        return ExtensionsStatus.DISABLED
    if are_extensions_loaded():
        return ExtensionsStatus.LOADED
    return ExtensionsStatus.NOT_LOADED


def is_contribution_available(contribution_id: str) -> bool:
    """Whether a registry entry is available to the current request.

    Contributions registered by an extension backend carry the
    ``extensions.<publisher>.<name>.`` prefix (see
    ``superset.core.api.core_api_injection``) and follow the extension's
    per-request availability; host contributions are always available.
    """
    if not contribution_id.startswith(EXTENSION_CONTRIBUTION_PREFIX):
        return True
    return get_extensions_status() is ExtensionsStatus.LOADED


def get_extensions_state() -> dict[str, str]:
    """Serialize the current availability for API responses.

    ``message`` accompanies only the state that needs operator action.
    """
    status: ExtensionsStatus = get_extensions_status()
    if status is ExtensionsStatus.NOT_LOADED:
        return {"status": status.value, "message": NOT_LOADED_MESSAGE}
    return {"status": status.value}


def get_servable_extensions() -> dict[str, LoadedExtension]:
    """Extensions this server may serve to the current request.

    ``get_extensions()`` re-reads bundles from disk on every call, so request
    handlers go through this accessor: a server that did not initialize its
    extensions at startup serves none of them, even when bundles are present.
    The per-request feature decision is enforced by the blueprint guard.
    """
    if not are_extensions_loaded():
        return {}
    return get_extensions()


def _refuse_disabled_extensions() -> FlaskResponse | None:
    """Refuse extension API dispatch before authentication or handler side effects.

    The body is constant, so the refusal reveals nothing about the caller.
    """
    if not is_extensions_enabled():
        return jsonify({"message": "Not found"}), 404
    return None


class RuntimeGuardedExtensionsApiMixin(BaseApi):
    """Install the per-request feature guard on an extensions API blueprint."""

    # The extensions APIs accept browser sessions, so their write routes keep
    # CSRF protection like other Superset APIs; FAB's ``BaseApi`` exempts by
    # default.
    csrf_exempt = False

    def create_blueprint(
        self,
        appbuilder: AppBuilder,
        endpoint: str | None = None,
        static_folder: str | None = None,
    ) -> Blueprint:
        """Register all routes behind the runtime feature guard."""
        blueprint: Blueprint = super().create_blueprint(
            appbuilder, endpoint, static_folder
        )
        blueprint.before_request(_refuse_disabled_extensions)
        return blueprint
