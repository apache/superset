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

"""Canonical resource and action mappings for scoped API keys."""

# Map FAB method permissions used by MCP tools to the coarser actions supported
# by API-key scopes. Keep this explicit so an unknown permission fails closed.
METHOD_PERMISSION_SCOPE_ACTION: dict[str, str] = {
    "read": "read",
    "get": "read",
    "write": "write",
    "update": "write",
    "delete": "write",
    "execute_sql_query": "write",
}

# Map MCP/FAB class permission names to stable public resource slugs. These
# cannot be derived by lowercasing because several names contain spaces or use
# public spellings that differ from their internal class names.
RESOURCE_SCOPE_NAME: dict[str, str] = {
    "Annotation": "annotation",
    "Chart": "chart",
    "Dashboard": "dashboard",
    "Database": "database",
    "Dataset": "dataset",
    "Explore": "explore",
    "Query": "query",
    "ReportSchedule": "report",
    "Role": "role",
    "Row Level Security": "rls",
    "SavedQuery": "savedquery",
    "SQLLab": "sqllab",
    "Tag": "tag",
    "Task": "task",
    "Theme": "theme",
    "User": "user",
}

RESOURCE_SCOPE_CLASS: dict[str, str] = {
    resource: class_name for class_name, resource in RESOURCE_SCOPE_NAME.items()
}
RESOURCE_SCOPE_ACTIONS: frozenset[str] = frozenset(
    METHOD_PERMISSION_SCOPE_ACTION.values()
)
SCOPE_ACTION_METHOD_PERMISSIONS: dict[str, tuple[str, ...]] = {
    action: tuple(
        method
        for method, mapped_action in METHOD_PERMISSION_SCOPE_ACTION.items()
        if mapped_action == action
    )
    for action in RESOURCE_SCOPE_ACTIONS
}


def get_resource_scope(
    class_permission_name: str, method_permission_name: str
) -> str | None:
    """Return the resource scope required by a FAB class/method permission."""
    resource = RESOURCE_SCOPE_NAME.get(class_permission_name)
    action = METHOD_PERMISSION_SCOPE_ACTION.get(method_permission_name)
    if resource is None or action is None:
        return None
    return f"superset:{resource}:{action}"
