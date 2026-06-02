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
"""Force-password-change-on-first-use enforcement.

A per-user ``password_must_change`` flag (on ``UserAttribute``) marks accounts —
typically created by an administrator — that must set a new password before
they can use the rest of the application. When ``ENABLE_FORCE_PASSWORD_CHANGE``
is enabled, a ``before_request`` hook redirects such users to the password-reset
page until they change it; the flag is cleared automatically on a successful
password reset (see ``SupersetSecurityManager.reset_password``).
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from flask import current_app, flash, g, redirect, request, url_for
from flask_babel import gettext as __

from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)

# Endpoint substrings that must remain reachable while a password change is
# pending, otherwise the redirect would loop (login/logout, the password-reset
# and user-info views, static assets, and the health check).
_EXEMPT_ENDPOINT_TOKENS = (
    "static",
    "appbuilder",
    "login",
    "logout",
    "resetmypassword",
    "resetpassword",
    "userinfoedit",
    "userinfo",
    "auth",
    "health",
)


def _get_user_attribute(user_id: int) -> Optional[Any]:
    # Imported lazily to avoid import cycles at app-init time.
    from superset.extensions import db
    from superset.models.user_attributes import UserAttribute

    return (
        db.session.query(UserAttribute)
        .filter(UserAttribute.user_id == user_id)
        .one_or_none()
    )


def password_change_required(user: Any) -> bool:
    """Return True if ``user`` has a pending forced password change."""
    user_id = getattr(user, "id", None)
    if not user_id:
        return False
    attr = _get_user_attribute(user_id)
    return bool(attr and attr.password_must_change)


@transaction()
def set_password_must_change(user_id: int, value: bool = True) -> None:
    """Set (or clear) the forced-password-change flag for a user.

    Intended to be called by administrative flows when provisioning an account
    that should require a password change on first use.
    """
    from superset.extensions import db
    from superset.models.user_attributes import UserAttribute

    attr = _get_user_attribute(user_id)
    if attr is None:
        attr = UserAttribute(user_id=user_id)
        db.session.add(attr)
    attr.password_must_change = value


@transaction()
def clear_password_must_change(user_id: int) -> None:
    """Clear the forced-password-change flag for a user, if set."""
    attr = _get_user_attribute(user_id)
    if attr and attr.password_must_change:
        attr.password_must_change = False


def _is_exempt_endpoint(endpoint: Optional[str]) -> bool:
    if not endpoint:
        return True
    lowered = endpoint.lower()
    return any(token in lowered for token in _EXEMPT_ENDPOINT_TOKENS)


def register_password_change_enforcement(app: Any) -> None:
    """Register the before-request hook that enforces pending password changes.

    No-op unless ``ENABLE_FORCE_PASSWORD_CHANGE`` is enabled, so there is zero
    per-request overhead in the default configuration.
    """

    @app.before_request
    def _enforce_password_change() -> Any:  # pylint: disable=unused-variable
        if not current_app.config.get("ENABLE_FORCE_PASSWORD_CHANGE"):
            return None

        user = getattr(g, "user", None)
        if not user or getattr(user, "is_anonymous", True):
            return None

        if _is_exempt_endpoint(request.endpoint):
            return None

        if not password_change_required(user):
            return None

        flash(__("You must change your password before continuing."), "warning")
        try:
            target = url_for("ResetMyPasswordView.this_form_get")
        except Exception:  # noqa: BLE001  # pylint: disable=broad-except
            target = "/"
        return redirect(target)
