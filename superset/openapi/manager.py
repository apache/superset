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
"""APPLICATION_ROOT-aware OpenAPI spec and Swagger UI.

Serves the OpenAPI spec and Swagger UI in a way that works when Superset is
deployed behind a URL prefix (reverse proxy) via ``APPLICATION_ROOT``. Enabled
by the ``FAB_API_SWAGGER_UI_SUPERSET_APP_ROOT`` config flag.
"""

from typing import Any

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from apispec.ext.marshmallow.common import resolve_schema_cls
from flask import current_app, request
from flask_appbuilder.api import BaseApi, expose, protect, safe
from flask_appbuilder.baseviews import BaseView
from flask_appbuilder.security.decorators import has_access

from superset.superset_typing import FlaskResponse


def normalize_app_root(app_root: str | None) -> str:
    """Normalize ``APPLICATION_ROOT`` into a prefix safe for URL concatenation.

    Flask defaults ``APPLICATION_ROOT`` to ``"/"``. Concatenating that (or any
    value with a trailing slash) directly with a leading-slash path produces an
    invalid protocol-relative URL such as ``//api/v1/_openapi``. Treat ``"/"`` as
    an empty prefix and strip any trailing slash so the result is either empty or
    a clean ``/prefix``.
    """
    if not app_root:
        return ""
    return app_root.rstrip("/")


def resolve_url_prefix() -> str:
    """Resolve the URL prefix used to build OpenAPI/Swagger links.

    Prefer the request's script root so reverse-proxy prefixes exposed via
    ``X-Forwarded-Prefix`` / ``SCRIPT_NAME`` keep working (this is what FAB's
    stock Swagger view does), and fall back to a normalized ``APPLICATION_ROOT``
    when no script root is present.
    """
    return request.script_root or normalize_app_root(
        current_app.config.get("APPLICATION_ROOT")
    )


def resolver(schema: Any) -> str:
    schema_cls = resolve_schema_cls(schema)
    name = schema_cls.__name__
    if name == "MetaSchema" and hasattr(schema_cls, "Meta"):
        return f"{schema_cls.Meta.parent_schema_name}.{schema_cls.Meta.model.__name__}"
    if name.endswith("Schema"):
        return name[:-6] or name
    return name


class SupersetOpenApi(BaseApi):
    route_base = "/api"
    allow_browser_login = True

    @expose("/<version>/_openapi")
    @protect()
    @safe
    def get(self, version: str) -> FlaskResponse:
        """Render the OpenAPI spec for every view that belongs to a version.
        ---
        get:
          description: >-
            Get the OpenAPI spec for a specific API version
          parameters:
          - in: path
            schema:
              type: string
            name: version
          responses:
            200:
              description: The OpenAPI spec
              content:
                application/json:
                  schema:
                    type: object
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        version_found = False
        api_spec = self._create_api_spec(version)
        for base_api in current_app.appbuilder.baseviews:
            if isinstance(base_api, BaseApi) and base_api.version == version:
                base_api.add_api_spec(api_spec)
                version_found = True
        if version_found:
            return self.response(200, **api_spec.to_dict())
        return self.response_404()

    @staticmethod
    def _create_api_spec(version: str) -> APISpec:
        prefix = resolve_url_prefix()
        default_server = {"url": request.host_url.rstrip("/") + (prefix or "/")}
        servers = current_app.config.get("FAB_OPENAPI_SERVERS", [default_server])
        return APISpec(
            title=current_app.appbuilder.app_name,
            version=version,
            openapi_version="3.0.2",
            info={"description": current_app.appbuilder.app_name},
            plugins=[MarshmallowPlugin(schema_name_resolver=resolver)],
            servers=servers,
        )


class SupersetSwaggerView(BaseView):
    route_base = "/swagger"
    default_view = "show"
    openapi_uri = "/api/{}/_openapi"

    @expose("/<version>")
    @has_access
    def show(self, version: str) -> FlaskResponse:
        openapi_uri = (resolve_url_prefix() + self.openapi_uri).format(version)
        return self.render_template(
            current_app.config.get(
                "FAB_API_SWAGGER_TEMPLATE", "appbuilder/swagger/swagger.html"
            ),
            openapi_uri=openapi_uri,
        )
