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
from typing import Any
import os
from flask import send_file

from flask.wrappers import Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from flask_babel import lazy_gettext as _

from superset.views.base_api import BaseSupersetApi


class ExtensionsRestApi(BaseSupersetApi):
    allow_browser_login = True
    resource_name = "extensions"

    @protect()
    @safe
    @expose("/", methods=("GET",))
    @permission_name("read")
    def get(self, **kwargs: Any) -> Response:
        app_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
        extensions_path = f"{app_dir}/static/extensions/"
        extensions = os.listdir(extensions_path)
        result = []
        for extension in extensions:
            remote_entry_url = (
                f"http://localhost:9000/api/v1/extensions/{extension}/remoteEntry.js"
            )
            exposed_modules = [
                "./ExtensionExample"
            ]  # Populate this list with the actual exposed modules
            scope = extension

            extension_data = {
                "remoteEntry": remote_entry_url,
                "exposedModules": exposed_modules,
                "scope": scope,
            }
            result.append(extension_data)
        return self.response(200, result=result)

    @protect()
    @safe
    @expose("/<name>/<file>", methods=("GET",))
    @permission_name("read")
    def content(self, name: str, file: str, **kwargs: Any) -> Response:
        app_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
        folder_path = f"{app_dir}/static/extensions/{name}"
        file_path = os.path.join(folder_path, file)

        if not os.path.exists(file_path):
            return Response("File not found", status=404)

        return send_file(
            file_path,
            as_attachment=True,
            mimetype="application/javascript",
            download_name=file,
        )
