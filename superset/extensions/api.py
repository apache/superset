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
from zipfile import is_zipfile, ZipFile

from flask import request, send_file
from flask.wrappers import Response
from flask_appbuilder.api import expose, permission_name, protect, safe

from superset import db
from superset.daos.extension import ExtensionDAO
from superset.extensions import event_logger
from superset.extensions.types import Manifest
from superset.extensions.utils import (
    get_bundle_files_from_zip,
    get_extensions,
    get_loaded_extension,
)
from superset.views.base_api import BaseSupersetApi, requires_form_data, statsd_metrics


class ExtensionsRestApi(BaseSupersetApi):
    allow_browser_login = True
    resource_name = "extensions"

    # TODO: Support the q parameter
    @protect()
    @safe
    @expose("/", methods=("GET",))
    @permission_name("read")
    def get(self, **kwargs: Any) -> Response:  # TODO: The module comes as a parameter
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
        # TODO: Move code to command
        result = []
        extensions = get_extensions()
        for extension in extensions.values():
            manifest: Manifest = extension.manifest
            extension_data: dict[str, Any] = {
                "id": extension.id,
                "name": extension.name,
                "dependencies": manifest.get("dependencies", []),
                "enabled": extension.enabled,
            }
            frontend = manifest.get("frontend")
            if frontend:
                module_federation = frontend.get("moduleFederation", {})
                remote_entry = frontend["remoteEntry"]
                extension_data.update(
                    {
                        "remoteEntry": f"/api/v1/extensions/{extension.name}/{remote_entry}",  # noqa: E501
                        "exposedModules": module_federation.get("exposes", []),
                        "contributions": frontend.get("contributions", {}),
                    }
                )

            result.append(extension_data)

        return self.response(200, result=result)

    @protect()
    @safe
    @expose("/<name>/<file>", methods=("GET",))
    @permission_name("read")
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

    @expose("/import/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.import_",
        log_to_statsd=False,
    )
    @requires_form_data
    def import_(self) -> Response:
        """Import extension.
        ---
        post:
          summary: Import extension bundle
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    bundle:
                      description: extension bundle
                      type: string
                      format: binary
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
        # TODO: Move code to command with @transaction
        upload = request.files.get("bundle")
        if not upload or not is_zipfile(upload):
            return self.response_400(message="Missing extensions bundle")

        with ZipFile(upload) as uploaded_file:
            try:
                files = get_bundle_files_from_zip(uploaded_file)
                extension = get_loaded_extension(files)
                ExtensionDAO.upsert(
                    name=extension.name,
                    manifest=extension.manifest,
                    frontend=extension.frontend,
                    backend=extension.backend,
                    enabled=True,
                )
                db.session.commit()
            except Exception as ex:
                self.response_400(message=str(ex))

        return self.response(200, message="OK")
