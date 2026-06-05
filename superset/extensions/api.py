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
import logging
import mimetypes
from io import BytesIO
from collections.abc import Callable
from typing import Any

import rison
from flask import request, send_file
from flask.wrappers import Response
from flask_appbuilder.api import BaseApi, expose, protect, safe

from superset.extensions.types import LoadedExtension
from superset.extensions.utils import (
    build_extension_data,
    get_extensions,
)

logger = logging.getLogger(__name__)

ALLOWED_FILTER_COLUMNS = {"name", "id", "publisher", "version"}
DEFAULT_PAGE_SIZE = 100


_MANIFEST_FIELD_GETTERS: dict[str, Callable[..., str]] = {
    "name": lambda m: m.name,
    "id": lambda m: m.id,
    "publisher": lambda m: m.publisher,
    "version": lambda m: m.version,
    "description": lambda m: m.description or "",
}


def _extension_field(ext: LoadedExtension, col: str) -> str:
    """Retrieve a filterable/searchable field from a LoadedExtension."""
    getter = _MANIFEST_FIELD_GETTERS.get(col)
    if getter is None:
        return ""
    return getter(ext.manifest)


class ExtensionsRestApi(BaseApi):
    allow_browser_login = True
    resource_name = "extensions"

    def response(self, status_code: int, **kwargs: Any) -> Response:
        """Helper method to create JSON responses."""
        from flask import jsonify

        return jsonify(kwargs), status_code

    def response_404(self) -> Response:
        """Helper method to create 404 responses."""
        from flask import jsonify

        return jsonify({"message": "Not found"}), 404

    @expose("/_info", methods=("GET",))
    @protect()
    @safe
    def info(self, **kwargs: Any) -> Response:
        """Get API info including permissions.
        ---
        get:
          summary: Get API info
          responses:
            200:
              description: API info
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      permissions:
                        type: array
                        items:
                          type: string
        """
        return self.response(200, permissions=["can_read"])

    @protect()
    @safe
    @expose("/", methods=("GET",))
    def get_list(self, **kwargs: Any) -> Response:
        """List enabled extensions with optional filtering.
        ---
        get_list:
          summary: List enabled extensions with optional filtering.
          parameters:
          - in: query
            name: q
            schema:
              type: string
            description: >
              Rison-encoded query object. Supported keys:
              ``filters`` – list of ``{col, opr, value}`` where *col* is
              one of ``name``, ``id``, ``publisher``, ``version`` and
              *opr* is ``eq``;
              ``search`` – case-insensitive substring match across
              name, id, description and publisher;
              ``page`` / ``page_size`` – zero-based pagination.
          responses:
            200:
              description: List of enabled extensions
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                        count:
                            type: integer
                        result:
                            type: array
                            items:
                              type: object
                              properties:
                                id:
                                  type: string
                                name:
                                  type: string
                                version:
                                  type: string
                                remoteEntry:
                                  type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        extensions = get_extensions()
        ext_list = list(extensions.values())

        q_str = request.args.get("q")
        q_args: dict[str, Any] = {}
        if q_str:
            try:
                q_args = rison.loads(q_str)
            except Exception:
                return self.response_400(
                    message="Invalid rison query parameter"
                )

            if not isinstance(q_args, dict):
                return self.response_400(
                    message="Query parameter must be a rison object"
                )

            ext_list, error = self._apply_q(ext_list, q_args)
            if error:
                return self.response_400(message=error)

        total_count = len(ext_list)

        page = q_args.get("page")
        page_size = q_args.get("page_size", DEFAULT_PAGE_SIZE)
        if page is not None:
            start = page * page_size
            ext_list = ext_list[start : start + page_size]

        result = [build_extension_data(ext) for ext in ext_list]
        return self.response(200, result=result, count=total_count)

    @staticmethod
    def _apply_q(
        ext_list: list[LoadedExtension], q_args: dict[str, Any]
    ) -> tuple[list[LoadedExtension], str | None]:
        """Apply filters and search from a parsed q parameter."""
        if filters := q_args.get("filters"):
            if not isinstance(filters, list):
                return ext_list, "'filters' must be a list"
            for f in filters:
                col = f.get("col")
                value = f.get("value")
                if col not in ALLOWED_FILTER_COLUMNS:
                    return ext_list, (
                        f"Invalid filter column '{col}'. "
                        f"Allowed: {', '.join(sorted(ALLOWED_FILTER_COLUMNS))}"
                    )
                ext_list = [
                    ext for ext in ext_list
                    if _extension_field(ext, col) == value
                ]

        if search := q_args.get("search"):
            term = str(search).lower()
            ext_list = [
                ext for ext in ext_list
                if any(
                    term in str(_extension_field(ext, field)).lower()
                    for field in ("name", "id", "description", "publisher")
                )
            ]

        return ext_list, None

    @protect()
    @safe
    @expose("/<publisher>/<name>", methods=("GET",))
    def get(self, publisher: str, name: str, **kwargs: Any) -> Response:
        """Get an extension by its publisher and name.
        ---
        get:
          summary: Get an extension by its publisher and name.
          parameters:
          - in: path
            schema:
              type: string
            name: publisher
          - in: path
            schema:
              type: string
            name: name
          responses:
            200:
              description: Extension details
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
                                remoteEntry:
                                  type: string
                                remoteEntry:
                                  type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        # Reconstruct composite ID from publisher and name
        composite_id = f"{publisher}.{name}"
        extensions = get_extensions()
        extension = extensions.get(composite_id)
        if not extension:
            return self.response_404()
        extension_data = build_extension_data(extension)
        return self.response(200, result=extension_data)

    @protect()
    @safe
    @expose("/<publisher>/<name>/<file>", methods=("GET",))
    def content(self, publisher: str, name: str, file: str) -> Response:
        """Get a frontend chunk of an extension.
        ---
        get:
          summary: Get a frontend chunk of an extension.
          parameters:
          - in: path
            schema:
              type: string
            name: publisher
            description: publisher of the extension
          - in: path
            schema:
              type: string
            name: name
            description: technical name of the extension
          - in: path
            schema:
              type: string
            name: file
            description: name of the requested chunk
          responses:
            200:
              description: Extension import result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        # Reconstruct composite ID from publisher and name
        composite_id = f"{publisher}.{name}"
        extensions = get_extensions()
        extension = extensions.get(composite_id)
        if not extension:
            return self.response_404()

        chunk = extension.frontend.get(file)
        if not chunk:
            return self.response_404()

        mimetype, _ = mimetypes.guess_type(file)
        if not mimetype:
            mimetype = "application/octet-stream"

        response = send_file(BytesIO(chunk), mimetype=mimetype)
        # Chunk filenames include a content hash, so they are immutable.
        response.cache_control.max_age = 31536000
        response.cache_control.public = True
        response.cache_control.immutable = True
        return response
