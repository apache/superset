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
import logging

from flask import g, redirect, request, Response
from flask_appbuilder.api import expose, safe
from flask_jwt_extended.exceptions import NoAuthorizationError
from marshmallow import ValidationError
from sqlalchemy.orm.exc import NoResultFound

from superset import app, is_feature_enabled
from superset.daos.statement import StatementDAO
from superset.daos.team import TeamDAO
from superset.daos.user import UserDAO
from superset.daos.user_info import UserInfoDAO
from superset.utils.slack import get_user_avatar, SlackClientError
from superset.views.base_api import BaseSupersetApi
from superset.views.users.schemas import UserResponseSchema, ValidateOnboardingPutSchema
from superset.views.utils import (
    bootstrap_user_data,
)

logger = logging.getLogger(__name__)
user_response_schema = UserResponseSchema()


def validate_language(lang: str) -> bool:  # DODO changed #33835937
    languages = app.config["LANGUAGES"]
    keys_of_languages = languages.keys()
    return lang in keys_of_languages


class CurrentUserRestApi(BaseSupersetApi):
    """An API to get information about the current user"""

    resource_name = "me"
    openapi_spec_tag = "Current User"
    openapi_spec_component_schemas = (UserResponseSchema,)

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

    # DODO changed #33835937
    @expose("change/lang/<lang>", ("GET",))
    def change_lang(self, lang: str) -> Response:
        try:
            if g.user is None or g.user.is_anonymous:
                return self.response_401()
            if not validate_language(lang):
                self.response_400("Incorrect language")
        except NoAuthorizationError:
            return self.response_401()
        UserInfoDAO.update_language(lang)
        return redirect("/superset/welcome/")

    @expose("/onboarding", ("GET",))
    def get_onboarding(self) -> Response:
        try:
            user = g.user
            if user is None or user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()
        user_onboarding = UserInfoDAO.get_onboarding()
        result = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_onboarding_finished": user_onboarding.get("is_onboarding_finished"),
            "onboarding_started_time": user_onboarding.get("onboarding_started_time"),
        }
        return self.response(200, result=user_response_schema.dump(result))

    @expose("/onboarding", ("PUT",))
    def put_onboarding(self) -> Response:
        try:
            user = g.user
            item = ValidateOnboardingPutSchema().load(request.json)
            if user is None or user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()
        except ValidationError as error:
            logger.warning("validate data failed to add new dashboard")
            return self.response_400(message=error.messages)

        dodo_role = item.get("dodo_role")
        onboarding_started_time = item.get("onboarding_started_time")
        update_user_onboarding = UserInfoDAO.update_onboarding(
            dodo_role, onboarding_started_time
        )
        result = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "dodo_role": update_user_onboarding.get("dodo_role"),
            "onboarding_started_time": update_user_onboarding.get(
                "onboarding_started_time"
            ),
        }
        return self.response(200, result=user_response_schema.dump(result))

    @expose("/team", ("GET",))  # текущая команда пользователя
    def my_team(self) -> Response:
        try:
            user = g.user
            if user is None or user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()
        except ValidationError as error:
            logger.warning("validate data failed to add new dashboard")
            return self.response_400(message=error.messages)
        result = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
        if team := TeamDAO.get_team_by_user_id():
            result["team"] = team.name
        else:
            result["team"] = None
        return self.response(200, result=user_response_schema.dump(result))

    @expose("/statements", ("GET",))  # все заявки пользователя
    def my_statements(self) -> Response:
        try:
            user = g.user
            if user is None or user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()
        except ValidationError as error:
            logger.warning("validate data failed to add new dashboard")
            return self.response_400(message=error.messages)
        result = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
        if statements := StatementDAO.get_statements_by_user_id():
            result["statements"] = statements
        else:
            result["statements"] = None
        return self.response(200, result=user_response_schema.dump(result))

    @expose("/country", ("GET",))  # страна пользователя, получаем в профиле
    def my_country(self) -> Response:
        try:
            user = g.user
            if user is None or user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()
        except ValidationError as error:
            logger.warning("validate data failed to add new dashboard")
            return self.response_400(message=error.messages)
        result = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
        if country := UserInfoDAO.get_country_by_user_id():
            result["country_name"] = country[0].country_name
        else:
            result["country_name"] = None
        return self.response(200, result=user_response_schema.dump(result))


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
