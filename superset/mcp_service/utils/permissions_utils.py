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

"""User helpers shared by MCP tools."""

from typing import Any, Optional

from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm.exc import DetachedInstanceError


def get_current_user() -> Optional[User]:
    """Get the current authenticated user."""
    try:
        from flask import g

        return getattr(g, "user", None)
    except Exception:
        return None


def get_user_role_names(user: Any) -> list[str]:
    """Return the names of every role a user holds, directly or through a group.

    Follows ``SecurityManager.get_user_roles``, which grants a user the roles of
    each of their groups on top of the ones assigned to them, so reading
    ``User.roles`` alone under-reports what the user can do. Each name is kept
    once, direct roles first.

    Roles that cannot be read (detached ORM instances, a non-string ``name``)
    are skipped. A ``groups`` relationship that cannot be read still leaves the
    direct roles in place.
    """
    names: list[str] = []

    def add(roles: Any) -> None:
        for role in roles or []:
            try:
                name = role.name
            except (AttributeError, DetachedInstanceError):
                continue
            if isinstance(name, str) and name not in names:
                names.append(name)

    try:
        add(getattr(user, "roles", None))
    except (TypeError, DetachedInstanceError):
        return []
    try:
        for group in getattr(user, "groups", None) or []:
            add(getattr(group, "roles", None))
    except (TypeError, DetachedInstanceError):
        pass
    return names
