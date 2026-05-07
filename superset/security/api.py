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
from typing import Any

from flask import current_app, g, request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import rison as parse_rison, safe, SQLAInterface
from flask_appbuilder.api.schemas import get_list_schema
from flask_appbuilder.const import AUTH_OAUTH, AUTH_SAML
from flask_appbuilder.security.decorators import permission_name, protect
from flask_appbuilder.security.sqla.models import RegisterUser, Role
from flask_wtf.csrf import generate_csrf
from marshmallow import EXCLUDE, fields, post_load, Schema, ValidationError
from sqlalchemy import asc, desc
from sqlalchemy.orm import selectinload

from superset.commands.dashboard.embedded.exceptions import (
    EmbeddedDashboardNotFoundError,
)
from superset.commands.exceptions import ForbiddenError
from superset.exceptions import SupersetGenericErrorException
from superset.extensions import db, event_logger
from superset.security.guest_token import GuestTokenResourceType
from superset.views.base_api import (
    BaseSupersetApi,
    BaseSupersetModelRestApi,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


class PermissiveSchema(Schema):
    """
    A marshmallow schema that ignores unexpected fields, instead of throwing an error.
    """

    class Meta:  # pylint: disable=too-few-public-methods
        unknown = EXCLUDE


class UserSchema(PermissiveSchema):
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()


class ResourceSchema(PermissiveSchema):
    type = fields.Enum(GuestTokenResourceType, by_value=True, required=True)
    id = fields.String(required=True)

    @post_load
    def convert_enum_to_value(  # pylint: disable=unused-argument
        self,
        data: dict[str, Any],
        **kwargs: Any,
    ) -> dict[str, Any]:
        # we don't care about the enum, we want the value inside
        data["type"] = data["type"].value
        return data


class RlsRuleSchema(PermissiveSchema):
    dataset = fields.Integer()
    clause = fields.String(required=True)  # todo other options?


class GuestTokenCreateSchema(PermissiveSchema):
    user = fields.Nested(UserSchema)
    resources = fields.List(fields.Nested(ResourceSchema), required=True)
    rls = fields.List(fields.Nested(RlsRuleSchema), required=True)
    datasets = fields.List(
        fields.Integer(),
        load_default=None,
        allow_none=True,
        metadata={
            "description": (
                "Optional allowlist of dataset IDs the guest may access. "
                "When omitted all datasets linked to the embedded dashboard "
                "are accessible, preserving the default behaviour."
            )
        },
    )


class RoleResponseSchema(PermissiveSchema):
    id = fields.Integer()
    name = fields.String()
    user_ids = fields.List(fields.Integer())
    permission_ids = fields.List(fields.Integer())


class RolesResponseSchema(PermissiveSchema):
    count = fields.Integer()
    ids = fields.List(fields.Integer())
    result = fields.List(fields.Nested(RoleResponseSchema))


guest_token_create_schema = GuestTokenCreateSchema()


class SecurityRestApi(BaseSupersetApi):
    resource_name = "security"
    allow_browser_login = True
    openapi_spec_tag = "Security"

    @expose("/csrf_token/", methods=("GET",))
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("read")
    def csrf_token(self) -> Response:
        """Get the CSRF token.
        ---
        get:
          summary: Get the CSRF token
          responses:
            200:
              description: Result contains the CSRF token
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                        result:
                          type: string
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        return self.response(200, result=generate_csrf())

    @expose("/auth_providers/", methods=("GET",))
    @event_logger.log_this
    @safe
    @statsd_metrics
    def auth_providers(self) -> Response:
        """Get the available SSO auth providers.
        ---
        get:
          summary: Get the SSO auth providers
          description: >-
            Returns a list of configured SSO auth providers (OAuth or SAML)
            with their names, icons, and login URLs. This endpoint does not
            require authentication and is intended for client applications
            that need to discover login options before authenticating.
          responses:
            200:
              description: Result contains the configured auth providers
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                        auth_type:
                          type: integer
                          description: >-
                            The FAB auth type constant (1=DB, 2=LDAP,
                            3=OAUTH, etc.)
                        login_page:
                          type: string
                          description: >-
                            URL of the login page. For SSO flows, open this
                            URL in a browser or web view.
                        browser_login:
                          type: boolean
                          description: >-
                            Whether authentication requires a browser flow
                            (OAuth/SAML). If false, use the
                            /api/v1/security/login endpoint with
                            username/password instead.
                        providers:
                          type: array
                          items:
                            type: object
                            properties:
                              name:
                                type: string
                              icon:
                                type: string
                              login_url:
                                type: string
                                description: >-
                                  Direct login URL for this provider.
                                  Open in a browser or web view to start
                                  the SSO flow.
            500:
              $ref: '#/components/responses/500'
        """
        auth_type = current_app.config.get("AUTH_TYPE")
        providers: list[dict[str, str]] = []

        # The login page URL is the SPA entry point that handles all auth flows.
        # For OAuth/SAML, the React frontend handles the redirect to the IdP.
        login_page = self.appbuilder.get_url_for_login

        login_base = login_page.rstrip("/")

        if auth_type == AUTH_OAUTH:
            for provider in self.appbuilder.sm.oauth_providers:
                name = provider["name"]
                providers.append(
                    {
                        "name": name,
                        "icon": provider.get("icon", "fa-sign-in"),
                        "login_url": f"{login_base}/{name}",
                    }
                )
        elif auth_type == AUTH_SAML:
            for provider in self.appbuilder.sm.saml_providers:
                name = provider["name"]
                providers.append(
                    {
                        "name": name,
                        "icon": provider.get("icon", "fa-sign-in"),
                        "login_url": f"{login_base}/{name}",
                    }
                )

        # browser_login indicates whether authentication requires a browser
        # flow (OAuth/SAML SSO) or can be done via the /api/v1/security/login
        # endpoint with username/password (DB/LDAP).
        browser_login = auth_type in (AUTH_OAUTH, AUTH_SAML)

        return self.response(
            200,
            auth_type=auth_type,
            login_page=login_page,
            browser_login=browser_login,
            providers=providers,
        )

    @expose("/session_token/", methods=("GET",))
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("read")
    def session_token(self) -> Response:
        """Get a JWT access token from the active web session.
        ---
        get:
          summary: Get a JWT session token
          description: >-
            Converts an active browser session (cookie-based) into a JWT
            access token. Intended for mobile or external applications that
            complete SSO login via a web view and need a bearer token for
            subsequent API calls.
          responses:
            200:
              description: Result contains the JWT access token
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                        access_token:
                          type: string
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        from flask_jwt_extended import create_access_token

        user = g.user
        if not user or user.is_anonymous:
            return self.response_401()

        token = create_access_token(identity=str(user.id), fresh=True)
        return self.response(200, access_token=token)

    @expose("/guest_token/", methods=("POST",))
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("grant_guest_token")
    def guest_token(self) -> Response:
        """Get a guest token that can be used for auth in embedded Superset.
        ---
        post:
          summary: Get a guest token
          requestBody:
            description: Parameters for the guest token
            required: true
            content:
              application/json:
                schema: GuestTokenCreateSchema
          responses:
            200:
              description: Result contains the guest token
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                        token:
                          type: string
            401:
              $ref: '#/components/responses/401'
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            body = guest_token_create_schema.load(request.json)
            self.appbuilder.sm.validate_guest_token_resources(body["resources"])
            guest_token_validator_hook = current_app.config.get(
                "GUEST_TOKEN_VALIDATOR_HOOK"
            )
            # Run validator to ensure the token parameters are OK.
            if guest_token_validator_hook is not None:
                if callable(guest_token_validator_hook):
                    if not guest_token_validator_hook(body):
                        raise ValidationError(message="Guest token validation failed")
                else:
                    raise SupersetGenericErrorException(
                        message="Guest token validator hook not callable"
                    )
            # TODO: Add generic validation:
            # make sure username doesn't reference an existing user
            # check rls rules for validity?
            token = self.appbuilder.sm.create_guest_access_token(
                body.get("user", {}),
                body["resources"],
                body["rls"],
                **({"datasets": body["datasets"]} if "datasets" in body else {}),
            )
            return self.response(200, token=token)
        except EmbeddedDashboardNotFoundError as error:
            return self.response_400(message=error.message)
        except ValidationError as error:
            return self.response_400(message=error.messages)


class RoleRestAPI(BaseSupersetApi):
    """
    APIs for listing roles with usersIds and permissionsIds and possibility to update
    users of roles
    """

    resource_name = "security/roles"
    allow_browser_login = True
    openapi_spec_tag = "Security Roles"
    openapi_spec_component_schemas = (
        RoleResponseSchema,
        RolesResponseSchema,
    )

    @expose("/search/", methods=["GET"])
    @event_logger.log_this
    @protect()
    @safe
    @parse_rison(get_list_schema)
    @statsd_metrics
    @permission_name("list_roles")
    def get_list(self, **kwargs: Any) -> Response:
        """
        List roles, including associated user IDs and permission IDs.

        ---
        get:
          summary: List roles
          description: Fetch a paginated list of roles with user and permission IDs.
          parameters:
            - in: query
              name: q
              schema:
                type: object
                properties:
                  order_column:
                    type: string
                    enum: ["id", "name"]
                    default: "id"
                  order_direction:
                    type: string
                    enum: ["asc", "desc"]
                    default: "asc"
                  page:
                    type: integer
                    default: 0
                  page_size:
                    type: integer
                    default: 10
                  filters:
                    type: array
                    items:
                      type: object
                      properties:
                        col:
                          type: string
                          enum: ["user_ids", "permission_ids", "name"]
                        value:
                          type: string
          responses:
            200:
              description: Successfully retrieved roles
              content:
                application/json:
                  schema: RolesResponseSchema
            400:
              description: Bad request (invalid input)
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      error:
                        type: string
            403:
              description: Forbidden
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      error:
                        type: string
        """
        try:
            args = kwargs.get("rison", {})
            order_column = args.get("order_column", "id")
            order_direction = args.get("order_direction", "asc")

            valid_columns = ["id", "name"]
            if order_column not in valid_columns:
                return self.response_400(
                    message=f"Invalid order column: {order_column}"
                )

            order_by = getattr(Role, order_column)
            order_by = asc(order_by) if order_direction == "asc" else desc(order_by)

            page = args.get("page", 0)
            page_size = args.get("page_size", 10)

            query = db.session.query(Role).options(
                selectinload(Role.permissions),
                selectinload(Role.user),
                selectinload(Role.groups),
            )

            filters = args.get("filters", [])
            filter_dict = {f["col"]: f["value"] for f in filters if "col" in f}

            if "user_ids" in filter_dict:
                query = query.filter(Role.user.any(id=filter_dict["user_ids"]))

            if "permission_ids" in filter_dict:
                query = query.filter(
                    Role.permissions.any(id=filter_dict["permission_ids"])
                )

            if "group_ids" in filter_dict:
                query = query.filter(Role.groups.any(id=filter_dict["group_ids"]))

            if "name" in filter_dict:
                query = query.filter(Role.name.ilike(f"%{filter_dict['name']}%"))

            total_count = query.count()

            roles = (
                query.order_by(order_by).offset(page * page_size).limit(page_size).all()
            )

            return self.response(
                200,
                result=[
                    {
                        "id": role.id,
                        "name": role.name,
                        "user_ids": [user.id for user in role.user],
                        "permission_ids": [perm.id for perm in role.permissions],
                        "group_ids": [group.id for group in role.groups],
                    }
                    for role in roles
                ],
                count=total_count,
                ids=[role.id for role in roles],
            )
        except ForbiddenError as e:
            return self.response_403(message=str(e))
        except Exception as e:
            return self.response_500(message=str(e))


class UserRegistrationsRestAPI(BaseSupersetModelRestApi):
    """
    APIs for listing user registrations (Admin only)
    """

    resource_name = "security/user_registrations"
    datamodel = SQLAInterface(RegisterUser)
    allow_browser_login = True
    # NOTE: registration_hash is intentionally excluded from both list_columns
    # and search_columns. It is a bearer token for the
    # /register/activation/<hash> flow; exposing it in API responses (and thus
    # logs/caches) or allowing it to be filtered on would let a holder activate
    # the pending account.
    list_columns = [
        "id",
        "username",
        "email",
        "first_name",
        "last_name",
        "registration_date",
    ]
    search_columns = [
        "username",
        "email",
        "first_name",
        "last_name",
        "registration_date",
    ]
