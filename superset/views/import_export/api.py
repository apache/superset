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
from zipfile import ZipFile

from flask import request, Response, send_file
from flask_appbuilder.api import BaseApi, expose, protect

from superset.commands.export import ExportAssetsCommand
from superset.commands.importers.exceptions import NoValidFilesFoundError
from superset.commands.importers.v1.assets import ImportAssetsCommand
from superset.commands.importers.v1.utils import get_contents_from_bundle
from superset.extensions import event_logger
from superset.views.base_api import requires_form_data


class ImportExportRestApi(BaseApi):
    """
    API for exporting all assets or importing them.
    """

    resource_name = "assets"
    openapi_spec_tag = "Import/export"

    @expose("/export/", methods=["GET"])
    @protect()
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
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        root = f"superset_export_{timestamp}"
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
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.import_",
        log_to_statsd=False,
    )
    @requires_form_data
    def import_(self) -> Response:
        upload = request.files.get("bundle")
        if not upload:
            return self.response_400()

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
