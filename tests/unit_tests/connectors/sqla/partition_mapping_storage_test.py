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
Where a partition filter mapping is persisted.

The feature ships stored in ``tables.extra`` and moves to four real columns in a
later migration, so these tests are about the seam rather than the feature: that
the blob survives its neighbours, that a malformed one degrades to "not
configured" instead of propagating, that a write dirties the column exactly when
it should, and that the store is the only way in.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from flask import Flask

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.connectors.sqla.partition_mapping_storage import (
    ColumnPartitionMappingStore,
    ColumnTransform,
    EXTRA_KEY,
    extra_with_partition_mapping,
    ExtraJsonPartitionMappingStore,
    load_partition_mapping,
    MAX_COLUMN_NAME_LENGTH,
    MAX_TRANSFORM_LENGTH,
    parse_mapping,
    partition_mapping_store,
    set_partition_mapping,
    StoredPartitionMapping,
)
from superset.models.core import Database
from superset.utils import json

MAPPING = StoredPartitionMapping(
    partition_column="dt_epoch",
    mapped_column=None,
    column_transforms={
        "event_time": ColumnTransform("unix_timestamp(:value)", is_monotonic=True)
    },
)


def _table(extra: str | None = None) -> SqlaTable:
    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    return SqlaTable(
        table_name="web_events",
        database=database,
        main_dttm_col="event_time",
        extra=extra,
        columns=[
            TableColumn(column_name="event_time", is_dttm=True, type="TIMESTAMP"),
            TableColumn(column_name="dt_epoch", type="BIGINT"),
        ],
    )


# ---------------------------------------------------------------------------
# Round-tripping
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "mapping",
    [
        StoredPartitionMapping(),
        StoredPartitionMapping(partition_column="dt_epoch"),
        StoredPartitionMapping(partition_column="dt_epoch", mapped_column="event_time"),
        MAPPING,
        StoredPartitionMapping(
            partition_column="dt_epoch",
            column_transforms={
                "event_time": ColumnTransform("unix_timestamp(:value)"),
                "country": ColumnTransform("lower(:value)", is_monotonic=False),
            },
        ),
    ],
)
def test_the_store_round_trips_a_mapping(
    app: Flask, mapping: StoredPartitionMapping
) -> None:
    table = _table()

    with app.app_context():
        store = partition_mapping_store()
        store.save(table, mapping)
        assert store.load(table) == mapping


def test_a_write_is_a_new_string_not_a_mutation(app: Flask) -> None:
    """
    `decode_extra` parses fresh and throws its dict away, so mutating a parsed
    copy would change nothing on the model -- SQLAlchemy would never see the
    attribute as dirty, and neither would Continuum.
    """
    table = _table()

    with app.app_context():
        partition_mapping_store().save(table, MAPPING)

    assert sa.inspect(table).attrs.extra.history.has_changes()
    assert json.loads(table.extra)[EXTRA_KEY]["partition_column"] == "dt_epoch"


def test_a_no_op_write_does_not_dirty_extra(app: Flask) -> None:
    """A version row for an edit that changed nothing is noise in the history."""
    table = _table(extra_with_partition_mapping(None, MAPPING))
    sa.inspect(table).attrs.extra.history  # noqa: B018
    before = table.extra

    with app.app_context():
        partition_mapping_store().save(table, MAPPING)

    assert table.extra is before


def test_clearing_a_mapping_removes_the_key(app: Flask) -> None:
    """
    Rather than leaving ``"partition_filter_mapping": null`` behind. Datasets
    that never used the feature, and datasets that stopped, should look the same
    in the blob.
    """
    table = _table(extra_with_partition_mapping(None, MAPPING))

    with app.app_context():
        partition_mapping_store().save(table, StoredPartitionMapping())

    assert EXTRA_KEY not in json.loads(table.extra)


# ---------------------------------------------------------------------------
# Defensive reads: ``extra`` is a free-text box
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw",
    [
        None,
        "",
        "not json",
        "[]",
        "3",
        '"a string"',
        "{}",
        '{"partition_filter_mapping": null}',
        '{"partition_filter_mapping": "nope"}',
        '{"partition_filter_mapping": []}',
        '{"partition_filter_mapping": {"partition_column": 42}}',
        '{"partition_filter_mapping": {"partition_column": ""}}',
        '{"partition_filter_mapping": {"partition_column": {"a": 1}}}',
    ],
)
def test_an_unusable_blob_reads_as_not_configured(raw: str | None) -> None:
    """
    Modelled on `get_dataset_timezone`: a value of the wrong type is "not
    configured", never propagated. Every one of these is something an owner can
    type into the editor's Extra box.
    """
    assert parse_mapping(raw) == StoredPartitionMapping()


