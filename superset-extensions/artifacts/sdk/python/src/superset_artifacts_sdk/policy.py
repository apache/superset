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
The policy: what an artifact may do here.

Three objects decide it, and each has one job:

- the manifest says what an artifact requests (``manifest.ArtifactManifest``);
- the policy says what is allowed (``ArtifactPolicy``);
- the grant is what a host computes from both in a context, at every check,
  and never stores (``grant_for``), so nothing in an artifact can widen it.

A policy starts from a profile, Locked, Standard or Open, which is a set of
values for every knob and a guarantee at once. It can only be narrowed from
there: knob by knob in a layer (``policy_layer``), and layer by layer, from
the deployment's to a workspace's (``resolve_policy``). A missing deployment
layer is Locked, and a layer that isn't valid reads as Locked, so a bad value
fails closed.

In every profile the frame has no network and no credentials, runs no SQL
and no ``eval``, and public embeds are off.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from enum import StrEnum
from types import MappingProxyType
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from superset_artifacts_sdk.capabilities import Capability
from superset_artifacts_sdk.manifest import ArtifactManifest, Binding

logger = logging.getLogger(__name__)

# Where a frame is shown; each context allows its own capabilities.
FrameMode = Literal["canvas", "embedded", "standalone"]
PackageMode = Literal["builtin", "allowlist", "any"]
SnapshotAccess = Literal["off", "editors", "shared"]
GuestAccess = Literal["off", "snapshot", "live"]
SourceKind = Literal["dataset", "chart", "semantic_view"]

NonNegativeInt = Annotated[int, Field(strict=True, ge=0)]
PositiveInt = Annotated[int, Field(strict=True, gt=0)]

# Each ranked knob's values, narrowest first.
_PACKAGE_MODES: tuple[PackageMode, ...] = ("builtin", "allowlist", "any")
_SNAPSHOT_ACCESS: tuple[SnapshotAccess, ...] = ("off", "editors", "shared")
_GUEST_ACCESS: tuple[GuestAccess, ...] = ("off", "snapshot", "live")


class Profile(StrEnum):
    """A named set of values for every knob, and the guarantee they give."""

    LOCKED = "locked"
    STANDARD = "standard"
    OPEN = "open"


_PROFILES_NARROWEST_FIRST = (Profile.LOCKED, Profile.STANDARD, Profile.OPEN)


class InvalidPolicyError(ValueError):
    """A policy layer that isn't valid: it reads as Locked."""


class _PolicyModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class PackagePolicy(_PolicyModel):
    """Which npm packages an artifact may depend on."""

    # builtin: only what the runtime brings; allowlist: only ``allow``;
    # any: any package, through the host's scanned proxy.
    mode: PackageMode
    allow: frozenset[str] = frozenset()
    deny: frozenset[str] = frozenset()
    # SPDX licence ids a package may carry; ``None`` admits any.
    licenses: frozenset[str] | None = None
    # How many hours a new release waits before a build may use it.
    cooldown_h: NonNegativeInt = 0
    # Whether a package new to the workspace waits for an admin's approval.
    approval: bool = False


class ComputePolicy(_PolicyModel):
    """Which compute capabilities the frame's policy may allow; never a network."""

    wasm: bool
    workers: bool


class DataPolicy(_PolicyModel):
    """What bindings may read, and how much."""

    sources: frozenset[SourceKind] = frozenset({"dataset", "chart", "semantic_view"})
    # The resources bindings may name, as "<kind>:<id>" ("dataset:42"); ``None``
    # admits any that the viewer may read.
    resources: frozenset[str] | None = None
    live: bool = True
    parameters: bool = True
    snapshots: SnapshotAccess
    max_bindings: PositiveInt
    max_rows: PositiveInt
    # Queries one view of an artifact may run.
    max_queries: PositiveInt


class IntegrationPolicy(_PolicyModel):
    """How an artifact takes part in its canvas."""

    theme: bool = True
    cross_filter_emit: bool = True


class SurfacePolicy(_PolicyModel):
    """Where an artifact may be shown beyond the canvases that place it."""

    standalone: bool
    embedded: bool
    guest: GuestAccess
    public: Literal[False] = False


class AuthoringPolicy(_PolicyModel):
    """What agents get while they write an artifact."""

    agent_adds_packages: bool
    real_rows: bool
    screenshots: bool


