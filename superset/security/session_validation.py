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
"""Terminate the session of a user who has been deactivated mid-session.

Flask-Login only consults ``is_active`` when establishing a login; for an
already-authenticated user it does not re-check it on subsequent requests. So a
user disabled by an administrator keeps their session until it expires. This
hook re-checks ``is_active`` on each request and logs the user out as soon as
their account is deactivated. (Deleted users are already handled: the user
loader returns ``None`` and the request is anonymous.)
"""

from __future__ import annotations

import logging
from typing import Any

from flask import request
from flask_login import current_user, logout_user

logger = logging.getLogger(__name__)

# Endpoints that must stay reachable for an anonymous/logging-out user.
_EXEMPT_ENDPOINT_TOKENS = (
    "static",
    "appbuilder",
    "login",
    "logout",
    "auth",
    "health",
)


def _is_exempt_endpoint(endpoint: str | None) -> bool:
    if not endpoint:
        return True
    lowered = endpoint.lower()
    return any(token in lowered for token in _EXEMPT_ENDPOINT_TOKENS)


def register_inactive_user_logout(app: Any) -> None:
    """Register the before-request hook that logs out deactivated users."""

    @app.before_request
    def _logout_inactive_user() -> None:  # pylint: disable=unused-variable
        if _is_exempt_endpoint(request.endpoint):
            return

        if not getattr(current_user, "is_authenticated", False):
            return

        # ``is_active`` is False once an admin deactivates the account. End the
        # session now; the request then proceeds as anonymous and the normal
        # access controls deny protected views.
        if not current_user.is_active:
            logger.info(
                "Logging out deactivated user (id=%s)",
                getattr(current_user, "id", None),
            )
            logout_user()
