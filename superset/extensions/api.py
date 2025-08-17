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

from flask import request, send_file
from flask.wrappers import Response
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset.commands.extension.delete import DeleteExtensionCommand
from superset.daos.extension import ExtensionDAO
from superset.extensions import event_logger
from superset.extensions.models import Extension
from superset.extensions.schemas import delete_schema, ExtensionPutSchema
from superset.extensions.utils import (
    build_extension_data,
    build_loaded_extension,
    get_extensions,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    requires_json,
    statsd_metrics,
)


# TODO: Refactor to use commands
class ExtensionsRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Extension)
    allow_browser_login = True
    resource_name = "extensions"

    edit_model_schema = ExtensionPutSchema()

    # TODO: Support the q parameter
    @protect()
    @safe
    @expose("/", methods=("GET",))
    def get_list(self, **kwargs: Any) -> Response:
        """List all enabled extensions.
        ---
        get_list:
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

        return self.response(200, result=result)

    @protect()
    @safe
    @expose("/<int:pk>", methods=("GET",))
    def get(self, pk: int, **kwargs: Any) -> Response:
        """Get an extension by its primary key.
        ---
        get:
          summary: Get an extension by its primary key.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
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
        extension = ExtensionDAO.find_by_id(pk)
        if not extension:
            return self.response_404()
        loaded_extension = build_loaded_extension(extension)
        extension_data = build_extension_data(loaded_extension)
        return self.response(200, result=extension_data)

    @protect()
    @safe
    @expose("/<name>/<file>", methods=("GET",))
    def content(self, name: str, file: str) -> Response:
        """Get a frontend chunk of an extension.
        ---
        get:
          summary: Get a frontend chunk of an extension.
          parameters:
          - in: path
            schema:
              type: string
            name: name
            description: name of the extension
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
        extensions = get_extensions()
        extension = extensions.get(name)
        if not extension:
            return self.response_404()

        chunk = extension.frontend.get(file)
        if not chunk:
            return self.response_404()

        mimetype, _ = mimetypes.guess_type(file)
        if not mimetype:
            mimetype = "application/octet-stream"

        return send_file(BytesIO(chunk), mimetype=mimetype)

    @expose("/<int:pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, pk: int) -> Response:
        """Update an extension.
        ---
        put:
          summary: Change an extension
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Extension schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Extension changed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: boolean
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            # TODO: Just supporting enabled field for now. We need to check if we'll
            # need more and also handle specific exceptions.
            item = self.edit_model_schema.load(request.json)
            model = ExtensionDAO.find_by_id(pk)
            if not model:
                return self.response_404()
            ExtensionDAO.update(item=model, attributes={"enabled": item["enabled"]})
            return self.response(200, result=True)

        except ValidationError as error:
            return self.response_400(message=error.messages)

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    @rison(delete_schema)
    def delete(self, **kwargs: Any) -> Response:
        """Delete extensions.
        ---
        delete:
          summary: Delete extensions
          parameters:
            - in: query
              name: q
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/delete_schema'
          responses:
            200:
              description: Extensions deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: boolean
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        ids = kwargs["rison"]
        if not ids or not isinstance(ids, list):
            return self.response_400(message="Invalid or missing ids")

        DeleteExtensionCommand(ids).run()
        return self.response(200, result=True)
