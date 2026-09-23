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
Tests for parsing ``AI_AGENT_MCP_SERVERS``.

The theme is that every rejection names the server it is about. A deployment
attaching its own MCP servers is editing a Python dict by hand, and the failure
mode worth engineering against is not a crash but a silently shorter tool list.
"""

from __future__ import annotations

from typing import Any

import pytest
from flask import current_app
from pytest_mock import MockerFixture

VALID_URL = "https://mcp.acme.internal/mcp"


def _parse(raw: Any) -> dict[str, Any]:
    from superset.ai.mcp.config import parse_mcp_servers

    return dict(parse_mcp_servers(raw))


def _error_for(raw: Any) -> str:
    """Parse ``raw``, asserting it is refused, and return the message."""
    from superset.ai.mcp.config import MCPConfigurationError

    with pytest.raises(MCPConfigurationError) as caught:
        _parse(raw)
    return str(caught.value)


# --------------------------------------------------------------------------- #
# The empty case: nothing configured must behave as if the feature is absent
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("raw", [{}, None])
def test_no_servers_configured_yields_nothing(raw: Any) -> None:
    """
    An unset setting is not an error, it is the default.

    Superset ships no third-party integration, so this is the shipped state and
    it has to parse to an empty mapping rather than raising.
    """
    assert _parse(raw) == {}


def test_servers_are_read_from_configuration_when_not_passed(
    mocker: MockerFixture,
) -> None:
    """The loader reads the setting when a caller supplies nothing."""
    from superset.ai.mcp.config import parse_mcp_servers

    mocker.patch.dict(
        current_app.config,
        {"AI_AGENT_MCP_SERVERS": {"acme_catalog": {"url": VALID_URL}}},
    )

    servers = parse_mcp_servers()

    assert set(servers) == {"acme_catalog"}
    assert servers["acme_catalog"].url == VALID_URL


def test_the_shipped_default_is_empty() -> None:
    """
    Superset enables no server of its own.

    Guards the promise that installing Superset connects it to nothing: this is
    the setting that would have to be non-empty for that to stop being true.
    """
    assert current_app.config["AI_AGENT_MCP_SERVERS"] == {}


# --------------------------------------------------------------------------- #
# Defaults and full parse
# --------------------------------------------------------------------------- #


def test_a_minimal_server_takes_the_documented_defaults() -> None:
    """A URL is the only required setting."""
    from superset.ai.mcp.config import (
        DEFAULT_TIMEOUT_SECONDS,
        TRANSPORT_STREAMABLE_HTTP,
    )

    server = _parse({"acme_catalog": {"url": VALID_URL}})["acme_catalog"]

    assert server.name == "acme_catalog"
    assert server.transport == TRANSPORT_STREAMABLE_HTTP
    assert server.headers == {}
    assert server.timeout_seconds == DEFAULT_TIMEOUT_SECONDS
    # Absent means "every tool the server offers", which is a different thing
    # from an empty allowlist meaning "none".
    assert server.tool_allowlist is None
    assert server.tool_denylist == ()


def test_every_documented_setting_round_trips() -> None:
    """The shape in the config comment is the shape that parses."""
    server = _parse(
        {
            "acme_catalog": {
                "url": VALID_URL,
                "transport": "sse",
                "headers": {"Authorization": "Bearer secret"},
                "timeout_seconds": 12,
                "tool_allowlist": ["search_tables"],
                "tool_denylist": ["drop_everything"],
            }
        }
    )["acme_catalog"]

    assert server.transport == "sse"
    assert server.headers == {"Authorization": "Bearer secret"}
    assert server.timeout_seconds == 12.0
    assert server.tool_allowlist == ("search_tables",)
    assert server.tool_denylist == ("drop_everything",)


# --------------------------------------------------------------------------- #
# Rejections, each naming the server
# --------------------------------------------------------------------------- #


def test_a_non_dict_setting_is_refused() -> None:
    """The setting maps a name to settings; a list cannot."""
    assert "AI_AGENT_MCP_SERVERS must be a dict" in _error_for(["acme_catalog"])


@pytest.mark.parametrize("value", ["https://mcp.acme.internal", 42, ["url"], None])
def test_a_non_dict_server_value_is_refused(value: Any) -> None:
    """
    A bare URL where a settings dict belongs is refused.

    Tempting to accept as a shorthand, but then ``headers`` and
    ``tool_allowlist`` have nowhere to live and the shorthand becomes the shape
    people copy.
    """
    message = _error_for({"acme_catalog": value})
    assert "acme_catalog" in message


def test_a_missing_url_is_refused() -> None:
    message = _error_for({"acme_catalog": {"transport": "sse"}})
    assert "acme_catalog" in message
    assert "url" in message


@pytest.mark.parametrize("url", ["", None, "   /mcp", "mcp.acme.internal/mcp"])
def test_an_unusable_url_is_refused(url: Any) -> None:
    """A URL that is not absolute cannot be connected to."""
    assert "acme_catalog" in _error_for({"acme_catalog": {"url": url}})


@pytest.mark.parametrize("url", ["file:///etc/passwd", "ftp://host/mcp"])
def test_a_non_http_scheme_is_refused(url: str) -> None:
    """
    Only HTTP(S) may be reached.

    Without this a mistyped setting turns every tool call into a local file
    read, which is a considerably more interesting bug than a broken catalog.
    """
    message = _error_for({"acme_catalog": {"url": url}})
    assert "acme_catalog" in message
    assert "http" in message


def test_an_unknown_transport_is_refused() -> None:
    """The message lists what is accepted, since the answer is short."""
    message = _error_for({"acme_catalog": {"url": VALID_URL, "transport": "stdio"}})
    assert "acme_catalog" in message
    assert "streamable_http" in message
    assert "sse" in message


def test_an_unknown_key_is_refused() -> None:
    """
    A typo in a security-relevant key must not be ignored.

    ``tool_allowlist`` misspelled as ``tool_allow_list`` would otherwise mean
    every tool the server offers, silently.
    """
    message = _error_for(
        {"acme_catalog": {"url": VALID_URL, "tool_allow_list": ["search_tables"]}}
    )
    assert "acme_catalog" in message
    assert "tool_allow_list" in message
    assert "tool_allowlist" in message


@pytest.mark.parametrize("timeout", [0, -1, "30", True, [30]])
def test_an_unusable_timeout_is_refused(timeout: Any) -> None:
    """
    A timeout must be a positive number.

    ``True`` is included deliberately: it is an ``int`` subclass, so a config
    that says ``"timeout_seconds": True`` would otherwise mean one second.
    """
    assert "acme_catalog" in _error_for(
        {"acme_catalog": {"url": VALID_URL, "timeout_seconds": timeout}}
    )


def test_an_absent_timeout_takes_the_default() -> None:
    """``None`` means "use the default" rather than being an error."""
    from superset.ai.mcp.config import DEFAULT_TIMEOUT_SECONDS

    server = _parse({"acme_catalog": {"url": VALID_URL, "timeout_seconds": None}})

    assert server["acme_catalog"].timeout_seconds == DEFAULT_TIMEOUT_SECONDS


@pytest.mark.parametrize(
    "headers",
    [["Authorization: Bearer x"], "Bearer x", {"Authorization": 42}, {7: "x"}],
)
def test_unusable_headers_are_refused(headers: Any) -> None:
    """Headers go on the wire, so they have to be a flat string mapping."""
    assert "acme_catalog" in _error_for(
        {"acme_catalog": {"url": VALID_URL, "headers": headers}}
    )


@pytest.mark.parametrize("key", ["tool_allowlist", "tool_denylist"])
@pytest.mark.parametrize("value", ["search_tables", 42, ["search_tables", ""]])
def test_unusable_tool_lists_are_refused(key: str, value: Any) -> None:
    """
    A bare string is refused rather than treated as one name.

    Python would happily iterate it into characters, which is exactly the sort
    of allowlist that matches nothing and looks fine.
    """
    message = _error_for({"acme_catalog": {"url": VALID_URL, key: value}})
    assert "acme_catalog" in message
    assert key in message


@pytest.mark.parametrize("name", ["", "acme catalog", "acme.catalog", "-acme", 42])
def test_an_unusable_server_name_is_refused(name: Any) -> None:
    """The name becomes part of a tool name, so it has to be a plain token."""
    assert _error_for({name: {"url": VALID_URL}})


def test_a_server_name_containing_the_separator_is_refused() -> None:
    """
    A double underscore would make the namespaced tool name ambiguous.

    ``mcp__a__b__c`` cannot be split back into a server and a tool, and the
    policy layer relies on being able to.
    """
    message = _error_for({"acme__catalog": {"url": VALID_URL}})
    assert "acme__catalog" in message
    assert "ambiguous" in message


# --------------------------------------------------------------------------- #
# Tool naming
# --------------------------------------------------------------------------- #


def test_a_tool_name_is_namespaced_by_its_server() -> None:
    """The documented, stable scheme operators paste into an allowlist."""
    from superset.ai.mcp.config import namespaced_tool_name

    assert (
        namespaced_tool_name("acme_catalog", "search_tables")
        == "mcp__acme_catalog__search_tables"
    )


def test_a_namespaced_name_splits_back_and_a_builtin_does_not() -> None:
    """
    The prefix is what tells a foreign tool from a built-in one.

    :class:`~superset.ai.policy.ForeignToolPolicy` decides whether to apply
    itself on this answer, so a built-in must never look foreign.
    """
    from superset.ai.mcp.config import is_foreign_tool_name, split_foreign_tool_name

    assert split_foreign_tool_name("mcp__acme_catalog__search_tables") == (
        "acme_catalog",
        "search_tables",
    )
    assert is_foreign_tool_name("mcp__acme_catalog__search_tables")

    for builtin in ("execute_sql", "search_assets", "get_schema"):
        assert split_foreign_tool_name(builtin) is None
        assert not is_foreign_tool_name(builtin)


@pytest.mark.parametrize("name", ["mcp__", "mcp__acme", "mcp__acme__", "mcp____tool"])
def test_a_malformed_namespaced_name_does_not_split(name: str) -> None:
    """Half a namespaced name is not a foreign tool reference."""
    from superset.ai.mcp.config import split_foreign_tool_name

    assert split_foreign_tool_name(name) is None


# --------------------------------------------------------------------------- #
# Allow and deny lists
# --------------------------------------------------------------------------- #


def test_an_absent_allowlist_takes_every_tool() -> None:
    from superset.ai.mcp.config import MCPServerConfig

    server = MCPServerConfig(name="acme_catalog", url=VALID_URL)

    assert server.offers("search_tables")
    assert server.offers("anything_at_all")


def test_an_allowlist_narrows_to_what_it_names() -> None:
    from superset.ai.mcp.config import MCPServerConfig

    server = MCPServerConfig(
        name="acme_catalog",
        url=VALID_URL,
        tool_allowlist=("search_tables",),
    )

    assert server.offers("search_tables")
    assert not server.offers("execute_sql")


def test_either_spelling_of_a_tool_name_matches() -> None:
    """
    The namespaced name works in a list too.

    It is the name an operator sees in a transcript, so it is the one they are
    most likely to paste back into configuration.
    """
    from superset.ai.mcp.config import MCPServerConfig

    server = MCPServerConfig(
        name="acme_catalog",
        url=VALID_URL,
        tool_allowlist=("mcp__acme_catalog__search_tables",),
    )

    assert server.offers("search_tables")
    assert not server.offers("execute_sql")


def test_the_denylist_wins_over_the_allowlist() -> None:
    """A name in both is refused; the safer reading of a contradiction."""
    from superset.ai.mcp.config import MCPServerConfig

    server = MCPServerConfig(
        name="acme_catalog",
        url=VALID_URL,
        tool_allowlist=("search_tables", "execute_sql"),
        tool_denylist=("execute_sql",),
    )

    assert server.offers("search_tables")
    assert not server.offers("execute_sql")


# --------------------------------------------------------------------------- #
# Resolving the servers a profile names
# --------------------------------------------------------------------------- #


def test_a_profile_may_reference_a_configured_server() -> None:
    from superset.ai.mcp.config import resolve_servers

    servers = _parse({"acme_catalog": {"url": VALID_URL}})

    resolved = resolve_servers(["acme_catalog"], servers)

    assert [server.name for server in resolved] == ["acme_catalog"]


def test_an_unknown_server_name_raises_rather_than_being_skipped() -> None:
    """
    A typo must not silently remove a capability.

    Skipping would present as a model that inexplicably stopped using a tool,
    which is close to undebuggable from the outside.
    """
    from superset.ai.mcp.config import MCPConfigurationError, resolve_servers

    servers = _parse({"acme_catalog": {"url": VALID_URL}})

    with pytest.raises(MCPConfigurationError) as caught:
        resolve_servers(["acme_catalogue"], servers)

    message = str(caught.value)
    assert "acme_catalogue" in message
    # The message says what *is* configured, which is how a typo gets spotted.
    assert "acme_catalog" in message
