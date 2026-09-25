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
``141b8ada7731_tag_pivot_tables_with_restored_aggregation``.

Covers the helper (_has_legacy_aggregate_function), the full upgrade() path
across multiple slices (tagging + query_context invalidation, idempotency,
and that unaffected slices are left alone), and that downgrade() is a
genuine no-op.
"""

from __future__ import annotations

from importlib import import_module
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from superset.tags.models import ObjectType, TagType
from superset.utils import json

migration = import_module(
    "superset.migrations.versions."
    "2026-09-25_00-00_141b8ada7731_tag_pivot_tables_with_restored_"
)

Slice = migration.Slice
Tag = migration.Tag
TaggedObject = migration.TaggedObject
_has_legacy_aggregate_function = migration._has_legacy_aggregate_function
_VIZ_TYPE = migration._VIZ_TYPE
_FIELD = migration._FIELD
_LEGACY_AGGREGATE_FUNCTIONS = migration._LEGACY_AGGREGATE_FUNCTIONS
LEGACY_AGGREGATION_TAG = migration.LEGACY_AGGREGATION_TAG


@pytest.fixture
def engine():
    engine = create_engine("sqlite:///:memory:")
    migration.Base.metadata.create_all(engine)
    return engine


# ---------------------------------------------------------------------------
# _has_legacy_aggregate_function
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("value", sorted(_LEGACY_AGGREGATE_FUNCTIONS))
def test_has_legacy_aggregate_function_true_for_every_recognized_value(value):
    slc = Slice(params=json.dumps({"viz_type": _VIZ_TYPE, _FIELD: value}))
    assert _has_legacy_aggregate_function(slc)


def test_has_legacy_aggregate_function_false_for_unrecognized_value():
    params = json.dumps({"viz_type": _VIZ_TYPE, _FIELD: "Metric"})
    assert not _has_legacy_aggregate_function(Slice(params=params))


def test_has_legacy_aggregate_function_false_when_field_absent():
    params = json.dumps({"viz_type": _VIZ_TYPE, "colTotals": True})
    assert not _has_legacy_aggregate_function(Slice(params=params))


def test_has_legacy_aggregate_function_false_when_params_empty():
    assert not _has_legacy_aggregate_function(Slice(params=None))


@pytest.mark.parametrize("malformed_params", ["[]", "null", "1", '"a string"'])
def test_has_legacy_aggregate_function_false_when_params_not_dict(malformed_params):
    """A historically malformed non-dict params value must be skipped, not
    raise, so one bad row can't abort `superset db upgrade` partway through
    paginated_update's batches."""
    assert not _has_legacy_aggregate_function(Slice(params=malformed_params))


def test_has_legacy_aggregate_function_false_on_invalid_json():
    assert not _has_legacy_aggregate_function(Slice(params="not-json"))


# ---------------------------------------------------------------------------
# Full upgrade() integration test
# ---------------------------------------------------------------------------


def _run_upgrade(engine) -> None:
    # Simulate the Alembic transaction the same way the real migration runs:
    # bind the session to an explicit connection so paginated_update's
    # internal commits are visible once the outer transaction closes.
    with engine.begin() as conn:
        upgrade_session = Session(bind=conn)
        with (
            patch.object(migration, "op") as mock_op,
            patch.object(migration, "db") as mock_db,
        ):
            mock_op.get_bind.return_value = conn
            mock_db.Session.return_value = upgrade_session
            migration.upgrade()


def test_upgrade_tags_and_invalidates_only_affected_pivot_tables(engine) -> None:
    with Session(engine) as seed:
        seed.add_all(
            [
                # A legacy aggregateFunction value -- must be tagged and have
                # its cached query_context cleared.
                Slice(
                    id=1,
                    viz_type=_VIZ_TYPE,
                    params=json.dumps({"viz_type": _VIZ_TYPE, _FIELD: "Median"}),
                    query_context=json.dumps({"form_data": {_FIELD: "Median"}}),
                ),
                # "Metric" (today's default, "Use metric definition") is not a
                # legacy value -- was never affected, must be left untouched.
                Slice(
                    id=2,
                    viz_type=_VIZ_TYPE,
                    params=json.dumps({"viz_type": _VIZ_TYPE, _FIELD: "Metric"}),
                    query_context=json.dumps({"form_data": {_FIELD: "Metric"}}),
                ),
                # No aggregateFunction at all -- must be left untouched.
                Slice(
                    id=3,
                    viz_type=_VIZ_TYPE,
                    params=json.dumps({"viz_type": _VIZ_TYPE}),
                    query_context=json.dumps({"form_data": {}}),
                ),
                # A different viz type that happens to reuse the same field
                # name and a legacy-looking value coincidentally -- must be
                # left untouched, since result aggregation only exists for
                # pivot_table_v2.
                Slice(
                    id=4,
                    viz_type="table",
                    params=json.dumps({"viz_type": "table", _FIELD: "Average"}),
                    query_context=json.dumps({"form_data": {_FIELD: "Average"}}),
                ),
            ]
        )
        seed.commit()

    _run_upgrade(engine)

    with Session(engine) as verify:
        tag = verify.query(Tag).filter_by(name=LEGACY_AGGREGATION_TAG).one()
        assert tag.type == TagType.custom

        tagged_object_ids = {
            row.object_id
            for row in verify.query(TaggedObject).filter_by(
                tag_id=tag.id, object_type=ObjectType.chart
            )
        }
        assert tagged_object_ids == {1}

        slc1 = verify.get(Slice, 1)
        assert slc1.query_context is None

        slc2 = verify.get(Slice, 2)
        assert slc2.query_context is not None

        slc3 = verify.get(Slice, 3)
        assert slc3.query_context is not None

        slc4 = verify.get(Slice, 4)
        assert slc4.query_context is not None


def test_upgrade_is_idempotent_across_repeated_runs(engine) -> None:
    """A re-run (or a slice matching an already-created tag) must not violate
    the (tag_id, object_id, object_type) unique constraint, and must not
    create a second Tag row for the same name."""
    with Session(engine) as seed:
        seed.add(
            Slice(
                id=1,
                viz_type=_VIZ_TYPE,
                params=json.dumps({"viz_type": _VIZ_TYPE, _FIELD: "Sum"}),
                query_context=json.dumps({"form_data": {_FIELD: "Sum"}}),
            )
        )
        seed.commit()

    _run_upgrade(engine)
    _run_upgrade(engine)

    with Session(engine) as verify:
        tags = verify.query(Tag).filter_by(name=LEGACY_AGGREGATION_TAG).all()
        assert len(tags) == 1

        tagged = (
            verify.query(TaggedObject)
            .filter_by(tag_id=tags[0].id, object_id=1, object_type=ObjectType.chart)
            .all()
        )
        assert len(tagged) == 1


def test_downgrade_is_a_noop() -> None:
    """downgrade() must not raise and must not be a real reverse migration --
    see the module docstring for why nothing is restored."""
    migration.downgrade()
