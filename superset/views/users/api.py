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
from __future__ import annotations

import functools
import logging
from datetime import datetime
from typing import Any, Callable, Dict

from flask import current_app as app, g, redirect, request, Response, session
from flask_appbuilder.api import expose, permission_name, safe
from flask_appbuilder.const import AUTH_DB
from flask_appbuilder.security.decorators import protect
from flask_appbuilder.security.sqla.models import User
from flask_login import login_user
from marshmallow import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.exc import NoResultFound

from superset import is_feature_enabled
from superset.daos.user import UserDAO
from superset.extensions import db, event_logger, security_manager
from superset.utils.auth_db_password import (
    get_auth_db_login_rate_limit_string,
    get_public_auth_db_password_policy,
    validate_auth_db_password,
)
from superset.utils.auth_db_password_hash import (
    hash_auth_db_password,
    verify_auth_db_password,
)
from superset.utils.auth_session_stamp import (
    bump_user_session_auth_stamp,
    clear_flask_login_remember_cookie,
)
from superset.utils.decorators import transaction
from superset.utils.slack import get_user_avatar, SlackClientError
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics
from superset.views.users.schemas import (
    CurrentUserPasswordPutSchema,
    CurrentUserPutSchema,
    UserResponseSchema,
)
from superset.views.utils import bootstrap_user_data

logger = logging.getLogger(__name__)

user_response_schema = UserResponseSchema()


def _get_client_ip() -> str | None:
    """Return best-effort client IP from request context."""
    if request.access_route:
        return request.access_route[0]
    return request.remote_addr


def _me_password_rate_limit_key() -> str:
    """Return the rate-limit key for password changes.

    Uses a per-user key (``me_password_uid:<id>``) when a user is in context,
    otherwise falls back to the client IP (or ``"unknown"`` when unavailable).
    """
    uid = getattr(getattr(g, "user", None), "id", None)
    if uid is not None:
        return f"me_password_uid:{uid}"
    return _get_client_ip() or "unknown"


def _rate_limit_me_password_change(
    f: Callable[..., Response],
) -> Callable[..., Response]:
    """Apply AUTH_DB ``login_rate_limit`` when Flask-Limiter is enabled."""

    @functools.wraps(f)
    def wrapped(self: CurrentUserRestApi, *args: Any, **kwargs: Any) -> Response:
        """Invoke ``f`` directly or through Flask-Limiter when rate limiting is on."""
        if not app.config.get("RATELIMIT_ENABLED", False):
            return f(self, *args, **kwargs)
        limiter = getattr(security_manager, "limiter", None)
        if limiter is None:
            return f(self, *args, **kwargs)
        limited_view = limiter.limit(
            get_auth_db_login_rate_limit_string(),
            key_func=_me_password_rate_limit_key,
            methods=["PUT"],
        )(f)
        return limited_view(self, *args, **kwargs)

    return wrapped


class PasswordChangeConflictError(Exception):
    """Raised when an optimistic password update loses a concurrent write race."""


def _load_password_change_body(
    schema: CurrentUserPasswordPutSchema,
    payload: object,
) -> dict[str, str]:
    """Parse and policy-validate a password-change request payload."""
    body = schema.load(payload or {})
    validate_auth_db_password(body["new_password"])
    return body


@transaction()
def _commit_user_password_change(
    api: CurrentUserRestApi,
    user_id: int,
    old_hash: str,
    new_hash: str,
) -> User:
    """Persist a password change and rotate the user's session auth stamp.

    The whole flow runs in a single transaction that commits once on success,
    so any failure path (including a missing user) rolls back the password
    write rather than reporting an error after it was already committed.
    """
    api.pre_update(g.user, {})
    rows_updated = (
        db.session.query(User)
        .filter(User.id == user_id, User.password == old_hash)
        .update(
            {
                User.password: new_hash,
                User.changed_on: g.user.changed_on,
                User.changed_by_fk: g.user.changed_by_fk,
            },
            synchronize_session=False,
        )
    )
    if rows_updated != 1:
        raise PasswordChangeConflictError

    bump_user_session_auth_stamp(user_id)
    user_after = db.session.get(User, user_id)
    if user_after is None:
        logger.error("User missing after password update for id=%s", user_id)
        raise SQLAlchemyError("user missing after password update")
    return user_after


