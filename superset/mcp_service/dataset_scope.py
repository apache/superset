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

"""Optional MCP dataset routing constraints, independent of authorization."""

import inspect
from collections.abc import Mapping
from typing import Any
from uuid import UUID

from fastmcp.exceptions import ToolError
from flask import current_app, g, has_app_context

from superset import security_manager

SCOPE_ERROR = (
    "The requested dataset or operation is outside the configured MCP dataset scope. "
    "No query was run. Do not substitute another dataset; explain the scope "
    "limitation and ask an administrator to review the routing configuration."
)

# Only these tools can operate in dataset-scoped mode. Other paths can read data
# through SQL, cached results, screenshots, or external semantic sources without
# a registered dataset identity. Refuse them rather than guess at their lineage.
SCOPED_TOOLS = frozenset(
    {
        "health_check",
        "get_schema",
        "list_datasets",
        "get_dataset_info",
        "query_dataset",
        "get_table",
    }
)


def get_dataset_scope() -> frozenset[UUID] | None:
    """Union effective roles' UUID allowlists; None disables routing constraints.

    Missing roles contribute nothing, including Admin. Authorization is applied
    separately by the dataset DAO and the normal query execution/RLS machinery.
    No scope is cached across calls or users.
    """
    if not has_app_context():
        return None
    config = current_app.config.get("MCP_DATASET_ROLE_ALLOWLIST")
    if config is None:
        return None
    if not isinstance(config, dict):
        raise ToolError("MCP_DATASET_ROLE_ALLOWLIST must map role names to UUID lists.")
    normalized: dict[str, set[UUID]] = {}
    try:
        for role, identifiers in config.items():
            if not isinstance(role, str) or not isinstance(identifiers, (list, tuple)):
                raise ValueError("Expected role names and UUID lists")
            normalized[role] = {UUID(str(identifier)) for identifier in identifiers}
    except (ValueError, TypeError, AttributeError) as ex:
        raise ToolError("Invalid dataset UUID allowlist configuration.") from ex
    if not getattr(g, "user", None):
        return frozenset()
    return frozenset(
        identifier
        for role in security_manager.get_user_roles()
        for identifier in normalized.get(role.name, set())
    )


def enforce_call_dataset_scope(
    tool_name: str,
    signature: inspect.Signature,
    args: tuple[Any, ...],
    kwargs: Mapping[str, Any],
) -> None:
    """Bind a tool's call arguments only when routing constraints are configured.

    Binding eagerly would make every MCP tool call pay for — and be able to fail
    on — signature resolution even where the feature is switched off.
    """
    scope = get_dataset_scope()
    if scope is None:
        return
    arguments: Mapping[str, Any]
    try:
        arguments = signature.bind_partial(*args, **kwargs).arguments
    except TypeError:
        # Leave malformed calls to the tool's own argument validation, which
        # reports them far more precisely than a binding failure here would.
        arguments = dict(kwargs)
    _enforce(tool_name, arguments, scope)


def enforce_tool_dataset_scope(tool_name: str, arguments: Mapping[str, Any]) -> None:
    """Refuse unsupported paths or out-of-scope datasets before tool execution."""
    scope = get_dataset_scope()
    if scope is None:
        return
    _enforce(tool_name, arguments, scope)


def _enforce(
    tool_name: str, arguments: Mapping[str, Any], scope: frozenset[UUID]
) -> None:
    """Apply the routing decision for one resolved scope and argument set.

    Lookup uses the ordinary access-filtered DAO, never skip_base_filter. An
    allowlist entry therefore cannot grant access to an otherwise hidden dataset.
    """
    if tool_name not in SCOPED_TOOLS:
        raise ToolError(SCOPE_ERROR)
    if tool_name not in {"get_dataset_info", "query_dataset", "get_table"}:
        return

    request = arguments.get("request")
    field = "identifier" if tool_name == "get_dataset_info" else "dataset_id"
    identifier = (
        request.get(field)
        if isinstance(request, dict)
        else getattr(request, field, None)
    )
    if identifier is None:
        # External semantic views are not registered datasets.
        raise ToolError(SCOPE_ERROR)
    from superset.mcp_service.dataset.dataset_utils import resolve_dataset

    dataset = resolve_dataset(identifier)
    if dataset is None or dataset.uuid not in scope:
        raise ToolError(SCOPE_ERROR)
