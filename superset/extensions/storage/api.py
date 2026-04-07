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
REST API for extension storage.

Provides HTTP endpoints for frontend extensions to access server-side
ephemeral storage without direct backend code.

By default, all operations are user-scoped (private to the current user).
Use the /shared/ endpoints to access state visible to all users.
"""

from __future__ import annotations

from typing import Any

from flask import g, request
from flask.wrappers import Response
from flask_appbuilder.api import BaseApi, expose, protect, safe

from superset.extensions import cache_manager
from superset.extensions.types import LoadedExtension
from superset.extensions.utils import get_extensions

# Key separator
SEPARATOR = ":"

# Key prefix for extension ephemeral state
KEY_PREFIX = "superset-ext"

# Default TTL: 1 hour
DEFAULT_TTL = 3600


def _build_cache_key(*parts: Any) -> str:
    """Build a namespaced cache key from parts."""
    return SEPARATOR.join(str(part) for part in parts)


def _get_extension_or_404(extension_id: str) -> LoadedExtension | None:
    """Get extension by ID or return None if not found."""
    extensions = get_extensions()
    return extensions.get(extension_id)


def _parse_ttl(body: dict[str, Any]) -> tuple[int | None, str | None]:
    """Parse and validate TTL from request body.

    Returns:
        (ttl, error_message) - ttl is the parsed value, error_message is set if invalid
    """
    try:
        ttl = int(body.get("ttl", DEFAULT_TTL))
    except (TypeError, ValueError):
        return None, "Field 'ttl' must be a positive integer"
    if ttl <= 0:
        return None, "Field 'ttl' must be a positive integer"
    return ttl, None


class ExtensionStorageRestApi(BaseApi):
    """REST API for extension ephemeral state storage."""

    allow_browser_login = True
    route_base = "/api/v1/extensions/storage"

    def response(self, status_code: int, **kwargs: Any) -> Response:
        """Helper method to create JSON responses."""
        from flask import jsonify

        return jsonify(kwargs), status_code

    def response_404(self, message: str = "Not found") -> Response:
        """Helper method to create 404 responses."""
        from flask import jsonify

        return jsonify({"message": message}), 404

    def response_400(self, message: str) -> Response:
        """Helper method to create 400 responses."""
        from flask import jsonify

        return jsonify({"message": message}), 400

    # =========================================================================
    # User-Scoped Ephemeral State Endpoints (Default)
    # =========================================================================

    @protect()
    @safe
    @expose("/ephemeral/<extension_id>/<key>", methods=("GET",))
    def get_ephemeral(self, extension_id: str, key: str, **kwargs: Any) -> Response:
        """Get a value from user-scoped ephemeral state.
        ---
        get:
          summary: Get a value from user-scoped ephemeral state (default)
          parameters:
          - in: path
            name: extension_id
            schema:
              type: string
            required: true
            description: Extension ID (publisher.name)
          - in: path
            name: key
            schema:
              type: string
            required: true
            description: Storage key
          responses:
            200:
              description: Value retrieved successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        description: The stored value
            404:
              description: Extension not found
        """
        extension = _get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        user_id = g.user.id
        cache_key = _build_cache_key(KEY_PREFIX, extension_id, "user", user_id, key)
        value = cache_manager.extension_ephemeral_state_cache.get(cache_key)

        return self.response(200, result=value)

    @protect()
    @safe
    @expose("/ephemeral/<extension_id>/<key>", methods=("PUT",))
    def set_ephemeral(self, extension_id: str, key: str, **kwargs: Any) -> Response:
        """Set a value in user-scoped ephemeral state.
        ---
        put:
          summary: Set a value in user-scoped ephemeral state (default)
          parameters:
          - in: path
            name: extension_id
            schema:
              type: string
            required: true
            description: Extension ID (publisher.name)
          - in: path
            name: key
            schema:
              type: string
            required: true
            description: Storage key
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    value:
                      description: The value to store
                    ttl:
                      type: integer
                      description: Time-to-live in seconds (default 3600)
          responses:
            200:
              description: Value stored successfully
            400:
              description: Invalid request body
            404:
              description: Extension not found
        """
        extension = _get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        body = request.get_json(silent=True) or {}
        if "value" not in body:
            return self.response_400("Request body must contain 'value' field")

        value = body["value"]
        ttl, error = _parse_ttl(body)
        if error:
            return self.response_400(error)

        user_id = g.user.id
        cache_key = _build_cache_key(KEY_PREFIX, extension_id, "user", user_id, key)
        cache_manager.extension_ephemeral_state_cache.set(cache_key, value, timeout=ttl)

        return self.response(200, message="Value stored successfully")

    @protect()
    @safe
    @expose("/ephemeral/<extension_id>/<key>", methods=("DELETE",))
    def delete_ephemeral(self, extension_id: str, key: str, **kwargs: Any) -> Response:
        """Delete a value from user-scoped ephemeral state.
        ---
        delete:
          summary: Delete a value from user-scoped ephemeral state (default)
          parameters:
          - in: path
            name: extension_id
            schema:
              type: string
            required: true
            description: Extension ID (publisher.name)
          - in: path
            name: key
            schema:
              type: string
            required: true
            description: Storage key
          responses:
            200:
              description: Value deleted successfully
            404:
              description: Extension not found
        """
        extension = _get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        user_id = g.user.id
        cache_key = _build_cache_key(KEY_PREFIX, extension_id, "user", user_id, key)
        cache_manager.extension_ephemeral_state_cache.delete(cache_key)

        return self.response(200, message="Value deleted successfully")

    # =========================================================================
    # Shared (Global) Ephemeral State Endpoints
    # =========================================================================

    @protect()
    @safe
    @expose("/ephemeral/shared/<extension_id>/<key>", methods=("GET",))
    def get_ephemeral_shared(
        self, extension_id: str, key: str, **kwargs: Any
    ) -> Response:
        """Get a value from shared ephemeral state.
        ---
        get:
          summary: Get a value from shared (global) ephemeral state
          parameters:
          - in: path
            name: extension_id
            schema:
              type: string
            required: true
            description: Extension ID (publisher.name)
          - in: path
            name: key
            schema:
              type: string
            required: true
            description: Storage key
          responses:
            200:
              description: Value retrieved successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        description: The stored value
            404:
              description: Extension not found
        """
        extension = _get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        cache_key = _build_cache_key(KEY_PREFIX, extension_id, "shared", key)
        value = cache_manager.extension_ephemeral_state_cache.get(cache_key)

        return self.response(200, result=value)

    @protect()
    @safe
    @expose("/ephemeral/shared/<extension_id>/<key>", methods=("PUT",))
    def set_ephemeral_shared(
        self, extension_id: str, key: str, **kwargs: Any
    ) -> Response:
        """Set a value in shared ephemeral state.
        ---
        put:
          summary: Set a value in shared (global) ephemeral state
          parameters:
          - in: path
            name: extension_id
            schema:
              type: string
            required: true
            description: Extension ID (publisher.name)
          - in: path
            name: key
            schema:
              type: string
            required: true
            description: Storage key
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    value:
                      description: The value to store
                    ttl:
                      type: integer
                      description: Time-to-live in seconds (default 3600)
          responses:
            200:
              description: Value stored successfully
            400:
              description: Invalid request body
            404:
              description: Extension not found
        """
        extension = _get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        body = request.get_json(silent=True) or {}
        if "value" not in body:
            return self.response_400("Request body must contain 'value' field")

        value = body["value"]
        ttl, error = _parse_ttl(body)
        if error:
            return self.response_400(error)

        cache_key = _build_cache_key(KEY_PREFIX, extension_id, "shared", key)
        cache_manager.extension_ephemeral_state_cache.set(cache_key, value, timeout=ttl)

        return self.response(200, message="Value stored successfully")

    @protect()
    @safe
    @expose("/ephemeral/shared/<extension_id>/<key>", methods=("DELETE",))
    def delete_ephemeral_shared(
        self, extension_id: str, key: str, **kwargs: Any
    ) -> Response:
        """Delete a value from shared ephemeral state.
        ---
        delete:
          summary: Delete a value from shared (global) ephemeral state
          parameters:
          - in: path
            name: extension_id
            schema:
              type: string
            required: true
            description: Extension ID (publisher.name)
          - in: path
            name: key
            schema:
              type: string
            required: true
            description: Storage key
          responses:
            200:
              description: Value deleted successfully
            404:
              description: Extension not found
        """
        extension = _get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        cache_key = _build_cache_key(KEY_PREFIX, extension_id, "shared", key)
        cache_manager.extension_ephemeral_state_cache.delete(cache_key)

        return self.response(200, message="Value deleted successfully")
