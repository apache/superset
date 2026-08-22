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
``AI_AGENT_MCP_SERVERS``, parsed into typed objects.

Validation is strict and every message names the offending server, because the
alternative is an agent that quietly lacks a capability. A misspelled key, a
missing URL, an unknown transport and a server name a profile references but
which is not configured are all startup-visible errors rather than a silently
shorter tool list.

Pure by design: no SDK import, no socket, no Flask requirement beyond the one
loader that reads the setting. That is what lets configuration be validated in a
unit test and lets :mod:`superset.ai.policy` ask whether a tool name is foreign
without pulling in a transport.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

#: Transport the SDK should use to reach a server. Two, because these are the
#: two the protocol defines for a server reached over a network; a stdio server
#: would mean Superset spawning a subprocess per turn, which is not something a
#: web worker should be doing.
TRANSPORT_STREAMABLE_HTTP = "streamable_http"
TRANSPORT_SSE = "sse"
TRANSPORTS: tuple[str, ...] = (TRANSPORT_STREAMABLE_HTTP, TRANSPORT_SSE)

#: Applied when a server names no timeout. Bounds how long one call may occupy
#: the worker running the turn.
DEFAULT_TIMEOUT_SECONDS = 30.0

#: Prefix and separator that namespace every foreign tool. A built-in tool name
#: never contains the separator, so a foreign tool cannot collide with one no
#: matter what the server calls it — which is the point: a server offering
#: ``execute_sql`` must not be able to displace Superset's.
FOREIGN_TOOL_PREFIX = "mcp__"
NAME_SEPARATOR = "__"

#: Providers restrict tool names to a short identifier-like token, so a
#: namespaced name that would exceed this is not offered to the model at all.
MAX_TOOL_NAME_LENGTH = 64

#: Keys a server entry may set. Anything else is a typo, and a typo in a
#: security-relevant key — ``headers``, ``tool_allowlist`` — must not be
#: ignored.
_ALLOWED_KEYS = frozenset(
    {
        "url",
        "transport",
        "headers",
        "timeout_seconds",
        "tool_allowlist",
        "tool_denylist",
    }
)

#: Schemes a server may be reached over. Restricted so that a configuration
#: mistake cannot turn a tool call into a local file read.
_ALLOWED_SCHEMES = frozenset({"http", "https"})

#: A server name that keeps the namespaced tool name readable and unambiguous.
#: The separator is excluded separately, below.
_SERVER_NAME = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$")


class MCPConfigurationError(Exception):
    """``AI_AGENT_MCP_SERVERS`` is not usable as written."""


@dataclass(frozen=True)
class MCPServerConfig:
    """
    One external MCP server, as configured.

    Frozen because it is read on every turn from several places; nothing should
    be able to retune a server mid-request.
    """

    #: Key the setting used, and the middle segment of every tool name this
    #: server contributes. Operator-chosen, so safe to show the model.
    name: str

    #: Absolute ``http``/``https`` endpoint.
    url: str

    transport: str = TRANSPORT_STREAMABLE_HTTP

    #: The **only** headers sent to this server. Superset never adds its own
    #: session cookie, CSRF token or authentication header: an external server
    #: is not a party to the user's Superset session, and forwarding a
    #: credential to it would hand that server the user's Superset identity.
    headers: dict[str, str] = field(default_factory=dict)

    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS

    #: Tools to take from this server. ``None`` means every tool it offers,
    #: which is convenient but means the server decides what the agent can do.
    tool_allowlist: tuple[str, ...] | None = None

    #: Tools to refuse regardless of the allowlist.
    tool_denylist: tuple[str, ...] = ()

    def offers(self, tool_name: str) -> bool:
        """
        Whether this server's ``tool_name`` may be adapted into a tool.

        Both the name the server uses and the namespaced name Superset assigns
        are accepted in either list, because the namespaced name is what an
        operator sees in a transcript and is the more natural thing to paste
        into configuration. The denylist wins: a name in both lists is refused.
        """
        candidates = {tool_name, namespaced_tool_name(self.name, tool_name)}
        if candidates & set(self.tool_denylist):
            return False
        if self.tool_allowlist is None:
            return True
        return bool(candidates & set(self.tool_allowlist))