class LimitPolicy(_PolicyModel):
    """How big an artifact may grow."""

    files: PositiveInt
    file_bytes: PositiveInt
    bundle_mib: PositiveInt


class ArtifactPolicy(_PolicyModel):
    """What artifacts may do here: a profile, narrowed knob by knob."""

    profile: Profile
    packages: PackagePolicy
    compute: ComputePolicy
    data: DataPolicy
    integration: IntegrationPolicy = IntegrationPolicy()
    surfaces: SurfacePolicy
    authoring: AuthoringPolicy
    limits: LimitPolicy


PROFILES: Mapping[Profile, ArtifactPolicy] = MappingProxyType(
    {
        Profile.LOCKED: ArtifactPolicy(
            profile=Profile.LOCKED,
            packages=PackagePolicy(mode="builtin", cooldown_h=72, approval=True),
            compute=ComputePolicy(wasm=False, workers=False),
            data=DataPolicy(
                snapshots="off", max_bindings=8, max_rows=5_000, max_queries=16
            ),
            surfaces=SurfacePolicy(standalone=True, embedded=False, guest="off"),
            authoring=AuthoringPolicy(
                agent_adds_packages=False, real_rows=False, screenshots=False
            ),
            limits=LimitPolicy(files=200, file_bytes=500_000, bundle_mib=5),
        ),
        Profile.STANDARD: ArtifactPolicy(
            profile=Profile.STANDARD,
            packages=PackagePolicy(mode="allowlist", cooldown_h=72, approval=True),
            compute=ComputePolicy(wasm=True, workers=False),
            data=DataPolicy(
                snapshots="shared", max_bindings=16, max_rows=50_000, max_queries=64
            ),
            surfaces=SurfacePolicy(standalone=True, embedded=True, guest="off"),
            authoring=AuthoringPolicy(
                agent_adds_packages=False, real_rows=True, screenshots=True
            ),
            limits=LimitPolicy(files=1_000, file_bytes=1_000_000, bundle_mib=20),
        ),
        Profile.OPEN: ArtifactPolicy(
            profile=Profile.OPEN,
            packages=PackagePolicy(mode="any", cooldown_h=72),
            compute=ComputePolicy(wasm=True, workers=True),
            data=DataPolicy(
                snapshots="shared", max_bindings=16, max_rows=50_000, max_queries=64
            ),
            surfaces=SurfacePolicy(standalone=True, embedded=True, guest="snapshot"),
            authoring=AuthoringPolicy(
                agent_adds_packages=True, real_rows=True, screenshots=True
            ),
            limits=LimitPolicy(files=1_000, file_bytes=1_000_000, bundle_mib=20),
        ),
    }
)
LOCKED = PROFILES[Profile.LOCKED]

# What each context allows at most. A standalone or embedded page has no
# canvas whose widgets could follow a cross-filter.
_OFF_CANVAS = frozenset(c for c in Capability if c is not Capability.CROSS_FILTER)
CONTEXT_CAPABILITIES: Mapping[FrameMode, frozenset[Capability]] = MappingProxyType(
    {
        "canvas": frozenset(Capability),
        "standalone": _OFF_CANVAS,
        "embedded": _OFF_CANVAS,
    }
)


def _narrowest(values: tuple[Any, ...], a: Any, b: Any) -> Any:
    return values[min(values.index(a), values.index(b))]


def _admitted(a: frozenset[Any] | None, b: frozenset[Any] | None) -> Any:
    """What both admit, where ``None`` admits anything."""
    if a is None or b is None:
        return b if a is None else a
    return a & b


def _packages_admitted(policy: PackagePolicy) -> frozenset[str] | None:
    """The packages a mode admits before its deny-list; ``None`` is any."""
    if policy.mode == "any":
        return None
    return policy.allow if policy.mode == "allowlist" else frozenset()


def _narrow_packages(a: PackagePolicy, b: PackagePolicy) -> PackagePolicy:
    mode = _narrowest(_PACKAGE_MODES, a.mode, b.mode)
    admitted = _admitted(_packages_admitted(a), _packages_admitted(b))
    return PackagePolicy(
        mode=mode,
        allow=admitted if mode == "allowlist" else frozenset(),
        deny=a.deny | b.deny,
        licenses=_admitted(a.licenses, b.licenses),
        cooldown_h=max(a.cooldown_h, b.cooldown_h),
        approval=a.approval or b.approval,
    )