def test_an_over_long_column_name_is_not_configured() -> None:
    """
    The typed API fields are length-validated; the Extra box is not, and these
    are the widths the columns get after the migration.
    """
    over = "x" * (MAX_COLUMN_NAME_LENGTH + 1)
    blob = {EXTRA_KEY: {"partition_column": over}}
    assert parse_mapping(json.dumps(blob)).partition_column is None

    at_limit = "x" * MAX_COLUMN_NAME_LENGTH
    blob = {EXTRA_KEY: {"partition_column": at_limit}}
    assert parse_mapping(json.dumps(blob)).partition_column == at_limit


def test_an_over_long_transform_is_not_configured() -> None:
    """An unbounded string would otherwise reach sqlglot on every query build."""
    blob = {
        EXTRA_KEY: {
            "partition_column": "dt_epoch",
            "column_transforms": {
                "event_time": {"value_transform": "x" * (MAX_TRANSFORM_LENGTH + 1)}
            },
        }
    }
    mapping = parse_mapping(json.dumps(blob))
    assert mapping.partition_column == "dt_epoch"
    assert mapping.transform_for("event_time").value_transform is None


@pytest.mark.parametrize("value", ["true", "no", 1, 0, [], {}, None])
def test_only_a_literal_true_declares_monotonicity(value: Any) -> None:
    """
    The one field where being wrong drops real rows rather than merely failing to
    prune: a truthy ``"no"`` coerced with ``bool()`` would enable range
    mirroring through a transform nobody declared order-preserving.
    """
    blob = {
        EXTRA_KEY: {
            "partition_column": "dt_epoch",
            "column_transforms": {
                "event_time": {
                    "value_transform": "unix_timestamp(:value)",
                    "is_monotonic": value,
                }
            },
        }
    }
    assert parse_mapping(json.dumps(blob)).transform_for("event_time").is_monotonic is (
        False
    )


def test_a_malformed_transform_entry_is_skipped_not_fatal() -> None:
    """One bad column must not cost the owner the rest of the mapping."""
    blob = {
        EXTRA_KEY: {
            "partition_column": "dt_epoch",
            "column_transforms": {
                "event_time": {"value_transform": "unix_timestamp(:value)"},
                "country": "not an object",
                "region_key": [],
                "dt_epoch": None,
            },
        }
    }
    mapping = parse_mapping(json.dumps(blob))
    assert set(mapping.column_transforms) == {"event_time"}


def test_an_undecodable_extra_is_replaced_and_logged(app: Flask) -> None:
    """
    It cannot be merged into, and the alternative -- silently dropping the
    mapping -- is worse and just as quiet. The text is already inert: nothing
    reads `certification` or `timezone` out of it either.
    """
    table = _table("not json at all")

    with app.app_context():
        with patch(
            "superset.connectors.sqla.partition_mapping_storage.logger"
        ) as logger:
            partition_mapping_store().save(table, MAPPING)

    assert load_partition_mapping.__module__  # keep the import honest
    assert logger.warning.called
    assert json.loads(table.extra)[EXTRA_KEY]["partition_column"] == "dt_epoch"


# ---------------------------------------------------------------------------
# The memo
# ---------------------------------------------------------------------------


def test_the_read_is_memoized_per_instance(app: Flask) -> None:
    """
    `load` is on the hot path -- `get_extra_cache_keys`, every `get_sqla_query`,
    and once per column in `TableColumn.data`.
    """
    table = _table(extra_with_partition_mapping(None, MAPPING))

    with app.app_context():
        with patch(
            "superset.connectors.sqla.partition_mapping_storage.parse_mapping",
            side_effect=parse_mapping,
        ) as spy:
            for _ in range(5):
                assert load_partition_mapping(table) == MAPPING

    assert spy.call_count == 1


