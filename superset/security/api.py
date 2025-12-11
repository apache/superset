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
import logging
from typing import Any

from flask import current_app, request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import rison, safe, SQLAInterface
from flask_appbuilder.api.schemas import get_list_schema
from flask_appbuilder.security.decorators import permission_name, protect
from flask_appbuilder.security.sqla.models import RegisterUser, Role, User
from flask_wtf.csrf import generate_csrf
from marshmallow import EXCLUDE, fields, post_load, Schema, ValidationError
from sqlalchemy import asc, desc
from sqlalchemy.orm import joinedload

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
from superset.models.sql_lab import SavedQuery
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice

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

ASSETS = {
    'dashboards': {
        'model': Dashboard,
        'is_single_owner': False,
        'name_field': 'dashboard_title',
        'list': [],
    },
    'charts': {
        'model': Slice,
        'is_single_owner': False,
        'name_field': 'slice_name',
        'list': [],
    },
    'saved_queries': {
        'model': SavedQuery,
        'is_single_owner': True,
        'name_field': 'label',
        'list': [],
    },
}

class ReassignmentRestAPI(BaseSupersetApi):
    """
    APIs for reassigning user-owned objects to another user
    """

    resource_name = "security/reassignment"
    allow_browser_login = True

    @expose("/users/<int:user_id>/assets/summary", methods=["GET"])
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("get")
    def asset_summary(self, user_id: int) -> Response:
        """
        Returns a summary of the assets (dashboards, charts, saved queries) owned by 
        the user with ID user_id that must be reassigned before user deletion.

        ---
        get:
          summary: Get a summary of the user's reassignable assets
          parameters:
            - in: path
              name: user_id
              schema:
                type: integer
              required: true
              description: ID of the user who may own reassignable assets
          responses:
            200:
              description: Names of user's assets
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      count:
                        description: The number of assets
                        type: integer
                      dashboards:
                        description: >-
                          A list of names of dashboards owned by the user
                        type: array
                        items:
                          type: string
                      charts:
                        description: >-
                          A list of names of charts owned by the user
                        type: array
                        items:
                          type: string
                      saved_queries:
                        description: >-
                          A list of names of saved queries owned by the user
                        type: array
                        items:
                          type: string
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            count = 0
            for a in ASSETS.values():
                a['list'] = []
                assets = None
                if a['is_single_owner']:
                    assets = db.session.query(a['model']).filter(a['model'].user_id == user_id).all()
                else:
                    assets = db.session.query(a['model']).filter(a['model'].owners.any(User.id == user_id)).all()
                for asset in assets:
                    count += 1
                    a['list'].append(getattr(asset, a['name_field']))

            return self.response(
                200,
                count=count,
                dashboards=ASSETS['dashboards']['list'],
                charts=ASSETS['charts']['list'],
                saved_queries=ASSETS['saved_queries']['list'],
            )
        except ForbiddenError as e:
            return self.response_403(message=str(e))
        except Exception as e:
            return self.response_500(message=str(e))

    @expose("/users/<int:user_id>/reassign/", methods=["POST", "GET"])
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("post")
    def reassign_owned_objects(self, user_id: int) -> Response:
        """
        Reassign all objects (dashboards, charts, saved queries) owned by the
        user with ID user_id to the user specified by the request payload.

        ---
        post:
          summary: Reassign user-owned objects
          parameters:
            - in: path
              name: user_id
              schema:
                type: integer
              required: true
              description: ID of the user whose objects are to be reassigned
          requestBody:
            description: Target user ID for reassignment
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    target_user_id:
                      type: integer
          responses:
            200:
              description: Successfully reassigned user-owned objects
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            target_user_id = request.json["target_user_id"]  # outside a method
            if not target_user_id:
                return self.response_400(message="Missing target_user_id")
            
            new_owner = db.session.query(User).get(target_user_id)

            for a in ASSETS.values():
                if a['is_single_owner']:
                    assets = db.session.query(a['model']).filter(a['model'].user_id == user_id).all()
                    for asset in assets:
                        asset.user = new_owner
                        asset.created_by = new_owner
                else:
                    assets = db.session.query(a['model']).filter(a['model'].owners.any(User.id == user_id)).all()
                    for asset in assets:
                        asset.owners = [o for o in asset.owners if o.id != user_id]
                        if new_owner.id not in {o.id for o in asset.owners}:
                            asset.owners.append(new_owner)
            db.session.commit()

            return self.response(
                200,
                message=f"User-owned objects successfully reassigned from {user_id} to {target_user_id}"
            )
        except ForbiddenError as e:
            return self.response_403(message=str(e))
        except Exception as e:
            return self.response_500(message=str(e))


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
                body["user"], body["resources"], body["rls"]
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
    @rison(get_list_schema)
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
                joinedload(Role.permissions), joinedload(Role.user)
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
                count=query.count(),
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
    list_columns = [
        "id",
        "username",
        "email",
        "first_name",
        "last_name",
        "registration_date",
        "registration_hash",
    ]

class UserSoftDeletionAPI(BaseSupersetApi):
    resource_name = "users"
    @expose("/soft_delete/<pk>", methods=["POST"])
    @safe
    def soft_delete(self, pk):
        from superset.models.user import SupersetUser  # local import to avoid circular dependency
        from superset import db

        user = db.session.get(SupersetUser, pk)
        if not user:
            return self.response_404()
        if user.is_deleted:
            return self.response(204)

        user.is_deleted = True
        user.active = False
        user.deleted_on = datetime.utcnow()
        db.session.commit()

        return self.response(200)
