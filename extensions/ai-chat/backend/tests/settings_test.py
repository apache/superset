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
"""Parsing and validation of TOOL_APPROVAL_MODE."""

from __future__ import annotations

from typing import Any

import pytest
from enx_dev.ai_chat.exceptions import AiChatConfigurationError
from enx_dev.ai_chat.settings import (
    DEFAULT_AI_CHAT_CONFIG,
    DEFAULT_TOOL_APPROVAL_MODE,
    DEPRECATED_APPROVAL_KEY,
    get_tool_approval_mode,
)
from enx_dev.ai_chat.types import ToolApprovalMode


def merged(**operator: Any) -> dict[str, Any]:
    """What ``get_ai_chat_config`` builds for a given operator override.

    Built here rather than read from the application, so these do not depend
    on whatever the developer's own ``superset_config.py`` happens to set.
    """
    return {**DEFAULT_AI_CHAT_CONFIG, **operator}


def test_default_mode_is_disabled() -> None:
    """Enabling the assistant and saying nothing about approval gets direct
    execution."""
    assert DEFAULT_TOOL_APPROVAL_MODE == ToolApprovalMode.DISABLED
    assert (
        get_tool_approval_mode(merged(ENABLED=True, PROVIDER="mock"))
        == ToolApprovalMode.DISABLED
    )


@pytest.mark.parametrize(
    "value,expected",
    [
        ("disabled", ToolApprovalMode.DISABLED),
        ("mutations_only", ToolApprovalMode.MUTATIONS_ONLY),
        ("all_tools", ToolApprovalMode.ALL_TOOLS),
    ],
)
def test_documented_values_are_accepted(value: str, expected: ToolApprovalMode) -> None:
    assert get_tool_approval_mode({"TOOL_APPROVAL_MODE": value}) == expected


@pytest.mark.parametrize(
    "value",
    [
        "Disabled",  # modes are lower case
        "mutations",  # nearly right
        "enabled",  # plausible but not a mode
        "",
        True,
        0,
        ["mutations_only"],
    ],
)
def test_invalid_values_are_rejected(value: Any) -> None:
    """A misspelled mode is a configuration error, not a default."""
    with pytest.raises(AiChatConfigurationError):
        get_tool_approval_mode({"TOOL_APPROVAL_MODE": value})


def test_invalid_value_is_not_echoed_to_the_browser() -> None:
    with pytest.raises(AiChatConfigurationError) as excinfo:
        get_tool_approval_mode({"TOOL_APPROVAL_MODE": "not-a-mode"})
    assert "not-a-mode" not in excinfo.value.message


def test_deprecated_flag_true_maps_to_mutations_only() -> None:
    """The old flag's True case is exactly today's mutations_only."""
    assert (
        get_tool_approval_mode({DEPRECATED_APPROVAL_KEY: True})
        == ToolApprovalMode.MUTATIONS_ONLY
    )


def test_deprecated_flag_false_does_not_ungate_destructive_tools() -> None:
    """The old False gated destructive tools while letting plain mutations
    through, which no mode expresses, so it resolves to the stricter one."""
    assert (
        get_tool_approval_mode({DEPRECATED_APPROVAL_KEY: False})
        == ToolApprovalMode.MUTATIONS_ONLY
    )


def test_deprecated_flag_warns_with_the_key_to_migrate_to(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level("WARNING"):
        get_tool_approval_mode({DEPRECATED_APPROVAL_KEY: True})
    assert DEPRECATED_APPROVAL_KEY in caplog.text
    assert "TOOL_APPROVAL_MODE" in caplog.text


def test_new_key_wins_over_the_deprecated_one() -> None:
    """Two competing settings do not fight: the new one decides."""
    assert (
        get_tool_approval_mode(
            {
                "TOOL_APPROVAL_MODE": "all_tools",
                DEPRECATED_APPROVAL_KEY: False,
            }
        )
        == ToolApprovalMode.ALL_TOOLS
    )


def test_neither_key_present_is_disabled() -> None:
    assert get_tool_approval_mode({}) == ToolApprovalMode.DISABLED


def test_deprecated_key_survives_the_default_merge() -> None:
    """The alias is reachable once the shipped defaults are merged in.

    Had they named a mode rather than leaving it unset, the merge would mask
    the operator's deprecated key and the alias would never run.
    """
    assert (
        get_tool_approval_mode(merged(**{DEPRECATED_APPROVAL_KEY: True}))
        == ToolApprovalMode.MUTATIONS_ONLY
    )
