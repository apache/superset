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

"""Pydantic schemas for role-related MCP tool responses."""

from __future__ import annotations

import logging
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
from superset.mcp_service.utils import sanitize_for_llm_context

DEFAULT_ROLE_COLUMNS = ["id", "name"]

ROLE_ALL_COLUMNS = ["id", "name"]

ROLE_SORTABLE_COLUMNS = ["id", "name"]

logger = logging.getLogger(__name__)


class RoleFilter(ColumnOperator):
    """Filter object for role listing.

    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal["name"] = Field(
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


class RoleInfo(BaseModel):
    id: int | None = Field(None, description="Role ID")
    name: str | None = Field(None, description="Role name")
    permissions: list[str] | None = Field(
        None,
        description=(
            "Permission names assigned to this role "
            "(only populated by get_role_info, not list_roles)"
        ),
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


class RoleList(PaginatedResponse[RoleFilter]):
    roles: List[RoleInfo]


class ListRolesRequest(PaginatedListRequest[RoleFilter]):
    """Request schema for list_roles."""

    order_direction: Annotated[
        Literal["asc", "desc"],
        Field(
            default="asc", description="Direction to order results ('asc' or 'desc')"
        ),
    ]


class RoleError(BaseModel):
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
    def create(cls, error: str, error_type: str) -> "RoleError":
        """Create a standardized RoleError with timestamp."""
        return cls(
            error=error, error_type=error_type, timestamp=datetime.now(timezone.utc)
        )


class GetRoleInfoRequest(BaseModel):
    """Request schema for get_role_info."""

    identifier: Annotated[
        int,
        Field(description="Role ID (integer)"),
    ]


def _serialize_permission_name(permission: Any) -> str | None:
    """Return direct permission names or FAB permission/view pairs."""
    if (name := getattr(permission, "name", None)) is not None:
        return str(name)

    permission_name = getattr(getattr(permission, "permission", None), "name", None)
    view_menu_name = getattr(getattr(permission, "view_menu", None), "name", None)
    if permission_name and view_menu_name:
        return f"{permission_name} on {view_menu_name}"

    return None


def serialize_role_object(
    role: Any, include_permissions: bool = False
) -> RoleInfo | None:
    """Serialize a FAB Role object into a RoleInfo schema.

    Set include_permissions=True for get_role_info; leave False for list_roles
    to avoid a per-role N+1 permissions lazy-load.
    """
    if not role:
        return None
    permissions: list[str] | None = None
    if include_permissions:
        try:
            raw_permissions = getattr(role, "permissions", None)
        except DetachedInstanceError:
            logger.debug(
                "Role permissions relationship is detached: role_id=%s",
                getattr(role, "id", None),
                exc_info=True,
            )
            raw_permissions = None

        if raw_permissions is not None:
            permissions = []
            try:
                for permission in raw_permissions:
                    try:
                        permission_name = _serialize_permission_name(permission)
                    except (DetachedInstanceError, TypeError):
                        logger.debug(
                            "Skipping unserializable role permission: role_id=%s",
                            getattr(role, "id", None),
                            exc_info=True,
                        )
                        continue

                    if permission_name is not None:
                        permissions.append(permission_name)
            except (DetachedInstanceError, TypeError):
                logger.debug(
                    "Could not iterate role permissions: role_id=%s",
                    getattr(role, "id", None),
                    exc_info=True,
                )
    return RoleInfo(
        id=getattr(role, "id", None),
        name=sanitize_for_llm_context(
            getattr(role, "name", None), field_path=("name",)
        ),
        permissions=[
            sanitize_for_llm_context(p, field_path=("permissions",))
            for p in permissions
        ]
        if permissions is not None
        else None,
    )
