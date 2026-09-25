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
"""HTTP endpoints of the MCP OAuth authorization server."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlsplit

from flask import abort, current_app, redirect, render_template_string, request
from flask_appbuilder import BaseView, expose
from flask_login import current_user
from flask_wtf.csrf import generate_csrf
from werkzeug.exceptions import NotFound

from superset import appbuilder, security_manager
from superset.mcp_oauth import service
from superset.mcp_oauth.keys import OAuthKeyConfigError
from superset.superset_typing import FlaskResponse
from superset.utils import json

logger = logging.getLogger(__name__)

_NO_STORE = {"Cache-Control": "no-store", "Pragma": "no-cache"}
# Registration, token and metadata endpoints carry no cookies, so any origin
# may call them; browser-based MCP clients need this for PKCE flows.
_PUBLIC_CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
}

_CONSENT_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize {{ client_name }}</title>
</head>
<body>
  <main>
    <h1>Allow {{ client_name }} to access {{ app_name }}?</h1>
    <p>Signed in as <strong>{{ username }}</strong>.</p>
    <p>{{ client_name }} will be able to call {{ app_name }}'s MCP tools as you,
      with your permissions, until you revoke access or the grant expires.</p>
    <p>You will be returned to <code>{{ redirect_host }}</code>.</p>
    <p>Scope: <code>{{ scope }}</code></p>
    <form method="post" action="{{ action }}">
      <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
      {% for name, value in fields.items() %}
      <input type="hidden" name="{{ name }}" value="{{ value }}">
      {% endfor %}
      <button type="submit" name="decision" value="approve">Allow</button>
      <button type="submit" name="decision" value="deny">Deny</button>
    </form>
  </main>
</body>
</html>
"""

_ERROR_TEMPLATE = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Authorization error</title></head>
<body><main><h1>Authorization error</h1><p>{{ message }}</p></main></body>
</html>
"""


def _require_enabled() -> None:
    if not service.is_enabled():
        abort(404)


def _current_user() -> Any | None:
    """The signed-in Superset user, excluding anonymous and embedded guest users."""
    user = current_user._get_current_object()  # pylint: disable=protected-access
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    if getattr(user, "is_anonymous", False) or security_manager.is_guest_user(user):
        return None
    return user


def _json(
    payload: Any, status: int = 200, headers: dict[str, str] | None = None
) -> FlaskResponse:
    response = current_app.response_class(
        json.dumps(payload), status=status, mimetype="application/json"
    )
    response.headers.update({**_PUBLIC_CORS, **(headers or {})})
    return response


def _html(body: str, status: int = 200) -> FlaskResponse:
    response = current_app.response_class(body, status=status, mimetype="text/html")
    response.headers.update(
        {
            **_NO_STORE,
            "X-Frame-Options": "DENY",
            "Content-Security-Policy": "frame-ancestors 'none'",
        }
    )
    return response


def _preflight() -> FlaskResponse:
    return _json({}, status=204)


class MCPOAuthWellKnownView(BaseView):
    """RFC 8414 / RFC 9728 discovery documents."""

    route_base = "/.well-known"

    @expose("/oauth-authorization-server", methods=("GET",))
    @expose("/oauth-authorization-server/<path:suffix>", methods=("GET",))
    def authorization_server_metadata(self, suffix: str | None = None) -> FlaskResponse:
        _require_enabled()
        # RFC 8414 section 3.1: for an issuer with a path, the path follows
        # the well-known prefix.
        issuer_path = urlsplit(service.issuer()).path.strip("/")
        if (suffix or "").strip("/") != issuer_path:
            abort(404)
        return _json(service.authorization_server_metadata())

    @expose("/oauth-protected-resource", methods=("GET",))
    @expose("/oauth-protected-resource/<path:suffix>", methods=("GET",))
    def protected_resource_metadata(self, suffix: str | None = None) -> FlaskResponse:
        _require_enabled()
        wanted = (suffix or "").strip("/")
        for resource in service.resources():
            if urlsplit(resource).path.strip("/") == wanted:
                return _json(service.protected_resource_metadata(resource))
        raise NotFound()


class MCPOAuthView(BaseView):
    """Registration, authorization, token and JWKS endpoints."""

    route_base = "/oauth/mcp"

    @expose("/register", methods=("POST", "OPTIONS"))
    def register(self) -> FlaskResponse:
        _require_enabled()
        if request.method == "OPTIONS":
            return _preflight()
        try:
            body = service.register_client(request.get_json(silent=True))
        except service.OAuthError as ex:
            return _json(ex.to_dict(), status=ex.status, headers=_NO_STORE)
        return _json(body, status=201, headers=_NO_STORE)

    @expose("/authorize", methods=("GET", "POST"))
    def authorize(self) -> FlaskResponse:
        _require_enabled()
        params = request.args if request.method == "GET" else request.form
        try:
            auth_request = service.parse_authorization_request(params)
        except service.AuthorizeFatalError as ex:
            return _html(render_template_string(_ERROR_TEMPLATE, message=str(ex)), 400)
        except service.AuthorizeRedirectError as ex:
            return redirect(ex.location())

        user = _current_user()
        if request.method == "GET":
            if user is None:
                return redirect(appbuilder.get_url_for_login_with(request.full_path))
            return self._consent(auth_request, user)

        if user is None:
            return _html(
                render_template_string(
                    _ERROR_TEMPLATE, message="Sign in to approve this request."
                ),
                401,
            )
        if request.form.get("decision") != "approve":
            return redirect(
                service.build_redirect(
                    auth_request.redirect_uri,
                    {
                        "error": "access_denied",
                        "error_description": "The user denied the request",
                    },
                    auth_request.state,
                )
            )
        code = service.create_authorization_code(auth_request, user)
        return redirect(
            service.build_redirect(
                auth_request.redirect_uri, {"code": code}, auth_request.state
            )
        )

    @staticmethod
    def _consent(
        auth_request: service.AuthorizationRequest, user: Any
    ) -> FlaskResponse:
        client = auth_request.client
        body = render_template_string(
            _CONSENT_TEMPLATE,
            client_name=client.client_name or "An MCP client",
            app_name=current_app.config.get("APP_NAME", "Superset"),
            username=user.username,
            redirect_host=urlsplit(auth_request.redirect_uri).netloc,
            scope=auth_request.scope,
            action=request.path,
            csrf_token=generate_csrf(),
            fields=auth_request.as_form_fields(),
        )
        return _html(body)

    @expose("/token", methods=("POST", "OPTIONS"))
    def token(self) -> FlaskResponse:
        _require_enabled()
        if request.method == "OPTIONS":
            return _preflight()
        authorization = request.headers.get("Authorization")
        try:
            body = service.handle_token_request(request.form, authorization)
        except service.OAuthError as ex:
            headers = dict(_NO_STORE)
            if ex.status == 401 and authorization:
                headers["WWW-Authenticate"] = 'Basic realm="mcp-oauth"'
            return _json(ex.to_dict(), status=ex.status, headers=headers)
        except OAuthKeyConfigError:
            logger.error("MCP OAuth signing key is misconfigured")
            return _json(
                {"error": "server_error", "error_description": "Server error"},
                status=500,
                headers=_NO_STORE,
            )
        return _json(body, headers=_NO_STORE)

    @expose("/jwks.json", methods=("GET",))
    def jwks(self) -> FlaskResponse:
        _require_enabled()
        try:
            keys = service.jwks()
        except OAuthKeyConfigError:
            logger.error("MCP OAuth signing key is misconfigured")
            abort(500)
        return _json(keys, headers={"Cache-Control": "public, max-age=300"})
