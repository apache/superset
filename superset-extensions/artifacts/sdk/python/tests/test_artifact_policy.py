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
"""The policy: its profiles, its layers that only narrow, and the grant."""

from __future__ import annotations

import logging
from typing import Any

import pytest
from superset_artifacts_sdk.capabilities import Capability
from superset_artifacts_sdk.manifest import ArtifactManifest
from superset_artifacts_sdk.policy import (
    ArtifactPolicy,
    binding_problems,
    grant_for,
    InvalidPolicyError,
    is_within,
    LOCKED,
    manifest_problems,
    narrow,
    policy_layer,
    Profile,
    PROFILES,
    resolve_policy,
    surface_allowed,
)

STANDARD = PROFILES[Profile.STANDARD]
OPEN = PROFILES[Profile.OPEN]


def _manifest(**fields: Any) -> ArtifactManifest:
    return ArtifactManifest.model_validate({"artifact_version": "1", **fields})


SALES = {
    "source": {"kind": "dataset", "dataset_id": 42},
    "metrics": ["revenue"],
    "dimensions": ["region"],
}


def test_the_profiles_widen_from_locked_to_open() -> None:
    assert is_within(LOCKED, STANDARD)
    assert is_within(STANDARD, OPEN)
    assert not is_within(OPEN, STANDARD)
    assert not is_within(STANDARD, LOCKED)


@pytest.mark.parametrize("profile", list(Profile))
def test_what_every_profile_guarantees(profile: Profile) -> None:
    policy = PROFILES[profile]
    assert policy.profile is profile
    assert not policy.surfaces.public
    assert policy.packages.mode != "any" or policy.packages.cooldown_h > 0


def test_locked_allows_no_packages_and_no_compute() -> None:
    assert LOCKED.packages.mode == "builtin"
    assert not LOCKED.compute.wasm
    assert not LOCKED.compute.workers
    assert LOCKED.data.snapshots == "off"
    assert not LOCKED.surfaces.embedded


def test_narrowing_takes_the_narrower_value_of_every_knob() -> None:
    narrowed = narrow(OPEN, STANDARD)
    assert narrowed == STANDARD
    assert narrow(STANDARD, OPEN) == STANDARD
    assert narrow(LOCKED, OPEN) == LOCKED


def test_allowlists_meet_and_deny_lists_add_up() -> None:
    upper = policy_layer(
        {"profile": "standard", "packages": {"allow": ["d3", "three"], "deny": ["x"]}}
    )
    lower = policy_layer(
        {"profile": "standard", "packages": {"allow": ["d3", "lodash"], "deny": ["y"]}}
    )

    packages = narrow(upper, lower).packages
    assert packages.allow == {"d3"}
    assert packages.deny == {"x", "y"}


def test_an_allowlist_within_any_keeps_its_own_list() -> None:
    """Any admits every package, so the list below it stands as it is."""
    allowlist = policy_layer({"profile": "standard", "packages": {"allow": ["d3"]}})
    assert narrow(OPEN, allowlist).packages.allow == {"d3"}
    assert narrow(OPEN, allowlist).packages.mode == "allowlist"


def test_a_layer_narrows_its_profile_knob_by_knob() -> None:
    policy = policy_layer(
        {"profile": "open", "compute": {"workers": False}, "data": {"max_rows": 100}}
    )
    assert policy.profile is Profile.OPEN
    assert policy.compute.wasm
    assert not policy.compute.workers
    assert policy.data.max_rows == 100
    assert policy.packages == OPEN.packages


@pytest.mark.parametrize(
    "layer",
    [
        {"profile": "locked", "compute": {"wasm": True}},
        {"profile": "standard", "packages": {"mode": "any"}},
        {"profile": "standard", "data": {"max_rows": 1_000_000}},
        {"profile": "open", "surfaces": {"guest": "live"}},
        {"profile": "open", "packages": {"cooldown_h": 0}},
    ],
)
def test_a_layer_never_widens_its_profile(layer: dict[str, Any]) -> None:
    with pytest.raises(InvalidPolicyError, match="only narrow"):
        policy_layer(layer)


@pytest.mark.parametrize(
    "layer",
    [
        {},
        {"profile": "unrestricted"},
        {"profile": "open", "network": True},
        {"profile": "open", "compute": {"eval": True}},
        {"profile": "open", "surfaces": {"public": True}},
        {"profile": "open", "data": {"max_rows": "lots"}},
        "open",
    ],
)
def test_anything_but_a_valid_layer_is_refused(layer: Any) -> None:
    with pytest.raises(InvalidPolicyError):
        policy_layer(layer)


def test_without_a_deployment_layer_the_policy_is_locked() -> None:
    assert resolve_policy(None) == LOCKED
    assert resolve_policy(None, {"profile": "open"}) == LOCKED


def test_a_workspace_layer_narrows_the_deployments() -> None:
    policy = resolve_policy({"profile": "open"}, {"profile": "standard"})
    assert policy == STANDARD
    # A workspace can't widen the deployment, whatever profile it names.
    assert resolve_policy({"profile": "standard"}, {"profile": "open"}) == STANDARD


