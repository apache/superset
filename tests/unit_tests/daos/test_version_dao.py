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
"""Unit tests for VersionDAO.

Exercise the pure helpers (``derive_version_uuid``,
``_coerce_snapshot_list``, ``_deserialize_snapshot_value``,
``VersionDAO._parse_slice_ids_json``) and the ``restore_version``
control-flow branches that can be covered with mocks alone. Full
round-trip scalar restore / audit stamping / non-destructive behaviour
is covered by the integration tests in
``tests/integration_tests/{charts,dashboards,datasets}/version_history_tests.py``
— those need a real Continuum stack and live DB, which unit tests
here deliberately avoid.
"""

from __future__ import annotations

from datetime import date, datetime
from unittest.mock import MagicMock, patch
from uuid import UUID

from superset.daos.version import (
    _coerce_snapshot_list,
    _deserialize_snapshot_value,
    derive_version_uuid,
    RESTORE_EXCLUDE_FIELDS,
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
# RESTORE_EXCLUDE_FIELDS constant (guards against accidental removal)
# ---------------------------------------------------------------------------


def test_restore_exclude_fields_covers_audit_columns():
    assert "created_on" in RESTORE_EXCLUDE_FIELDS
    assert "created_by_fk" in RESTORE_EXCLUDE_FIELDS
    assert "changed_on" in RESTORE_EXCLUDE_FIELDS
    assert "changed_by_fk" in RESTORE_EXCLUDE_FIELDS


# ---------------------------------------------------------------------------
# _coerce_snapshot_list
# ---------------------------------------------------------------------------


def test_coerce_snapshot_list_handles_none():
    assert _coerce_snapshot_list(None) == []


def test_coerce_snapshot_list_passes_through_list():
    data = [{"a": 1}, {"b": 2}]
    assert _coerce_snapshot_list(data) is data


def test_coerce_snapshot_list_parses_json_string():
    assert _coerce_snapshot_list('[{"x": 1}]') == [{"x": 1}]


def test_coerce_snapshot_list_handles_invalid_json():
    assert _coerce_snapshot_list("not-json") == []


def test_coerce_snapshot_list_rejects_non_list_json():
    assert _coerce_snapshot_list('{"not": "a list"}') == []


def test_coerce_snapshot_list_rejects_unknown_type():
    assert _coerce_snapshot_list(42) == []


# ---------------------------------------------------------------------------
# _deserialize_snapshot_value
# ---------------------------------------------------------------------------


def test_deserialize_snapshot_value_passes_through_non_strings():
    column = MagicMock()
    assert _deserialize_snapshot_value(column, None) is None
    assert _deserialize_snapshot_value(column, 42) == 42
    assert _deserialize_snapshot_value(column, True) is True


def test_deserialize_snapshot_value_parses_iso_datetime():
    column = MagicMock()
    column.type.python_type = datetime
    value = "2026-04-23T10:15:30"
    assert _deserialize_snapshot_value(column, value) == datetime.fromisoformat(value)


def test_deserialize_snapshot_value_parses_iso_date():
    column = MagicMock()
    column.type.python_type = date
    assert _deserialize_snapshot_value(column, "2026-04-23") == date(2026, 4, 23)


def test_deserialize_snapshot_value_parses_uuid():
    column = MagicMock()
    column.type.python_type = UUID
    raw = "14f48794-ebfa-4f60-a26a-582c49132f1b"
    assert _deserialize_snapshot_value(column, raw) == UUID(raw)


def test_deserialize_snapshot_value_tolerates_unsupported_type():
    """Columns whose python_type raises NotImplementedError (some custom
    types) must fall through without raising."""
    column = MagicMock()
    column.type = MagicMock()
    type(column.type).python_type = property(
        lambda _self: (_ for _ in ()).throw(NotImplementedError())
    )
    assert _deserialize_snapshot_value(column, "whatever") == "whatever"


def test_deserialize_snapshot_value_tolerates_invalid_iso_string():
    column = MagicMock()
    column.type.python_type = datetime
    assert _deserialize_snapshot_value(column, "not-a-date") == "not-a-date"


# ---------------------------------------------------------------------------
# VersionDAO._parse_slice_ids_json
# ---------------------------------------------------------------------------


def test_parse_slice_ids_json_from_list():
    assert VersionDAO._parse_slice_ids_json([1, 2, 3]) == [1, 2, 3]


def test_parse_slice_ids_json_from_string():
    assert VersionDAO._parse_slice_ids_json("[1, 2, 3]") == [1, 2, 3]


def test_parse_slice_ids_json_drops_non_integer_items():
    assert VersionDAO._parse_slice_ids_json([1, "two", 3, None, 4.5]) == [1, 3]


def test_parse_slice_ids_json_coerces_numeric_strings():
    assert VersionDAO._parse_slice_ids_json(["1", "2", "-3"]) == [1, 2, -3]


def test_parse_slice_ids_json_handles_none():
    assert VersionDAO._parse_slice_ids_json(None) == []


def test_parse_slice_ids_json_handles_invalid_json():
    assert VersionDAO._parse_slice_ids_json("not-json") == []


# ---------------------------------------------------------------------------
# restore_version control-flow — unknown entity / out-of-range version
# ---------------------------------------------------------------------------


@patch.object(VersionDAO, "_find_active_entity_by_uuid", return_value=None)
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
