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
import json
from typing import Any

from flask import g, redirect, request, Response
from flask_appbuilder import ModelRestApi
from flask_appbuilder.api import expose, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

# NGLS CHANGE - START #
from flask_appbuilder.security.sqla.models import (
    Permission,
    PermissionView,
    Role,
    User,
    ViewMenu,
)
from flask_jwt_extended.exceptions import NoAuthorizationError
from sqlalchemy import asc, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.exc import NoResultFound

# NGLS CHANGE - END #
from superset import app, is_feature_enabled
from superset.daos.user import UserDAO
from superset.utils.slack import get_user_avatar, SlackClientError
from superset.views.base_api import BaseSupersetApi
from superset.views.users.schemas import UserResponseSchema
from superset.views.utils import bootstrap_user_data

user_response_schema = UserResponseSchema()


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


# NGLS CHANGE - START #
def parse_legacy_q() -> dict[str, Any]:
    q = request.args.get("q")
    if not q:
        return {}

    try:
        return json.loads(q)
    except Exception:
        return {}


class LegacyBaseApi(ModelRestApi):
    page_size = 25
    max_page_size = 1000

    def _get_args(self) -> dict[str, Any]:
        return parse_legacy_q()

    def _pagination(self) -> tuple[int, int]:
        args = self._get_args()
        page = args.get("page", 0)
        page_size = min(args.get("page_size", self.page_size), self.max_page_size)
        return page, page_size

    # ================= FILTERS =================
    def _apply_filters(self, query: Any) -> Any:
        args = self._get_args()
        filters = args.get("filters", [])

        for f in filters:
            col = f.get("col")
            opr = f.get("opr")
            value = f.get("value")

            column = getattr(self.datamodel.obj, col, None)
            if not column:
                continue

            if opr == "eq":
                query = query.filter(column == value)
            elif opr == "ne":
                query = query.filter(column != value)
            elif opr == "like":
                query = query.filter(column.ilike(f"%{value}%"))
            elif opr == "in":
                query = query.filter(column.in_(value))
            elif opr == "gt":
                query = query.filter(column > value)
            elif opr == "lt":
                query = query.filter(column < value)

        return query

    # ================= ORDER =================
    def _apply_ordering(self, query: Any) -> Any:
        args = self._get_args()
        order_col = args.get("order_column")
        order_dir = args.get("order_direction", "asc")

        if not order_col:
            return query

        column = getattr(self.datamodel.obj, order_col, None)
        if not column:
            return query

        if order_dir == "desc":
            return query.order_by(desc(column))
        return query.order_by(asc(column))

    # ================= OPTIMIZED COUNTING =================
    def _get_count(self, query: Any) -> int | None:
        args = self._get_args()

        if args.get("include_count") is False:
            return None

        if args.get("fast_count"):
            return query.limit(1000).count()

        return query.order_by(None).count()

    # ================= QUERY PIPELINE =================
    def _apply_all(self, query: Any) -> Any:
        query = self._apply_filters(query)
        query = self._apply_ordering(query)
        return query


# ================= USERS =================
class LegacyUsersApi(LegacyBaseApi):
    resource_name = "legacy/security/users"
    datamodel = SQLAInterface(User)

    @expose("/", methods=("GET",))
    @safe
    def get_list(self, **kwargs: Any) -> Response:
        """
        Legacy users API (Superset 2.x compatible)
        ---
        get:
          summary: Get users (legacy format)
          responses:
            200:
              description: List of users
        """
        page, page_size = self._pagination()

        query = self.datamodel.session.query(User)
        query = self._apply_all(query)
        # total = query.count()
        total = self._get_count(query)

        results = query.offset(page * page_size).limit(page_size).all()

        data = [
            {
                "id": u.id,
                "username": u.username,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                "active": u.active,
                "roles": [{"id": r.id, "name": r.name} for r in u.roles],
            }
            for u in results
        ]

        # return self.response(200, count=total, result=data)
        response: dict[str, Any] = {"result": data}

        if total is not None:
            response["count"] = total

        return self.response(200, **response)


# ================= ROLES =================
class LegacyRolesApi(LegacyBaseApi):
    resource_name = "legacy/security/roles"
    datamodel = SQLAInterface(Role)

    @expose("/", methods=("GET",))
    @safe
    def get_list(self, **kwargs: Any) -> Response:
        page, page_size = self._pagination()

        query = self.datamodel.session.query(Role)
        query = self._apply_all(query)
        # total = query.count()
        total = self._get_count(query)

        results = query.offset(page * page_size).limit(page_size).all()

        data = [{"id": r.id, "name": r.name} for r in results]

        # return self.response(200, count=total, result=data)
        response: dict[str, Any] = {"result": data}

        if total is not None:
            response["count"] = total

        return self.response(200, **response)


