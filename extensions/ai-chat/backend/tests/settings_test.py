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
"""Parsing and validation of TOOL_APPROVAL_MODE.

These call ``get_tool_approval_mode`` with an explicit dict, which is the
same path the runtime takes after ``get_ai_chat_config`` has merged operator
overrides onto the shipped defaults.
"""

from __future__ import annotations

from typing import Any

import pytest
from enx_dev.ai_chat.exceptions import AiChatConfigurationError
from enx_dev.ai_chat.settings import (
    DEFAULT_TOOL_APPROVAL_MODE,
    DEPRECATED_APPROVAL_KEY,
    get_ai_chat_config,
    get_tool_approval_mode,
)
from enx_dev.ai_chat.types import ToolApprovalMode
from flask.ctx import AppContext


def test_default_mode_is_disabled(app_context: AppContext) -> None:
    """An operator who enables the assistant and says nothing about approval
    gets direct execution.

    Read through ``get_ai_chat_config`` rather than off the defaults dict,
    since that is the merge the runtime actually sees.
    """
    assert DEFAULT_TOOL_APPROVAL_MODE == ToolApprovalMode.DISABLED
    minimal = {**get_ai_chat_config(), "ENABLED": True, "PROVIDER": "mock"}
    assert get_tool_approval_mode(minimal) == ToolApprovalMode.DISABLED


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
    """No silent fallback in either direction: a misspelled mode is a
    configuration error, not a default."""
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
    """The old flag's False case gated destructive tools while letting plain
    mutations through, which no mode expresses. It resolves to the stricter
    of the two rather than quietly dropping that gate."""
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


def test_deprecated_key_survives_the_default_merge(app_context: AppContext) -> None:
    """The alias is reachable through the real configuration path.

    The shipped defaults carry TOOL_APPROVAL_MODE, so had they defaulted it
    to a mode rather than leaving it unset, the merge would mask the operator's
    deprecated key and the alias would never run.
    """
    from flask import current_app

    original = current_app.config["AI_CHAT_CONFIG"]
    current_app.config["AI_CHAT_CONFIG"] = {
        **original,
        DEPRECATED_APPROVAL_KEY: True,
    }
    try:
        assert get_tool_approval_mode() == ToolApprovalMode.MUTATIONS_ONLY
    finally:
        current_app.config["AI_CHAT_CONFIG"] = original
