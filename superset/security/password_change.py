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
*self-service* password reset (see ``SupersetSecurityManager.reset_password``).
An admin-initiated reset deliberately preserves the flag so the target user is
still forced to change the temporary password at next login.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from flask import current_app, flash, g, redirect, request, url_for
from flask_babel import gettext as __
from sqlalchemy.exc import IntegrityError

from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)

# Flask endpoints take the form ``<ViewClass>.<method>`` (or a bare name for
# function views). The following must remain reachable while a password change
# is pending, otherwise the redirect would loop: the auth views (login/logout
# for every auth backend), the password-reset and user-info-edit views, static
# assets, and the health check. We match the *view-class* component (the part
# before the dot) exactly against the allow-list below rather than doing a
# substring search, so unrelated endpoints that merely share a substring (e.g.
# an "Author"-named view, or any name containing "health"/"static") are not
# accidentally exempted from enforcement.
_EXEMPT_VIEW_CLASSES = frozenset(
    {
        "AuthDBView",
        "AuthLDAPView",
        "AuthOAuthView",
        "AuthOIDView",
        "AuthRemoteUserView",
        "ResetMyPasswordView",
        "ResetPasswordView",
        "UserInfoEditView",
    }
)

# Exact endpoint names (function views / Flask built-ins) that are always exempt.
_EXEMPT_ENDPOINTS = frozenset({"static", "appbuilder.static", "health", "healthcheck"})


def _get_user_attribute(user_id: int) -> Optional[Any]:
    # Imported lazily to avoid import cycles at app-init time.
    from superset.extensions import db
    from superset.models.user_attributes import UserAttribute

    # ``user_attribute.user_id`` carries a unique constraint, but databases
    # migrated from before the constraint existed could contain duplicate rows.
    # ``.one_or_none()`` would raise ``MultipleResultsFound`` (a 500) in that
    # case; fetch deterministically by ordering on the primary key and taking
    # the first row instead.
    return (
        db.session.query(UserAttribute)
        .filter(UserAttribute.user_id == user_id)
        .order_by(UserAttribute.id)
        .first()
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
        # ``user_attribute.user_id`` carries a unique constraint, so a
        # concurrent call for the same user can win the insert between our
        # read and flush. Insert in a nested transaction and, on conflict,
        # fall through to update the row the winner created (mirroring the
        # upsert in ``superset.security.session_invalidation``).
        try:
            with db.session.begin_nested():
                db.session.add(
                    UserAttribute(user_id=user_id, password_must_change=value)
                )
            return
        except IntegrityError:
            attr = _get_user_attribute(user_id)
            if attr is None:  # pragma: no cover - the conflicting row vanished
                raise
    attr.password_must_change = value


@transaction()
def clear_password_must_change(user_id: int) -> None:
    """Clear the forced-password-change flag for a user, if set."""
    attr = _get_user_attribute(user_id)
    if attr and attr.password_must_change:
        attr.password_must_change = False


def _is_exempt_endpoint(endpoint: Optional[str]) -> bool:
    # A missing endpoint (e.g. an unmatched URL) is left to normal 404 handling.
    if not endpoint:
        return True
    if endpoint in _EXEMPT_ENDPOINTS:
        return True
    # Any blueprint's static route, e.g. "<blueprint>.static".
    if endpoint.endswith(".static"):
        return True
    # Match the view-class component exactly, so e.g. "AuthDBView.login" is
    # exempt but an unrelated "AuthorView.list" is not.
    view_class = endpoint.split(".", 1)[0]
    return view_class in _EXEMPT_VIEW_CLASSES


def register_password_change_enforcement(app: Any) -> None:
    """Register the before-request hook that enforces pending password changes.

    No-op unless ``ENABLE_FORCE_PASSWORD_CHANGE`` is enabled, so there is zero
    per-request overhead in the default configuration.
    """

    @app.before_request
    def _enforce_password_change() -> Any:  # pylint: disable=unused-variable
        """Redirect flagged users to the password-reset page.

        Returns ``None`` (request proceeds) for anonymous users, exempt
        endpoints, and users without a pending change; otherwise returns a
        redirect to an exempt target (or an error response if none resolves).
        """
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
        # Resolve the password-reset page. If that endpoint can't be resolved
        # (e.g. a custom security manager without ``ResetMyPasswordView``), fall
        # back to logout, which is always exempt from this enforcement. The
        # logout endpoint is derived from the *registered* auth view so the
        # fallback works for non-DB auth backends (LDAP, OAuth, remote-user)
        # too, with ``AuthDBView.logout`` as a last resort. We must NOT fall
        # back to "/" or any other non-exempt route: the index re-runs this
        # same hook and would trap the user in an infinite 302 loop. If no
        # exempt target can be resolved at all, return an error response rather
        # than redirect, so a flagged user can never get stuck looping.
        candidates = ["ResetMyPasswordView.this_form_get"]
        auth_view = getattr(
            getattr(getattr(current_app, "appbuilder", None), "sm", None),
            "auth_view",
            None,
        )
        # Only redirect to the registered auth view's logout if that view is
        # itself exempt from this hook; otherwise the redirect would loop.
        if (
            auth_view is not None
            and getattr(auth_view, "endpoint", None) in _EXEMPT_VIEW_CLASSES
        ):
            candidates.append(f"{auth_view.endpoint}.logout")
        candidates.append("AuthDBView.logout")
        for endpoint in candidates:
            try:
                return redirect(url_for(endpoint))
            except Exception:  # noqa: BLE001, S112  # pylint: disable=broad-except
                # Try the next exempt fallback; a failed url_for resolution here
                # is expected/benign and not worth logging per attempt.
                continue
        return (
            __("You must change your password before continuing."),
            503,
        )
