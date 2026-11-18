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
The artifact runtime provider interface.

Artifacts need machinery that a plain Superset deployment doesn't run: a
sandbox host on a separate site that serves each frame, a build service and
headless checks. This interface names that machinery; a host implements it
and registers one provider at startup (``superset_artifacts_sdk.registry``).
With no provider registered, artifacts stay off.

Each service is also a role of its own (``FrameLinkMinter``,
``FrameSources``, ``ArtifactBuilder``, ``ArtifactChecker``,
``ArtifactStoreSource`` and ``PolicySource``), which
``ArtifactRuntimeProvider`` combines, so that code using one service depends
on that service only.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, Protocol, runtime_checkable

from superset_artifacts_sdk.capabilities import Capability
from superset_artifacts_sdk.policy import ArtifactPolicy, FrameMode
from superset_artifacts_sdk.store import ArtifactStoreBackend

Severity = Literal["error", "warning"]


@dataclass(frozen=True)
class ArtifactRef:
    """An artifact, and one of its versions (a tree hash); ``None`` is the draft."""

    artifact_id: str
    version: str | None = None


@dataclass(frozen=True)
class FrameContext:
    """
    Where a frame is shown, which pages may contain it, and what it's granted.

    ``allowed_parents`` are the origins allowed as the frame's ancestors in
    this context (its CSP ``frame-ancestors``). ``capabilities`` is the grant:
    manifest ∩ policy ∩ context (``policy.grant_for``). Its compute part is
    what the frame's own CSP may add; nothing in it opens a network.
    ``policy`` is the policy in force: a provider serves nothing of what it
    builds that the policy refuses now, as packages denied since the build.
    """

    mode: FrameMode
    allowed_parents: tuple[str, ...]
    capabilities: frozenset[Capability]
    policy: ArtifactPolicy | None = None


@dataclass(frozen=True)
class FrameLink:
    """
    A short-lived, single-use link that loads an artifact's frame.

    ``expires_at`` must be timezone-aware, so that every reader compares and
    serializes the same instant; a naive datetime raises ``ValueError``.
    """

    url: str
    expires_at: datetime

    def __post_init__(self) -> None:
        if self.expires_at.utcoffset() is None:
            raise ValueError("FrameLink.expires_at must be timezone-aware")


@dataclass(frozen=True)
class Diagnostic:
    """
    One problem that a build or a check found, for the agent to fix.

    ``file`` is a path in the artifact's tree. ``line`` and ``column`` count
    from 1, as ``artifact_view``'s lines and browser stack traces do.
    """

    message: str
    severity: Severity = "error"
    file: str | None = None
    line: int | None = None
    column: int | None = None


@dataclass(frozen=True)
class BuildResult:
    """
    The outcome of building an artifact version.

    A build compiles the files, checks their imports and flags the APIs the
    sandbox will block. ``bundle_id`` identifies the built output when ``ok``.
    """

    ok: bool
    diagnostics: tuple[Diagnostic, ...] = ()
    bundle_id: str | None = None


@dataclass(frozen=True)
class CheckResult:
    """
    The outcome of running an artifact version in a headless browser.

    ``subscribed_to_data`` says whether the artifact asked for its data;
    ``dom_summary`` is a short text summary of what it rendered.
    """

    ok: bool
    diagnostics: tuple[Diagnostic, ...] = ()
    console: tuple[str, ...] = ()
    csp_violations: tuple[str, ...] = ()
    subscribed_to_data: bool = False
    dom_summary: str | None = None


class VersionNotFoundError(LookupError):
    """
    The store holds no such version of the artifact.

    A provider raises it from ``mint_frame_link``, ``build`` and ``check``
    when ``ref`` names a version that the store doesn't hold for the
    artifact, or the draft of an artifact that has none. A write or a publish
    that lands between reading a version and the call can cause it, so
    reading the artifact again may find the version to use. Callers catch
    this exception rather than ``LookupError``, so that a ``KeyError`` from a
    bug still surfaces as one.
    """


