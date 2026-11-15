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

"""The provider interface and its placeholder registry."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import FrozenInstanceError
from datetime import datetime, timedelta, timezone

import pytest
from superset_core import artifacts as sdk
from superset_core.artifacts.capabilities import Capability
from superset_core.artifacts.provider import (
    ArtifactBuilder,
    ArtifactChecker,
    ArtifactRef,
    ArtifactRuntimeProvider,
    artifacts_available,
    ArtifactStoreSource,
    BuildResult,
    CheckResult,
    clear_provider,
    Diagnostic,
    FrameContext,
    FrameLink,
    FrameLinkMinter,
    get_provider,
    ProviderAlreadyRegisteredError,
    register_provider,
    VersionNotFoundError,
)
from superset_core.artifacts.store import ArtifactStoreBackend
from superset_core.artifacts.testing import InMemoryArtifactStore


class FakeProvider:
    """A provider with canned answers, structurally an ``ArtifactRuntimeProvider``."""

    def __init__(self) -> None:
        self.store = InMemoryArtifactStore()

    def mint_frame_link(self, ref: ArtifactRef, context: FrameContext) -> FrameLink:
        return FrameLink(
            url=f"https://sandbox.example.com/frame/{ref.artifact_id}",
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=60),
        )

    def build(self, ref: ArtifactRef) -> BuildResult:
        return BuildResult(ok=True, bundle_id=f"bundle-{ref.artifact_id}")

    def check(self, ref: ArtifactRef) -> CheckResult:
        return CheckResult(
            ok=False,
            diagnostics=(Diagnostic("x is not defined", file="app.js", line=3),),
            console=("rendering",),
            subscribed_to_data=True,
        )

    def store_backend(self) -> ArtifactStoreBackend | None:
        return self.store


@pytest.fixture(autouse=True)
def _no_registered_provider() -> Iterator[None]:
    """Each test starts, and leaves the registry, with no provider."""
    clear_provider()
    yield
    clear_provider()


def test_artifacts_are_off_without_a_provider() -> None:
    assert get_provider() is None
    assert not artifacts_available()


def test_registering_a_provider_turns_artifacts_on() -> None:
    provider = FakeProvider()
    register_provider(provider)
    assert get_provider() is provider
    assert artifacts_available()


def test_a_second_provider_needs_replace() -> None:
    first, second = FakeProvider(), FakeProvider()
    register_provider(first)
    with pytest.raises(ProviderAlreadyRegisteredError, match="replace=True"):
        register_provider(second)
    assert get_provider() is first

    register_provider(second, replace=True)
    assert get_provider() is second


def test_clear_provider_turns_artifacts_off() -> None:
    register_provider(FakeProvider())
    clear_provider()
    assert get_provider() is None
    assert not artifacts_available()


def test_register_provider_rejects_other_objects() -> None:
    with pytest.raises(TypeError, match="does not implement ArtifactRuntimeProvider"):
        register_provider(object())  # type: ignore[arg-type]
    assert not artifacts_available()


def test_a_structural_provider_satisfies_the_protocol() -> None:
    provider = FakeProvider()
    assert isinstance(provider, ArtifactRuntimeProvider)
    assert isinstance(provider.store_backend(), ArtifactStoreBackend)

    ref = ArtifactRef("artifact-1")
    context = FrameContext(
        mode="canvas",
        allowed_parents=("https://superset.example.com",),
        capabilities=frozenset({Capability.DATA, Capability.THEME}),
    )
    link = provider.mint_frame_link(ref, context)
    assert link.url.endswith("/artifact-1")
    assert link.expires_at.tzinfo is not None
    assert provider.build(ref).bundle_id == "bundle-artifact-1"
    assert provider.check(ref).diagnostics[0].line == 3


def test_the_provider_plays_every_role() -> None:
    provider = FakeProvider()
    assert isinstance(provider, FrameLinkMinter)
    assert isinstance(provider, ArtifactBuilder)
    assert isinstance(provider, ArtifactChecker)
    assert isinstance(provider, ArtifactStoreSource)


class FramesOnly:
    """Just the sandbox's role, as a fake for code that only mints links."""

    def mint_frame_link(self, ref: ArtifactRef, context: FrameContext) -> FrameLink:
        return FrameLink(
            url=f"https://sandbox.example.com/frame/{ref.artifact_id}",
            expires_at=datetime(2026, 11, 15, tzinfo=timezone.utc),
        )


def test_one_role_serves_code_that_needs_only_it() -> None:
    """A role is enough to call; registering still takes the whole provider."""
    frames = FramesOnly()
    assert isinstance(frames, FrameLinkMinter)
    assert not isinstance(frames, ArtifactRuntimeProvider)
    with pytest.raises(TypeError, match="does not implement"):
        register_provider(frames)  # type: ignore[arg-type]


class StoreOnly:
    """Just the store's role, as a fake for code that only needs the files."""

    def store_backend(self) -> ArtifactStoreBackend | None:
        return InMemoryArtifactStore()


def test_the_store_is_a_role_of_its_own() -> None:
    source = StoreOnly()
    assert isinstance(source, ArtifactStoreSource)
    assert not isinstance(source, ArtifactRuntimeProvider)
    assert isinstance(source.store_backend(), ArtifactStoreBackend)


def test_a_version_the_store_lacks_has_an_error_of_its_own() -> None:
    """A ``LookupError`` that callers catch without catching a ``KeyError`` bug."""
    assert sdk.VersionNotFoundError is VersionNotFoundError
    assert issubclass(VersionNotFoundError, LookupError)
    assert not issubclass(KeyError, VersionNotFoundError)
    assert not issubclass(VersionNotFoundError, KeyError)


def test_frame_links_expire_at_an_aware_instant() -> None:
    expires_at = datetime(2026, 11, 15, 9, 30, tzinfo=timezone.utc)
    assert FrameLink("https://sandbox.example.com/f", expires_at).expires_at == (
        expires_at
    )
    with pytest.raises(ValueError, match="timezone-aware"):
        FrameLink("https://sandbox.example.com/f", datetime(2026, 11, 15, 9, 30))


def test_artifact_ref_defaults_to_the_draft() -> None:
    assert ArtifactRef("artifact-1").version is None


def test_results_have_empty_defaults() -> None:
    assert Diagnostic("oops").severity == "error"
    assert BuildResult(ok=True) == BuildResult(ok=True, diagnostics=(), bundle_id=None)
    check = CheckResult(ok=True)
    assert check.diagnostics == ()
    assert check.console == ()
    assert check.csp_violations == ()
    assert not check.subscribed_to_data
    assert check.dom_summary is None


def test_value_objects_are_frozen_and_hashable() -> None:
    context = FrameContext(
        mode="embedded",
        allowed_parents=("https://customer.example.com",),
        capabilities=frozenset({Capability.DATA}),
    )
    same = FrameContext(
        mode="embedded",
        allowed_parents=("https://customer.example.com",),
        capabilities=frozenset({Capability.DATA}),
    )
    assert context == same
    assert hash(context) == hash(same)
    with pytest.raises(FrozenInstanceError):
        context.mode = "canvas"  # type: ignore[misc]
    with pytest.raises(FrozenInstanceError):
        ArtifactRef("artifact-1").version = "v2"  # type: ignore[misc]
