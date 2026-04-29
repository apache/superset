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
from datetime import datetime
from typing import Any, Dict

from flask import current_app as app, g, redirect, request, Response, session
from flask_appbuilder.api import expose, permission_name, safe
from flask_appbuilder.const import AUTH_DB
from flask_appbuilder.security.decorators import protect
from flask_appbuilder.security.sqla.models import User
from flask_login import login_user
from marshmallow import ValidationError
from sqlalchemy.orm.exc import NoResultFound
from werkzeug.security import check_password_hash, generate_password_hash

from superset import is_feature_enabled
from superset.daos.auth_audit_log import AuthAuditLogDAO
from superset.daos.user import UserDAO
from superset.extensions import db, event_logger
from superset.utils.auth_db_password import validate_auth_db_password
from superset.utils.slack import get_user_avatar, SlackClientError
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics
from superset.views.users.schemas import (
    CurrentUserPasswordPutSchema,
    CurrentUserPutSchema,
    UserResponseSchema,
)
from superset.views.utils import bootstrap_user_data

user_response_schema = UserResponseSchema()


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
    def update_my_password(self) -> Response:
        """Update the current user's password (AUTH_DB only)
        ---
        put:
          summary: Update the current user's password
          description: >-
            Changes the authenticated user's password when ``AUTH_TYPE`` is ``AUTH_DB``.
            Requires the current password and a new password that satisfies ``AUTH_DB_CONFIG``
            policy.
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
        """
        if app.config.get("AUTH_TYPE") != AUTH_DB:
            return self.response_400(
                message=(
                    "Password change is only available when AUTH_TYPE is AUTH_DB."
                ),
            )
        try:
            body = self.current_user_password_put_schema.load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            validate_auth_db_password(body["new_password"])
        except ValidationError as error:
            return self.response_400(message=error.messages)

        if not check_password_hash(g.user.password, body["current_password"]):
            return self.response_400(message="Incorrect current password.")

        g.user.password = generate_password_hash(
            password=body["new_password"],
            method=app.config.get("FAB_PASSWORD_HASH_METHOD", "scrypt"),
            salt_length=app.config.get("FAB_PASSWORD_HASH_SALT_LENGTH", 16),
        )
        self.pre_update(g.user, {})
        AuthAuditLogDAO.create(
            event_type="password_change",
            user_id=g.user.id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
            metadata={"initiated_by": "self"},
        )
        # Mitigate session fixation: clear the cookie session and re-establish login.
        for key in list(session.keys()):
            session.pop(key)
        login_user(g.user)
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, result=user_response_schema.dump(g.user))


class UserRestApi(BaseSupersetApi):
    """An API to get information about users"""

    resource_name = "user"
    openapi_spec_tag = "User"
    openapi_spec_component_schemas = (UserResponseSchema,)

    @expose("/<int:user_id>/avatar.png", methods=("GET",))
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
