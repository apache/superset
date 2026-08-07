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
"""Tests for migration
``1a27941d5352_restore_pivot_table_percent_display``.

Covers the two helper functions (_migrate_params,
_migrate_query_context_form_data), the full upgrade() path across multiple
slices, and that downgrade() is a genuine no-op.
"""

from __future__ import annotations

from importlib import import_module
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from superset.utils import json

migration = import_module(
    "superset.migrations.versions."
    "2026-08-05_00-00_1a27941d5352_restore_pivot_table_percent_display"
)

Slice = migration.Slice
_migrate_params = migration._migrate_params
_migrate_query_context_form_data = migration._migrate_query_context_form_data
_VIZ_TYPE = migration._VIZ_TYPE
_OLD_FIELD = migration._OLD_FIELD
_NEW_FIELD = migration._NEW_FIELD
_FRACTION_MAPPING = migration._FRACTION_MAPPING


@pytest.fixture
def engine():
    engine = create_engine("sqlite:///:memory:", future=True)
    migration.Base.metadata.create_all(engine)
    return engine


# ---------------------------------------------------------------------------
# _migrate_params
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("old_value", "expected_new_value"),
    list(_FRACTION_MAPPING.items()),
)
def test_migrate_params_maps_every_fraction_value(old_value, expected_new_value):
    slc = Slice(params=json.dumps({"viz_type": _VIZ_TYPE, _OLD_FIELD: old_value}))
    changed = _migrate_params(slc)
    assert changed
    result = json.loads(slc.params)
    assert result[_NEW_FIELD] == expected_new_value
    assert _OLD_FIELD not in result


def test_migrate_params_noop_for_non_fraction_value():
    params = json.dumps({"viz_type": _VIZ_TYPE, _OLD_FIELD: "Sum"})
    slc = Slice(params=params)
    changed = _migrate_params(slc)
    assert not changed
    result = json.loads(slc.params)
    # Non-fraction aggregateFunction values are out of scope and left alone.
    assert result[_OLD_FIELD] == "Sum"
    assert _NEW_FIELD not in result


@pytest.mark.parametrize(
    "old_value",
    [
        "Count as Fraction of Total",
        "Count as Fraction of Rows",
        "Count as Fraction of Columns",
    ],
)
def test_migrate_params_noop_for_count_fraction_value(old_value):
    """Count-based fractions divided record counts, not metric values -- see
    the module docstring for why translating them to the new value-based
    showValuesAs modes would change what the chart displays."""
    params = json.dumps({"viz_type": _VIZ_TYPE, _OLD_FIELD: old_value})
    slc = Slice(params=params)
    changed = _migrate_params(slc)
    assert not changed
    result = json.loads(slc.params)
    assert result[_OLD_FIELD] == old_value
    assert _NEW_FIELD not in result


@pytest.mark.parametrize("malformed_params", ["[]", "null", "1", '"a string"'])
def test_migrate_params_noop_when_params_not_dict(malformed_params):
    """A historically malformed non-dict params value must be skipped, not
    raise, so one bad row can't abort `superset db upgrade` partway through
    paginated_update's batches."""
    slc = Slice(params=malformed_params)
    changed = _migrate_params(slc)
    assert not changed
    assert slc.params == malformed_params


def test_migrate_params_noop_when_field_absent():
    params = json.dumps({"viz_type": _VIZ_TYPE, "colTotals": True})
    slc = Slice(params=params)
    assert not _migrate_params(slc)


def test_migrate_params_noop_when_already_set():
    """Never clobber a showValuesAs the user already configured through the
    new control, even if a stale aggregateFunction is somehow also present."""
    params = json.dumps(
        {
            _OLD_FIELD: "Sum as Fraction of Total",
            _NEW_FIELD: "percent_row",
        }
    )
    slc = Slice(params=params)
    changed = _migrate_params(slc)
    assert not changed
    result = json.loads(slc.params)
    assert result[_NEW_FIELD] == "percent_row"


def test_migrate_params_noop_when_params_empty():
    assert not _migrate_params(Slice(params=None))


def test_migrate_params_noop_on_invalid_json():
    slc = Slice(params="not-json")
    changed = _migrate_params(slc)
    assert not changed
    assert slc.params == "not-json"


# ---------------------------------------------------------------------------
# _migrate_query_context_form_data
# ---------------------------------------------------------------------------


