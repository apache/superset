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
import json
import re
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
from superset.utils.core import check_is_safe_zip
from superset.views.base_api import BaseSupersetApi, requires_form_data, statsd_metrics

BUNDLE_REGEX = re.compile(r"^dist/([^/]+)$")


class ExtensionsRestApi(BaseSupersetApi):
    allow_browser_login = True
    resource_name = "extensions"

    @protect()
    @safe
    @expose("/", methods=("GET",))
    @permission_name("read")
    def get(self, **kwargs: Any) -> Response:  # TODO: The module comes as a parameter
        # TODO: Move code to command
        result = []
        extensions = ExtensionDAO.find_all()
        for extension in extensions:
            manifest: Manifest = json.loads(extension.manifest)
            files = list(json.loads(extension.bundle))
            remote_entry_url = f"http://localhost:9000/api/v1/extensions/{extension.name}/remoteEntry.js"
            exposed_modules = [
                exposed_module
                for module in manifest.get("moduleFederation", {})
                for exposed_module in module.get("exposes", [])
            ]
            extension_data = {
                "name": extension.name,
                "remoteEntry": remote_entry_url,
                "files": files,
                "scope": extension.name,
                "exposedModules": exposed_modules,
                "contributions": manifest.get("contributions", {}),
                "extensionDependencies": manifest.get("extensionDependencies", []),
            }

            result.append(extension_data)

        return self.response(200, result=result)

    @protect()
    @safe
    @expose("/<name>/<file>", methods=("GET",))
    @permission_name("read")
    def content(self, name: str, file: str) -> Response:
        """Get a chunk file of an extension.
        ---
        get:
          summary: Get a chunk file of an extension.
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
        # TODO: Move code to command
        extension = ExtensionDAO.get_by_name(name)
        if not extension:
            return self.response_404()

        chunk = json.loads(extension.bundle).get(file)
        if not chunk:
            return self.response_404()

        chunk_bytes = BytesIO(chunk.encode("utf-8"))
        chunk_bytes.seek(0)

        return send_file(
            chunk_bytes,
            as_attachment=True,
            mimetype="application/javascript",
            download_name=file,
        )

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
                      description: extension bundle (ZIP)
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

        bundle: dict[str, str] = {}
        with ZipFile(upload) as uploaded_file:
            check_is_safe_zip(uploaded_file)
            for filename in uploaded_file.namelist():
                content = uploaded_file.read(filename).decode()
                if filename == "manifest.json":
                    try:
                        manifest = json.loads(content)
                        if "name" not in manifest:
                            return self.response_400(message="name missing in manifest")
                        name = manifest["name"]
                    except Exception:
                        return self.response_400(message="unable to parse manifest")
                elif match := BUNDLE_REGEX.match(filename):
                    bundle[match.group(1)] = content
                else:
                    self.response_400(message=f"Unexpected file in bundle: {filename}")

        if not manifest:
            return self.response_400(message="Missing manifest.json")

        if not bundle:
            return self.response_400(message="Missing bundle (no dist directory")

        ExtensionDAO.upsert(
            name=name,
            manifest=manifest,
            bundle=bundle,
            enabled=True,
        )
        db.session.commit()

        return self.response(200, message="OK")
