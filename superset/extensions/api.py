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
import mimetypes
import re
from io import BytesIO
from typing import Any

from flask import send_file
from flask.wrappers import Response
from flask_appbuilder.api import expose, protect, safe

from superset.extensions.utils import (
    build_extension_data,
    get_extensions,
)
from superset.views.base_api import BaseSupersetApi

# Allowlist for publisher and name path parameters — alphanumeric, hyphens,
# underscores only. Rejects path-traversal attempts (../), URL-encoded slashes,
# and any other characters that could escape EXTENSIONS_PATH.
_SEGMENT_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def _validate_segment(value: str) -> bool:
    """Return True if *value* is a safe publisher or name segment."""
    return bool(_SEGMENT_RE.match(value))


class ExtensionsRestApi(BaseSupersetApi):
    allow_browser_login = True
    resource_name = "extensions"
    class_permission_name = "Extensions"
    base_permissions = [
        "can_get_list",
        "can_get",
        "can_content",
        "can_info",
    ]

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

    # TODO: Support the q parameter
    @protect()
    @safe
    @expose("/", methods=("GET",))
    def get_list(self, **kwargs: Any) -> Response:
        """List all installed extensions.
        ---
        get_list:
          summary: List all installed extensions.
          responses:
            200:
              description: List of all installed extensions
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
        result = []
        extensions = get_extensions()
        for extension in extensions.values():
            extension_data = build_extension_data(extension)
            result.append(extension_data)

        response = {
            "result": result,
            "count": len(result),
        }

        return self.response(200, **response)

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
        if not _validate_segment(publisher) or not _validate_segment(name):
            return self.response(400, message="Invalid publisher or name.")
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
        if not _validate_segment(publisher) or not _validate_segment(name):
            return self.response(400, message="Invalid publisher or name.")
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