def test_migrate_query_context_maps_fraction_value():
    qc = json.dumps(
        {
            "form_data": {_OLD_FIELD: "Sum as Fraction of Columns"},
            "queries": [],
        }
    )
    slc = Slice(query_context=qc)
    changed = _migrate_query_context_form_data(slc)
    assert changed
    result = json.loads(slc.query_context)
    assert result["form_data"][_NEW_FIELD] == "percent_col"
    assert _OLD_FIELD not in result["form_data"]


def test_migrate_query_context_noop_when_form_data_missing():
    qc = json.dumps({"queries": []})
    slc = Slice(query_context=qc)
    assert not _migrate_query_context_form_data(slc)


def test_migrate_query_context_noop_when_query_context_empty():
    assert not _migrate_query_context_form_data(Slice(query_context=None))


@pytest.mark.parametrize("malformed_qc", ["[]", "null", "1", '"a string"'])
def test_migrate_query_context_noop_when_query_context_not_dict(malformed_qc):
    slc = Slice(query_context=malformed_qc)
    changed = _migrate_query_context_form_data(slc)
    assert not changed
    assert slc.query_context == malformed_qc


def test_migrate_query_context_noop_on_invalid_json():
    slc = Slice(query_context="not-json")
    changed = _migrate_query_context_form_data(slc)
    assert not changed
    assert slc.query_context == "not-json"


# ---------------------------------------------------------------------------
# Full upgrade() integration test
# ---------------------------------------------------------------------------


def test_upgrade_restores_percent_display_only_for_affected_pivot_tables(
    engine,
) -> None:
    with Session(engine, future=True) as seed:
        seed.add_all(
            [
                # Had a fraction display configured before #41184 -- must be
                # restored via the new field, and the old field cleaned up.
                Slice(
                    id=1,
                    viz_type=_VIZ_TYPE,
                    params=json.dumps(
                        {
                            "viz_type": _VIZ_TYPE,
                            _OLD_FIELD: "Sum as Fraction of Total",
                        }
                    ),
                    query_context=json.dumps(
                        {
                            "form_data": {_OLD_FIELD: "Sum as Fraction of Total"},
                            "queries": [],
                        }
                    ),
                ),
                # Had a non-fraction aggregateFunction -- was never broken by
                # the removal, must be left completely untouched.
                Slice(
                    id=2,
                    viz_type=_VIZ_TYPE,
                    params=json.dumps({"viz_type": _VIZ_TYPE, _OLD_FIELD: "Average"}),
                    query_context=None,
                ),
                # A different viz type that happens to reuse the same field
                # name coincidentally -- must be left untouched.
                Slice(
                    id=3,
                    viz_type="table",
                    params=json.dumps(
                        {
                            "viz_type": "table",
                            _OLD_FIELD: "Sum as Fraction of Rows",
                        }
                    ),
                    query_context=None,
                ),
            ]
        )
        seed.commit()

    # Simulate the Alembic transaction the same way the real migration runs:
    # bind the session to an explicit connection so paginated_update's
    # internal commits are visible once the outer transaction closes.
    with engine.begin() as conn:
        upgrade_session = Session(bind=conn, future=True)
        with (
            patch.object(migration, "op") as mock_op,
            patch.object(migration, "db") as mock_db,
        ):
            mock_op.get_bind.return_value = conn
            mock_db.Session.return_value = upgrade_session
            migration.upgrade()

    with Session(engine, future=True) as verify:
        slc1 = verify.get(Slice, 1)
        params1 = json.loads(slc1.params)
        assert params1[_NEW_FIELD] == "percent_total"
        assert _OLD_FIELD not in params1
        qc1 = json.loads(slc1.query_context)
        assert qc1["form_data"][_NEW_FIELD] == "percent_total"
        assert _OLD_FIELD not in qc1["form_data"]

        slc2 = verify.get(Slice, 2)
        params2 = json.loads(slc2.params)
        assert params2[_OLD_FIELD] == "Average"
        assert _NEW_FIELD not in params2

        slc3 = verify.get(Slice, 3)
        params3 = json.loads(slc3.params)
        assert params3[_OLD_FIELD] == "Sum as Fraction of Rows"
        assert _NEW_FIELD not in params3


def test_downgrade_is_a_noop() -> None:
    """downgrade() must not raise and must not be a real reverse migration --
    see the module docstring for why nothing is restored."""
    migration.downgrade()
