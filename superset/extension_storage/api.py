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

"""REST API for extension Tier-3 persistent storage.

URL structure (all under /api/v1/extensions/<publisher>/<name>/storage/persistent/):

  GET             /global/
      Paginated list of global keys (?page=0&page_size=25&category=…).

  GET/PUT/DELETE  /global/<key>
      Global key-value: shared across all users of this extension.

  GET             /user/
      Paginated list of user-scoped keys (?page=0&page_size=25&category=…).

  GET/PUT/DELETE  /user/<key>
      User-scoped key-value: isolated per authenticated user.

  GET             /resources/<resource_type>/<resource_uuid>/
      Paginated list of resource-linked keys (?page=0&page_size=25&category=…).

  GET/PUT/DELETE  /resources/<resource_type>/<resource_uuid>/<key>
      Resource-linked key-value: tied to a specific Superset resource.
"""

from __future__ import annotations

import logging

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe

from superset.extension_storage.daos import ExtensionStorageDAO
from superset.superset_typing import FlaskResponse
from superset.utils.core import get_user_id
from superset.utils.decorators import transaction
from superset.views.base_api import BaseSupersetApi

logger = logging.getLogger(__name__)

_MIME_DEFAULT = "application/json"
_PAGE_SIZE_DEFAULT = 25
_PAGE_SIZE_MAX = 100


def _parse_pagination() -> tuple[int, int]:
    """Return (offset, page_size) from ?page=&page_size= query params."""
    try:
        page = max(0, int(request.args.get("page", 0)))
    except (TypeError, ValueError):
        page = 0
    try:
        page_size = min(
            _PAGE_SIZE_MAX,
            max(1, int(request.args.get("page_size", _PAGE_SIZE_DEFAULT))),
        )
    except (TypeError, ValueError):
        page_size = _PAGE_SIZE_DEFAULT
    return page * page_size, page_size


def _extension_id(publisher: str, name: str) -> str:
    return f"{publisher}.{name}"


def _entry_to_dict(entry: object) -> dict[str, object]:
    from superset.extension_storage.models import ExtensionStorage

    assert isinstance(entry, ExtensionStorage)
    return {
        "key": entry.key,
        "value_type": entry.value_type,
        "category": entry.category,
        "description": entry.description,
        "is_encrypted": entry.is_encrypted,
        "uuid": str(entry.uuid),
    }


