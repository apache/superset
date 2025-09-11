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

"""
Field-level permissions utilities for MCP service.
Provides functionality to filter sensitive data based on user permissions.
"""

import logging
from typing import Any, List, Optional, Set

from flask_appbuilder.security.sqla.models import User
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Define sensitive fields by object type
SENSITIVE_FIELDS = {
    "dataset": {
        "sql",  # Raw SQL queries may contain sensitive logic
        "extra",  # May contain connection strings or credentials
        "database_id",  # Internal database references
        "changed_by_fk",  # Internal user references
        "created_by_fk",  # Internal user references
    },
    "chart": {
        "query_context",  # May contain sensitive filters or parameters
        "cache_key",  # Internal cache references
        "changed_by_fk",  # Internal user references
        "created_by_fk",  # Internal user references
    },
    "dashboard": {
        "json_metadata",  # May contain sensitive configuration
        "position_json",  # Internal layout data
        "css",  # May contain sensitive styling info
        "changed_by_fk",  # Internal user references
        "created_by_fk",  # Internal user references
    },
    "common": {
        "uuid",  # Internal identifiers (keep for some use cases)
        "changed_by_fk",  # Internal user references
        "created_by_fk",  # Internal user references
    },
}

# Permissions required to access sensitive fields
SENSITIVE_FIELD_PERMISSIONS = {
    "sql": "can_sql_json",  # SQL Lab permissions
    "extra": "can_this_form_get",  # Advanced form permissions
    "database_id": "can_this_form_get",  # Database access permissions
    "query_context": "can_explore_json",  # Explore permissions
    "cache_key": "can_warm_up_cache",  # Cache management permissions
    "json_metadata": "can_this_form_get",  # Advanced dashboard permissions
    "position_json": "can_this_form_get",  # Dashboard edit permissions
    "css": "can_this_form_get",  # Dashboard styling permissions
}


def get_current_user() -> Optional[User]:
    """Get the current authenticated user."""
    try:
        from flask import g

        return getattr(g, "user", None)
    except Exception:
        return None


def user_has_permission(
    user: Optional[User], permission: str, resource: Optional[str] = None
) -> bool:
    """
    Check if user has a specific permission.

    Args:
        user: User object or None
        permission: Permission name (e.g., 'can_sql_json')
        resource: Resource name (e.g., 'Superset', 'Chart', etc.)

    Returns:
        True if user has permission, False otherwise
    """
    if not user:
        return False

    try:
        # Check if user is admin (has all permissions)
        if hasattr(user, "roles"):
            for role in user.roles:
                if role.name in ("Admin", "admin"):
                    return True

        # Check specific permission
        from superset import security_manager

        if resource:
            return security_manager.has_access(permission, resource, user)
        else:
            # Check if user has permission on any resource
            for pvm in user.get_permissions():
                if pvm.permission.name == permission:
                    return True

        return False
    except Exception as e:
        logger.warning(
            "Error checking permission %s for user %s: %s", permission, user, e
        )
        return False


def get_allowed_fields(
    object_type: str,
    user: Optional[User] = None,
    requested_fields: Optional[List[str]] = None,
) -> Set[str]:
    """
    Get the set of fields that the user is allowed to access for a given object type.

    Args:
        object_type: Type of object ('dataset', 'chart', 'dashboard')
        user: User object (if None, will try to get current user)
        requested_fields: List of fields requested (if None, all allowed fields)

    Returns:
        Set of allowed field names
    """
    if not user:
        user = get_current_user()

    # Get sensitive fields for this object type
    sensitive_fields = SENSITIVE_FIELDS.get(object_type, set())
    sensitive_fields.update(SENSITIVE_FIELDS.get("common", set()))

    # If no user, only allow non-sensitive fields
    if not user:
        if requested_fields:
            return set(requested_fields) - sensitive_fields
        else:
            # Return empty set - caller should use default safe fields
            return set()

    # Check permissions for sensitive fields
    allowed_fields = set()

    if requested_fields:
        for field in requested_fields:
            if field not in sensitive_fields:
                # Non-sensitive field, always allowed
                allowed_fields.add(field)
            else:
                # Check if user has permission for this sensitive field
                required_permission = SENSITIVE_FIELD_PERMISSIONS.get(field)
                if required_permission and user_has_permission(
                    user, required_permission
                ):
                    allowed_fields.add(field)
                elif not required_permission:
                    # No specific permission required, but still sensitive
                    # Allow for authenticated users (basic sensitivity)
                    allowed_fields.add(field)
    else:
        # No specific fields requested, return empty set
        # Caller should specify default fields
        return set()

    return allowed_fields