def narrow(a: ArtifactPolicy, b: ArtifactPolicy) -> ArtifactPolicy:
    """The policy that both ``a`` and ``b`` allow: the narrower value of each knob."""
    return ArtifactPolicy(
        profile=_narrowest(_PROFILES_NARROWEST_FIRST, a.profile, b.profile),
        packages=_narrow_packages(a.packages, b.packages),
        compute=ComputePolicy(
            wasm=a.compute.wasm and b.compute.wasm,
            workers=a.compute.workers and b.compute.workers,
        ),
        data=DataPolicy(
            sources=a.data.sources & b.data.sources,
            resources=_admitted(a.data.resources, b.data.resources),
            live=a.data.live and b.data.live,
            parameters=a.data.parameters and b.data.parameters,
            snapshots=_narrowest(_SNAPSHOT_ACCESS, a.data.snapshots, b.data.snapshots),
            max_bindings=min(a.data.max_bindings, b.data.max_bindings),
            max_rows=min(a.data.max_rows, b.data.max_rows),
            max_queries=min(a.data.max_queries, b.data.max_queries),
        ),
        integration=IntegrationPolicy(
            theme=a.integration.theme and b.integration.theme,
            cross_filter_emit=(
                a.integration.cross_filter_emit and b.integration.cross_filter_emit
            ),
        ),
        surfaces=SurfacePolicy(
            standalone=a.surfaces.standalone and b.surfaces.standalone,
            embedded=a.surfaces.embedded and b.surfaces.embedded,
            guest=_narrowest(_GUEST_ACCESS, a.surfaces.guest, b.surfaces.guest),
        ),
        authoring=AuthoringPolicy(
            agent_adds_packages=(
                a.authoring.agent_adds_packages and b.authoring.agent_adds_packages
            ),
            real_rows=a.authoring.real_rows and b.authoring.real_rows,
            screenshots=a.authoring.screenshots and b.authoring.screenshots,
        ),
        limits=LimitPolicy(
            files=min(a.limits.files, b.limits.files),
            file_bytes=min(a.limits.file_bytes, b.limits.file_bytes),
            bundle_mib=min(a.limits.bundle_mib, b.limits.bundle_mib),
        ),
    )


def is_within(policy: ArtifactPolicy, bound: ArtifactPolicy) -> bool:
    """Whether ``policy`` allows nothing that ``bound`` doesn't."""
    return narrow(bound, policy) == policy


