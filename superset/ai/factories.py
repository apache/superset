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
Resolves the configured provider, runtime and tool registry.

Everything here is looked up per call rather than cached at import, so that a
deployment can change providers with a restart and a test can swap one with a
config patch. The cost is a dictionary lookup and a class instantiation, which
is negligible beside a model round trip.
"""

from __future__ import annotations

import logging
from typing import Any

from superset.ai.llm.base import BaseLLMProvider
from superset.ai.profiles import AgentProfile, build_profile_registry, ProfileRegistry
from superset.ai.runtime.base import BaseAgentRuntime

logger = logging.getLogger(__name__)


class AIAssistantNotConfiguredError(Exception):
    """
    The assistant is enabled but has no usable model provider.

    Raised rather than defaulted, because a default would mean Superset
    choosing a vendor on an operator's behalf.
    """


def is_configured() -> bool:
    """
    Whether the assistant can actually serve a request.

    The feature flag alone is not enough: a deployment that enables the flag
    without configuring a provider gets endpoints that 404 rather than
    endpoints that fail at inference time.
    """
    from flask import current_app

    from superset import is_feature_enabled

    if not is_feature_enabled("AI_ASSISTANT"):
        return False
    return bool(current_app.config.get("AI_LLM_PROVIDER_CLASS"))


def get_provider() -> BaseLLMProvider:
    """Instantiate the configured model provider."""
    from flask import current_app

    from superset.utils.class_utils import load_class_from_name

    path = current_app.config.get("AI_LLM_PROVIDER_CLASS")
    if not path:
        raise AIAssistantNotConfiguredError(
            "AI_LLM_PROVIDER_CLASS is not set. The AI assistant needs a model "
            "provider before it can answer anything."
        )

    provider_class = load_class_from_name(path)
    config: dict[str, Any] = dict(
        current_app.config.get("AI_LLM_PROVIDER_CONFIG") or {}
    )
    provider = provider_class(**config)
    if not isinstance(provider, BaseLLMProvider):
        raise AIAssistantNotConfiguredError(
            f"AI_LLM_PROVIDER_CLASS {path!r} is not a BaseLLMProvider subclass."
        )
    return provider


def get_runtime(provider: BaseLLMProvider | None = None) -> BaseAgentRuntime:
    """Instantiate the configured agent runtime."""
    from flask import current_app

    from superset.utils.class_utils import load_class_from_name

    path = current_app.config.get(
        "AI_AGENT_RUNTIME_CLASS",
        "superset.ai.runtime.messages.MessagesApiRuntime",
    )
    runtime_class = load_class_from_name(path)
    return runtime_class(provider or get_provider())


def get_profiles() -> ProfileRegistry:
    """
    Build the profile registry, validating tool names against the registry.

    Validation happens here rather than at import so a configuration mistake
    surfaces as a clear error on the first request instead of preventing the
    whole application from starting.
    """
    from superset.ai.tools.base import ALL_TOOL_NAMES

    return build_profile_registry(known_tools=set(ALL_TOOL_NAMES))


def get_tools_for_profile(profile: AgentProfile) -> Any:
    """
    Build the tool registry a profile is permitted to use.

    Built-in tools first, then any contributed by the external MCP servers the
    profile names. Returns ``None`` when the profile grants neither, which is a
    legitimate configuration: an assistant that only converses needs no tools.
    """
    from superset.ai.tools import build_registry, BUNDLE_ALL

    if not profile.tools and not profile.mcp_servers:
        return None

    registry = build_registry(BUNDLE_ALL).subset(profile.tools)
    for tool in _mcp_tools_for_profile(profile, taken=frozenset(registry.names())):
        registry.register(tool)
    return registry


def _mcp_tools_for_profile(profile: AgentProfile, taken: frozenset[str]) -> list[Any]:
    """
    Tools contributed by the external MCP servers a profile names.

    A profile naming an unconfigured server raises, because a typo there is
    indistinguishable at runtime from an agent that has lost a capability. A
    configured server that is simply unreachable does not raise: discovery
    degrades to an empty contribution, which is what keeps a third party's
    downtime from ending a turn.

    Imported locally so that a deployment configuring no servers never loads the
    MCP client — and so that this module stays importable without the SDK.
    """
    if not profile.mcp_servers:
        return []

    from superset.ai.mcp.config import resolve_servers
    from superset.ai.mcp.tools import discover_tools

    servers = resolve_servers(profile.mcp_servers)
    return discover_tools(servers, taken=taken)
