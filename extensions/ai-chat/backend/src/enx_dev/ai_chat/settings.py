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
"""AI chat gateway defaults and resolved configuration.

The defaults ship with the extension, and :func:`get_ai_chat_config` merges
whatever the operator put in ``AI_CHAT_CONFIG`` over them. That makes a
minimal enablement possible -- ``{"ENABLED": True, "PROVIDER": "mock"}`` keeps
the curated tool allowlist and the size limits intact -- and it means Superset
itself carries no default for a key it knows nothing about.

This is also where ``TOOL_APPROVAL_MODE`` is parsed and validated, so the rest
of the gateway asks for a :class:`ToolApprovalMode` and never re-reads or
re-interprets the raw configuration value.
"""

from __future__ import annotations

import logging
from typing import Any

from enx_dev.ai_chat.exceptions import AiChatConfigurationError
from enx_dev.ai_chat.types import ToolApprovalMode
from flask import current_app

logger = logging.getLogger(__name__)

DEFAULT_AI_CHAT_CONFIG: dict[str, Any] = {
    # Master switch for the AI chat gateway endpoints
    "ENABLED": False,
    # One of "mock", "openai_compatible", "anthropic". The mock provider is
    # deterministic and needs no credentials, for development and tests.
    "PROVIDER": "mock",
    # Model identifier passed to the provider, e.g. "gpt-4o-mini" or
    # "claude-sonnet-4-5". Ignored by the mock provider.
    "MODEL": None,
    # Name of the environment variable holding the provider API key, e.g.
    # "OPENAI_API_KEY" or "ANTHROPIC_API_KEY". The key itself is never stored
    # in configuration and never sent to the browser.
    "API_KEY_ENV_VAR": None,
    # Provider base URL override, defaulting per provider to
    # https://api.openai.com/v1 or https://api.anthropic.com. Operator
    # configurable only, never taken from the request.
    "BASE_URL": None,
    # Hard limits applied to every request
    "MAX_INPUT_CHARS": 100_000,
    "MAX_OUTPUT_TOKENS": 4096,
    "MAX_MESSAGES_PER_REQUEST": 80,
    "MAX_TOOL_CALLS_PER_TURN": 8,
    "MAX_TOOL_OUTPUT_CHARS": 50_000,
    "REQUEST_TIMEOUT_SECONDS": 120,
    # Seconds a mutation approval stays valid before expiring
    "APPROVAL_TTL_SECONDS": 300,
    # Explicit allowlist of MCP tools the assistant may see and call. Tools
    # outside this list are invisible to the model, and an empty list leaves a
    # chat-only assistant with no MCP tool use at all.
    "ALLOWED_MCP_TOOLS": [
        # Discovery and read-only inspection
        "list_dashboards",
        "get_dashboard_info",
        "get_dashboard_layout",
        "get_dashboard_datasets",
        "list_charts",
        "get_chart_info",
        "get_chart_data",
        "list_datasets",
        "get_dataset_info",
        "query_dataset",
        "list_databases",
        "get_database_info",
        "list_metrics",
        "get_table",
        "generate_explore_link",
        "get_instance_info",
        # Creation workflows
        "generate_chart",
        "generate_dashboard",
        "create_virtual_dataset",
        "add_chart_to_existing_dashboard",
        # Modification workflows (gated behind an approval, with an explicit
        # warning in the UI, in every mode but "disabled")
        "update_chart",
        "update_dashboard",
        "manage_native_filters",
        "remove_chart_from_dashboard",
        "delete_chart",
        "delete_dashboard",
        # SQL assistance (execute_sql itself blocks destructive DDL and
        # honors the per-database allow_dml flag)
        "execute_sql",
    ],
    # "disabled", "mutations_only" or "all_tools"; see ToolApprovalMode. Left
    # unset rather than defaulted so the merge cannot mask an operator's
    # deprecated REQUIRE_APPROVAL_FOR_MUTATIONS.
    "TOOL_APPROVAL_MODE": None,
}

#: What an operator who configures nothing gets: direct execution.
DEFAULT_TOOL_APPROVAL_MODE = ToolApprovalMode.DISABLED

#: Superseded by TOOL_APPROVAL_MODE. Read only when the new key is unset.
DEPRECATED_APPROVAL_KEY = "REQUIRE_APPROVAL_FOR_MUTATIONS"


def get_ai_chat_config() -> dict[str, Any]:
    """Return the shipped defaults merged with operator overrides."""
    configured = current_app.config.get("AI_CHAT_CONFIG") or {}
    return {**DEFAULT_AI_CHAT_CONFIG, **configured}


def get_tool_approval_mode(config: dict[str, Any] | None = None) -> ToolApprovalMode:
    """Resolve and validate the configured approval mode.

    An unrecognized value raises rather than falling back: a misspelled mode
    must not silently become a different security posture, in either
    direction.
    """
    config = get_ai_chat_config() if config is None else config
    raw = config.get("TOOL_APPROVAL_MODE")
    if raw is None:
        return _mode_from_deprecated_key(config)
    try:
        return ToolApprovalMode(raw)
    except ValueError as ex:
        # The bad value goes to the log, where the operator who can fix it
        # looks, rather than to the browser.
        logger.error(
            "AI_CHAT_CONFIG['TOOL_APPROVAL_MODE'] is %r, which is not a "
            "recognized approval mode. Valid values are: %s.",
            raw,
            ", ".join(mode.value for mode in ToolApprovalMode),
        )
        raise AiChatConfigurationError(
            "The AI chat tool approval mode is not configured correctly. "
            "Please contact an administrator."
        ) from ex


def _mode_from_deprecated_key(config: dict[str, Any]) -> ToolApprovalMode:
    """Translate the superseded REQUIRE_APPROVAL_FOR_MUTATIONS flag.

    ``True`` is exactly ``mutations_only``. ``False`` gated destructive tools
    while letting plain mutations through, which no mode expresses, so it
    resolves to the stricter neighbour rather than quietly ungating them.
    """
    if config.get(DEPRECATED_APPROVAL_KEY) is None:
        return DEFAULT_TOOL_APPROVAL_MODE

    required = bool(config[DEPRECATED_APPROVAL_KEY])
    logger.warning(
        "AI_CHAT_CONFIG['%s'] is deprecated and will be removed; set "
        "'TOOL_APPROVAL_MODE' to one of %s instead.%s",
        DEPRECATED_APPROVAL_KEY,
        ", ".join(repr(mode.value) for mode in ToolApprovalMode),
        ""
        if required
        else (
            f" {DEPRECATED_APPROVAL_KEY}=False gated destructive tools while "
            "letting plain mutations through, which no mode expresses; "
            "'mutations_only' is being used so nothing is ungated silently."
        ),
    )
    return ToolApprovalMode.MUTATIONS_ONLY
