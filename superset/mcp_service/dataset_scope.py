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

import enum
import inspect
import logging
from collections.abc import Callable, Iterable, Mapping
from typing import Any, Final, Literal, TYPE_CHECKING, TypeAlias
from uuid import UUID

from fastmcp.exceptions import ToolError
from flask import current_app, g, has_app_context
from flask_appbuilder.models.filters import BaseFilter

from superset import security_manager

if TYPE_CHECKING:
    from sqlalchemy.orm.query import Query

logger = logging.getLogger(__name__)

CONFIG_KEY = "MCP_DATASET_ROLE_ALLOWLIST"


class _UnscopedType(enum.Enum):
    """Type of the ``UNSCOPED`` sentinel; a single-member enum for typing."""

    UNSCOPED = "unscoped"


# Returned by a ``MCP_DATASET_ROLE_ALLOWLIST`` resolver to exempt the current
# caller from routing constraints (full tool surface, no dataset filter), e.g.
# for a tenant that has not opted into dataset scoping. Checked by identity:
# ``None``, an empty iterable, errors and any other value still deny every
# dataset, so only an explicit opt-out can widen access.
UNSCOPED: Final = _UnscopedType.UNSCOPED

DatasetScopeResolver: TypeAlias = Callable[
    [Any], Iterable[str | UUID] | Literal[_UnscopedType.UNSCOPED] | None
]

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
# Enforcement runs inside ``mcp_auth_hook``, so the tools in app.py's
# ``ALLOWED_UNPROTECTED`` (``generate_bug_report``) are never gated here. That is
# intentional: they are public precisely so diagnostics survive broken auth, and
# they read no dataset rows. Any future unprotected tool that can reach dataset
# data would need its own gate.
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

        # SqlaTable.uuid is an unannotated Column, so mypy sees the raw
        # nullable value type here instead of an InstrumentedAttribute; same
        # false positive already ignored at
        # superset/connectors/sqla/models.py:2491.
        return query.filter(SqlaTable.uuid.in_(value))  # type: ignore[union-attr]


def parse_dataset_role_allowlist(config: Any) -> dict[str, set[UUID]] | None:
    """Validate the static allowlist mapping; None means nothing to validate.

    Split out from scope resolution so a deployment can fail at startup on a
    malformed mapping rather than on every subsequent tool call.

    A callable ``config`` resolves its allowlist per request (see
    ``get_dataset_scope``) and cannot be validated once at startup, so it is
    treated here as "nothing to validate" rather than as an error. Callers
    that need to distinguish "routing constraints are off" from "a callable
    is configured" must check ``callable(config)`` themselves before calling
    this function; ``get_dataset_scope`` does so.
    """
    if config is None or callable(config):
        return None
    if not isinstance(config, dict):
        raise MCPDatasetScopeError(
            f"{CONFIG_KEY} must map role names to lists of dataset UUIDs "
            "or be a callable resolving dataset UUIDs."
        )
    normalized: dict[str, set[UUID]] = {}
    for role, identifiers in config.items():
        if not isinstance(role, str):
            raise MCPDatasetScopeError(
                f"{CONFIG_KEY} keys must be role names; got {role!r} "
                f"({type(role).__name__})."
            )
        if not isinstance(identifiers, (list, tuple, set, frozenset)):
            raise MCPDatasetScopeError(
                f"{CONFIG_KEY}[{role!r}] must be a list of dataset UUIDs; got "
                f"{type(identifiers).__name__}."
            )
        normalized[role] = {
            _coerce_dataset_uuid(role, identifier) for identifier in identifiers
        }
    return normalized


def _coerce_dataset_uuid(role: str, identifier: Any) -> UUID:
    """Convert one allowlist entry to a UUID, naming the bad entry on failure.

    Only ``UUID`` and ``str`` are accepted. Coercing arbitrary types through
    ``str()`` could accept an unintended type whose string happens to parse as
    a UUID. Reject other types explicitly so configuration errors identify the
    offending type and entry instead of relying on string conversion.
    """
    if isinstance(identifier, UUID):
        return identifier
    if not isinstance(identifier, str):
        raise MCPDatasetScopeError(
            f"{CONFIG_KEY}[{role!r}] entries must be dataset UUID strings; got "
            f"{identifier!r} ({type(identifier).__name__}). Dataset names and "
            "numeric IDs are not accepted."
        )
    try:
        return UUID(identifier)
    except ValueError as ex:
        raise MCPDatasetScopeError(
            f"{CONFIG_KEY}[{role!r}] contains {identifier!r}, which is not a "
            "valid dataset UUID."
        ) from ex


