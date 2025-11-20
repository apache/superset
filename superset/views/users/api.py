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

from flask import current_app as app, g, redirect, request, Response
from flask_appbuilder.api import expose, safe
from flask_appbuilder.security.sqla.models import User
from flask_jwt_extended.exceptions import NoAuthorizationError
from marshmallow import ValidationError
from sqlalchemy.orm.exc import NoResultFound
from werkzeug.security import generate_password_hash

from superset import is_feature_enabled
from superset.commands.api_key.create import CreateApiKeyCommand
from superset.commands.api_key.exceptions import (
    ApiKeyCreateFailedError,
    ApiKeyForbiddenError,
    ApiKeyNotFoundError,
    ApiKeyRequiredFieldValidationError,
    ApiKeyRevokeFailedError,
)
from superset.commands.api_key.revoke import RevokeApiKeyCommand
from superset.daos.api_key import ApiKeyDAO
from superset.daos.user import UserDAO
from superset.extensions import db, event_logger
from superset.utils.slack import get_user_avatar, SlackClientError
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics
from superset.views.users.schemas import (
    ApiKeyCreateResponseSchema,
    ApiKeyPostSchema,
    ApiKeyResponseSchema,
    CurrentUserPutSchema,
    UserResponseSchema,
)
from superset.views.utils import bootstrap_user_data

user_response_schema = UserResponseSchema()
api_key_response_schema = ApiKeyResponseSchema()
api_key_create_response_schema = ApiKeyCreateResponseSchema()
api_key_post_schema = ApiKeyPostSchema()


class CurrentUserRestApi(BaseSupersetApi):
    """An API to get information about the current user"""

    resource_name = "me"
    openapi_spec_tag = "Current User"
    openapi_spec_component_schemas = (
        UserResponseSchema,
        CurrentUserPutSchema,
        ApiKeyPostSchema,
        ApiKeyResponseSchema,
        ApiKeyCreateResponseSchema,
    )

    current_user_put_schema = CurrentUserPutSchema()

    def pre_update(self, item: User, data: Dict[str, Any]) -> None:
        item.changed_on = datetime.now()
        item.changed_by_fk = g.user.id
        if "password" in data and data["password"]:
            item.password = generate_password_hash(
                password=data["password"],
                method=app.config.get("FAB_PASSWORD_HASH_METHOD", "scrypt"),
                salt_length=app.config.get("FAB_PASSWORD_HASH_SALT_LENGTH", 16),
            )

    @expose("/", methods=("GET",))
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
        try:
            if g.user is None or g.user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()

        return self.response(200, result=user_response_schema.dump(g.user))

    @expose("/roles/", methods=("GET",))
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
        try:
            if g.user is None or g.user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()
        user = bootstrap_user_data(g.user, include_perms=True)
        return self.response(200, result=user)

    @expose("/", methods=["PUT"])
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
            Updates the current user's first name, last name, or password.
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
            if g.user is None or g.user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()
        try:
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

    @expose("/api_keys/", methods=("GET",))
    @safe
    def get_api_keys(self) -> Response:
        """Get all API keys for the current user
        ---
        get:
          summary: List API keys
          description: >-
            Gets all API keys owned by the current user.
          responses:
            200:
              description: List of API keys
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/ApiKeyResponseSchema'
            401:
              $ref: '#/components/responses/401'
        """
        try:
            if g.user is None or g.user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()

        api_keys = ApiKeyDAO.find_by_user(g.user.id)
        return self.response(
            200, result=api_key_response_schema.dump(api_keys, many=True)
        )

    @expose("/api_keys/", methods=("POST",))
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post_api_key",
        log_to_statsd=False,
    )
    @requires_json
    def create_api_key(self) -> Response:
        """Create a new API key
        ---
        post:
          summary: Create API key
          description: >-
            Creates a new API key for the current user. The full API key is returned
            only once in the response and cannot be retrieved later.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ApiKeyPostSchema'
          responses:
            200:
              description: API key created successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/ApiKeyCreateResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
        """
        try:
            if g.user is None or g.user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()

        try:
            data = api_key_post_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            api_key, plaintext_key = CreateApiKeyCommand(data).run()
            return self.response(
                200,
                result={
                    "id": api_key.id,
                    "name": api_key.name,
                    "api_key": plaintext_key,
                    "key_prefix": api_key.key_prefix,
                    "workspace_name": api_key.workspace_name,
                    "created_on": api_key.created_on.isoformat(),
                },
            )
        except ApiKeyRequiredFieldValidationError as ex:
            return self.response_400(message=str(ex))
        except ApiKeyCreateFailedError as ex:
            return self.response_500(message=str(ex))

    @expose("/api_keys/<int:api_key_id>", methods=("DELETE",))
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self,
        *args,
        **kwargs: f"{self.__class__.__name__}.delete_api_key",
        log_to_statsd=False,
    )
    def revoke_api_key(self, api_key_id: int) -> Response:
        """Revoke an API key
        ---
        delete:
          summary: Revoke API key
          description: >-
            Revokes an API key owned by the current user. Revoked keys cannot be used
            for authentication.
          parameters:
            - in: path
              name: api_key_id
              required: true
              description: The ID of the API key to revoke
              schema:
                type: integer
          responses:
            200:
              description: API key revoked successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            if g.user is None or g.user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()

        try:
            RevokeApiKeyCommand(api_key_id).run()
            return self.response(200, message="API key revoked successfully")
        except ApiKeyNotFoundError:
            return self.response_404()
        except ApiKeyForbiddenError:
            return self.response_403()
        except ApiKeyRevokeFailedError as ex:
            return self.response_500(message=str(ex))


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