def filter_sensitive_data(
    data: Any,
    object_type: str,
    user: Optional[User] = None,
    allowed_fields: Optional[Set[str]] = None,
) -> Any:
    """
    Filter sensitive data from an object based on user permissions.

    Args:
        data: Data to filter (dict, Pydantic model, or list)
        object_type: Type of object ('dataset', 'chart', 'dashboard')
        user: User object (if None, will try to get current user)
        allowed_fields: Pre-computed allowed fields (optimization)

    Returns:
        Filtered data with sensitive fields removed
    """
    if not data:
        return data

    if not user:
        user = get_current_user()

    # Handle different data types
    if isinstance(data, list):
        return [
            filter_sensitive_data(item, object_type, user, allowed_fields)
            for item in data
        ]

    if isinstance(data, BaseModel):
        # Convert Pydantic model to dict for filtering
        data_dict = data.model_dump()
        filtered_dict = filter_sensitive_data(
            data_dict, object_type, user, allowed_fields
        )
        # Return as dict since we can't easily reconstruct the Pydantic model
        return filtered_dict

    if not isinstance(data, dict):
        # Not a dict-like object, return as-is
        return data

    # Get allowed fields if not provided
    if allowed_fields is None:
        requested_fields = list(data.keys())
        allowed_fields = get_allowed_fields(object_type, user, requested_fields)

    # Filter the dictionary
    filtered_data = {}
    for key, value in data.items():
        if key in allowed_fields:
            filtered_data[key] = value
        else:
            # Log when we filter out sensitive data
            logger.debug(
                "Filtered sensitive field '%s' for object type '%s'", key, object_type
            )

    return filtered_data


def apply_field_permissions_to_columns(
    columns: List[str], object_type: str, user: Optional[User] = None
) -> List[str]:
    """
    Filter a list of column names based on field-level permissions.

    Args:
        columns: List of column names to filter
        object_type: Type of object ('dataset', 'chart', 'dashboard')
        user: User object (if None, will try to get current user)

    Returns:
        Filtered list of allowed column names
    """
    allowed_fields = get_allowed_fields(object_type, user, columns)
    return [col for col in columns if col in allowed_fields]


class PermissionAwareSerializer:
    """
    Wrapper for serializers that automatically applies field-level permissions.
    """

    def __init__(self, object_type: str, base_serializer: Any):
        self.object_type = object_type
        self.base_serializer = base_serializer

    def serialize(
        self, obj: Any, columns: List[str], user: Optional[User] = None
    ) -> Any:
        """
        Serialize object with field-level permissions applied.

        Args:
            obj: Object to serialize
            columns: Requested columns
            user: User object for permission checking

        Returns:
            Serialized object with sensitive fields filtered
        """
        # Filter columns based on permissions
        allowed_columns = apply_field_permissions_to_columns(
            columns, self.object_type, user
        )

        # Use base serializer with filtered columns
        serialized = self.base_serializer(obj, allowed_columns)

        # Apply additional filtering to the serialized result
        return filter_sensitive_data(serialized, self.object_type, user)


# Convenience functions for common object types
def filter_dataset_data(data: Any, user: Optional[User] = None) -> Any:
    """Filter sensitive data from dataset objects."""
    return filter_sensitive_data(data, "dataset", user)


def filter_chart_data(data: Any, user: Optional[User] = None) -> Any:
    """Filter sensitive data from chart objects."""
    return filter_sensitive_data(data, "chart", user)


def filter_dashboard_data(data: Any, user: Optional[User] = None) -> Any:
    """Filter sensitive data from dashboard objects."""
    return filter_sensitive_data(data, "dashboard", user)
