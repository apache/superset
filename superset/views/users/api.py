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
from flask import g, Response, redirect
from flask_appbuilder.api import expose, safe
from flask_jwt_extended.exceptions import NoAuthorizationError

from superset.views.base_api import BaseSupersetApi
from superset.views.users.schemas import UserResponseSchema
from superset.views.utils import bootstrap_user_data, update_language
from superset import app

user_response_schema = UserResponseSchema()


def validate_language(lang) -> bool:  # DODO changed #33835937
    languages = app.config["LANGUAGES"]
    keys_of_languages = languages.keys()
    return lang in keys_of_languages


class CurrentUserRestApi(BaseSupersetApi):
    """An api to get information about the current user"""

    resource_name = "me"
    openapi_spec_tag = "Current User"
    openapi_spec_component_schemas = (UserResponseSchema,)

    @expose("/", methods=("GET",))
    @safe
    def get_me(self) -> Response:
        """Get the user object corresponding to the agent making the request
        ---
        get:
          description: >-
            Returns the user object corresponding to the agent making the request,
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
        """Get the user roles corresponding to the agent making the request
        ---
        get:
          description: >-
            Returns the user roles corresponding to the agent making the request,
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
    def change_lang(self, lang: str):
        try:
            if g.user is None or g.user.is_anonymous:
                return self.response_401()
            if not validate_language(lang):
                self.response_400("Incorrect language")
        except NoAuthorizationError:
            return self.response_401()
        update_language(lang)
        return redirect("/superset/welcome/")