@runtime_checkable
class FrameLinkMinter(Protocol):
    """The sandbox's role in a provider: links that load an artifact's frame."""

    def mint_frame_link(self, ref: ArtifactRef, context: FrameContext) -> FrameLink:
        """
        Mint a short-lived, single-use link that loads ``ref``'s frame.

        The page it serves holds only code, and allows only
        ``context.allowed_parents`` to contain it. Raises
        ``VersionNotFoundError`` when the store holds no such version of the
        artifact.
        """
        ...


@runtime_checkable
class FrameSources(Protocol):
    """
    The sandbox's role in the host pages' policy: where its frames load from.

    A host page shows a frame only from a source that its Content Security
    Policy allows in ``frame-src``, and only the provider knows its sandbox's
    site.
    """

    def frame_sources(self) -> Sequence[str]:
        """
        The CSP source expressions that host pages must allow in ``frame-src``
        to show this provider's frames, for example ``https://*.sandbox.example``.

        Every link that ``mint_frame_link`` returns loads from one of them.
        They name the sandbox's site and nothing wider: never ``*``, a bare
        scheme such as ``https:`` or a keyword such as ``'self'``. A host may
        ask for every page it serves, so the answer must be quick to compute.
        """
        ...


@runtime_checkable
class ArtifactBuilder(Protocol):
    """The build service's role in a provider."""

    def build(self, ref: ArtifactRef, policy: ArtifactPolicy) -> BuildResult:
        """
        Build ``ref`` under ``policy``, returning the errors the agent needs to fix.

        The policy is the request's: the build applies its package and compute
        knobs, so that what it refuses matches what the host enforces. Raises
        ``VersionNotFoundError`` when the store holds no such version of the
        artifact.
        """
        ...


@runtime_checkable
class ArtifactChecker(Protocol):
    """The headless check's role in a provider."""

    # TODO: screenshots come with v2 of ``check``.

    def check(self, ref: ArtifactRef, policy: ArtifactPolicy) -> CheckResult:
        """
        Run ``ref`` in an isolated headless browser and report what happened.

        ``policy`` is the request's: its authoring knobs decide whether the
        check takes screenshots and whether the artifact sees real rows.
        Raises ``VersionNotFoundError`` when the store holds no such version
        of the artifact.
        """
        ...


@runtime_checkable
class ArtifactStoreSource(Protocol):
    """The store's role in a provider: where an artifact's files live."""

    def store_backend(self) -> ArtifactStoreBackend | None:
        """
        Return the backend for the artifact file store, or ``None``.

        ``None`` keeps the default backend on Superset's extension storage.
        The backend comes scoped by the host already, for example to the
        tenant serving the request (see ``ArtifactStoreBackend``).
        """
        ...


@runtime_checkable
class PolicySource(Protocol):
    """The host's role in the policy: the layer that narrows the deployment's."""

    def policy_layer(self) -> Mapping[str, Any] | None:
        """
        The policy layer for the request being served, such as its workspace's,
        or ``None`` to narrow nothing.

        A layer names a profile and the knobs that narrow it
        (``policy.policy_layer``). The host validates it on every request, and
        an invalid one reads as Locked, so a provider can pass on what its own
        settings say without checking it first.
        """
        ...


@runtime_checkable
class ArtifactRuntimeProvider(
    FrameLinkMinter,
    FrameSources,
    ArtifactBuilder,
    ArtifactChecker,
    ArtifactStoreSource,
    PolicySource,
    Protocol,
):
    """
    The machinery a host supplies for artifacts, registered as one object.

    It plays every role above, and adds nothing of its own. Registering it is
    what turns artifacts on; code that uses only one role should depend on
    that role, so that its fakes and its callers need nothing else. Generated
    code never runs in the host page: only in the viewer's frame on the
    sandbox site, or in the provider's isolated headless checks. How a frame
    loads its packages is the provider's own, as is the CSP its sandbox host
    serves the frame with.
    """

    # TODO: consider making this interface smaller.
