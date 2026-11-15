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
sandbox host on a separate site that serves each frame, a build service, a
package host and headless checks. Superset defines this interface; a host
implements it and registers one provider at startup. With no provider
registered, artifacts stay off (``artifacts_available``).

Each service is also a role of its own (``FrameLinkMinter``,
``FrameSources``, ``ArtifactBuilder``, ``ArtifactChecker`` and
``ArtifactStoreSource``), which ``ArtifactRuntimeProvider`` combines, so that
code using one service depends on that service only.

The registry is a placeholder until Superset decides how a host implements
an interface that an extension defines. Whether plain Superset should ship
a development-only provider is an open question.
"""

from __future__ import annotations

import threading
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol, runtime_checkable

from superset_core.artifacts.capabilities import Capability
from superset_core.artifacts.store import ArtifactStoreBackend

FrameMode = Literal["canvas", "embedded", "standalone"]
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
    at most what the manifest declares, and what the context allows.
    """

    mode: FrameMode
    allowed_parents: tuple[str, ...]
    capabilities: frozenset[Capability]


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

    def build(self, ref: ArtifactRef) -> BuildResult:
        """
        Build ``ref``, returning the errors the agent needs to fix.

        Raises ``VersionNotFoundError`` when the store holds no such version
        of the artifact.
        """
        ...


@runtime_checkable
class ArtifactChecker(Protocol):
    """The headless check's role in a provider."""

    # TODO: screenshots come with v2 of ``check``.

    def check(self, ref: ArtifactRef) -> CheckResult:
        """
        Run ``ref`` in an isolated headless browser and report what happened.

        Raises ``VersionNotFoundError`` when the store holds no such version
        of the artifact. The conditions for isolating that browser pool are
        an open question.
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
class ArtifactRuntimeProvider(
    FrameLinkMinter,
    FrameSources,
    ArtifactBuilder,
    ArtifactChecker,
    ArtifactStoreSource,
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


class ProviderAlreadyRegisteredError(RuntimeError):
    """A provider is registered already; pass ``replace=True`` to swap it."""


_lock = threading.Lock()
_provider: ArtifactRuntimeProvider | None = None


def register_provider(
    provider: ArtifactRuntimeProvider, *, replace: bool = False
) -> None:
    """
    Register the host's provider, which turns artifacts on.

    Raises ``ProviderAlreadyRegisteredError`` if one is registered already and
    ``replace`` is false, and ``TypeError`` if ``provider`` doesn't implement
    ``ArtifactRuntimeProvider``.
    """
    global _provider
    if not isinstance(provider, ArtifactRuntimeProvider):
        raise TypeError(
            f"{type(provider).__name__} does not implement ArtifactRuntimeProvider"
        )
    with _lock:
        if _provider is not None and not replace:
            raise ProviderAlreadyRegisteredError(
                f"an artifact runtime provider is registered already "
                f"({type(_provider).__name__}); pass replace=True to swap it"
            )
        _provider = provider


def get_provider() -> ArtifactRuntimeProvider | None:
    """Return the registered provider, or ``None`` if there is none."""
    with _lock:
        return _provider


def clear_provider() -> None:
    """Unregister the provider, which turns artifacts off."""
    global _provider
    with _lock:
        _provider = None


def artifacts_available() -> bool:
    """
    Whether artifacts are available: true only when a provider is registered.

    Per-workspace switches and a kill switch are the host's to add on top.
    """
    return get_provider() is not None
