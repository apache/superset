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

All operations are user-scoped by default. Use `?shared=true` query param
to access shared state visible to all users.
"""

from __future__ import annotations

from typing import Any

from flask import g, request
from flask.wrappers import Response
from flask_appbuilder.api import BaseApi, expose, protect, safe

from superset.extensions import cache_manager
from superset.extensions.storage.persistent_state_dao import ExtensionStorageDAO
from superset.extensions.types import LoadedExtension
from superset.extensions.utils import get_extensions
from superset.utils import json
from superset.utils.decorators import transaction

# Key separator
SEPARATOR = ":"

# Key prefix for extension ephemeral state
KEY_PREFIX = "superset-ext"


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
        (ttl, error_message) - ttl is None when omitted (cache uses
        CACHE_DEFAULT_TIMEOUT), error_message is set if the value is invalid.
    """
    if "ttl" not in body:
        return None, None
    try:
        ttl = int(body["ttl"])
    except (TypeError, ValueError):
        return None, "Field 'ttl' must be a positive integer"
    if ttl <= 0:
        return None, "Field 'ttl' must be a positive integer"
    return ttl, None


def _build_storage_key(extension_id: str, key: str, shared: bool) -> str:
    """Build the cache key based on scope (user or shared)."""
    if shared:
        return _build_cache_key(KEY_PREFIX, extension_id, "shared", key)
    user_id = g.user.id
    return _build_cache_key(KEY_PREFIX, extension_id, "user", user_id, key)


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

    @protect()
    @safe
    @expose("/ephemeral/<extension_id>/<key>", methods=("GET",))
    def get_ephemeral(self, extension_id: str, key: str, **kwargs: Any) -> Response:
        """Get a value from ephemeral state.
        ---
        get:
          summary: Get a value from ephemeral state
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
          - in: query
            name: shared
            schema:
              type: boolean
            required: false
            description: If true, read from shared state visible to all users
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

        shared = request.args.get("shared", "false").lower() == "true"
        cache_key = _build_storage_key(extension_id, key, shared)
        value = cache_manager.extension_ephemeral_state_cache.get(cache_key)

        return self.response(200, result=value)

    @protect()
    @safe
    @expose("/ephemeral/<extension_id>/<key>", methods=("PUT",))
    def set_ephemeral(self, extension_id: str, key: str, **kwargs: Any) -> Response:
        """Set a value in ephemeral state.
        ---
        put:
          summary: Set a value in ephemeral state
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
          - in: query
            name: shared
            schema:
              type: boolean
            required: false
            description: If true, store as shared state visible to all users
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
                      description: Time-to-live in seconds (defaults to
                        CACHE_DEFAULT_TIMEOUT)
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

        shared = request.args.get("shared", "false").lower() == "true"
        cache_key = _build_storage_key(extension_id, key, shared)
        cache_manager.extension_ephemeral_state_cache.set(cache_key, value, timeout=ttl)

        return self.response(200, message="Value stored successfully")

    @protect()
    @safe
    @expose("/ephemeral/<extension_id>/<key>", methods=("DELETE",))
    def delete_ephemeral(self, extension_id: str, key: str, **kwargs: Any) -> Response:
        """Delete a value from ephemeral state.
        ---
        delete:
          summary: Delete a value from ephemeral state
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
          - in: query
            name: shared
            schema:
              type: boolean
            required: false
            description: If true, delete from shared state
          responses:
            200:
              description: Value deleted successfully
            404:
              description: Extension not found
        """
        extension = _get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        shared = request.args.get("shared", "false").lower() == "true"
        cache_key = _build_storage_key(extension_id, key, shared)
        cache_manager.extension_ephemeral_state_cache.delete(cache_key)

        return self.response(200, message="Value deleted successfully")

    @protect()
    @safe
    @expose("/persistent/<extension_id>/<key>", methods=("GET",))
    def get_persistent(self, extension_id: str, key: str, **kwargs: Any) -> Response:
        """Get a value from persistent state.
        ---
        get:
          summary: Get a value from persistent state
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
          - in: query
            name: shared
            schema:
              type: boolean
            required: false
            description: If true, read from shared state visible to all users
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

        shared = request.args.get("shared", "false").lower() == "true"
        user_fk = None if shared else g.user.id
        raw = ExtensionStorageDAO.get_value(extension_id, key, user_fk=user_fk)
        value = json.loads(raw) if raw is not None else None

        return self.response(200, result=value)

    @protect()
    @safe
    @expose("/persistent/<extension_id>/<key>", methods=("PUT",))
    @transaction()
    def set_persistent(self, extension_id: str, key: str, **kwargs: Any) -> Response:
        """Set a value in persistent state.
        ---
        put:
          summary: Set a value in persistent state
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
          - in: query
            name: shared
            schema:
              type: boolean
            required: false
            description: If true, store as shared state visible to all users
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    value:
                      description: The value to store (must be JSON-serializable)
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

        shared = request.args.get("shared", "false").lower() == "true"
        user_fk = None if shared else g.user.id
        value_bytes = json.dumps(body["value"]).encode()
        ExtensionStorageDAO.set(extension_id, key, value_bytes, user_fk=user_fk)

        return self.response(200, message="Value stored successfully")

    @protect()
    @safe
    @expose("/persistent/<extension_id>/<key>", methods=("DELETE",))
    @transaction()
    def delete_persistent(self, extension_id: str, key: str, **kwargs: Any) -> Response:
        """Delete a value from persistent state.
        ---
        delete:
          summary: Delete a value from persistent state
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
          - in: query
            name: shared
            schema:
              type: boolean
            required: false
            description: If true, delete from shared state
          responses:
            200:
              description: Value deleted successfully
            404:
              description: Extension not found
        """
        extension = _get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        shared = request.args.get("shared", "false").lower() == "true"
        user_fk = None if shared else g.user.id
        ExtensionStorageDAO.delete(extension_id, key, user_fk=user_fk)

        return self.response(200, message="Value deleted successfully")
