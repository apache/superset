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
"""Unit tests for ``VersionDAO``.

Exercises the pure helpers (``derive_version_uuid``) and the
``restore_version`` control-flow branches that can be covered with mocks
alone. Full round-trip scalar restore / audit stamping / non-destructive
behaviour is covered by the integration tests in
``tests/integration_tests/{charts,dashboards,datasets}/version_history_tests.py``
— those need a real Continuum stack and live DB, which unit tests here
deliberately avoid.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import UUID

from superset.daos.version import (
    derive_version_uuid,
    VERSION_UUID_NAMESPACE,
    VersionDAO,
)

# ---------------------------------------------------------------------------
# derive_version_uuid
# ---------------------------------------------------------------------------


def test_derive_version_uuid_is_deterministic():
    entity = UUID("14f48794-ebfa-4f60-a26a-582c49132f1b")
    assert derive_version_uuid(entity, 42) == derive_version_uuid(entity, 42)


def test_derive_version_uuid_differs_across_tx():
    entity = UUID("14f48794-ebfa-4f60-a26a-582c49132f1b")
    assert derive_version_uuid(entity, 1) != derive_version_uuid(entity, 2)


def test_derive_version_uuid_differs_across_entities():
    tx = 42
    a = UUID("14f48794-ebfa-4f60-a26a-582c49132f1b")
    b = UUID("b388a396-cbca-4299-a443-3e41e870e2c2")
    assert derive_version_uuid(a, tx) != derive_version_uuid(b, tx)


def test_derive_version_uuid_is_v5():
    """UUIDs must be version 5 — changing this is a breaking change."""
    entity = UUID("14f48794-ebfa-4f60-a26a-582c49132f1b")
    result = derive_version_uuid(entity, 1)
    assert result.version == 5


def test_derive_version_uuid_uses_fixed_namespace():
    """Asserts the namespace constant hasn't drifted (changing it
    invalidates every cached version_uuid — see the constant's comment)."""
    assert VERSION_UUID_NAMESPACE == UUID("7a6f5d9b-4c3b-5d8e-9a1c-0e2b4c6d8f10")


# ---------------------------------------------------------------------------
# restore_version control-flow — unknown entity / out-of-range version
# ---------------------------------------------------------------------------


@patch("superset.versioning.restore.find_active_by_uuid", return_value=None)
def test_restore_version_returns_none_for_unknown_entity(mock_find):
    """Unknown entity UUID → caller raises 404."""
    result = VersionDAO.restore_version(
        MagicMock(__name__="Dashboard"),
        UUID("00000000-0000-0000-0000-000000000000"),
        0,
    )
    assert result is None


# Out-of-range version_num (the lookup query returns None) is verified
# end-to-end in the integration tests
# (``test_restore_returns_404_for_unknown_version_uuid`` in the three
# {charts,dashboards,datasets}/version_history_tests.py suites). A pure
# unit-level version of that test would require mocking the full
# SQLAlchemy expression tree — including ``ver_cls.operation_type != 0``
# — which is fragile and doesn't add coverage beyond what the
# integration path already provides.
