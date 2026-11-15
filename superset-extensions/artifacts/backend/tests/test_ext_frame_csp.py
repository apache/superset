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
"""The sandbox site that the extension declares for the host pages' CSP."""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from datetime import datetime, timezone

import pytest
from superset_core.artifacts.provider import (
    ArtifactRef,
    BuildResult,
    CheckResult,
    clear_provider,
    FrameContext,
    FrameLink,
    register_provider,
)
from superset_core.artifacts.store import ArtifactStoreBackend
from superset_core.artifacts.testing import InMemoryArtifactStore
from superset_core.extensions.csp import csp_source_problem
from superset_oss.artifacts.frames.csp import csp_sources_for, frame_csp_sources

SANDBOX = "https://*.sandbox.example"


class SandboxOnly:
    """A provider's frame sources and nothing else."""

    def frame_sources(self) -> Sequence[str]:
        return (SANDBOX, "https://sandbox.example")


class Provider:
    """A provider whose store backend is ``backend``."""

    def __init__(self, backend: ArtifactStoreBackend | None) -> None:
        self.backend = backend

    def mint_frame_link(self, ref: ArtifactRef, context: FrameContext) -> FrameLink:
        return FrameLink(
            url=f"https://a1.sandbox.example/{ref.artifact_id}",
            expires_at=datetime(2026, 11, 15, tzinfo=timezone.utc),
        )

    def frame_sources(self) -> Sequence[str]:
        return (SANDBOX,)

    def build(self, ref: ArtifactRef) -> BuildResult:
        return BuildResult(ok=True)

    def check(self, ref: ArtifactRef) -> CheckResult:
        return CheckResult(ok=True)

    def store_backend(self) -> ArtifactStoreBackend | None:
        return self.backend


@pytest.fixture(autouse=True)
def _no_registered_provider() -> Iterator[None]:
    clear_provider()
    yield
    clear_provider()


def test_frames_need_the_sandbox_in_frame_src() -> None:
    assert csp_sources_for(SandboxOnly()) == {
        "frame-src": [SANDBOX, "https://sandbox.example"]
    }


def test_nothing_is_declared_while_artifacts_are_off() -> None:
    assert frame_csp_sources() == {}


def test_the_providers_sandbox_is_declared_while_artifacts_are_on() -> None:
    register_provider(Provider(InMemoryArtifactStore()))
    sources = frame_csp_sources()
    assert sources == {"frame-src": [SANDBOX]}
    assert [csp_source_problem("frame-src", s) for s in sources["frame-src"]] == [None]


def test_nothing_is_declared_while_the_store_cant_run() -> None:
    """Every frame link answers NOT_ENABLED then, so no frame loads."""
    register_provider(Provider(None))
    assert frame_csp_sources() == {}


def test_the_declaration_follows_the_registered_provider() -> None:
    """The host asks per page, so a provider registered later is honoured."""
    assert frame_csp_sources() == {}
    register_provider(Provider(InMemoryArtifactStore()))
    assert frame_csp_sources() == {"frame-src": [SANDBOX]}
    clear_provider()
    assert frame_csp_sources() == {}
