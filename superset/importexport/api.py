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
from datetime import datetime
from io import BytesIO
from zipfile import is_zipfile, ZipFile

from flask import request, Response, send_file
from flask_appbuilder.api import expose, protect

from superset.commands.export.assets import ExportAssetsCommand
from superset.commands.importers.exceptions import (
    IncorrectFormatError,
    NoValidFilesFoundError,
)
from superset.commands.importers.v1.assets import ImportAssetsCommand
from superset.commands.importers.v1.utils import get_contents_from_bundle
from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetApi, requires_form_data, statsd_metrics


class ImportExportRestApi(BaseSupersetApi):
    """
    API for exporting all assets or importing them.
    """

    resource_name = "assets"
    openapi_spec_tag = "Import/export"
    allow_browser_login = True

    @expose("/export/", methods=["GET"])
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.export",
        log_to_statsd=False,
    )
    def export(self) -> Response:
        """
        Export all assets.
        ---
        get:
          description: >-
            Returns a ZIP file with all the Superset assets (databases, datasets, charts,
            dashboards, saved queries) as YAML files.
          responses:
            200:
              description: ZIP file
              content:
                application/zip:
                  schema:
                    type: string
                    format: binary
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        root = f"assets_export_{timestamp}"
        filename = f"{root}.zip"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            for file_name, file_content in ExportAssetsCommand().run():
                with bundle.open(f"{root}/{file_name}", "w") as fp:
                    fp.write(file_content.encode())
        buf.seek(0)

        response = send_file(
            buf,
            mimetype="application/zip",
            as_attachment=True,
            attachment_filename=filename,
        )
        return response

    @expose("/import/", methods=["POST"])
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.import_",
        log_to_statsd=False,
    )
    @requires_form_data
    def import_(self) -> Response:
        """Import multiple assets
        ---
        post:
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    bundle:
                      description: upload file (ZIP or JSON)
                      type: string
                      format: binary
                    passwords:
                      description: >-
                        JSON map of passwords for each featured database in the
                        ZIP file. If the ZIP includes a database config in the path
                        `databases/MyDatabase.yaml`, the password should be provided
                        in the following format:
                        `{"databases/MyDatabase.yaml": "my_password"}`.
                      type: string
          responses:
            200:
              description: Assets import result
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
        upload = request.files.get("bundle")
        if not upload:
            return self.response_400()
        if not is_zipfile(upload):
            raise IncorrectFormatError("Not a ZIP file")

        with ZipFile(upload) as bundle:
            contents = get_contents_from_bundle(bundle)

        if not contents:
            raise NoValidFilesFoundError()

        passwords = (
            json.loads(request.form["passwords"])
            if "passwords" in request.form
            else None
        )

        command = ImportAssetsCommand(contents, passwords=passwords)
        command.run()
        return self.response(200, message="OK")