def test_the_memo_invalidates_when_extra_changes(app: Flask) -> None:
    """Keyed on the raw string, so an assignment anywhere invalidates it."""
    table = _table(extra_with_partition_mapping(None, MAPPING))

    with app.app_context():
        assert load_partition_mapping(table).partition_column == "dt_epoch"
        table.extra = json.dumps({"timezone": "Europe/Berlin"})
        assert load_partition_mapping(table) == StoredPartitionMapping()


def test_the_memo_is_not_a_mapped_attribute() -> None:
    """It must never reach the database, or confuse Continuum's diffing."""
    names = set(sa.inspect(SqlaTable).attrs.keys())
    assert not {name for name in names if name.startswith("_partition_mapping")}


# ---------------------------------------------------------------------------
# The model facade
# ---------------------------------------------------------------------------


def test_the_facade_reads_through_the_store(app: Flask) -> None:
    table = _table(extra_with_partition_mapping(None, MAPPING))

    with app.app_context():
        assert table.partition_column == "dt_epoch"
        # `None` means "follow main_dttm_col", which is not resolved on read.
        assert table.partition_mapped_column is None

        event_time, dt_epoch = table.columns
        assert event_time.partition_value_transform == "unix_timestamp(:value)"
        assert event_time.partition_transform_is_monotonic is True
        assert dt_epoch.partition_value_transform is None
        assert dt_epoch.partition_transform_is_monotonic is False


def test_a_detached_column_reads_as_not_declared(app: Flask) -> None:
    """
    `DatasetDAO._override_columns` constructs `TableColumn(table_id=...)` with no
    relationship, so an unattached column is a normal state. Reporting "not
    declared" is the safe direction: mirroring stops rather than starting wrongly.
    """
    orphan = TableColumn(column_name="event_time")

    with app.app_context():
        assert orphan.partition_value_transform is None
        assert orphan.partition_transform_is_monotonic is False


@pytest.mark.parametrize(
    "attribute",
    ["partition_column", "partition_mapped_column"],
)
def test_the_dataset_attributes_are_read_only(app: Flask, attribute: str) -> None:
    """
    Assignment must raise rather than vanish. Under the extra-JSON store a
    setter's write is lost the moment `extra` is assigned afterwards, with no
    exception and no log -- and which of the two runs last depends on
    marshmallow's field ordering. This is the guard against reintroducing setters.
    """
    table = _table()
    with app.app_context():
        with pytest.raises(AttributeError):
            setattr(table, attribute, "dt_epoch")


@pytest.mark.parametrize(
    "attribute",
    ["partition_value_transform", "partition_transform_is_monotonic"],
)
def test_the_column_attributes_are_read_only(app: Flask, attribute: str) -> None:
    column = TableColumn(column_name="event_time")
    with app.app_context():
        with pytest.raises(AttributeError):
            setattr(column, attribute, "x")


def test_the_column_attributes_are_not_constructor_kwargs() -> None:
    """
    `DatasetDAO._upsert_columns` does `TableColumn(**properties)` with no
    whitelist, which is why the DAO's funnel strips these from the payload before
    it gets there.
    """
    with pytest.raises((AttributeError, TypeError)):
        TableColumn(column_name="event_time", partition_value_transform="x")


# ---------------------------------------------------------------------------
# The write API
# ---------------------------------------------------------------------------


def test_set_partition_mapping_patches_rather_than_replaces(app: Flask) -> None:
    table = _table(extra_with_partition_mapping(None, MAPPING))

    with app.app_context():
        set_partition_mapping(table, partition_column="other_epoch")

        assert table.partition_column == "other_epoch"
        # The transform, and the mapped-column override, are untouched.
        assert table.columns[0].partition_value_transform == "unix_timestamp(:value)"
        assert table.partition_mapped_column is None


def test_set_partition_mapping_targets_the_effective_mapped_column(
    app: Flask,
) -> None:
    """
    Setting a mapped column and its transform in one call has to do what it reads
    like, so the target is resolved after this call's `mapped_column`, not before.
    """
    table = _table()

    with app.app_context():
        set_partition_mapping(
            table,
            partition_column="dt_epoch",
            mapped_column="event_time",
            value_transform="unix_timestamp(:value)",
        )

        assert table.columns[0].partition_value_transform == "unix_timestamp(:value)"


