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

from flask import current_app, redirect, request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import rison as parse_rison, safe, SQLAInterface
from flask_appbuilder.api.schemas import get_list_schema
from flask_appbuilder.security.decorators import permission_name, protect
from flask_appbuilder.security.sqla.models import RegisterUser, Role
from flask_login import login_user
from flask_wtf.csrf import generate_csrf
from marshmallow import (
    EXCLUDE,
    fields,
    post_load,
    RAISE,
    Schema,
    validate,
    ValidationError,
)
from sqlalchemy import asc, desc
from sqlalchemy.orm import selectinload

from superset.commands.dashboard.embedded.exceptions import (
    EmbeddedDashboardAccessDeniedError,
    EmbeddedDashboardNotFoundError,
)
from superset.commands.exceptions import ForbiddenError
from superset.constants import RouteMethod
from superset.exceptions import SupersetGenericErrorException
from superset.extensions import db, event_logger
from superset.security import login_token as login_token_utils
from superset.security.guest_token import (
    build_guest_token_audit_payload,
    GuestTokenResourceType,
)
from superset.utils.core import get_user_id
from superset.utils.decorators import transaction
from superset.utils.link_redirect import is_safe_redirect_url
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
    attributes = fields.Dict(
        keys=fields.String(), values=fields.Raw(allow_none=True), allow_none=True
    )


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


class RlsRuleSchema(Schema):
    """
    Schema for a single row-level security rule attached to a guest token.

    Unlike the other guest-token schemas, this one rejects unknown fields
    instead of silently dropping them. A rule is scoped to a dataset only when
    it carries a valid positive integer ``dataset`` key; a rule with no
    ``dataset`` is treated as global and its ``clause`` is applied to every
    dataset the embedded resource can reach (see ``get_guest_rls_filters``).
    Silently excluding an unexpected field -- most commonly a mistyped or
    legacy scope key such as ``datasource`` -- would therefore turn an intended
    dataset-scoped rule into a global one without any feedback to the caller.
    Raising on unknown fields surfaces the mistake as an HTTP 400 before a
    token is ever issued and keeps the accepted payload aligned with the
    documented ``RlsRule`` contract (``dataset`` and ``clause``).

    For the same reason ``dataset`` is constrained to strict, positive
    integers: a falsy value such as ``0`` (or ``false``, which marshmallow
    coerces to ``0``) would pass a bare ``Integer`` field but then read as
    falsy in ``get_guest_rls_filters``, silently widening a scoped rule to
    every dataset.
    """

    class Meta:  # pylint: disable=too-few-public-methods
        unknown = RAISE

    dataset = fields.Integer(strict=True, validate=validate.Range(min=1))
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


class LoginTokenResponseSchema(Schema):
    access_token = fields.String(
        metadata={
            "description": "Opaque single-use token. Carries no identity data; it "
            "is only a handle to a short-lived server-side record."
        }
    )
    expires_at = fields.Integer(
        metadata={"description": "Unix timestamp after which the token is rejected."}
    )


guest_token_create_schema = GuestTokenCreateSchema()


