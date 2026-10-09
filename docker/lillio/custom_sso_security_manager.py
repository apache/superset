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
"""Okta OIDC user-info mapping for Superset."""

import logging
from typing import Any

from flask import request
from flask_appbuilder import expose
from flask_appbuilder.security.views import AuthOAuthView, WerkzeugResponse
from superset.security import SupersetSecurityManager

logger = logging.getLogger(__name__)


class LillioAuthOAuthView(AuthOAuthView):
    """Keep the IdP issuer out of Flask-AppBuilder's internal state JWT."""

    @expose("/login/")
    @expose("/login/<provider>")
    def login(self, provider: str | None = None) -> WerkzeugResponse:
        # Okta-initiated login appends ``iss`` to this request. FAB serializes
        # query parameters with ``flat=False``, which turns it into a list in
        # the internal state JWT. PyJWT rejects that because ``iss`` is a
        # registered claim whose value must be a string. The IdP issuer is
        # already defined by server_metadata_url and is not state we need to
        # preserve across the OAuth redirect.
        if "iss" not in request.args:
            return super().login(provider)

        original_args = request.args
        sanitized_args = original_args.copy()
        sanitized_args.pop("iss", None)
        request.args = sanitized_args
        try:
            return super().login(provider)
        finally:
            request.args = original_args


class CustomSsoSecurityManager(SupersetSecurityManager):
    authoauthview = LillioAuthOAuthView

    def oauth_user_info(self, provider: str, response: Any = None) -> dict[str, Any]:
        if provider != "okta":
            return {}

        remote = self.appbuilder.sm.oauth_remotes[provider]

        info: dict[str, Any] = {}
        try:
            info = remote.userinfo() or {}
        except Exception as exc:  # noqa: BLE001
            logger.warning("okta userinfo() failed: %r", exc)

        groups = info.get("groups")
        if groups is None and response:
            try:
                groups = (remote.parse_id_token(response) or {}).get("groups")
            except Exception as exc:  # noqa: BLE001
                logger.warning("okta parse_id_token failed: %r", exc)

        email = info.get("email")
        logger.debug("Okta OIDC user %s groups=%s", email, groups)
        return {
            "username": email,
            "email": email,
            "first_name": info.get("given_name", ""),
            "last_name": info.get("family_name", ""),
            "role_keys": groups or [],
        }