def test_set_partition_mapping_can_target_a_named_column(app: Flask) -> None:
    """A transform may be declared on a column that is not (yet) the mapped one."""
    table = _table()

    with app.app_context():
        set_partition_mapping(table, value_transform="lower(:value)", column="dt_epoch")
        mapping = load_partition_mapping(table)

    assert mapping.transform_for("dt_epoch").value_transform == "lower(:value)"
    assert mapping.transform_for("event_time").value_transform is None


def test_set_partition_mapping_refuses_a_transform_with_no_column(app: Flask) -> None:
    table = _table()
    table.main_dttm_col = None

    with app.app_context():
        with pytest.raises(ValueError, match="no mapped column"):
            set_partition_mapping(table, value_transform="unix_timestamp(:value)")


def test_an_omitted_keyword_means_unchanged(app: Flask) -> None:
    table = _table(extra_with_partition_mapping(None, MAPPING))

    with app.app_context():
        set_partition_mapping(table, is_monotonic=False)
        mapping = load_partition_mapping(table)

    assert mapping.partition_column == "dt_epoch"
    assert (
        mapping.transform_for("event_time").value_transform == "unix_timestamp(:value)"
    )
    assert mapping.transform_for("event_time").is_monotonic is False


# ---------------------------------------------------------------------------
# The swap point
# ---------------------------------------------------------------------------


def test_the_factory_resolves_the_configured_store(app: Flask) -> None:
    with app.app_context():
        assert isinstance(partition_mapping_store(), ExtraJsonPartitionMappingStore)


def test_the_column_store_names_the_migration_it_needs(app: Flask) -> None:
    """
    Deliberately unimplemented rather than written against columns that do not
    exist: it would read `table.partition_column`, which today is the facade
    property, which calls the store. The error has to say what to do about it.
    """
    app.config["PARTITION_MAPPING_STORE"] = "columns"
    try:
        with app.app_context():
            store = partition_mapping_store()
            assert isinstance(store, ColumnPartitionMappingStore)
            for call in (
                lambda: store.load(_table()),
                lambda: store.save(_table(), MAPPING),
            ):
                with pytest.raises(NotImplementedError, match="migration"):
                    call()
    finally:
        app.config["PARTITION_MAPPING_STORE"] = "extra"


def test_an_unknown_store_is_a_configuration_error(app: Flask) -> None:
    app.config["PARTITION_MAPPING_STORE"] = "bogus"
    try:
        with app.app_context():
            with pytest.raises(ValueError, match="PARTITION_MAPPING_STORE"):
                partition_mapping_store()
    finally:
        app.config["PARTITION_MAPPING_STORE"] = "extra"


def test_the_facade_and_the_dao_read_whichever_store_is_configured(
    app: Flask,
) -> None:
    """
    The claim the indirection exists to support: swap the store and the model,
    the DAO and the query rewriter follow, with no other change. Proved against a
    dict-backed stand-in rather than the column store, which cannot be
    implemented before its migration.
    """
    from superset.connectors.sqla import partition_mapping_storage as storage

    class FakeStore:
        def __init__(self) -> None:
            self.mappings: dict[int, StoredPartitionMapping] = {}

        def load(self, table: SqlaTable) -> StoredPartitionMapping:
            return self.mappings.get(id(table), StoredPartitionMapping())

        def save(self, table: SqlaTable, mapping: StoredPartitionMapping) -> None:
            self.mappings[id(table)] = mapping

    fake = FakeStore()
    app.config["PARTITION_MAPPING_STORE"] = "fake"
    storage.STORES["fake"] = lambda: fake  # type: ignore[assignment]
    try:
        table = _table()
        with app.app_context():
            set_partition_mapping(
                table,
                partition_column="dt_epoch",
                mapped_column="event_time",
                value_transform="unix_timestamp(:value)",
                is_monotonic=True,
            )

            # Nothing was written to `extra` -- the store, not the column, is the
            # source of truth.
            assert table.extra is None
            assert table.partition_column == "dt_epoch"
            assert table.partition_mapped_column == "event_time"
            assert (
                table.columns[0].partition_value_transform == "unix_timestamp(:value)"
            )
            assert table.columns[0].partition_transform_is_monotonic is True
            assert table.partition_filter_mapping_summary == {
                "partition_column": "dt_epoch",
                "mapped_column": "event_time",
                "active": True,
            }
    finally:
        del storage.STORES["fake"]
        app.config["PARTITION_MAPPING_STORE"] = "extra"