def _merged(base: Mapping[str, Any], overrides: Mapping[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in overrides.items():
        if isinstance(value, Mapping) and isinstance(merged.get(key), Mapping):
            merged[key] = _merged(merged[key], value)
        else:
            merged[key] = value
    return merged


def policy_layer(layer: Mapping[str, Any]) -> ArtifactPolicy:
    """
    The policy that a layer describes: a profile's name, and knobs that narrow
    it, such as ``{"profile": "standard", "packages": {"mode": "builtin"}}``.

    Raises ``InvalidPolicyError`` for anything else: a missing or unknown
    profile, an unknown knob or value, and a knob that widens its profile.
    """
    if not isinstance(layer, Mapping):
        raise InvalidPolicyError("a policy layer is a mapping of knobs")
    overrides = dict(layer)
    try:
        profile = Profile(overrides.pop("profile"))
    except KeyError as ex:
        raise InvalidPolicyError("a policy layer names its profile") from ex
    except ValueError as ex:
        raise InvalidPolicyError(f"{layer['profile']!r} is not a profile") from ex
    base = PROFILES[profile]
    try:
        policy = ArtifactPolicy.model_validate(
            _merged(base.model_dump(), overrides), strict=False
        )
    except ValidationError as ex:
        raise InvalidPolicyError(str(ex)) from ex
    # A profile bounds which packages an allowlist admits by its mode only:
    # the list itself is the layer's to give.
    allow = policy.packages.allow
    bound = base.model_copy(
        update={"packages": base.packages.model_copy(update={"allow": allow})}
    )
    if not is_within(policy, bound):
        raise InvalidPolicyError(
            f"a layer can only narrow its profile, {profile.value}, never widen it"
        )
    return policy


def _layer_or_locked(layer: Mapping[str, Any], what: str) -> ArtifactPolicy:
    try:
        return policy_layer(layer)
    except InvalidPolicyError as ex:
        logger.warning(
            "Artifacts: the %s policy is invalid, so it is Locked: %s", what, ex
        )
        return LOCKED


def resolve_policy(
    deployment: Mapping[str, Any] | None,
    workspace: Mapping[str, Any] | None = None,
) -> ArtifactPolicy:
    """
    The policy in force: the deployment's layer, narrowed by the workspace's.

    Without a deployment layer the policy is Locked, and without a workspace
    layer the deployment's stands. A layer that isn't valid reads as Locked
    and logs why, so the result is Locked within the layers above it.
    """
    policy = (
        LOCKED if deployment is None else _layer_or_locked(deployment, "deployment")
    )
    if workspace is not None:
        policy = narrow(policy, _layer_or_locked(workspace, "workspace"))
    return policy


def allowed_capabilities(policy: ArtifactPolicy) -> frozenset[Capability]:
    """The capabilities ``policy`` lets any frame have, in any context."""
    allowed = {Capability.DATA}
    if policy.integration.cross_filter_emit:
        allowed.add(Capability.CROSS_FILTER)
    if policy.integration.theme:
        allowed.add(Capability.THEME)
    if policy.compute.wasm:
        allowed.add(Capability.COMPUTE_WASM)
    if policy.compute.workers:
        allowed.add(Capability.COMPUTE_WORKERS)
    return frozenset(allowed)


def grant_for(
    manifest: ArtifactManifest, policy: ArtifactPolicy, mode: FrameMode
) -> frozenset[Capability]:
    """The capabilities a frame gets: manifest ∩ policy ∩ context."""
    return (
        frozenset(manifest.capabilities)
        & allowed_capabilities(policy)
        & CONTEXT_CAPABILITIES[mode]
    )


def surface_allowed(policy: ArtifactPolicy, mode: FrameMode) -> bool:
    """Whether ``policy`` lets an artifact be shown in ``mode`` at all."""
    if mode == "standalone":
        return policy.surfaces.standalone
    if mode == "embedded":
        return policy.surfaces.embedded
    return True


def binding_problems(name: str, binding: Binding, policy: ArtifactPolicy) -> list[str]:
    """Why ``policy`` refuses a binding, in words for its author; empty if not."""
    data = policy.data
    source = binding.source
    problems = []
    if source.kind not in data.sources:
        problems.append(f"binding {name!r}: {source.kind} sources aren't allowed")
    if data.resources is not None and source.resource not in data.resources:
        problems.append(f"binding {name!r}: {source.resource} isn't allowed")
    if binding.mode == "live" and not data.live:
        problems.append(f"binding {name!r}: live data isn't allowed")
    if binding.mode == "snapshot" and data.snapshots == "off":
        problems.append(f"binding {name!r}: snapshots aren't allowed")
    if binding.parameters and not data.parameters:
        problems.append(f"binding {name!r}: parameters aren't allowed")
    if binding.row_limit is not None and binding.row_limit > data.max_rows:
        problems.append(
            f"binding {name!r}: row_limit {binding.row_limit} is over {data.max_rows}"
        )
    return problems


def manifest_problems(manifest: ArtifactManifest, policy: ArtifactPolicy) -> list[str]:
    """
    Why ``policy`` refuses ``manifest``, in words for its author; empty if it
    doesn't. A host checks it on every write that changes the manifest and at
    publishing, so a tighter policy reaches a draft before it can be published.
    """
    packages = policy.packages
    problems = []
    for name in manifest.dependencies:
        if name in packages.deny:
            problems.append(f"package {name!r} is denied")
        elif packages.mode == "builtin":
            problems.append(
                f"package {name!r}: only the runtime's own packages are allowed"
            )
        elif packages.mode == "allowlist" and name not in packages.allow:
            problems.append(f"package {name!r} isn't on the allowlist")
    declared = set(manifest.capabilities)
    for capability, allowed in (
        (Capability.COMPUTE_WASM, policy.compute.wasm),
        (Capability.COMPUTE_WORKERS, policy.compute.workers),
    ):
        if capability in declared and not allowed:
            problems.append(f"the {capability.value!r} capability isn't allowed")
    if len(manifest.bindings) > policy.data.max_bindings:
        problems.append(
            f"{len(manifest.bindings)} bindings; at most {policy.data.max_bindings} "
            "are allowed"
        )
    for name, binding in manifest.bindings.items():
        problems.extend(binding_problems(name, binding, policy))
    return problems
