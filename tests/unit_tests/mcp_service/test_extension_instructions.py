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
"""Guidance extensions add to the MCP server's instructions."""

from collections.abc import Iterator
from contextlib import nullcontext
from unittest.mock import MagicMock, patch

import mcp.types as mt
import pytest

from superset.core.mcp import instructions
from superset.extensions.context import extension_context, get_context
from superset.mcp_service.app import get_default_instructions, init_fastmcp_server
from superset.mcp_service.middleware import ExtensionInstructionsMiddleware
from tests.unit_tests.extensions.storage.conftest import create_manifest


@pytest.fixture(autouse=True)
def no_contributions() -> Iterator[None]:
    instructions.reset()
    yield
    instructions.reset()


def contribute(source: instructions.InstructionsSource, name: str = "boards") -> None:
    with extension_context(create_manifest("acme", name)):
        instructions.contribute_instructions(source)


def test_an_extension_contributes_while_it_loads_and_nobody_else_can() -> None:
    with pytest.raises(RuntimeError, match="by an extension"):
        instructions.contribute_instructions("Use the board tools.")
    with pytest.raises(TypeError):
        contribute(42)  # type: ignore[arg-type]
    assert instructions.extension_guidance() == ""


def test_the_host_injects_its_contribute_instructions() -> None:
    import superset_core.mcp.instructions as core_instructions

    from superset.core.mcp.core_mcp_injection import inject_mcp_instructions

    with patch.object(core_instructions, "contribute_instructions"):
        inject_mcp_instructions()
        assert (
            core_instructions.contribute_instructions
            is instructions.contribute_instructions
        )


def test_each_extensions_guidance_is_listed_under_its_id() -> None:
    contribute("Use the board tools for a board\nthe user names.")
    contribute(lambda: "Ask before deleting a deck.", name="decks")

    assert instructions.extension_guidance() == (
        f"{instructions.HEADING}\n"
        "- acme.boards:\n"
        "  Use the board tools for a board\n"
        "  the user names.\n"
        "- acme.decks:\n"
        "  Ask before deleting a deck.\n\n"
    )


def test_a_callable_is_asked_each_time_in_its_extensions_context() -> None:
    answers = iter(["First.", None, ""])
    seen: list[str] = []

    def guidance() -> str | None:
        seen.append(get_context().extension.id)
        return next(answers)

    contribute(guidance)

    assert "First." in instructions.extension_guidance()
    assert instructions.extension_guidance() == ""
    assert instructions.extension_guidance() == ""
    assert seen == ["acme.boards"] * 3
    assert instructions.has_dynamic_contributions()


def test_a_callable_that_fails_adds_nothing() -> None:
    def guidance() -> str:
        raise RuntimeError("the provider is down")

    contribute(guidance)
    contribute("Static guidance.", name="decks")

    assert instructions.extension_guidance() == (
        f"{instructions.HEADING}\n- acme.decks:\n  Static guidance.\n\n"
    )


def test_the_default_instructions_are_the_hosts_own_without_contributions() -> None:
    default = get_default_instructions("Superset")

    assert default == get_default_instructions("Superset", extension_guidance="")
    assert instructions.HEADING not in default


def test_the_guidance_follows_the_hosts_rules_which_stay_as_they_are() -> None:
    default = get_default_instructions("Superset")
    contribute("Write boards with the board tools.")

    with_notes = get_default_instructions("Superset")

    notes = instructions.extension_guidance()
    assert with_notes == default.replace(
        "\nGeneral usage tips:", f"\n{notes}General usage tips:"
    )
    rules = with_notes.index("IMPORTANT - Tool-Only Interaction:")
    assert rules < with_notes.index(instructions.HEADING)
    assert "Do NOT generate code artifacts" in with_notes


def _mock_flask_app() -> MagicMock:
    mock = MagicMock()
    mock.config.get.side_effect = lambda key, default=None: (
        "Superset"
        if key == "APP_NAME"
        else set()
        if key == "MCP_DISABLED_TOOLS"
        else default
    )
    return mock


def _init() -> MagicMock:
    """The global MCP instance as init_fastmcp_server configures it."""
    with patch.dict(
        "sys.modules",
        {"superset.mcp_service.flask_singleton": MagicMock(app=_mock_flask_app())},
    ):
        with patch("superset.mcp_service.app.mcp") as mock_mcp:
            init_fastmcp_server()
    return mock_mcp


def _session_middleware(mock_mcp: MagicMock) -> list[ExtensionInstructionsMiddleware]:
    return [
        call.args[0]
        for call in mock_mcp.add_middleware.call_args_list
        if isinstance(call.args[0], ExtensionInstructionsMiddleware)
    ]


def test_static_guidance_goes_into_the_servers_instructions() -> None:
    contribute("Write boards with the board tools.")

    mock_mcp = _init()

    assert "Write boards with the board tools." in mock_mcp._mcp_server.instructions
    assert _session_middleware(mock_mcp) == []


def test_guidance_that_can_change_is_read_for_each_session() -> None:
    enabled = MagicMock(return_value=False)
    contribute(lambda: "Write boards." if enabled() else None)

    mock_mcp = _init()

    assert instructions.HEADING not in mock_mcp._mcp_server.instructions
    [middleware] = _session_middleware(mock_mcp)
    enabled.return_value = True
    assert "Write boards." in middleware._build()


def _initialize_result(text: str) -> mt.InitializeResult:
    return mt.InitializeResult(
        protocolVersion="2025-06-18",
        capabilities=mt.ServerCapabilities(),
        serverInfo=mt.Implementation(name="Superset MCP Server", version="1"),
        instructions=text,
    )


async def _initialize(
    middleware: ExtensionInstructionsMiddleware,
) -> mt.InitializeResult | None:
    async def call_next(_context: object) -> mt.InitializeResult:
        return _initialize_result("the server's own")

    with patch(
        "superset.mcp_service.middleware._get_app_context_manager",
        return_value=nullcontext(),
    ):
        return await middleware.on_initialize(MagicMock(), call_next)


@pytest.mark.asyncio
async def test_a_session_gets_the_instructions_as_they_are_when_it_starts() -> None:
    result = await _initialize(ExtensionInstructionsMiddleware(lambda: "now"))

    assert result is not None
    assert result.instructions == "now"
    assert result.serverInfo.name == "Superset MCP Server"


@pytest.mark.asyncio
async def test_a_session_keeps_the_servers_instructions_when_building_fails() -> None:
    def build() -> str:
        raise RuntimeError("broken")

    result = await _initialize(ExtensionInstructionsMiddleware(build))

    assert result is not None
    assert result.instructions == "the server's own"