def namespaced_tool_name(server_name: str, tool_name: str) -> str:
    """
    The name the model calls a foreign tool by.

    Stable, and documented for operators, because it appears in stored
    conversation history and in a server's ``tool_allowlist``.
    """
    return f"{FOREIGN_TOOL_PREFIX}{server_name}{NAME_SEPARATOR}{tool_name}"


def is_foreign_tool_name(tool_name: str) -> bool:
    """Whether ``tool_name`` was contributed by an external server."""
    return split_foreign_tool_name(tool_name) is not None


def split_foreign_tool_name(tool_name: str) -> tuple[str, str] | None:
    """
    Recover ``(server_name, remote_tool_name)``, or ``None`` for a built-in.

    Unambiguous because a validated server name cannot itself contain the
    separator, so the first occurrence after the prefix is the boundary.
    """
    if not tool_name.startswith(FOREIGN_TOOL_PREFIX):
        return None
    remainder = tool_name[len(FOREIGN_TOOL_PREFIX) :]
    server, separator, remote = remainder.partition(NAME_SEPARATOR)
    if not separator or not server or not remote:
        return None
    return server, remote


def parse_mcp_servers(raw: Any = None) -> dict[str, MCPServerConfig]:
    """
    Validate the setting into a mapping of server name to configuration.

    ``raw`` defaults to ``AI_AGENT_MCP_SERVERS``. An empty setting yields an
    empty mapping, which is what makes the whole extension point inert by
    default.
    """
    if raw is None:
        raw = _configured_servers()
    if not raw:
        return {}
    if not isinstance(raw, dict):
        raise MCPConfigurationError(
            "AI_AGENT_MCP_SERVERS must be a dict mapping a server name to its "
            f"settings, not {type(raw).__name__}."
        )

    servers: dict[str, MCPServerConfig] = {}
    for name, entry in raw.items():
        server_name = _validated_name(name)
        servers[server_name] = _parse_server(server_name, entry)
    return servers


def resolve_servers(
    names: Sequence[str],
    servers: dict[str, MCPServerConfig] | None = None,
) -> list[MCPServerConfig]:
    """
    Look up the configurations a profile references.

    An unknown name raises rather than being skipped, for the same reason
    :meth:`~superset.ai.tools.base.ToolRegistry.subset` raises on an unknown
    tool: a typo that silently removed a capability presents as a model that
    inexplicably stopped using it.
    """
    if servers is None:
        servers = parse_mcp_servers()
    unknown = [name for name in names if name not in servers]
    if unknown:
        available = ", ".join(sorted(servers)) or "none"
        raise MCPConfigurationError(
            f"Unknown MCP server(s) {', '.join(sorted(unknown))}. Configured in "
            f"AI_AGENT_MCP_SERVERS: {available}."
        )
    return [servers[name] for name in names]


def _configured_servers() -> Any:
    """
    The raw setting, or nothing outside an application context.

    Absent rather than fatal, so configuration parsing stays unit-testable
    without a Flask app.
    """
    try:
        from flask import current_app

        return current_app.config.get("AI_AGENT_MCP_SERVERS") or {}
    except Exception:  # pylint: disable=broad-except
        return {}


def _validated_name(name: Any) -> str:
    """Check a server name is usable as a tool-name segment."""
    if not isinstance(name, str) or not name:
        raise MCPConfigurationError(
            "Every AI_AGENT_MCP_SERVERS key must be a non-empty server name; "
            f"found {name!r}."
        )
    if NAME_SEPARATOR in name:
        raise MCPConfigurationError(
            f"MCP server name {name!r} may not contain {NAME_SEPARATOR!r}: it "
            f"would make the tool name it namespaces ambiguous."
        )
    if not _SERVER_NAME.match(name):
        raise MCPConfigurationError(
            f"MCP server name {name!r} must be letters, digits, hyphens and "
            f"underscores, starting and ending with a letter or digit. The name "
            f"becomes part of every tool name this server contributes."
        )
    return name