def _reestablish_login_session(user: User) -> None:
    """Clear the cookie session and log the user back in after a password change."""
    for key in list(session.keys()):
        session.pop(key)
    login_user(user)
    clear_flask_login_remember_cookie()


class CurrentUserRestApi(BaseSupersetApi):
    """An API to get information about the current user"""

    resource_name = "me"
    openapi_spec_tag = "Current User"
    allow_browser_login = True
    openapi_spec_component_schemas = (
        UserResponseSchema,
        CurrentUserPutSchema,
        CurrentUserPasswordPutSchema,
    )

    current_user_put_schema = CurrentUserPutSchema()
    current_user_password_put_schema = CurrentUserPasswordPutSchema()

    def pre_update(self, item: User, data: Dict[str, Any]) -> None:
        item.changed_on = datetime.now()
        item.changed_by_fk = g.user.id

    @expose("/", methods=("GET",))
    @protect()
    @permission_name("read")
    @safe
    def get_me(self) -> Response:
        """Get the user object corresponding to the agent making the request.
        ---
        get:
          summary: Get the user object
          description: >-
            Gets the user object corresponding to the agent making the request,
            or returns a 401 error if the user is unauthenticated.
          responses:
            200:
              description: The current user
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/UserResponseSchema'
            401:
              $ref: '#/components/responses/401'
        """
        return self.response(200, result=user_response_schema.dump(g.user))

    @expose("/roles/", methods=("GET",))
    @protect()
    @permission_name("read")
    @safe
    def get_my_roles(self) -> Response:
        """Get the user roles corresponding to the agent making the request.
        ---
        get:
          summary: Get the user roles
          description: >-
            Gets the user roles corresponding to the agent making the request,
            or returns a 401 error if the user is unauthenticated.
          responses:
            200:
              description: The current user
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/UserResponseSchema'
            401:
              $ref: '#/components/responses/401'
        """
        user = bootstrap_user_data(g.user, include_perms=True)
        return self.response(200, result=user)

    @expose("/", methods=["PUT"])
    @protect()
    @permission_name("write")
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def update_me(self) -> Response:
        """Update current user information
        ---
        put:
          summary: Update the current user
          description: >-
            Updates the current user's first name or last name. When ``AUTH_TYPE`` is
            ``AUTH_DB``, password changes must use ``PUT /api/v1/me/password``.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/CurrentUserPutSchema'
          responses:
            200:
              description: User updated successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/UserResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
        """
        try:
            if (
                app.config.get("AUTH_TYPE") == AUTH_DB
                and request.json
                and "password" in request.json
            ):
                return self.response_400(
                    message=(
                        "Setting password via PUT /api/v1/me/ is not allowed when "
                        "AUTH_TYPE is AUTH_DB. Use PUT /api/v1/me/password instead."
                    ),
                )

            item = self.current_user_put_schema.load(request.json)
            if not item:
                return self.response_400(message="At least one field must be provided.")

            for key, value in item.items():
                setattr(g.user, key, value)

            self.pre_update(g.user, item)
            db.session.commit()  # pylint: disable=consider-using-transaction
            return self.response(200, result=user_response_schema.dump(g.user))
        except ValidationError as error:
            return self.response_400(message=error.messages)

    @expose("/password", methods=["PUT"])
    @protect()
    @permission_name("write")
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put_password",
        log_to_statsd=False,
    )
    @requires_json
    @_rate_limit_me_password_change
    def update_my_password(self) -> Response:
        """Update the current user's password (AUTH_DB only)
        ---
        put:
          summary: Update the current user's password
          description: >-
            Changes the authenticated user's password when ``AUTH_TYPE`` is ``AUTH_DB``.
            Requires the current password and a new password that satisfies
            ``AUTH_DB_CONFIG`` policy.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/CurrentUserPasswordPutSchema'
          responses:
            200:
              description: Password updated successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/UserResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        if app.config.get("AUTH_TYPE") != AUTH_DB:
            return self.response_400(
                message=(
                    "Password change is only available when AUTH_TYPE is AUTH_DB."
                ),
            )

        try:
            body = _load_password_change_body(
                self.current_user_password_put_schema,
                request.json,
            )
            user_db = db.session.get(User, g.user.id)
            if user_db is None:
                return self.response_404()

            old_hash = user_db.password
            if not verify_auth_db_password(old_hash, body["current_password"]):
                return self.response_400(message="Incorrect current password.")

            new_hash = hash_auth_db_password(body["new_password"])
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            user_after = _commit_user_password_change(
                self,
                g.user.id,
                old_hash,
                new_hash,
            )
        except PasswordChangeConflictError:
            return self.response_400(
                message=(
                    "Unable to update password. Your password may have been "
                    "changed elsewhere; please try again."
                ),
            )
        except SQLAlchemyError:
            db.session.rollback()  # pylint: disable=consider-using-transaction
            logger.exception("Failed to commit password change")
            return self.response_500(
                message="Unable to update password. Please try again.",
            )

        _reestablish_login_session(user_after)
        return self.response(200, result=user_response_schema.dump(user_after))

    @expose("/password/policy", methods=["GET"])
    @protect()
    @permission_name("read")
    @safe
    def get_my_password_policy(self) -> Response:
        """Get non-secret password policy options for AUTH_DB.
        ---
        get:
          summary: Get current user's password policy
          description: >-
            Returns non-secret ``AUTH_DB_CONFIG`` password policy options used for
            real-time password-strength and validation UI.
          responses:
            200:
              description: Password policy options
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
        """
        if app.config.get("AUTH_TYPE") != AUTH_DB:
            return self.response_400(
                message=(
                    "Password policy is only available when AUTH_TYPE is AUTH_DB."
                ),
            )
        return self.response(200, result=get_public_auth_db_password_policy())


class UserRestApi(BaseSupersetApi):
    """An API to get information about users"""

    resource_name = "user"
    openapi_spec_tag = "User"
    # Enable browser login for all user endpoints to support avatar access and other
    # user-related functionality that may be called from browser contexts
    allow_browser_login = True
    openapi_spec_component_schemas = (UserResponseSchema,)

    @expose("/<int:user_id>/avatar.png", methods=("GET",))
    @protect()
    @safe
    def avatar(self, user_id: int) -> Response:
        """Get a redirect to the avatar's URL for the user with the given ID.
        ---
        get:
          summary: Get the user avatar
          description: >-
            Gets the avatar URL for the user with the given ID, or returns a 401 error
            if the user is unauthenticated.
          parameters:
            - in: path
              name: user_id
              required: true
              description: The ID of the user
              schema:
                type: string
          responses:
            301:
              description: A redirect to the user's avatar URL
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        avatar_url = None
        try:
            user = UserDAO.get_by_id(user_id)
        except NoResultFound:
            return self.response_404()

        if not user:
            return self.response_404()

        # fetch from the one-to-one relationship
        if len(user.extra_attributes) > 0:
            avatar_url = user.extra_attributes[0].avatar_url

        slack_token = app.config.get("SLACK_API_TOKEN")
        if (
            not avatar_url
            and slack_token
            and is_feature_enabled("SLACK_ENABLE_AVATARS")
        ):
            try:
                # Fetching the avatar url from slack
                avatar_url = get_user_avatar(user.email)
            except SlackClientError:
                return self.response_404()

            UserDAO.set_avatar_url(user, avatar_url)

        # Return a permanent redirect to the avatar URL
        if avatar_url:
            return redirect(avatar_url, code=301)

        # No avatar found, return a "no-content" response
        return Response(status=204)
