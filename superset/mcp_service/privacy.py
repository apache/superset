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

"""Privacy helpers for MCP user-directory and data-model metadata."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone
from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ConfigDict, Field

F = TypeVar("F", bound=Callable[..., Any])

USER_DIRECTORY_FIELDS = frozenset(
    {
        "changed_by",
        "changed_by_fk",
        "changed_by_name",
        "created_by",
        "created_by_fk",
        "created_by_name",
        "last_saved_by",
        "last_saved_by_fk",
        "last_saved_by_name",
        "owner",
        "owners",
        "roles",
    }
)

DATA_MODEL_METADATA_ACCESS_ATTR = "_requires_data_model_metadata_access"
DATA_MODEL_METADATA_ERROR_TYPE = "DataModelMetadataRestricted"
DATA_MODEL_METADATA_PRIVACY_SCOPE = "data_model"
DATA_MODEL_METADATA_ERROR_MESSAGE = (
    "You don't have permission to access underlying dataset or database details "
    "for your role."
)
DATA_MODEL_METADATA_DENIAL_MESSAGE = (
    "I don't have permission to access underlying dataset or database details "
    "for your role. I can't provide dataset names, schema details, columns, "
    "field values, or SQL for that data model."
)

CHART_DATA_MODEL_COLUMNS = frozenset(
    {
        "catalog_perm",
        "datasource_id",
        "datasource_name",
        "datasource_type",
        "filters",
        "form_data",
        "params",
        "perm",
        "query_context",
        "schema_perm",
    }
)


class PrivacyError(BaseModel):
    """Structured privacy/permission denial for MCP tool responses."""

    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    privacy_scope: str = Field(..., description="Privacy scope for the denial")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create_data_model_metadata_denied(cls) -> "PrivacyError":
        return cls(
            error=DATA_MODEL_METADATA_ERROR_MESSAGE,
            error_type=DATA_MODEL_METADATA_ERROR_TYPE,
            privacy_scope=DATA_MODEL_METADATA_PRIVACY_SCOPE,
            timestamp=datetime.now(timezone.utc),
        )


def requires_data_model_metadata_access(func: F) -> F:
    """Mark a tool as requiring data-model metadata permission."""
    setattr(func, DATA_MODEL_METADATA_ACCESS_ATTR, True)
    return func


def tool_requires_data_model_metadata_access(func: Any) -> bool:
    """Return whether a tool requires data-model metadata access."""
    return bool(getattr(func, DATA_MODEL_METADATA_ACCESS_ATTR, False))


def user_can_view_data_model_metadata() -> bool:
    """Return whether the current user can inspect dataset/schema metadata."""
    try:
        from superset import security_manager

        return any(
            security_manager.can_access(permission_name, "Dataset")
            for permission_name in (
                "can_get_drill_info",
                "can_get_or_create_dataset",
                "can_write",
            )
        )
    except Exception:  # noqa: BLE001
        return False


def filter_user_directory_fields(data: dict[str, Any]) -> dict[str, Any]:
    """Remove fields that expose users, roles, owners, or access metadata."""
    return {
        key: value for key, value in data.items() if key not in USER_DIRECTORY_FIELDS
    }


def filter_user_directory_columns(columns: Iterable[str]) -> list[str]:
    """Remove user-directory columns while preserving order."""
    return [column for column in columns if column not in USER_DIRECTORY_FIELDS]


def remove_chart_data_model_columns(columns: Iterable[str]) -> list[str]:
    """Remove chart fields that reveal data-model metadata."""
    return [column for column in columns if column not in CHART_DATA_MODEL_COLUMNS]


def redact_chart_data_model_fields(chart_info: Any) -> Any:
    """Redact chart fields that expose dataset or database metadata.

    Fails closed: if redaction cannot be applied, the exception propagates
    rather than returning unredacted data.
    """
    from superset.mcp_service.chart.schemas import ChartInfo

    if isinstance(chart_info, ChartInfo):
        return chart_info.model_copy(
            update={
                "datasource_name": None,
                "datasource_type": None,
                "filters": None,
                "form_data": None,
            }
        )
    return chart_info


def request_uses_chart_data_model_filter(filters: Iterable[Any]) -> bool:
    """Return whether chart filters target hidden data-model fields."""
    return any(
        getattr(filter_, "col", None) in CHART_DATA_MODEL_COLUMNS for filter_ in filters
    )


def is_data_model_metadata_error(data: Any) -> bool:
    """Return whether tool output is a structured data-model privacy denial."""
    return (
        isinstance(data, dict)
        and data.get("error_type") == DATA_MODEL_METADATA_ERROR_TYPE
        and data.get("privacy_scope", DATA_MODEL_METADATA_PRIVACY_SCOPE)
        == DATA_MODEL_METADATA_PRIVACY_SCOPE
    )