class LegacyPostRolePermissionsApi(ModelRestApi):
    resource_name = "legacy/security/roles"
    datamodel = SQLAInterface(Role)

    class_permission_name = "Role"

    @expose("/<int:pk>/permissions/", methods=("POST",))
    @safe
    def add_permissions(self, pk: int) -> Response:  # noqa: C901
        session = self.datamodel.session

        role = session.get(Role, pk)
        if not role:
            return self.response_404()

        data = request.json or {}

        added = []

        # 🔹 Case 1: ids
        if "permission_view_menu_ids" in data:
            pvs = (
                session.query(PermissionView)
                .filter(PermissionView.id.in_(data["permission_view_menu_ids"]))
                .all()
            )

            for pv in pvs:
                if pv not in role.permissions:
                    role.permissions.append(pv)
                    added.append(pv.id)

        # 🔹 Case 2: legacy (names)
        elif "permissions" in data:
            for item in data["permissions"]:
                permission = None
                view_menu = None

                if "permission_name" in item:
                    permission = (
                        session.query(Permission)
                        .filter_by(name=item["permission_name"])
                        .one_or_none()
                    )

                if "view_menu_name" in item:
                    view_menu = (
                        session.query(ViewMenu)
                        .filter_by(name=item["view_menu_name"])
                        .one_or_none()
                    )

                if not permission or not view_menu:
                    continue

                pv = (
                    session.query(PermissionView)
                    .filter_by(
                        permission_id=permission.id,
                        view_menu_id=view_menu.id,
                    )
                    .one_or_none()
                )

                if pv and pv not in role.permissions:
                    role.permissions.append(pv)
                    added.append(pv.id)

        session.commit()

        return self.response(
            200,
            role_id=role.id,
            added=added,
            total=len(role.permissions),
        )


class LegacyGetRolePermissionsApi(ModelRestApi):
    resource_name = "legacy/security/roles"
    datamodel = SQLAInterface(Role)

    class_permission_name = "Role"

    @expose("/<int:pk>/permissions/", methods=("GET",))
    @safe
    def get_permissions(self, pk: int) -> Response:
        """
        ---
        get:
          summary: Get permissions for a role
          parameters:
            - in: path
              name: pk
              required: true
              schema:
                type: integer
          responses:
            200:
              description: List of permissions for the role
        """

        try:
            role = (
                self.datamodel.session.query(Role)
                .options(
                    joinedload(Role.permissions).joinedload(PermissionView.permission),
                    joinedload(Role.permissions).joinedload(PermissionView.view_menu),
                )
                .filter(Role.id == pk)
                .one()
            )
        except NoResultFound:
            return self.response_404()

        result = [
            {
                "id": perm.id,
                "permission": perm.permission.name,
                "view_menu": perm.view_menu.name,
            }
            for perm in role.permissions
        ]

        return self.response(200, count=len(result), result=result)


# ================= PERMISSIONS =================
class LegacyPermissionsApi(LegacyBaseApi):
    resource_name = "legacy/security/permissions"
    datamodel = SQLAInterface(Permission)

    @expose("/", methods=("GET",))
    @safe
    def get_list(self, **kwargs: Any) -> Response:
        page, page_size = self._pagination()

        query = self.datamodel.session.query(Permission)
        query = self._apply_all(query)
        # total = query.count()
        total = self._get_count(query)

        results = query.offset(page * page_size).limit(page_size).all()

        data = [{"id": p.id, "name": p.name} for p in results]

        # return self.response(200, count=total, result=data)
        response: dict[str, Any] = {"result": data}

        if total is not None:
            response["count"] = total

        return self.response(200, **response)


# ================= RESOURCES =================
class LegacyResourcesApi(LegacyBaseApi):
    resource_name = "legacy/security/resources"
    datamodel = SQLAInterface(ViewMenu)

    @expose("/", methods=("GET",))
    @safe
    def get_list(self, **kwargs: Any) -> Response:
        page, page_size = self._pagination()

        query = self.datamodel.session.query(ViewMenu)
        query = self._apply_all(query)
        # total = query.count()
        total = self._get_count(query)

        results = query.offset(page * page_size).limit(page_size).all()

        data = [{"id": r.id, "name": r.name} for r in results]

        # return self.response(200, count=total, result=data)
        response: dict[str, Any] = {"result": data}

        if total is not None:
            response["count"] = total

        return self.response(200, **response)


# ================= PERMISSION-RESOURCE =================
class LegacyPermissionResourcesApi(LegacyBaseApi):
    resource_name = "legacy/security/permissions-resources"
    datamodel = SQLAInterface(PermissionView)

    @expose("/", methods=("GET",))
    @safe
    def get_list(self, **kwargs: Any) -> Response:
        page, page_size = self._pagination()

        query = self.datamodel.session.query(PermissionView)
        query = self._apply_all(query)
        # total = query.count()
        total = self._get_count(query)

        results = query.offset(page * page_size).limit(page_size).all()

        data = [
            {
                "id": p.id,
                "permission": p.permission.name,
                "view_menu": p.view_menu.name,
            }
            for p in results
        ]

        # return self.response(200, count=total, result=data)
        response: dict[str, Any] = {"result": data}

        if total is not None:
            response["count"] = total

        return self.response(200, **response)


# NGLS CHANGE - END #
