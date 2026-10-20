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
from io import BytesIO
from typing import Any

from flask import send_file
from flask.wrappers import Response
from flask_appbuilder.api import BaseApi, expose, protect, safe

from superset.extensions.availability import (
    are_extensions_loaded,
    get_extensions_state,
    get_servable_extensions,
    NOT_LOADED_MESSAGE,
    RuntimeGuardedExtensionsApiMixin,
)
from superset.extensions.utils import build_extension_data


class ExtensionsRestApi(RuntimeGuardedExtensionsApiMixin, BaseApi):
    allow_browser_login = True
    resource_name = "extensions"

    def response(self, status_code: int, **kwargs: Any) -> Response:
        """Helper method to create JSON responses."""
        from flask import jsonify

        return jsonify(kwargs), status_code

    def response_404(self, message: str = "Not found") -> Response:
        """Helper method to create 404 responses."""
        from flask import jsonify

        return jsonify({"message": message}), 404

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
                      status:
                        type: string
                        enum: [loaded, not_loaded]
                        description: >-
                          `not_loaded` when extensions are enabled for this
                          request but were not loaded at server startup
                      message:
                        type: string
        """
        return self.response(200, permissions=["can_read"], **get_extensions_state())

    # TODO: Support the q parameter
    @protect()
    @safe
    @expose("/", methods=("GET",))
    def get_list(self, **kwargs: Any) -> Response:
        """List all enabled extensions.
        ---
        get:
          summary: List all enabled extensions.
          responses:
            200:
              description: List of all enabled extensions
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
                        count:
                            type: integer
                        status:
                            type: string
                            enum: [loaded, not_loaded]
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
        # Empty on a server that did not initialize extensions at startup, so
        # the browser loads no extension code.
        result = []
        for extension in get_servable_extensions().values():
            extension_data = build_extension_data(extension)
            result.append(extension_data)

        response = {
            "result": result,
            "count": len(result),
            **get_extensions_state(),
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
        if not are_extensions_loaded():
            return self.response_404(NOT_LOADED_MESSAGE)
        # Reconstruct composite ID from publisher and name
        composite_id = f"{publisher}.{name}"
        extension = get_servable_extensions().get(composite_id)
        if not extension:
            return self.response_404()
        extension_data = build_extension_data(extension)
        return self.response(200, result=extension_data)

    @protect()
    @safe
    @expose("/<publisher>/<name>/<path:file>", methods=("GET",))
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
        if not are_extensions_loaded():
            return self.response_404(NOT_LOADED_MESSAGE)
        # Reconstruct composite ID from publisher and name
        composite_id = f"{publisher}.{name}"
        extension = get_servable_extensions().get(composite_id)
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
