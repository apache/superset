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
"""

from __future__ import annotations

from typing import Any

from flask import current_app

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
        # Modification workflows (destructive tools require approval with
        # an explicit warning in the UI)
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
    # When True, which is strongly recommended, every mutating or destructive
    # tool call requires a server-enforced, single-use user approval. Setting
    # it to False lifts the requirement for mutating tools only; destructive
    # tools always require approval.
    "REQUIRE_APPROVAL_FOR_MUTATIONS": True,
}


def get_ai_chat_config() -> dict[str, Any]:
    """Return the shipped defaults merged with operator overrides."""
    configured = current_app.config.get("AI_CHAT_CONFIG") or {}
    return {**DEFAULT_AI_CHAT_CONFIG, **configured}