def test_an_invalid_layer_fails_closed_and_says_why(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.WARNING):
        assert resolve_policy({"profile": "everything"}) == LOCKED
        assert resolve_policy({"profile": "open"}, {"profile": 7}) == LOCKED
    assert "deployment policy is invalid" in caplog.text
    assert "workspace policy is invalid" in caplog.text


def test_the_grant_is_manifest_policy_and_context() -> None:
    manifest = _manifest(
        bindings={"sales": SALES},
        events=[{"kind": "cross_filter", "binding": "sales", "dimension": "region"}],
        capabilities=["data", "cross_filter", "theme", "compute.wasm"],
    )

    assert grant_for(manifest, OPEN, "canvas") == {
        Capability.DATA,
        Capability.CROSS_FILTER,
        Capability.THEME,
        Capability.COMPUTE_WASM,
    }
    # Locked allows no WebAssembly; a standalone page has no canvas to filter.
    assert grant_for(manifest, LOCKED, "canvas") == {
        Capability.DATA,
        Capability.CROSS_FILTER,
        Capability.THEME,
    }
    assert Capability.CROSS_FILTER not in grant_for(manifest, OPEN, "standalone")


def test_the_grant_never_holds_what_the_manifest_doesnt_declare() -> None:
    assert grant_for(_manifest(capabilities=["theme"]), OPEN, "canvas") == {
        Capability.THEME
    }


def test_a_policy_can_turn_off_emitting_cross_filters() -> None:
    quiet = policy_layer(
        {"profile": "standard", "integration": {"cross_filter_emit": False}}
    )
    manifest = _manifest(capabilities=["cross_filter", "theme"])
    assert grant_for(manifest, quiet, "canvas") == {Capability.THEME}


def test_surfaces_follow_the_policy() -> None:
    assert surface_allowed(LOCKED, "standalone")
    assert not surface_allowed(LOCKED, "embedded")
    assert surface_allowed(STANDARD, "embedded")
    assert surface_allowed(LOCKED, "canvas")


def test_locked_refuses_every_package() -> None:
    problems = manifest_problems(_manifest(dependencies={"d3": "7.9.0"}), LOCKED)
    assert problems == ["package 'd3': only the runtime's own packages are allowed"]


def test_an_allowlist_admits_only_its_packages_and_never_a_denied_one() -> None:
    policy = policy_layer(
        {"profile": "standard", "packages": {"allow": ["d3"], "deny": ["leftpad"]}}
    )
    manifest = _manifest(
        dependencies={"d3": "7.9.0", "three": "0.160.0", "leftpad": "1.3.0"}
    )
    assert manifest_problems(manifest, policy) == [
        "package 'three' isn't on the allowlist",
        "package 'leftpad' is denied",
    ]
    assert manifest_problems(_manifest(dependencies={"three": "0.160.0"}), OPEN) == []


def test_compute_needs_the_policy() -> None:
    manifest = _manifest(capabilities=["compute.wasm", "compute.workers"])
    assert manifest_problems(manifest, STANDARD) == [
        "the 'compute.workers' capability isn't allowed"
    ]
    assert manifest_problems(manifest, OPEN) == []


def test_bindings_are_checked_against_the_data_knobs() -> None:
    policy = policy_layer(
        {
            "profile": "standard",
            "data": {
                "sources": ["dataset"],
                "resources": ["dataset:42"],
                "max_rows": 100,
                "parameters": False,
            },
        }
    )
    manifest = _manifest(
        capabilities=["data"],
        bindings={
            "sales": {
                **SALES,
                "row_limit": 500,
                "parameters": {"r": {"type": "string"}},
            },
            "costs": {"source": {"kind": "dataset", "dataset_id": 7}},
            "chart": {"source": {"kind": "chart", "chart_id": 3}},
        },
    )
    assert manifest_problems(manifest, policy) == [
        "binding 'sales': parameters aren't allowed",
        "binding 'sales': row_limit 500 is over 100",
        "binding 'costs': dataset:7 isn't allowed",
        "binding 'chart': chart sources aren't allowed",
        "binding 'chart': chart:3 isn't allowed",
    ]


def test_snapshots_need_the_policy_to_allow_them() -> None:
    manifest = _manifest(
        capabilities=["data"], bindings={"sales": {**SALES, "mode": "snapshot"}}
    )
    assert manifest_problems(manifest, LOCKED) == [
        "binding 'sales': snapshots aren't allowed"
    ]
    assert manifest_problems(manifest, STANDARD) == []
    assert binding_problems("sales", manifest.bindings["sales"], STANDARD) == []


def test_a_manifest_with_too_many_bindings_is_refused() -> None:
    policy = policy_layer({"profile": "locked", "data": {"max_bindings": 1}})
    manifest = _manifest(
        capabilities=["data"],
        bindings={"a": SALES, "b": SALES},
    )
    assert manifest_problems(manifest, policy) == ["2 bindings; at most 1 are allowed"]


def test_policies_are_immutable() -> None:
    with pytest.raises(ValueError, match="frozen"):
        LOCKED.compute.wasm = True
    assert isinstance(PROFILES[Profile.LOCKED], ArtifactPolicy)
