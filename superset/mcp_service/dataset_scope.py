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
from typing import Any, TYPE_CHECKING
from uuid import UUID

from fastmcp.exceptions import ToolError
from flask import current_app, g, has_app_context
from flask_appbuilder.models.filters import BaseFilter

from superset import security_manager

if TYPE_CHECKING:
    from sqlalchemy.orm.query import Query

CONFIG_KEY = "MCP_DATASET_ROLE_ALLOWLIST"

_NO_SUBSTITUTE = (
    "No query was run. Do not substitute another dataset; explain the scope "
    "limitation and ask an administrator to review the routing configuration."
)

# Distinct refusals so a misrouted request is distinguishable from a tool that
# scoped mode does not support at all — both for callers and for regression
# tests, which would otherwise pass against an implementation that refuses
# unconditionally.
UNSUPPORTED_TOOL_ERROR = (
    "This tool is unavailable while MCP is running with a configured dataset "
    f"scope, because its results cannot be attributed to a specific registered "
    f"dataset. {_NO_SUBSTITUTE}"
)
NO_DATASET_IDENTITY_ERROR = (
    "This request does not identify a registered dataset, which MCP requires "
    f"while running with a configured dataset scope. {_NO_SUBSTITUTE}"
)
OUT_OF_SCOPE_ERROR = (
    "The requested dataset is outside the configured MCP dataset scope. "
    f"{_NO_SUBSTITUTE}"
)

# Only these tools can operate in dataset-scoped mode. Other paths can read data
# through SQL, cached results, screenshots, or external semantic sources without
# a registered dataset identity. Refuse them rather than guess at their lineage.
#
# This deliberately gates execution only, not ``tools/list`` visibility. Tool
# listings are assembled by the tool-search transform, which synthesizes its own
# meta tools; filtering that listing on this set would hide the very tools a
# client needs to reach the scoped ones. A refusal the model can read is a
# better failure than a tool surface that silently disappears.
SCOPED_TOOLS = frozenset(
    {
        "health_check",
        "get_schema",
        "list_datasets",
        "get_dataset_info",
        "query_dataset",
        "get_table",
        # The metric/dimension discovery tools get_table's own documented
        # workflow starts with. They name a dataset, so they can be scoped, and
        # refusing them would block the allowed tool they lead into.
        "list_metrics",
        "get_compatible_dimensions",
        "get_compatible_metrics",
    }
)

# Tools whose request names a single dataset, mapped to the field that names it.
DATASET_IDENTIFIER_FIELDS = {
    "get_dataset_info": "identifier",
    "query_dataset": "dataset_id",
    "get_table": "dataset_id",
    "list_metrics": "dataset_id",
    "get_compatible_dimensions": "dataset_id",
    "get_compatible_metrics": "dataset_id",
}


class MCPDatasetScopeError(ToolError):
    """Raised when a call is refused by, or the config of, the routing allowlist.

    Subclasses ``ToolError`` so the explanation reaches the caller verbatim
    instead of being flattened into a generic internal error. Surfacing a
    configuration problem rather than quietly ignoring the setting keeps a typo
    from silently restoring the unrestricted tool surface an operator opted out
    of.
    """


class DatasetScopeFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """Restrict a dataset query to the caller's routing allowlist.

    Applied as a custom filter rather than a caller-visible column operator so
    the resolved allowlist — which may name datasets the caller cannot access —
    is not echoed back in the ``filters_applied`` section of a list response.
    """

    name = "MCP dataset scope"
    arg_name = "mcp_dataset_scope"

    def apply(self, query: "Query", value: frozenset[UUID]) -> "Query":
        from superset.connectors.sqla.models import SqlaTable

        return query.filter(SqlaTable.uuid.in_(value))


def parse_dataset_role_allowlist(config: Any) -> dict[str, set[UUID]] | None:
    """Validate the allowlist mapping; None means routing constraints are off.

    Split out from scope resolution so a deployment can fail at startup on a
    malformed mapping rather than on every subsequent tool call.
    """
    if config is None:
        return None
    if not isinstance(config, dict):
        raise MCPDatasetScopeError(
            f"{CONFIG_KEY} must map role names to lists of dataset UUIDs."
        )
    normalized: dict[str, set[UUID]] = {}
    try:
        for role, identifiers in config.items():
            if not isinstance(role, str) or not isinstance(identifiers, (list, tuple)):
                raise ValueError("Expected role names and UUID lists")
            normalized[role] = {UUID(str(identifier)) for identifier in identifiers}
    except (ValueError, TypeError, AttributeError) as ex:
        raise MCPDatasetScopeError(
            f"{CONFIG_KEY} contains an entry that is not a list of dataset UUIDs."
        ) from ex
    return normalized


def get_dataset_scope() -> frozenset[UUID] | None:
    """Union effective roles' UUID allowlists; None disables routing constraints.

    Missing roles contribute nothing, including Admin. Authorization is applied
    separately by the dataset DAO and the normal query execution/RLS machinery.
    No scope is cached across calls or users.
    """
    if not has_app_context():
        # Reached only for FastMCP internal operations such as tool discovery,
        # which run without a Flask context and therefore touch no dataset data.
        return None
    normalized = parse_dataset_role_allowlist(current_app.config.get(CONFIG_KEY))
    if normalized is None:
        return None
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
    """Refuse unsupported paths or out-of-scope datasets before tool execution.

    Call arguments are bound only once routing constraints are known to be
    configured: binding eagerly would make every MCP tool call pay for — and be
    able to fail on — signature resolution even where the feature is off.
    """
    scope = get_dataset_scope()
    if scope is None:
        return
    if tool_name not in SCOPED_TOOLS:
        raise MCPDatasetScopeError(UNSUPPORTED_TOOL_ERROR)
    field = DATASET_IDENTIFIER_FIELDS.get(tool_name)
    if field is None:
        return
    arguments: Mapping[str, Any]
    try:
        arguments = signature.bind_partial(*args, **kwargs).arguments
    except TypeError:
        # Leave malformed calls to the tool's own argument validation, which
        # reports them far more precisely than a binding failure here would.
        arguments = dict(kwargs)
    _enforce_dataset_identifier(arguments, field, scope)


def _enforce_dataset_identifier(
    arguments: Mapping[str, Any], field: str, scope: frozenset[UUID]
) -> None:
    """Resolve the request's dataset and check it against the allowlist.

    Lookup uses the ordinary access-filtered DAO, never skip_base_filter. An
    allowlist entry therefore cannot grant access to an otherwise hidden dataset.
    """
    request = arguments.get("request")
    identifier = (
        request.get(field)
        if isinstance(request, dict)
        else getattr(request, field, None)
    )
    if identifier is None:
        # External semantic views are not registered datasets.
        raise MCPDatasetScopeError(NO_DATASET_IDENTITY_ERROR)
    from superset.mcp_service.dataset.dataset_utils import resolve_dataset

    dataset = resolve_dataset(identifier)
    if dataset is None or dataset.uuid not in scope:
        raise MCPDatasetScopeError(OUT_OF_SCOPE_ERROR)