class ExtensionStorageRestApi(BaseSupersetApi):
    """Generic persistent storage for extensions (Tier 3)."""

    allow_browser_login = True
    route_base = "/api/v1/extensions"
    resource_name = "extensions"
    openapi_spec_tag = "Extension Storage"

    # ── Global scope ──────────────────────────────────────────────────────────

    @expose(
        "/<publisher>/<name>/storage/persistent/global/",
        methods=("GET",),
    )
    @protect()
    @safe
    def list_global(self, publisher: str, name: str) -> FlaskResponse:
        """List global (non-user-scoped) storage entries with pagination.
        ---
        get:
          summary: List global persistent storage entries
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: category
              in: query
              required: false
              schema: {type: string}
            - name: page
              in: query
              required: false
              schema: {type: integer, default: 0}
            - name: page_size
              in: query
              required: false
              schema: {type: integer, default: 25}
          responses:
            200:
              description: Success
        """
        ext_id = _extension_id(publisher, name)
        category = request.args.get("category")
        offset, page_size = _parse_pagination()
        entries = ExtensionStorageDAO.list_global(ext_id, category=category)
        total = len(entries)
        page_entries = entries[offset : offset + page_size]
        return self.response(
            200,
            result=[_entry_to_dict(e) for e in page_entries],
            count=total,
        )

    @expose(
        "/<publisher>/<name>/storage/persistent/global/<key>",
        methods=("GET",),
    )
    @protect()
    @safe
    def get_global(self, publisher: str, name: str, key: str) -> FlaskResponse:
        """Get a global (non-user-scoped) persistent value.
        ---
        get:
          summary: Get global persistent value
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: key
              in: path
              required: true
              schema: {type: string}
          responses:
            200:
              description: Success
            404:
              description: Not found
        """
        ext_id = _extension_id(publisher, name)
        value = ExtensionStorageDAO.get_value(ext_id, key)
        if value is None:
            return self.response(404, message="Not found")
        entry = ExtensionStorageDAO.get(ext_id, key)
        assert entry is not None
        mime = entry.value_type
        return Response(value, status=200, mimetype=mime)

    @expose(
        "/<publisher>/<name>/storage/persistent/global/<key>",
        methods=("PUT",),
    )
    @protect()
    @safe
    @transaction()
    def set_global(self, publisher: str, name: str, key: str) -> FlaskResponse:
        """Create or update a global persistent value.
        ---
        put:
          summary: Set global persistent value
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: key
              in: path
              required: true
              schema: {type: string}
          requestBody:
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    value: {type: string}
                    value_type: {type: string}
                    category: {type: string}
                    description: {type: string}
                    is_encrypted: {type: boolean}
          responses:
            200:
              description: Success
        """
        ext_id = _extension_id(publisher, name)
        body = request.get_json(force=True) or {}
        raw_value: str | bytes = body.get("value", "")
        value_bytes = raw_value.encode() if isinstance(raw_value, str) else raw_value
        entry = ExtensionStorageDAO.set(
            extension_id=ext_id,
            key=key,
            value=value_bytes,
            value_type=body.get("value_type", _MIME_DEFAULT),
            category=body.get("category"),
            description=body.get("description"),
            is_encrypted=bool(body.get("is_encrypted", False)),
        )
        return self.response(200, result=_entry_to_dict(entry))

    @expose(
        "/<publisher>/<name>/storage/persistent/global/<key>",
        methods=("DELETE",),
    )
    @protect()
    @safe
    @transaction()
    def delete_global(self, publisher: str, name: str, key: str) -> FlaskResponse:
        """Delete a global persistent value.
        ---
        delete:
          summary: Delete global persistent value
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: key
              in: path
              required: true
              schema: {type: string}
          responses:
            200:
              description: Deleted
            404:
              description: Not found
        """
        ext_id = _extension_id(publisher, name)
        deleted = ExtensionStorageDAO.delete(ext_id, key)
        if not deleted:
            return self.response(404, message="Not found")
        return self.response(200, message="Deleted")

    # ── User scope ────────────────────────────────────────────────────────────

    @expose(
        "/<publisher>/<name>/storage/persistent/user/",
        methods=("GET",),
    )
    @protect()
    @safe
    def list_user(self, publisher: str, name: str) -> FlaskResponse:
        """List user-scoped storage entries for the current user with pagination.
        ---
        get:
          summary: List user-scoped storage entries
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: category
              in: query
              required: false
              schema: {type: string}
            - name: page
              in: query
              required: false
              schema: {type: integer, default: 0}
            - name: page_size
              in: query
              required: false
              schema: {type: integer, default: 25}
          responses:
            200:
              description: Success
        """
        user_id = get_user_id()
        if not user_id:
            return self.response(401, message="Authentication required")
        ext_id = _extension_id(publisher, name)
        category = request.args.get("category")
        offset, page_size = _parse_pagination()
        entries = ExtensionStorageDAO.list_user(ext_id, user_id, category=category)
        total = len(entries)
        page_entries = entries[offset : offset + page_size]
        return self.response(
            200, result=[_entry_to_dict(e) for e in page_entries], count=total
        )

    @expose(
        "/<publisher>/<name>/storage/persistent/user/<key>",
        methods=("GET",),
    )
    @protect()
    @safe
    def get_user(self, publisher: str, name: str, key: str) -> FlaskResponse:
        """Get a user-scoped persistent value.
        ---
        get:
          summary: Get user-scoped persistent value
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: key
              in: path
              required: true
              schema: {type: string}
          responses:
            200:
              description: Success
            404:
              description: Not found
        """
        user_id = get_user_id()
        if not user_id:
            return self.response(401, message="Authentication required")
        ext_id = _extension_id(publisher, name)
        value = ExtensionStorageDAO.get_value(ext_id, key, user_fk=user_id)
        if value is None:
            return self.response(404, message="Not found")
        entry = ExtensionStorageDAO.get(ext_id, key, user_fk=user_id)
        assert entry is not None
        return Response(value, status=200, mimetype=entry.value_type)

    @expose(
        "/<publisher>/<name>/storage/persistent/user/<key>",
        methods=("PUT",),
    )
    @protect()
    @safe
    @transaction()
    def set_user(self, publisher: str, name: str, key: str) -> FlaskResponse:
        """Create or update a user-scoped persistent value.
        ---
        put:
          summary: Set user-scoped persistent value
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: key
              in: path
              required: true
              schema: {type: string}
          responses:
            200:
              description: Success
        """
        user_id = get_user_id()
        if not user_id:
            return self.response(401, message="Authentication required")
        ext_id = _extension_id(publisher, name)
        body = request.get_json(force=True) or {}
        raw_value: str | bytes = body.get("value", "")
        value_bytes = raw_value.encode() if isinstance(raw_value, str) else raw_value
        entry = ExtensionStorageDAO.set(
            extension_id=ext_id,
            key=key,
            value=value_bytes,
            value_type=body.get("value_type", _MIME_DEFAULT),
            user_fk=user_id,
            category=body.get("category"),
            description=body.get("description"),
            is_encrypted=bool(body.get("is_encrypted", False)),
        )
        return self.response(200, result=_entry_to_dict(entry))

    @expose(
        "/<publisher>/<name>/storage/persistent/user/<key>",
        methods=("DELETE",),
    )
    @protect()
    @safe
    @transaction()
    def delete_user(self, publisher: str, name: str, key: str) -> FlaskResponse:
        """Delete a user-scoped persistent value.
        ---
        delete:
          summary: Delete user-scoped persistent value
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: key
              in: path
              required: true
              schema: {type: string}
          responses:
            200:
              description: Deleted
            404:
              description: Not found
        """
        user_id = get_user_id()
        if not user_id:
            return self.response(401, message="Authentication required")
        ext_id = _extension_id(publisher, name)
        deleted = ExtensionStorageDAO.delete(ext_id, key, user_fk=user_id)
        if not deleted:
            return self.response(404, message="Not found")
        return self.response(200, message="Deleted")

    # ── Resource scope ────────────────────────────────────────────────────────

    @expose(
        "/<publisher>/<name>/storage/persistent/resources/<resource_type>/<resource_uuid>/",
        methods=("GET",),
    )
    @protect()
    @safe
    def list_resource(
        self,
        publisher: str,
        name: str,
        resource_type: str,
        resource_uuid: str,
    ) -> FlaskResponse:
        """List storage entries linked to a resource with pagination.
        ---
        get:
          summary: List resource-linked storage entries
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: resource_type
              in: path
              required: true
              schema: {type: string}
            - name: resource_uuid
              in: path
              required: true
              schema: {type: string}
            - name: category
              in: query
              required: false
              schema: {type: string}
            - name: page
              in: query
              required: false
              schema: {type: integer, default: 0}
            - name: page_size
              in: query
              required: false
              schema: {type: integer, default: 25}
          responses:
            200:
              description: Success
        """
        ext_id = _extension_id(publisher, name)
        category = request.args.get("category")
        offset, page_size = _parse_pagination()
        entries = ExtensionStorageDAO.list_resource(
            ext_id, resource_type, resource_uuid, category=category
        )
        total = len(entries)
        page_entries = entries[offset : offset + page_size]
        return self.response(
            200, result=[_entry_to_dict(e) for e in page_entries], count=total
        )

    @expose(
        "/<publisher>/<name>/storage/persistent/resources/<resource_type>/<resource_uuid>/<key>",
        methods=("GET",),
    )
    @protect()
    @safe
    def get_resource(
        self,
        publisher: str,
        name: str,
        resource_type: str,
        resource_uuid: str,
        key: str,
    ) -> FlaskResponse:
        """Get a resource-linked persistent value.
        ---
        get:
          summary: Get resource-linked persistent value
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: resource_type
              in: path
              required: true
              schema: {type: string}
            - name: resource_uuid
              in: path
              required: true
              schema: {type: string}
            - name: key
              in: path
              required: true
              schema: {type: string}
          responses:
            200:
              description: Success
            404:
              description: Not found
        """
        ext_id = _extension_id(publisher, name)
        value = ExtensionStorageDAO.get_value(
            ext_id, key, resource_type=resource_type, resource_uuid=resource_uuid
        )
        if value is None:
            return self.response(404, message="Not found")
        entry = ExtensionStorageDAO.get(
            ext_id, key, resource_type=resource_type, resource_uuid=resource_uuid
        )
        assert entry is not None
        return Response(value, status=200, mimetype=entry.value_type)

    @expose(
        "/<publisher>/<name>/storage/persistent/resources/<resource_type>/<resource_uuid>/<key>",
        methods=("PUT",),
    )
    @protect()
    @safe
    @transaction()
    def set_resource(
        self,
        publisher: str,
        name: str,
        resource_type: str,
        resource_uuid: str,
        key: str,
    ) -> FlaskResponse:
        """Create or update a resource-linked persistent value.
        ---
        put:
          summary: Set resource-linked persistent value
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: resource_type
              in: path
              required: true
              schema: {type: string}
            - name: resource_uuid
              in: path
              required: true
              schema: {type: string}
            - name: key
              in: path
              required: true
              schema: {type: string}
          responses:
            200:
              description: Success
        """
        ext_id = _extension_id(publisher, name)
        body = request.get_json(force=True) or {}
        raw_value: str | bytes = body.get("value", "")
        value_bytes = raw_value.encode() if isinstance(raw_value, str) else raw_value
        entry = ExtensionStorageDAO.set(
            extension_id=ext_id,
            key=key,
            value=value_bytes,
            value_type=body.get("value_type", _MIME_DEFAULT),
            resource_type=resource_type,
            resource_uuid=resource_uuid,
            category=body.get("category"),
            description=body.get("description"),
            is_encrypted=bool(body.get("is_encrypted", False)),
        )
        return self.response(200, result=_entry_to_dict(entry))

    @expose(
        "/<publisher>/<name>/storage/persistent/resources/<resource_type>/<resource_uuid>/<key>",
        methods=("DELETE",),
    )
    @protect()
    @safe
    @transaction()
    def delete_resource(
        self,
        publisher: str,
        name: str,
        resource_type: str,
        resource_uuid: str,
        key: str,
    ) -> FlaskResponse:
        """Delete a resource-linked persistent value.
        ---
        delete:
          summary: Delete resource-linked persistent value
          parameters:
            - name: publisher
              in: path
              required: true
              schema: {type: string}
            - name: name
              in: path
              required: true
              schema: {type: string}
            - name: resource_type
              in: path
              required: true
              schema: {type: string}
            - name: resource_uuid
              in: path
              required: true
              schema: {type: string}
            - name: key
              in: path
              required: true
              schema: {type: string}
          responses:
            200:
              description: Deleted
            404:
              description: Not found
        """
        ext_id = _extension_id(publisher, name)
        deleted = ExtensionStorageDAO.delete(
            ext_id, key, resource_type=resource_type, resource_uuid=resource_uuid
        )
        if not deleted:
            return self.response(404, message="Not found")
        return self.response(200, message="Deleted")
