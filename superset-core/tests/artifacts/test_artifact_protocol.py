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

"""The bridge protocol constants, and their TypeScript counterparts."""

from __future__ import annotations

from pathlib import Path

import pytest
from superset_core.artifacts.capabilities import Capability
from superset_core.artifacts.protocol import (
    FRAME_MESSAGE_TYPES,
    HOST_MESSAGE_TYPES,
    PROTOCOL_NAME,
    PROTOCOL_VERSION,
    REQUEST_CAPABILITIES,
    REQUEST_TYPES,
)

SDK_SOURCES = (
    Path(__file__).resolve().parents[3]
    / "superset-frontend"
    / "packages"
    / "superset-artifact-sdk"
    / "src"
)


def test_protocol_identity() -> None:
    assert PROTOCOL_NAME == "superset-artifacts"
    assert PROTOCOL_VERSION == 1


def test_every_request_needs_a_capability() -> None:
    assert set(REQUEST_CAPABILITIES) == set(REQUEST_TYPES)
    assert all(isinstance(value, Capability) for value in REQUEST_CAPABILITIES.values())


def test_host_and_frame_message_types_are_distinct() -> None:
    assert not set(HOST_MESSAGE_TYPES) & set(FRAME_MESSAGE_TYPES)


@pytest.mark.skipif(
    not SDK_SOURCES.is_dir(), reason="the TypeScript SDK isn't in this checkout"
)
def test_the_typescript_sdk_shares_the_constants() -> None:
    """Guards against the two halves of the contract drifting apart."""
    protocol = (SDK_SOURCES / "protocol.ts").read_text(encoding="utf-8")
    assert f"PROTOCOL_NAME = '{PROTOCOL_NAME}'" in protocol
    assert f"PROTOCOL_VERSION = {PROTOCOL_VERSION};" in protocol
    for request_type, capability in REQUEST_CAPABILITIES.items():
        assert f"{request_type}: Capability.{capability.name}," in protocol

    capabilities = (SDK_SOURCES / "capabilities.ts").read_text(encoding="utf-8")
    for capability in Capability:
        assert f"{capability.name}: '{capability.value}'," in capabilities
