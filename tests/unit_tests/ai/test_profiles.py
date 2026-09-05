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
"""Tests for the selectable agent profiles and how configuration reshapes them."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

import pytest
from flask import current_app
from pytest_mock import MockerFixture

if TYPE_CHECKING:
    from superset.ai.profiles import AgentProfile, ProfileRegistry


def _known_tools() -> set[str]:
    """
    The names real tools answer to.

    Taken from the tool registry rather than restated here, so a test cannot
    validate against a tool that does not exist.
    """
    from superset.ai.tools.base import ALL_TOOL_NAMES

    return set(ALL_TOOL_NAMES)


def _build(overrides: dict[str, Any], **kwargs: Any) -> ProfileRegistry:
    """Build a registry from explicit overrides, bypassing config."""
    from superset.ai.profiles import build_profile_registry

    return build_profile_registry(overrides, **kwargs)


def _profile(**kwargs: Any) -> AgentProfile:
    from superset.ai.profiles import AgentProfile

    kwargs.setdefault("key", "gated")
    kwargs.setdefault("name", "Gated")
    return AgentProfile(**kwargs)


def _registry_of(*profiles: AgentProfile) -> ProfileRegistry:
    from superset.ai.profiles import ProfileRegistry

    return ProfileRegistry(profiles={profile.key: profile for profile in profiles})


def test_builtin_profiles_are_available_without_configuration() -> None:
    """A deployment that configures nothing still gets usable profiles."""
    from superset.ai.llm.base import ModelAlias
    from superset.ai.profiles import build_profile_registry, DEFAULT_PROFILE_KEY

    registry = build_profile_registry({})

    assert set(registry.profiles) == {DEFAULT_PROFILE_KEY, "analyst"}
    assert registry.profiles[DEFAULT_PROFILE_KEY].key == DEFAULT_PROFILE_KEY
    assert registry.profiles[DEFAULT_PROFILE_KEY].model_alias is ModelAlias.DEFAULT
    assert registry.profiles["analyst"].model_alias is ModelAlias.REASONING
    # Every shipped profile names tools that actually exist, so a default
    # deployment passing the real tool registry cannot fail to start.
    build_profile_registry({}, known_tools=_known_tools())


@pytest.mark.parametrize("key", [None, "", "no-such-profile"])
def test_unknown_or_missing_key_resolves_to_the_default(key: str | None) -> None:
    """
    A request naming nothing, or something stale, still gets an answer.

    Falling back matters because a client may hold a profile key that the
    deployment has since reconfigured away; erroring would break the tab.
    """
    from superset.ai.profiles import DEFAULT_PROFILE_KEY

    assert _build({}).get(key).key == DEFAULT_PROFILE_KEY


def test_override_narrows_a_profile_without_restating_it() -> None:
    """
    Overriding one field leaves the rest of the profile intact.

    This is what makes "the shipped default, minus raw SQL" a two-line config
    change rather than a copy of the built-in definition that then rots.
    """
    from superset.ai.llm.base import ModelAlias
    from superset.ai.profiles import BUILTIN_PROFILES, DEFAULT_PROFILE_KEY

    registry = _build(
        {DEFAULT_PROFILE_KEY: {"tools": ["search_assets", "get_schema"]}},
        known_tools=_known_tools(),
    )
    profile = registry.get(DEFAULT_PROFILE_KEY)

    assert profile.tools == ("search_assets", "get_schema")
    assert profile.name == "Assistant"
    assert profile.description
    assert profile.model_alias is ModelAlias.DEFAULT

    # The built-in definition is shared module state; merging must not mutate it.
    builtin = next(p for p in BUILTIN_PROFILES if p.key == DEFAULT_PROFILE_KEY)
    assert "execute_sql" in builtin.tools


def test_override_can_define_a_brand_new_profile() -> None:
    """A key the built-ins never mention becomes a profile of its own."""
    registry = _build(
        {
            "readonly": {
                "name": "Read only",
                "description": "Finds things; runs nothing.",
                "tools": ["search_assets"],
            }
        },
        known_tools=_known_tools(),
    )
    profile = registry.get("readonly")

    assert profile.key == "readonly"
    assert profile.name == "Read only"
    assert profile.tools == ("search_assets",)
    # Unstated fields fall back to the dataclass defaults rather than to the
    # built-in default profile's values.
    assert profile.max_turns is None
    assert profile.required_permission is None


def test_model_alias_accepts_the_string_a_config_file_contains() -> None:
    """
    ``"reasoning"`` is coerced to the enum member.

    A config file is plain data; requiring an imported enum there would mean
    importing Superset internals into ``superset_config.py``.
    """
    from superset.ai.llm.base import ModelAlias

    registry = _build({"analyst": {"model_alias": "fast"}})
    assert registry.get("analyst").model_alias is ModelAlias.FAST

    registry = _build({"default": {"model_alias": ModelAlias.REASONING}})
    assert registry.get("default").model_alias is ModelAlias.REASONING


def test_unknown_model_alias_raises_and_lists_the_valid_ones() -> None:
    """The error tells the operator what to write instead of guessing."""
    from superset.ai.llm.base import ModelAlias
    from superset.ai.profiles import AgentProfileError

    with pytest.raises(AgentProfileError, match="Unknown model_alias") as excinfo:
        _build({"analyst": {"model_alias": "gpt-turbo-9000"}})

    message = str(excinfo.value)
    assert "gpt-turbo-9000" in message
    assert "analyst" in message
    for alias in ModelAlias:
        assert alias.value in message


def test_unknown_profile_field_names_the_offending_field() -> None:
    """A misspelled field is refused rather than silently dropped."""
    from superset.ai.profiles import AgentProfileError

    with pytest.raises(AgentProfileError, match="max_turnz"):
        _build({"analyst": {"max_turnz": 3}})


def test_key_cannot_be_overridden() -> None:
    """
    ``key`` is the map key, not a field.

    Allowing it would let one entry rename itself over another, so it is
    reported as an unknown field.
    """
    from superset.ai.profiles import AgentProfileError

    with pytest.raises(AgentProfileError, match="key"):
        _build({"analyst": {"key": "default"}})


@pytest.mark.parametrize("override", ["tools", ["search_assets"], 3, None])
def test_a_non_dict_override_is_refused(override: Any) -> None:
    """
    Each value must be a dict of fields.

    The natural mistake is writing a bare tool list, which would otherwise be
    accepted as "no overrides at all".
    """
    from superset.ai.profiles import AgentProfileError

    with pytest.raises(AgentProfileError, match="must be a dict"):
        _build({"analyst": override})


@pytest.mark.parametrize(
    "permission",
    [("can_write", "AIAssistant"), ["can_write", "AIAssistant"]],
)
def test_required_permission_accepts_a_pair(permission: Any) -> None:
    """A tuple or a list both mean the same FAB ``(permission, view)``."""
    registry = _build({"analyst": {"required_permission": permission}})
    # Gates skipped: this asserts coercion, and applying the gate here would
    # need a request context the coercion does not care about.
    profile = registry.get("analyst", enforce_gates=False)
    assert profile.required_permission == ("can_write", "AIAssistant")


@pytest.mark.parametrize(
    "permission",
    [("can_write",), ("can_write", "AIAssistant", "extra"), ()],
)
def test_required_permission_of_the_wrong_length_is_refused(permission: Any) -> None:
    """
    A malformed permission pair is fatal.

    Guessing at the operator's intent here would either over- or under-grant
    access to a profile, so neither is attempted.
    """
    from superset.ai.profiles import AgentProfileError

    with pytest.raises(AgentProfileError, match="required_permission"):
        _build({"analyst": {"required_permission": permission}})


def test_required_permission_may_be_cleared() -> None:
    """``None`` removes a gate rather than tripping the pair validation."""
    registry = _build(
        {
            "open": {
                "name": "Open",
                "required_permission": None,
            }
        }
    )
    assert registry.get("open").required_permission is None


def test_a_typo_in_a_tool_name_fails_loudly() -> None:
    """
    An unknown tool name is a startup error naming the typo and the real names.

    This is the guarantee that matters most in this module: without it a
    misspelled tool is simply absent, and the symptom a deployment sees is a
    model that has mysteriously stopped querying anything.
    """
    from superset.ai.profiles import AgentProfileError

    with pytest.raises(AgentProfileError, match="unknown tool") as excinfo:
        _build(
            {"analyst": {"tools": ["search_assets", "excute_sql"]}},
            known_tools=_known_tools(),
        )

    message = str(excinfo.value)
    assert "excute_sql" in message, "must name the offending tool"
    assert "analyst" in message, "must name the profile to fix"
    for name in sorted(_known_tools()):
        assert name in message, "must list what is actually available"


def test_tool_validation_also_covers_the_builtin_profiles() -> None:
    """
    Validation is not limited to the profiles a deployment configured.

    A caller that hands over a narrower tool set than the built-ins reference
    is told so, rather than running a shipped profile whose advertised tools
    are partly fiction. The cost is that narrowing the tool set means
    overriding the built-in profiles too.
    """
    from superset.ai.profiles import AgentProfileError
    from superset.ai.tools.base import DISCOVERY_TOOL_NAMES

    with pytest.raises(AgentProfileError, match="execute_sql"):
        _build({}, known_tools=set(DISCOVERY_TOOL_NAMES))


def test_tools_are_not_validated_unless_asked() -> None:
    """
    Omitting ``known_tools`` skips validation.

    Configuration is read in processes that must not import the tool modules,
    so the check is opt-in for the caller that can afford it.
    """
    registry = _build({"analyst": {"tools": ["excute_sql"]}})
    assert registry.get("analyst").tools == ("excute_sql",)


def test_an_empty_tool_list_is_a_valid_profile() -> None:
    """
    A profile with no tools is a supported deployment choice.

    Conversation with no warehouse access is a legitimate posture, so an empty
    list must not be mistaken for a misconfiguration.
    """
    registry = _build(
        {"default": {"tools": []}, "chat": {"name": "Chat", "tools": []}},
        known_tools=_known_tools(),
    )
    assert registry.get("default").tools == ()
    assert registry.get("chat").tools == ()


def test_knowledge_domains_are_coerced_to_a_tuple() -> None:
    """A configured list becomes the immutable form the profile declares."""
    registry = _build({"analyst": {"knowledge_domains": ["finance", "sales"]}})
    assert registry.get("analyst").knowledge_domains == ("finance", "sales")


def test_overrides_are_read_from_config_by_default(mocker: MockerFixture) -> None:
    """``AI_AGENT_PROFILES`` is the source when no overrides are passed."""
    from superset.ai.profiles import build_profile_registry

    mocker.patch.dict(
        current_app.config,
        {
            "AI_AGENT_PROFILES": {
                "default": {"name": "House assistant"},
                "triage": {"name": "Triage", "model_alias": "fast"},
            }
        },
    )
    registry = build_profile_registry()

    assert registry.get("default").name == "House assistant"
    assert registry.get("triage").model_alias.value == "fast"


def test_public_dict_hides_the_gating_rules() -> None:
    """
    The browser is told what it can select, not how the decision was made.

    Echoing the permission and flag back would hand a client the rules to
    reason about, and gating is resolved server-side regardless.
    """
    from superset.utils import json

    profile = _profile(
        key="deep",
        name="Deep analysis",
        description="Takes its time.",
        tools=("search_assets",),
        required_permission=("can_write", "AIAssistant"),
        feature_flag="AI_DEEP_ANALYSIS",
        model="some-private-model",
    )
    public = profile.to_public_dict()

    assert public == {
        "key": "deep",
        "name": "Deep analysis",
        "description": "Takes its time.",
        "tools": ["search_assets"],
    }
    serialised = json.dumps(public)
    assert "AI_DEEP_ANALYSIS" not in serialised
    assert "can_write" not in serialised
    assert "some-private-model" not in serialised


@pytest.mark.parametrize("allowed", [False, True])
def test_permission_gated_profile_follows_can_access(
    allowed: bool,
    mocker: MockerFixture,
) -> None:
    """A profile with a required permission is offered only to holders of it."""
    can_access = mocker.patch("superset.security_manager.can_access")
    can_access.return_value = allowed

    registry = _registry_of(
        _profile(key="deep", required_permission=("can_write", "AIAssistant"))
    )
    visible = [profile.key for profile in registry.visible_to_current_user()]

    assert visible == (["deep"] if allowed else [])
    can_access.assert_called_once_with("can_write", "AIAssistant")


def test_feature_flag_gated_profile_is_hidden_when_the_flag_is_off(
    mocker: MockerFixture,
) -> None:
    """
    A disabled flag hides the profile it gates, and only that one.

    The flag is checked before the permission, so a profile behind a flag that
    is off never reaches the security manager at all.
    """
    can_access = mocker.patch("superset.security_manager.can_access")
    mocker.patch(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        return_value=False,
    )

    registry = _registry_of(
        _profile(key="default", name="Assistant"),
        _profile(
            key="deep",
            feature_flag="AI_DEEP_ANALYSIS",
            required_permission=("can_write", "AIAssistant"),
        ),
    )
    visible = [profile.key for profile in registry.visible_to_current_user()]

    assert visible == ["default"]
    can_access.assert_not_called()


def test_get_refuses_a_gated_profile_the_user_may_not_use(
    mocker: MockerFixture,
) -> None:
    """
    Resolving a key applies the gate, not just listing does.

    The listing endpoint and the run path are separate code paths. If only the
    listing consulted the gate, posting a hidden profile's key would hand the
    caller its tools, model tier and turn budget — the permission and the
    feature flag would be decorative. The refusal downgrades rather than
    erroring, so a stale client still gets an answer.
    """
    can_access = mocker.patch("superset.security_manager.can_access")
    can_access.return_value = False
    mocker.patch(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        return_value=False,
    )

    registry = _registry_of(
        _profile(key="default", name="Assistant"),
        _profile(
            key="deep",
            feature_flag="AI_DEEP_ANALYSIS",
            required_permission=("can_write", "AIAssistant"),
        ),
    )

    assert registry.get("deep").key == "default"
    assert [p.key for p in registry.visible_to_current_user()] == ["default"]


def test_get_allows_a_gated_profile_the_user_may_use(
    mocker: MockerFixture,
) -> None:
    """A user holding the permission gets the profile they asked for."""
    mocker.patch("superset.security_manager.can_access", return_value=True)
    mocker.patch(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )

    registry = _registry_of(
        _profile(key="default", name="Assistant"),
        _profile(
            key="deep",
            feature_flag="AI_DEEP_ANALYSIS",
            required_permission=("can_write", "AIAssistant"),
        ),
    )

    assert registry.get("deep").key == "deep"


def test_get_raises_when_no_profile_is_permitted(mocker: MockerFixture) -> None:
    """
    A principal entitled to nothing gets an error, not a silent grant.

    Downgrading is only safe while some profile remains permitted; with none,
    falling through to an arbitrary one would defeat the gate entirely.
    """
    from superset.ai.profiles import AgentProfileError

    mocker.patch("superset.security_manager.can_access", return_value=False)

    registry = _registry_of(
        _profile(key="default", required_permission=("can_write", "AIAssistant")),
    )

    with pytest.raises(AgentProfileError, match="available to this user"):
        registry.get("default")


def test_get_can_skip_gates_for_a_trusted_caller() -> None:
    """
    ``enforce_gates=False`` is available where entitlement is already known.

    Present so an internal caller need not fabricate a request context, and
    deliberately explicit at every call site.
    """
    registry = _registry_of(
        _profile(key="deep", required_permission=("can_write", "AIAssistant")),
    )

    assert registry.get("deep", enforce_gates=False).key == "deep"


def test_feature_flag_gated_profile_is_shown_when_the_flag_is_on(
    mocker: MockerFixture,
) -> None:
    """An enabled flag leaves the profile selectable."""
    mocker.patch(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )

    registry = _registry_of(_profile(key="deep", feature_flag="AI_DEEP_ANALYSIS"))
    assert [p.key for p in registry.visible_to_current_user()] == ["deep"]


def test_an_ungated_profile_is_always_visible(mocker: MockerFixture) -> None:
    """
    With neither gate set, no check is consulted.

    Anyone who can use the assistant at all can select such a profile, so a
    hostile ``can_access`` cannot take the default profile away.
    """
    mocker.patch("superset.security_manager.can_access", return_value=False)
    mocker.patch(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        return_value=False,
    )

    registry = _build({}, known_tools=_known_tools())
    visible = {profile.key for profile in registry.visible_to_current_user()}

    assert visible == set(registry.profiles)


def test_get_on_an_empty_registry_raises() -> None:
    """
    A registry with nothing in it is a configuration error, not a silent None.

    Callers resolve a profile before doing anything else, so failing here is
    what turns "profiles are misconfigured" into a legible message.
    """
    from superset.ai.profiles import AgentProfileError, ProfileRegistry

    registry = ProfileRegistry()
    with pytest.raises(AgentProfileError, match="No AI agent profiles"):
        registry.get(None)
    with pytest.raises(AgentProfileError, match="No AI agent profiles"):
        registry.get("analyst")
    assert registry.visible_to_current_user() == []


def test_get_falls_back_to_any_profile_when_the_default_is_gone() -> None:
    """
    Losing the ``default`` key does not make the registry unusable.

    A deployment can rename its profiles wholesale; a request that names none
    then still resolves to something rather than failing.
    """
    registry = _registry_of(_profile(key="only", name="Only"))
    assert registry.get(None).key == "only"
    assert registry.get("something-else").key == "only"