class SecurityRestApi(BaseSupersetApi):
    resource_name = "security"
    allow_browser_login = True
    openapi_spec_tag = "Security"
    openapi_spec_component_schemas = (LoginTokenResponseSchema,)

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
            self.appbuilder.sm.validate_guest_token_resources(
                body["resources"], datasets=body.get("datasets")
            )
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
            audit_payload = build_guest_token_audit_payload(
                issuer_user_id=get_user_id(),
                source_ip=request.remote_addr,
                body=body,
                token=token,
                header_name=current_app.config["GUEST_TOKEN_HEADER_NAME"],
                header_budget_bytes=current_app.config["GUEST_TOKEN_HEADER_MAX_BYTES"],
            )
            logger.info("Guest token issued: %s", audit_payload)
            if audit_payload["header_budget_exceeded"]:
                logger.warning(
                    "Guest token exceeds configured request-header budget: "
                    "token_bytes=%s header_bytes=%s header_budget_bytes=%s",
                    audit_payload["token_bytes"],
                    audit_payload["header_bytes"],
                    audit_payload["header_budget_bytes"],
                )
            return self.response(200, token=token)
        except EmbeddedDashboardNotFoundError as error:
            return self.response_400(message=error.message)
        except EmbeddedDashboardAccessDeniedError as error:
            # The minting principal is not entitled to the dashboard being
            # scoped (see validate_guest_token_resources): an authorization
            # denial, not a server fault, so answer 403 rather than letting
            # @safe turn it into a logged 500.
            # FAB 5.x: response_403() takes no message argument (unlike
            # response_400), so build the 403 explicitly.
            return self.response(403, message=error.message)
        except ValidationError as error:
            return self.response_400(message=error.messages)

    @expose("/login-token/", methods=("POST",))
    @event_logger.log_this
    @safe
    @statsd_metrics
    @transaction()
    def login_token(self) -> Response:
        """Mint a one-time login token for iframe embedding.
        ---
        post:
          summary: Mint a one-time login token
          description: >-
            Exchanges a caller-supplied proof of identity for an opaque, single-use
            token that GET on this same path trades for a session cookie. Intended
            to be called server-to-server by a trusted parent application so the
            underlying credential never reaches the browser. The
            LOGIN_TOKEN_IDENTITY_RESOLVER hook decides what counts as proof.
          responses:
            200:
              description: The minted token and its expiry
              content:
                application/json:
                  schema: LoginTokenResponseSchema
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        if not login_token_utils.is_enabled():
            # 404 rather than 403: with the feature off there is nothing here to
            # be forbidden from, and this keeps the surface closed by default.
            return self.response_404()

        if (userinfo := login_token_utils.resolve_identity(request)) is None:
            return self.response_401()

        token, expires_on = login_token_utils.mint(userinfo)
        logger.info(
            "One-time login token minted for '%s' from %s",
            userinfo.get("username") or userinfo.get("email"),
            request.remote_addr,
        )
        return self.response(
            200,
            access_token=token,
            expires_at=int(expires_on.timestamp()),
        )

    @expose("/login-token/", methods=("GET",))
    @event_logger.log_this
    @statsd_metrics
    @safe
    @transaction()
    def login_with_token(self) -> Response:
        """Consume a one-time login token and establish a session.
        ---
        get:
          summary: Consume a one-time login token
          description: >-
            Reached by navigating an iframe to this URL. Exchanges the token for a
            standard session cookie and redirects to `next`, so the frame holds an
            ordinary Superset session with the user's own roles and row-level
            security. The token is deleted on use.
          parameters:
          - in: query
            name: token
            required: true
            schema:
              type: string
            description: The opaque token returned by POST on this path
          - in: query
            name: next
            required: false
            schema:
              type: string
            description: Internal URL to redirect to; rejected if not internal
          responses:
            302:
              description: Session established; redirect to `next`
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        if not login_token_utils.is_enabled():
            return self.response_404()

        token = request.args.get("token", "")
        # A single failure mode for unknown, malformed, expired and already-spent
        # tokens, so the response cannot be used to probe which one it was.
        if not token or (userinfo := login_token_utils.consume(token)) is None:
            return self.response_401()

        # ``consume`` has deleted the entry, but ``@transaction()`` does not nest
        # and only commits when this handler returns normally. An exception
        # escaping from here would roll the deletion back and resurrect a token
        # that has already been handed out, so provisioning failures are caught
        # and reported as a denial: the burn stays durable and a spent token is
        # never redeemable a second time.
        try:
            user = self.appbuilder.sm.auth_user_oauth(userinfo)
        except Exception:  # pylint: disable=broad-except
            logger.exception("Provisioning failed for a one-time login token")
            user = None

        if user is None:
            # Provisioning declined the identity: the user is deactivated, or
            # AUTH_USER_REGISTRATION is off and they have no account yet.
            logger.warning(
                "One-time login token resolved an identity that could not be "
                "provisioned: '%s'",
                userinfo.get("username") or userinfo.get("email"),
            )
            return self.response_401()

        login_user(user)
        logger.info("Session established from a one-time login token for '%s'", user)

        # Only ever redirect to a value that has passed the internal-URL check.
        # Assigning into a separate variable inside the guarded branch — rather
        # than reassigning the request-derived one — keeps the sanitizer on the
        # path to the redirect, which taint analysis can follow.
        requested_next = request.args.get("next") or "/"
        safe_next_url = "/"
        if is_safe_redirect_url(requested_next):
            safe_next_url = requested_next
        else:
            logger.warning("Rejected unsafe `next` on login-token consume")

        return redirect(safe_next_url)


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
        except Exception:
            # Log the full error server-side for operator visibility, but return
            # a generic message so internal details (ORM/driver error text, SQL
            # fragments, schema names) are not echoed back to the caller.
            logger.exception("Unexpected error in RoleRestAPI.get_list")
            return self.response_500(message="An unexpected error occurred")


class UserRegistrationsRestAPI(BaseSupersetModelRestApi):
    """
    APIs for listing user registrations (Admin only)
    """

    resource_name = "security/user_registrations"
    datamodel = SQLAInterface(RegisterUser)
    allow_browser_login = True
    # POST/PUT are intentionally excluded: restricting the exposed routes
    # keeps the FAB default create/update handlers from ever being
    # registered, so a mis-granted role cannot silently alter a pending
    # registration. DELETE is kept: the User Registrations admin page
    # deletes pending registrations through this route, and the class is
    # gated Admin-only via ADMIN_ONLY_VIEW_MENUS (keyed on the view-menu
    # name, i.e. every permission on this class, not just specific ones),
    # so exposing it does not grant non-Admin roles anything.
    include_route_methods = {
        RouteMethod.GET,
        RouteMethod.GET_LIST,
        RouteMethod.INFO,
        RouteMethod.DELETE,
    }
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
