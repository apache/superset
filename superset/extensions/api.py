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
from pathlib import Path
from typing import Any
from zipfile import is_zipfile, ZipFile

from flask import current_app, request, send_file
from flask.wrappers import Response
from flask_appbuilder.api import BaseApi, expose, protect, safe

from superset.extensions import security_manager
from superset.extensions.settings import (
    get_extension_settings,
    update_extension_settings,
)
from superset.extensions.utils import (
    build_extension_data,
    get_bundle_files_from_zip,
    get_extensions,
    get_loaded_extension,
)
from superset.utils.core import check_is_safe_zip

# Allowlist for publisher and name path parameters — alphanumeric, hyphens,
# underscores only. Rejects path-traversal attempts (../), URL-encoded slashes,
# and any other characters that could escape EXTENSIONS_PATH.
_SEGMENT_RE = re.compile(r"^[A-Za-z0-9_-]+$")

# Default 10 MB server-side upload limit; can be overridden via config.
_DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _validate_segment(value: str) -> bool:
    """Return True if *value* is a safe publisher or name segment."""
    return bool(_SEGMENT_RE.match(value))


class ExtensionsRestApi(BaseApi):
    allow_browser_login = True
    resource_name = "extensions"
    class_permission_name = "Extensions"
    base_permissions = [
        "can_get_list",
        "can_get",
        "can_put",
        "can_post",
        "can_delete",
        "can_content",
        "can_info",
        "can_get_settings",
        "can_put_settings",
    ]

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
    @expose("/", methods=("POST",))
    def post(self, **kwargs: Any) -> Response:
        """Upload and install an extension bundle (.supx file).
        ---
        post:
          summary: Upload a .supx extension bundle.
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    bundle:
                      type: string
                      format: binary
                      description: The .supx extension bundle file.
          responses:
            201:
              description: Extension installed successfully.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        if not security_manager.is_admin():
            return self.response(403, message="Admin access required.")

        extensions_path = current_app.config.get("EXTENSIONS_PATH")
        if not extensions_path:
            return self.response(
                400,
                message=(
                    "EXTENSIONS_PATH is not configured. Set it in superset_config.py "
                    "to enable extension uploads."
                ),
            )

        upload = request.files.get("bundle")
        if not upload:
            return self.response(
                400, message="No file provided. Send a 'bundle' field."
            )

        if not upload.filename or not upload.filename.endswith(".supx"):
            return self.response(400, message="File must have a .supx extension.")

        max_bytes: int = current_app.config.get(
            "EXTENSIONS_MAX_UPLOAD_SIZE", _DEFAULT_MAX_UPLOAD_BYTES
        )
        raw = upload.read(max_bytes + 1)
        if len(raw) > max_bytes:
            return self.response(
                400,
                message=(
                    f"File exceeds the maximum allowed size of {max_bytes} bytes."
                ),
            )

        stream = BytesIO(raw)
        if not is_zipfile(stream):
            return self.response(400, message="File is not a valid ZIP archive.")

        stream.seek(0)
        try:
            with ZipFile(stream, "r") as zip_file:
                check_is_safe_zip(zip_file)
                files = list(get_bundle_files_from_zip(zip_file))
                extension = get_loaded_extension(files, source_base_path="upload://")
        except Exception as ex:  # pylint: disable=broad-except
            return self.response(400, message=f"Invalid extension bundle: {ex}")

        # Validate the manifest id before using it as a filename component.
        # The id is publisher.name (e.g. "acme.chatbot"); each segment must pass
        # _validate_segment so a crafted bundle cannot write outside EXTENSIONS_PATH
        # even though the admin is trusted — defence-in-depth against third-party
        # bundles the admin did not author.
        manifest_id: str = extension.manifest.id
        id_parts = manifest_id.split(".", 1)
        if len(id_parts) != 2 or not all(  # noqa: PLR2004
            _validate_segment(p) for p in id_parts
        ):
            return self.response(
                400,
                message=(
                    f"Invalid extension id '{manifest_id}' in manifest. "
                    "Expected '<publisher>.<name>' with alphanumeric, hyphen, "
                    "or underscore characters only."
                ),
            )

        # Reject bundles whose manifest id collides with a LOCAL_EXTENSIONS entry.
        local_ids = {
            Path(p).name for p in current_app.config.get("LOCAL_EXTENSIONS", [])
        }
        if manifest_id in local_ids:
            return self.response(
                409,
                message=(
                    f"Extension '{manifest_id}' is already installed as a "
                    "local extension. Remove it from LOCAL_EXTENSIONS before uploading."
                ),
            )

        # Persist to EXTENSIONS_PATH so the extension survives restarts.
        # Destination filename is built from the validated manifest id, not from the
        # uploaded filename, so neither can escape EXTENSIONS_PATH.
        dest_dir = Path(extensions_path)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_file = dest_dir / f"{manifest_id}.supx"

        stream.seek(0)
        dest_file.write_bytes(stream.read())

        return self.response(201, result=build_extension_data(extension))

    @protect()
    @safe
    @expose("/<publisher>/<name>", methods=("DELETE",))
    def delete(self, publisher: str, name: str, **kwargs: Any) -> Response:
        """Delete an uploaded extension bundle.
        ---
        delete:
          summary: Delete an extension by its publisher and name.
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
              description: Extension deleted.
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not security_manager.is_admin():
            return self.response(403, message="Admin access required.")

        if not _validate_segment(publisher) or not _validate_segment(name):
            return self.response(400, message="Invalid publisher or name.")

        composite_id = f"{publisher}.{name}"
        extensions = get_extensions()
        extension = extensions.get(composite_id)
        if not extension:
            return self.response_404()

        # LOCAL_EXTENSIONS are managed via config — cannot be deleted through the UI.
        local_paths = {
            str((Path(p) / "dist").resolve())
            for p in current_app.config.get("LOCAL_EXTENSIONS", [])
        }
        if extension.source_base_path in local_paths:
            return self.response(
                400,
                message=(
                    "Local extensions configured via LOCAL_EXTENSIONS cannot be "
                    "deleted through the UI. Remove them from your configuration."
                ),
            )

        # Locate and remove the .supx file from EXTENSIONS_PATH.
        extensions_path = current_app.config.get("EXTENSIONS_PATH")
        if not extensions_path:
            return self.response(
                400,
                message="EXTENSIONS_PATH is not configured; cannot remove bundle file.",
            )

        supx_file = Path(extensions_path) / f"{composite_id}.supx"
        if not supx_file.exists():
            return self.response_404()

        supx_file.unlink()
        return self.response(200, message="Extension deleted.")

    @protect()
    @safe
    @expose("/settings", methods=("GET",))
    def get_settings(self, **kwargs: Any) -> Response:
        """Get global extension admin settings.

        No admin gate here by design: authenticated non-admin users need these
        settings so the ChatbotMount can read active_chatbot_id on every page.
        ---
        get:
          summary: Get extension admin settings (active chatbot, enabled flags).
          responses:
            200:
              description: Extension settings
        """
        return self.response(200, result=get_extension_settings())

    @protect()
    @safe
    @expose("/settings", methods=("PUT",))
    def put_settings(self, **kwargs: Any) -> Response:
        """Update global extension admin settings.
        ---
        put:
          summary: Update extension admin settings.
          requestBody:
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    active_chatbot_id:
                      type: string
                      nullable: true
                    enabled:
                      type: object
                      additionalProperties:
                        type: boolean
          responses:
            200:
              description: Updated settings
            403:
              $ref: '#/components/responses/403'
        """
        if not security_manager.is_admin():
            return self.response(403, message="Admin access required.")
        body = request.get_json(silent=True) or {}
        result = update_extension_settings(body)
        return self.response(200, result=result)

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
