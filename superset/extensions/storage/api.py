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

from superset.extensions.storage.codecs import DEFAULT_CODEC, get_codec, SAFE_CODECS
from superset.extensions.storage.ephemeral_dao import (
    ExtensionEphemeralDAO,
    ExtensionEphemeralTTLInvalid,
    ExtensionEphemeralValueTooLarge,
)
from superset.extensions.storage.persistent_dao import (
    ExtensionStorageDAO,
    ExtensionStorageKeyTooLong,
    ExtensionStorageListPayloadTooLarge,
    ExtensionStorageQuotaExceeded,
    ExtensionStorageValueTooLarge,
)
from superset.extensions.storage.utils import get_extension_or_404, parse_ttl
from superset.utils.decorators import transaction


class ExtensionStorageRestApi(BaseApi):
    """REST API for extension ephemeral state storage."""

    allow_browser_login = True
    route_base = "/api/v1/extensions"

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
    @expose("/<publisher>/<name>/storage/ephemeral/<key>", methods=("GET",))
    def get_ephemeral(
        self, publisher: str, name: str, key: str, **kwargs: Any
    ) -> Response:
        """Get a value from ephemeral state.
        ---
        get:
          summary: Get a value from ephemeral state
          parameters:
          - in: path
            name: publisher
            schema:
              type: string
            required: true
            description: Extension publisher
          - in: path
            name: name
            schema:
              type: string
            required: true
            description: Extension name
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
                      codec:
                        type: string
                        description: Name of the codec 'result' was encoded
                          with, e.g. "json" (default) or "base64"
            400:
              description: Value was stored with a codec unavailable over the API
            404:
              description: Extension not found
        """
        extension_id = f"{publisher}.{name}"
        extension = get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        shared = request.args.get("shared", "false").lower() == "true"
        raw = ExtensionEphemeralDAO.get_raw(extension_id, key, shared=shared)
        if raw is None:
            return self.response(200, result=None)
        value, codec = raw
        if codec not in SAFE_CODECS:
            return self.response_400(
                f"Value was stored with codec '{codec}', which cannot be "
                "read over the REST API."
            )

        return self.response(200, result=get_codec(codec).decode(value), codec=codec)

    @protect()
    @safe
    @expose("/<publisher>/<name>/storage/ephemeral/<key>", methods=("PUT",))
    def set_ephemeral(
        self, publisher: str, name: str, key: str, **kwargs: Any
    ) -> Response:
        """Set a value in ephemeral state.
        ---
        put:
          summary: Set a value in ephemeral state
          parameters:
          - in: path
            name: publisher
            schema:
              type: string
            required: true
            description: Extension publisher
          - in: path
            name: name
            schema:
              type: string
            required: true
            description: Extension name
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
                  required:
                    - value
                    - ttl
                  properties:
                    value:
                      description: The value to store (must not exceed
                        MAX_VALUE_SIZE bytes once encoded with 'codec')
                    codec:
                      type: string
                      description: Name of the codec used to encode 'value',
                        e.g. "json" (default). Must be one of the codecs
                        allowed over the REST API.
                    ttl:
                      type: integer
                      description: Time-to-live in seconds (must be a positive
                        integer not exceeding MAX_TTL)
          responses:
            200:
              description: Value stored successfully
            400:
              description: Invalid request body, or codec not allowed over the API
            404:
              description: Extension not found
        """
        extension_id = f"{publisher}.{name}"
        extension = get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        body = request.get_json(silent=True) or {}
        if "value" not in body:
            return self.response_400("Request body must contain 'value' field")

        codec = body.get("codec", DEFAULT_CODEC)
        if codec not in SAFE_CODECS:
            return self.response_400(
                f"Codec '{codec}' is not allowed over the REST API."
            )

        value = body["value"]
        ttl, error = parse_ttl(body)
        if error:
            return self.response_400(error)

        shared = request.args.get("shared", "false").lower() == "true"
        try:
            ExtensionEphemeralDAO.set(
                extension_id, key, value, ttl, codec=codec, shared=shared
            )
        except (ExtensionEphemeralTTLInvalid, ExtensionEphemeralValueTooLarge) as ex:
            return self.response_400(ex.message)

        return self.response(200, message="Value stored successfully")

    @protect()
    @safe
    @expose("/<publisher>/<name>/storage/ephemeral/<key>", methods=("DELETE",))
    def delete_ephemeral(
        self, publisher: str, name: str, key: str, **kwargs: Any
    ) -> Response:
        """Delete a value from ephemeral state.
        ---
        delete:
          summary: Delete a value from ephemeral state
          parameters:
          - in: path
            name: publisher
            schema:
              type: string
            required: true
            description: Extension publisher
          - in: path
            name: name
            schema:
              type: string
            required: true
            description: Extension name
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
        extension_id = f"{publisher}.{name}"
        extension = get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        shared = request.args.get("shared", "false").lower() == "true"
        ExtensionEphemeralDAO.delete(extension_id, key, shared=shared)

        return self.response(200, message="Value deleted successfully")

    @protect()
    @safe
    @expose("/<publisher>/<name>/storage/persistent", methods=("GET",))
    def list_persistent(self, publisher: str, name: str, **kwargs: Any) -> Response:
        """List entries in persistent state.
        ---
        get:
          summary: List entries in persistent state
          parameters:
          - in: path
            name: publisher
            schema:
              type: string
            required: true
            description: Extension publisher
          - in: path
            name: name
            schema:
              type: string
            required: true
            description: Extension name
          - in: query
            name: shared
            schema:
              type: boolean
            required: false
            description: If true, list shared state visible to all users
          - in: query
            name: resource_type
            schema:
              type: string
            required: false
            description: Filter by resource type
          - in: query
            name: resource_uuid
            schema:
              type: string
            required: false
            description: Filter by resource UUID (requires resource_type)
          - in: query
            name: page
            schema:
              type: integer
            required: false
            description: Zero-indexed page number. Defaults to 0.
          - in: query
            name: page_size
            schema:
              type: integer
            required: false
            description: Number of entries per page. Defaults to 10. There
              is no fixed ceiling, but a page whose combined value size
              exceeds MAX_LIST_PAYLOAD_SIZE is rejected — reduce page_size
              and retry if that happens.
          responses:
            200:
              description: Entries retrieved successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          type: object
                          properties:
                            key:
                              type: string
                            value:
                              description: The stored value, or null if its
                                codec cannot be read over the REST API
                            codec:
                              type: string
                      count:
                        type: integer
                        description: Total number of entries matching the
                          given scope/filters, across all pages
            400:
              description: The requested page's combined value size exceeds
                MAX_LIST_PAYLOAD_SIZE
            404:
              description: Extension not found
        """
        extension_id = f"{publisher}.{name}"
        extension = get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        shared = request.args.get("shared", "false").lower() == "true"
        user_fk = None if shared else g.user.id
        resource_type = request.args.get("resource_type")
        resource_uuid = request.args.get("resource_uuid")
        try:
            page = int(request.args.get("page", 0))
            page_size = int(request.args.get("page_size", 10))
        except (TypeError, ValueError):
            return self.response_400("'page' and 'page_size' must be integers")

        try:
            entries, count = ExtensionStorageDAO.list_entries(
                extension_id,
                user_fk=user_fk,
                resource_type=resource_type,
                resource_uuid=resource_uuid,
                page=page,
                page_size=page_size,
            )
        except ExtensionStorageListPayloadTooLarge as ex:
            return self.response(ex.status, message=ex.message)

        result = [
            {
                "key": entry.key,
                "value": (
                    get_codec(entry.codec).decode(entry.value)
                    if entry.codec in SAFE_CODECS and entry.value is not None
                    else None
                ),
                "codec": entry.codec,
            }
            for entry in entries
        ]

        return self.response(200, result=result, count=count)

    @protect()
    @safe
    @expose("/<publisher>/<name>/storage/persistent/<key>", methods=("GET",))
    def get_persistent(
        self, publisher: str, name: str, key: str, **kwargs: Any
    ) -> Response:
        """Get a value from persistent state.
        ---
        get:
          summary: Get a value from persistent state
          parameters:
          - in: path
            name: publisher
            schema:
              type: string
            required: true
            description: Extension publisher
          - in: path
            name: name
            schema:
              type: string
            required: true
            description: Extension name
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
                      codec:
                        type: string
                        description: Name of the codec 'result' was encoded
                          with, e.g. "json" (default) or "base64"
            400:
              description: Value was stored with a codec unavailable over the API
            404:
              description: Extension not found
        """
        extension_id = f"{publisher}.{name}"
        extension = get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        shared = request.args.get("shared", "false").lower() == "true"
        user_fk = None if shared else g.user.id
        entry = ExtensionStorageDAO.get(extension_id, key, user_fk=user_fk)
        if entry is None:
            return self.response(200, result=None)
        if entry.codec not in SAFE_CODECS:
            return self.response_400(
                f"Value was stored with codec '{entry.codec}', which cannot be "
                "read over the REST API."
            )

        value = ExtensionStorageDAO.get_decoded_value(
            extension_id, key, user_fk=user_fk
        )

        return self.response(200, result=value, codec=entry.codec)

    @protect()
    @safe
    @expose("/<publisher>/<name>/storage/persistent/<key>", methods=("PUT",))
    @transaction()
    def set_persistent(
        self, publisher: str, name: str, key: str, **kwargs: Any
    ) -> Response:
        """Set a value in persistent state.
        ---
        put:
          summary: Set a value in persistent state
          parameters:
          - in: path
            name: publisher
            schema:
              type: string
            required: true
            description: Extension publisher
          - in: path
            name: name
            schema:
              type: string
            required: true
            description: Extension name
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
                  required:
                    - value
                  properties:
                    value:
                      description: The value to store
                    codec:
                      type: string
                      description: Name of the codec used to encode 'value',
                        e.g. "json" (default). Must be one of the codecs
                        allowed over the REST API.
                    encrypt:
                      type: boolean
                      description: If true, the value is encrypted at rest
          responses:
            200:
              description: Value stored successfully
            400:
              description: Invalid request body, codec not allowed over the
                API, or value exceeds MAX_VALUE_SIZE
            404:
              description: Extension not found
            413:
              description: Extension persistent storage quota exceeded
        """
        extension_id = f"{publisher}.{name}"
        extension = get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        body = request.get_json(silent=True) or {}
        if "value" not in body:
            return self.response_400("Request body must contain 'value' field")

        codec = body.get("codec", DEFAULT_CODEC)
        if codec not in SAFE_CODECS:
            return self.response_400(
                f"Codec '{codec}' is not allowed over the REST API."
            )

        encrypt = bool(body.get("encrypt", False))
        shared = request.args.get("shared", "false").lower() == "true"
        user_fk = None if shared else g.user.id
        value_bytes = get_codec(codec).encode(body["value"])
        try:
            ExtensionStorageDAO.set(
                extension_id,
                key,
                value_bytes,
                codec=codec,
                user_fk=user_fk,
                encrypt=encrypt,
            )
        except (
            ExtensionStorageKeyTooLong,
            ExtensionStorageQuotaExceeded,
            ExtensionStorageValueTooLarge,
        ) as ex:
            return self.response(ex.status, message=ex.message)

        return self.response(200, message="Value stored successfully")

    @protect()
    @safe
    @expose("/<publisher>/<name>/storage/persistent/<key>", methods=("DELETE",))
    @transaction()
    def delete_persistent(
        self, publisher: str, name: str, key: str, **kwargs: Any
    ) -> Response:
        """Delete a value from persistent state.
        ---
        delete:
          summary: Delete a value from persistent state
          parameters:
          - in: path
            name: publisher
            schema:
              type: string
            required: true
            description: Extension publisher
          - in: path
            name: name
            schema:
              type: string
            required: true
            description: Extension name
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
        extension_id = f"{publisher}.{name}"
        extension = get_extension_or_404(extension_id)
        if not extension:
            return self.response_404("Extension not found")

        shared = request.args.get("shared", "false").lower() == "true"
        user_fk = None if shared else g.user.id
        ExtensionStorageDAO.delete_by_key(extension_id, key, user_fk=user_fk)

        return self.response(200, message="Value deleted successfully")