def _parse_server(name: str, entry: Any) -> MCPServerConfig:
    """Validate one entry, naming ``name`` in every failure."""
    if not isinstance(entry, dict):
        raise MCPConfigurationError(
            f"AI_AGENT_MCP_SERVERS[{name!r}] must be a dict of settings, not "
            f"{type(entry).__name__}."
        )
    if unknown := set(entry) - _ALLOWED_KEYS:
        raise MCPConfigurationError(
            f"Unknown setting(s) for MCP server {name!r}: "
            f"{', '.join(sorted(str(key) for key in unknown))}. Accepted: "
            f"{', '.join(sorted(_ALLOWED_KEYS))}."
        )

    return MCPServerConfig(
        name=name,
        url=_parse_url(name, entry.get("url")),
        transport=_parse_transport(name, entry.get("transport")),
        headers=_parse_headers(name, entry.get("headers")),
        timeout_seconds=_parse_timeout(name, entry.get("timeout_seconds")),
        tool_allowlist=_parse_tool_list(name, "tool_allowlist", entry, allow_none=True),
        tool_denylist=_parse_tool_list(name, "tool_denylist", entry, allow_none=False)
        or (),
    )


def _parse_url(name: str, value: Any) -> str:
    """Require an absolute HTTP(S) endpoint."""
    if not value:
        raise MCPConfigurationError(
            f"MCP server {name!r} has no 'url'. Set it to the server's endpoint."
        )
    if not isinstance(value, str):
        raise MCPConfigurationError(
            f"The 'url' for MCP server {name!r} must be a string, not "
            f"{type(value).__name__}."
        )
    parsed = urlparse(value)
    if parsed.scheme not in _ALLOWED_SCHEMES or not parsed.netloc:
        raise MCPConfigurationError(
            f"The 'url' for MCP server {name!r} must be an absolute "
            f"{' or '.join(sorted(_ALLOWED_SCHEMES))} URL; got {value!r}."
        )
    return value


def _parse_transport(name: str, value: Any) -> str:
    if value is None:
        return TRANSPORT_STREAMABLE_HTTP
    if value not in TRANSPORTS:
        raise MCPConfigurationError(
            f"Unknown 'transport' {value!r} for MCP server {name!r}. Expected "
            f"one of {', '.join(TRANSPORTS)}."
        )
    return str(value)


def _parse_headers(name: str, value: Any) -> dict[str, str]:
    """Require a flat string mapping; this is what gets put on the wire."""
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise MCPConfigurationError(
            f"The 'headers' for MCP server {name!r} must be a dict of header "
            f"name to value, not {type(value).__name__}."
        )
    headers: dict[str, str] = {}
    for key, header_value in value.items():
        if not isinstance(key, str) or not isinstance(header_value, str):
            raise MCPConfigurationError(
                f"Every header for MCP server {name!r} must be a string name "
                f"and a string value; got {key!r}: {type(header_value).__name__}."
            )
        headers[key] = header_value
    return headers


def _parse_timeout(name: str, value: Any) -> float:
    if value is None:
        return DEFAULT_TIMEOUT_SECONDS
    # bool is an int subclass, and a timeout of True is a configuration error
    # rather than one second.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise MCPConfigurationError(
            f"The 'timeout_seconds' for MCP server {name!r} must be a number, "
            f"not {type(value).__name__}."
        )
    if value <= 0:
        raise MCPConfigurationError(
            f"The 'timeout_seconds' for MCP server {name!r} must be greater "
            f"than zero; got {value!r}."
        )
    return float(value)


def _parse_tool_list(
    name: str,
    key: str,
    entry: dict[str, Any],
    allow_none: bool,
) -> tuple[str, ...] | None:
    """
    Read a tool name list.

    ``allow_none`` distinguishes the allowlist, where absent means "every tool
    the server offers", from the denylist, where absent means "none".
    """
    if key not in entry or entry[key] is None:
        return None if allow_none else ()
    value = entry[key]
    if not isinstance(value, (list, tuple, set, frozenset)):
        raise MCPConfigurationError(
            f"The {key!r} for MCP server {name!r} must be a list of tool names, "
            f"not {type(value).__name__}."
        )
    names = tuple(str(item) for item in value)
    if any(not item for item in names):
        raise MCPConfigurationError(
            f"The {key!r} for MCP server {name!r} contains an empty tool name."
        )
    return names
