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
Agent profiles: named configurations a user can choose between.

A profile bundles the decisions that differ between "answer a quick question"
and "do a careful multi-step analysis": which tools are on the table, which
model tier, how many steps, and which permission a user needs to select it.

Every field is settable from ``AI_AGENT_PROFILES`` in ``superset_config.py``,
because which tools an LLM may invoke is a decision each deployment has to make
for itself — and one they must be able to make without patching Superset.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field, replace
from typing import Any

from superset.ai.llm.base import ModelAlias

logger = logging.getLogger(__name__)

#: Profile selected when a request names none.
DEFAULT_PROFILE_KEY = "default"


class AgentProfileError(Exception):
    """A profile is not usable as configured."""


@dataclass(frozen=True)
class AgentProfile:
    """One selectable agent configuration."""

    key: str
    name: str
    description: str = ""
    #: Tool names this profile may invoke. An empty tuple means no tools, which
    #: is a legitimate configuration: a deployment that wants conversation
    #: without warehouse access sets exactly that.
    tools: tuple[str, ...] = ()
    model_alias: ModelAlias = ModelAlias.DEFAULT
    #: Pin a concrete model. ``None`` leaves the choice to ``model_alias``.
    model: str | None = None
    #: ``None`` defers to ``AI_AGENT_MAX_TURNS``.
    max_turns: int | None = None
    #: ``None`` defers to ``AI_AGENT_TIMEOUT_SECONDS``.
    timeout_seconds: float | None = None
    #: Extra prompt section keys to include for this profile.
    knowledge_domains: tuple[str, ...] = ()
    #: Names of servers in ``AI_AGENT_MCP_SERVERS`` whose tools this profile may
    #: also use, namespaced ``mcp__<server>__<tool>``. Empty for every built-in
    #: profile, because Superset ships no third-party integration; a deployment
    #: that wants one names its own servers here.
    mcp_servers: tuple[str, ...] = ()
    #: FAB ``(permission, view)`` a user must hold to select this profile.
    #: ``None`` means any user who can use the assistant at all.
    required_permission: tuple[str, str] | None = None
    #: Feature flag gating this profile beyond ``AI_ASSISTANT``.
    feature_flag: str | None = None

    def to_public_dict(self) -> dict[str, Any]:
        """
        Shape returned to the browser.

        Deliberately excludes ``required_permission`` and ``feature_flag``:
        gating is resolved server-side, and echoing the rules back invites a
        client to try to reason about them.
        """
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "tools": list(self.tools),
        }


#: Shipped profiles. Two, because the meaningful distinction is between a quick
#: answer and a thorough investigation; more than that is a configuration
#: decision rather than something Superset should presume.
BUILTIN_PROFILES: tuple[AgentProfile, ...] = (
    AgentProfile(
        key=DEFAULT_PROFILE_KEY,
        name="Assistant",
        description=(
            "Answers questions about your data, finds the right dataset, and "
            "runs read-only queries."
        ),
        tools=(
            "search_assets",
            "list_databases",
            "get_schema",
            "execute_sql",
            "validate_sql",
            "get_chart_context",
            "get_dashboard_context",
        ),
        model_alias=ModelAlias.DEFAULT,
    ),
    AgentProfile(
        key="analyst",
        name="Analyst",
        description=(
            "Takes more steps and reasons harder. Slower, but better on "
            "multi-step questions."
        ),
        tools=(
            "search_assets",
            "list_databases",
            "get_schema",
            "execute_sql",
            "validate_sql",
            "get_chart_context",
            "get_dashboard_context",
        ),
        model_alias=ModelAlias.REASONING,
        max_turns=40,
    ),
)


@dataclass
class ProfileRegistry:
    """Resolved profiles for the running deployment."""

    profiles: dict[str, AgentProfile] = field(default_factory=dict)

    def get(self, key: str | None, *, enforce_gates: bool = True) -> AgentProfile:
        """
        Resolve the profile a request may actually run with.

        Gating is enforced here, not only in :meth:`visible_to_current_user`. The
        listing endpoint and the run path are different code paths, and if only
        the listing consulted the gate then posting a hidden profile's key would
        grant its tools, model tier and turn budget to a user who was never
        offered it.

        An unusable key downgrades to a permitted profile rather than raising:
        a stale client naming a profile that has since been reconfigured, and a
        caller probing for a gated one, should both simply get the assistant they
        are entitled to.

        ``enforce_gates=False`` exists for callers that already know the
        principal is entitled — pass it only when that is genuinely true.
        """
        if key:
            candidate = self.profiles.get(key)
            if candidate is not None and self._usable(candidate, enforce_gates):
                return candidate
            if candidate is not None:
                logger.info(
                    "Downgrading AI agent profile %r: not permitted for this user",
                    key,
                )

        default = self.profiles.get(DEFAULT_PROFILE_KEY)
        if default is not None and self._usable(default, enforce_gates):
            return default

        for profile in self.profiles.values():
            if self._usable(profile, enforce_gates):
                return profile

        raise AgentProfileError(
            "No AI agent profile is available to this user."
            if self.profiles
            else "No AI agent profiles are configured."
        )

    def visible_to_current_user(self) -> list[AgentProfile]:
        """Profiles the current user is allowed to select."""
        return [p for p in self.profiles.values() if _is_permitted(p)]

    def _usable(self, profile: AgentProfile, enforce_gates: bool) -> bool:
        """Whether this profile may be run for the current principal."""
        return not enforce_gates or _is_permitted(profile)


