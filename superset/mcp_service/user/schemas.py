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

"""Pydantic schemas for user-related MCP tool responses."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, List, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_serializer,
)
from sqlalchemy.orm.exc import DetachedInstanceError

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.common.pagination_schemas import (
    PaginatedListRequest,
    PaginatedResponse,
)
from superset.mcp_service.utils import (
    escape_llm_context_delimiters,
    sanitize_for_llm_context,
)

logger = __import__("logging").getLogger(__name__)

DEFAULT_USER_COLUMNS = ["id", "username", "first_name", "last_name", "active"]

USER_ALL_COLUMNS = [
    "id",
    "username",
    "first_name",
    "last_name",
    "active",
    "email",
    "changed_on",
]

USER_SORTABLE_COLUMNS = [
    "id",
    "username",
    "first_name",
    "last_name",
    "active",
    "changed_on",
]


class UserFilter(ColumnOperator):
    """Filter object for user listing.

    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal["username", "first_name", "last_name", "active"] = Field(
        ...,
        description="Column to filter on.",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use.",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class UserInfo(BaseModel):
    id: int | None = Field(None, description="User ID")
    username: str | None = Field(None, description="Username")
    first_name: str | None = Field(None, description="First name")
    last_name: str | None = Field(None, description="Last name")
    active: bool | None = Field(None, description="Whether the user account is active")
    email: str | None = Field(
        None,
        description="Email address (only returned with data model metadata access)",
    )
    roles: list[str] | None = Field(
        None,
        description="Assigned role names (only returned with data model metadata "
        "access via get_user_info; not available in list_users because roles "
        "is a relationship, not a selectable column)",
    )

    @field_validator("roles", mode="before")
    @classmethod
    def _extract_role_names(cls, v: Any) -> list[str] | None:
        """Coerce Role ORM objects to their .name strings."""
        if v is None:
            return None
        if isinstance(v, str):
            # Preserve Pydantic's default rejection of bare strings for list[str].
            raise ValueError("roles must be a list, not a string")
        result: list[str] = []
        for item in v:
            if isinstance(item, str):
                result.append(escape_llm_context_delimiters(item))
                continue
            try:
                name = item.name
                if isinstance(name, str):
                    result.append(escape_llm_context_delimiters(name))
            except (AttributeError, DetachedInstanceError):
                logger.debug(
                    "Skipping role with detached instance in UserInfo.roles coercion"
                )
        return result

    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
    model_config = ConfigDict(
        from_attributes=True,
        ser_json_timedelta="iso8601",
        populate_by_name=True,
    )

    @model_serializer(mode="wrap")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> dict[str, Any]:
        data = serializer(self)
        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                return {k: v for k, v in data.items() if k in select_columns}
        return data


class UserList(PaginatedResponse[UserFilter]):
    users: List[UserInfo]


class ListUsersRequest(PaginatedListRequest[UserFilter]):
    """Request schema for list_users."""

    order_direction: Annotated[
        Literal["asc", "desc"],
        Field(
            default="asc", description="Direction to order results ('asc' or 'desc')"
        ),
    ]


class UserError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @field_validator("error")
    @classmethod
    def sanitize_error_for_llm_context(cls, value: str) -> str:
        """Wrap error text before it is exposed to LLM context."""
        return sanitize_for_llm_context(value, field_path=("error",))

    @classmethod
    def create(cls, error: str, error_type: str) -> "UserError":
        """Create a standardized UserError with timestamp."""
        return cls(
            error=error, error_type=error_type, timestamp=datetime.now(timezone.utc)
        )


class GetUserInfoRequest(BaseModel):
    """Request schema for get_user_info."""

    identifier: Annotated[
        int,
        Field(description="User ID (integer)"),
    ]


def serialize_user_object(
    user: Any, include_sensitive: bool = False, include_roles: bool = True
) -> UserInfo | None:
    """Serialize a FAB User object into a UserInfo schema.

    Sensitive fields (email, roles) are only included when include_sensitive=True,
    which should reflect whether the caller has data model metadata access.
    Set include_roles=False to skip the roles relationship traversal (avoids N+1
    queries in list context where roles are never returned).
    """
    if not user:
        return None

    roles: list[str] | None = None
    if include_sensitive and include_roles:
        user_roles = getattr(user, "roles", None)
        if user_roles is not None:
            roles = []
            for r in user_roles:
                try:
                    if hasattr(r, "name") and isinstance(r.name, str):
                        roles.append(escape_llm_context_delimiters(r.name))
                except (AttributeError, DetachedInstanceError):
                    logger.debug(
                        "Skipping role that raised exception in serialize_user_object"
                    )
                    continue

    return UserInfo(
        id=getattr(user, "id", None),
        username=escape_llm_context_delimiters(getattr(user, "username", None)),
        first_name=sanitize_for_llm_context(
            getattr(user, "first_name", None), field_path=("first_name",)
        ),
        last_name=sanitize_for_llm_context(
            getattr(user, "last_name", None), field_path=("last_name",)
        ),
        active=getattr(user, "active", None),
        email=escape_llm_context_delimiters(getattr(user, "email", None))
        if include_sensitive
        else None,
        roles=roles,
        changed_on=getattr(user, "changed_on", None),
    )