def get_dataset_scope() -> frozenset[UUID] | None:
    """Resolve the caller's dataset allowlist; None disables routing constraints.

    ``MCP_DATASET_ROLE_ALLOWLIST`` accepts two forms:

    - A static ``dict[str, list[str]]`` mapping role name to dataset UUIDs,
      validated at startup. Effective roles' allowlists are unioned; missing
      roles (including Admin) contribute nothing.
    - A callable resolving the allowlist for the current request's user (see
      ``_resolve_callable_scope``), for deployments where roles and dataset
      UUIDs are not static (e.g. per-workspace in a multi-tenant install).
      The callable returns ``UNSCOPED`` to leave the caller unconstrained.

    Authorization is applied separately by the dataset DAO and the normal
    query execution/RLS machinery. No scope is cached across calls or users.
    """
    if not has_app_context():
        # Reached only for FastMCP internal operations such as tool discovery,
        # which run without a Flask context and therefore touch no dataset data.
        return None
    config = current_app.config.get(CONFIG_KEY)
    if config is None:
        return None
    if callable(config):
        return _resolve_callable_scope(config)
    normalized = parse_dataset_role_allowlist(config)
    assert normalized is not None  # config is neither None nor callable here
    if not getattr(g, "user", None):
        # Routing is enabled, but no user can contribute roles: deny every
        # dataset. None would disable routing rather than represent no grants.
        return frozenset()
    return frozenset(
        identifier
        for role in security_manager.get_user_roles()
        for identifier in normalized.get(role.name, set())
    )


def _resolve_callable_scope(
    resolver: DatasetScopeResolver,
) -> frozenset[UUID] | None:
    """Call a configured ``MCP_DATASET_ROLE_ALLOWLIST`` resolver for this request.

    Returns None only when the resolver returns the ``UNSCOPED`` sentinel,
    which exempts this caller from routing constraints. ``None`` from the
    resolver is not an opt-out: it is the natural "no grants found" result of
    a lookup, so treating it as unrestricted would turn a missed lookup into
    full access.

    Fails CLOSED -- denies every dataset for this request -- if the resolver
    raises, returns ``None``, or returns something that cannot be parsed as
    dataset UUIDs. This is deliberately different from a bare ``None``
    *config* at the top level, which disables routing constraints entirely:
    once an operator has configured dynamic routing, a resolution failure for
    one request (an unresolvable workspace, a transient lookup error) must
    deny access rather than silently fall back to the unrestricted tool
    surface for that caller.
    """
    user = getattr(g, "user", None)
    # Log the numeric id rather than the username so a failing tenant can be
    # traced without writing identity claims to the log.
    user_id = getattr(user, "id", None)
    try:
        result = resolver(user)
        if result is UNSCOPED:
            return None
        if result is None:
            return frozenset()
        if isinstance(result, (str, bytes)) or not isinstance(result, Iterable):
            logger.warning(
                "%s callable returned %s for user_id=%s, expected an iterable of "
                "dataset UUIDs or None; failing closed (denying all datasets) for "
                "this request",
                CONFIG_KEY,
                type(result).__name__,
                user_id,
            )
            return frozenset()
        # A lazy result can raise during iteration or UUID conversion, not just
        # when invoking the resolver. Discard partial grants on any failure.
        coerced = _coerce_callable_scope_entries(result)
    except Exception:  # noqa: BLE001 — operator-supplied callable may raise anything
        logger.warning(
            "%s callable raised while resolving dataset scope for user_id=%s; "
            "failing closed (denying all datasets) for this request",
            CONFIG_KEY,
            user_id,
            exc_info=True,
        )
        return frozenset()
    if coerced is None:
        logger.warning(
            "%s callable returned a value that is not a valid dataset UUID for "
            "user_id=%s; failing closed (denying all datasets) for this request",
            CONFIG_KEY,
            user_id,
        )
        return frozenset()
    return coerced


def _coerce_callable_scope_entries(
    identifiers: Iterable[object],
) -> frozenset[UUID] | None:
    """Convert a resolver's returned identifiers to UUIDs, or None if invalid."""
    coerced: set[UUID] = set()
    for identifier in identifiers:
        if isinstance(identifier, UUID):
            coerced.add(identifier)
            continue
        if not isinstance(identifier, str):
            return None
        try:
            coerced.add(UUID(identifier))
        except ValueError:
            return None
    return frozenset(coerced)


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