def build_profile_registry(
    overrides: dict[str, Any] | None = None,
    known_tools: set[str] | None = None,
) -> ProfileRegistry:
    """
    Merge configured profiles over the built-ins.

    ``AI_AGENT_PROFILES`` maps a profile key to a dict of fields to override, so
    a deployment can narrow the default profile's tool list without restating
    everything else:

        AI_AGENT_PROFILES = {
            "default": {"tools": ["search_assets", "get_schema"]},
            "analyst": {"model_alias": "reasoning", "max_turns": 60},
            "readonly": {
                "name": "Read only",
                "tools": ["search_assets"],
            },
        }

    Passing ``known_tools`` validates every referenced tool name, so a typo is a
    startup error rather than an agent that silently lacks a capability.
    """
    from flask import current_app

    if overrides is None:
        overrides = current_app.config.get("AI_AGENT_PROFILES") or {}

    profiles = {profile.key: profile for profile in BUILTIN_PROFILES}

    for key, override in overrides.items():
        if not isinstance(override, dict):
            raise AgentProfileError(
                f"AI_AGENT_PROFILES[{key!r}] must be a dict of profile fields."
            )
        base = profiles.get(key) or AgentProfile(key=key, name=key)
        profiles[key] = _apply_override(base, override)

    if known_tools is not None:
        _validate_tools(profiles, known_tools)

    return ProfileRegistry(profiles=profiles)


def _apply_override(base: AgentProfile, override: dict[str, Any]) -> AgentProfile:
    """Coerce a config dict onto a profile, rejecting unknown fields."""
    allowed = {f for f in AgentProfile.__dataclass_fields__ if f != "key"}
    if unknown := set(override) - allowed:
        raise AgentProfileError(
            f"Unknown AI agent profile field(s) for {base.key!r}: "
            f"{', '.join(sorted(unknown))}"
        )

    values = dict(override)
    if "tools" in values:
        values["tools"] = tuple(values["tools"])
    if "knowledge_domains" in values:
        values["knowledge_domains"] = tuple(values["knowledge_domains"])
    if "mcp_servers" in values:
        values["mcp_servers"] = tuple(values["mcp_servers"])
    if "required_permission" in values and values["required_permission"] is not None:
        permission = tuple(values["required_permission"])
        if len(permission) != 2:
            raise AgentProfileError(
                f"required_permission for {base.key!r} must be "
                f"(permission_name, view_name)."
            )
        values["required_permission"] = permission
    if "model_alias" in values:
        # Accept the plain string a config file would naturally contain.
        try:
            values["model_alias"] = ModelAlias(values["model_alias"])
        except ValueError as ex:
            raise AgentProfileError(
                f"Unknown model_alias for {base.key!r}: "
                f"{values['model_alias']!r}. Expected one of "
                f"{', '.join(a.value for a in ModelAlias)}."
            ) from ex

    return replace(base, **values)


def _validate_tools(profiles: dict[str, AgentProfile], known: set[str]) -> None:
    """Fail loudly on a tool name no tool answers to."""
    for profile in profiles.values():
        unknown = set(profile.tools) - known
        if unknown:
            raise AgentProfileError(
                f"AI agent profile {profile.key!r} references unknown tool(s): "
                f"{', '.join(sorted(unknown))}. Available: "
                f"{', '.join(sorted(known))}."
            )


def _is_permitted(profile: AgentProfile) -> bool:
    """Whether the current user may select this profile."""
    from superset import security_manager
    from superset.extensions import feature_flag_manager

    if profile.feature_flag and not feature_flag_manager.is_feature_enabled(
        profile.feature_flag
    ):
        return False
    if profile.required_permission is None:
        return True
    permission, view = profile.required_permission
    return bool(security_manager.can_access(permission, view))
