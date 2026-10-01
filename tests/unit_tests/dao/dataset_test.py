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

import copy
from datetime import datetime
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from freezegun import freeze_time
from sqlalchemy.orm.session import Session

from superset.daos.base import BaseDAO
from superset.daos.dataset import DatasetDAO
from superset.sql.parse import Table
from tests.unit_tests.conftest import with_feature_flags


def test_validate_update_uniqueness(session: Session) -> None:
    """
    Test the `validate_update_uniqueness` static method.

    In particular, allow datasets with the same name in the same database as long as they
    are in different schemas
    """  # noqa: E501
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    dataset1 = SqlaTable(
        table_name="my_dataset",
        schema="main",
        database=database,
    )
    dataset2 = SqlaTable(
        table_name="my_dataset",
        schema="dev",
        database=database,
    )
    db.session.add_all([database, dataset1, dataset2])
    db.session.flush()

    assert (
        DatasetDAO.validate_update_uniqueness(
            database=database,
            table=Table(dataset1.table_name, dataset1.schema),
            dataset_id=dataset1.id,
        )
        is True
    )

    assert (
        DatasetDAO.validate_update_uniqueness(
            database=database,
            table=Table(dataset1.table_name, dataset2.schema),
            dataset_id=dataset1.id,
        )
        is False
    )

    assert (
        DatasetDAO.validate_update_uniqueness(
            database=database,
            table=Table(dataset1.table_name),
            dataset_id=dataset1.id,
        )
        is True
    )


def test_logical_duplicate_catalog_predicate_is_null_aware(session: Session) -> None:
    """A row stored with ``catalog = NULL`` is the default catalog, so a probe
    normalized to the database default must still match it.

    Before the null-aware predicate the stored ``catalog`` was compared as-is,
    so a ``catalog = NULL`` row and a ``catalog = <default>`` probe were treated
    as different physical tables and a default-catalog twin slipped through.
    """
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="cat_db", sqlalchemy_uri="sqlite://")
    stored_null = SqlaTable(
        table_name="t", schema="main", catalog=None, database=database
    )
    db.session.add_all([database, stored_null])
    db.session.flush()

    # Pretend the database exposes a non-NULL default catalog so the probe
    # normalizes to it; the NULL-stored row must still be recognized as a twin.
    with patch.object(Database, "get_default_catalog", return_value="default_cat"):
        probe = SqlaTable(
            table_name="t", schema="main", catalog="default_cat", database=database
        )
        db.session.add(probe)
        db.session.flush()
        assert DatasetDAO.has_active_logical_duplicate(probe) is True

        # A genuinely different (non-default) catalog is not a twin.
        other = SqlaTable(
            table_name="t", schema="main", catalog="other_cat", database=database
        )
        db.session.add(other)
        db.session.flush()
        assert DatasetDAO.has_active_logical_duplicate(other) is False


def test_find_soft_deleted_logical_duplicate(session: Session) -> None:
    """The importer create-path helper returns a soft-deleted twin (despite the
    visibility filter) and ignores active rows."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="sd_db", sqlalchemy_uri="sqlite://")
    twin = SqlaTable(table_name="t", schema="main", database=database)
    db.session.add_all([database, twin])
    db.session.flush()

    table = Table("t", "main")

    # Active row: not a soft-deleted twin.
    assert DatasetDAO.find_soft_deleted_logical_duplicate(database, table) is None

    # Soft-delete it: now found despite the visibility filter.
    twin.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
    db.session.flush()
    found = DatasetDAO.find_soft_deleted_logical_duplicate(database, table)
    assert found is not None
    assert found.id == twin.id

    # Catalog mismatch: a soft-deleted row in a *different* (non-default)
    # catalog is not the same physical table, so the null-aware predicate must
    # exclude it. (sqlite has no default catalog, so an explicit "other_cat"
    # row must only match an "other_cat" probe.)
    other_catalog_twin = SqlaTable(
        table_name="t2",
        schema="main",
        catalog="other_cat",
        database=database,
        deleted_at=datetime(2026, 1, 1, 12, 0, 0),
    )
    db.session.add(other_catalog_twin)
    db.session.flush()
    assert (
        DatasetDAO.find_soft_deleted_logical_duplicate(
            database, Table("t2", "main", "my_cat")
        )
        is None
    )
    # Same explicit catalog: found.
    same_catalog = DatasetDAO.find_soft_deleted_logical_duplicate(
        database, Table("t2", "main", "other_cat")
    )
    assert same_catalog is not None
    assert same_catalog.id == other_catalog_twin.id


@freeze_time("2025-01-01 00:00:00")
@patch.object(DatasetDAO, "update_columns")
@patch.object(DatasetDAO, "update_metrics")
@patch.object(BaseDAO, "update")
@pytest.mark.parametrize(
    "attributes,expected_attributes",
    [
        (
            {
                "columns": [{"id": 1, "name": "col1"}],
                "metrics": [{"id": 1, "name": "metric1"}],
            },
            {"changed_on": datetime(2025, 1, 1, 0, 0, 0)},
        ),
        (
            {
                "columns": [{"id": 1, "name": "col1"}],
                "metrics": [{"id": 1, "name": "metric1"}],
                "description": "test description",
            },
            {
                "description": "test description",
                "changed_on": datetime(2025, 1, 1, 0, 0, 0),
            },
        ),
        (
            {
                "columns": [{"id": 1, "name": "col1"}],
            },
            {"changed_on": datetime(2025, 1, 1, 0, 0, 0)},
        ),
        (
            {
                "columns": [{"id": 1, "name": "col1"}],
                "description": "test description",
            },
            {
                "description": "test description",
                "changed_on": datetime(2025, 1, 1, 0, 0, 0),
            },
        ),
        (
            {
                "metrics": [{"id": 1, "name": "metric1"}],
            },
            {"changed_on": datetime(2025, 1, 1, 0, 0, 0)},
        ),
        (
            {
                "metrics": [{"id": 1, "name": "metric1"}],
                "description": "test description",
            },
            {
                "description": "test description",
                "changed_on": datetime(2025, 1, 1, 0, 0, 0),
            },
        ),
        (
            {"description": "test description"},
            {"description": "test description"},
        ),
    ],
)
def test_update_dataset_related_metadata_updates_changed_on(
    base_update_mock: MagicMock,
    update_metrics_mock: MagicMock,
    update_columns_mock: MagicMock,
    attributes: dict[str, Any],
    expected_attributes: dict[str, Any],
) -> None:
    """
    Test that the changed_on property is updated when a metric or column is updated.
    """
    item = MagicMock()
    DatasetDAO.update(item, copy.deepcopy(attributes))

    if "columns" in attributes:
        update_columns_mock.assert_called_once_with(
            item, attributes["columns"], override_columns=False
        )
    else:
        update_columns_mock.assert_not_called()

    if "metrics" in attributes:
        update_metrics_mock.assert_called_once_with(item, attributes["metrics"])
    else:
        update_metrics_mock.assert_not_called()

    base_update_mock.assert_called_once_with(item, expected_attributes)


def _mock_dataset(catalog: str | None, default_catalog: str) -> MagicMock:
    """A SqlaTable-shaped mock with controllable catalog values."""
    model = MagicMock()
    model.id = 1
    model.database_id = 7
    model.schema = "public"
    model.table_name = "users"
    model.catalog = catalog
    model.database.get_default_catalog.return_value = default_catalog
    return model


def test_has_active_logical_duplicate_normalizes_unset_catalog(
    app_context: None,
) -> None:
    """A row stored with ``catalog = None`` is matched against the database
    default catalog, the same rule ``validate_uniqueness`` applies.

    This is the gap the soft-delete reviews flagged: restore/re-import
    compared the raw stored ``catalog`` while create/update normalized it, so
    a soft-deleted ``catalog = NULL`` row and an active default-catalog twin
    could be treated as different physical tables.
    """
    model = _mock_dataset(catalog=None, default_catalog="default_cat")

    with patch("superset.daos.dataset.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.first.return_value = None

        assert DatasetDAO.has_active_logical_duplicate(model) is False

    # Normalization must consult the database default when catalog is unset.
    model.database.get_default_catalog.assert_called_once()


def test_has_active_logical_duplicate_keeps_explicit_catalog(
    app_context: None,
) -> None:
    """An explicit catalog is matched exactly, but the database default is still
    consulted: the null-aware predicate needs it to decide whether the explicit
    catalog *is* the default (and should therefore also match ``catalog IS
    NULL`` rows)."""
    model = _mock_dataset(catalog="explicit_cat", default_catalog="default_cat")

    with patch("superset.daos.dataset.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.first.return_value = None

        assert DatasetDAO.has_active_logical_duplicate(model) is False

    model.database.get_default_catalog.assert_called_once()


def test_has_active_logical_duplicate_true_when_twin_found(
    app_context: None,
) -> None:
    """A matching active row makes the helper report a duplicate."""
    model = _mock_dataset(catalog="explicit_cat", default_catalog="default_cat")

    with patch("superset.daos.dataset.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.first.return_value = (
            MagicMock()
        )

        assert DatasetDAO.has_active_logical_duplicate(model) is True


def test_has_active_logical_duplicate_never_bypasses_visibility(
    app_context: None,
) -> None:
    """Contract tripwire for the docstring's do-not-add-the-bypass clause.

    The helper's active-rows-only semantics come from the SoftDeleteMixin
    listener; wrapping the query in ``skip_visibility_filter`` — the file's
    dominant pattern, so a plausible future "consistency" edit — would
    broaden the check to soft-deleted rows and silently refuse legitimate
    restores of legacy twin pairs. The suite stays green under that
    mutation without this pin.
    """
    model = _mock_dataset(catalog=None, default_catalog="default_cat")

    with (
        patch("superset.daos.dataset.db") as mock_db,
        patch("superset.models.helpers.skip_visibility_filter") as bypass_spy,
    ):
        mock_db.session.query.return_value.filter.return_value.first.return_value = None
        DatasetDAO.has_active_logical_duplicate(model)

    bypass_spy.assert_not_called()


def test_override_columns_preserves_pks_and_ignores_payload_id(
    session: Session,
) -> None:
    """``_override_columns`` matches by natural key (column_name): a
    name-matched column keeps its live PK even when the payload carries a
    different ``id``, unchanged columns' ids survive a metadata refresh (so
    chart references by id stay valid), removed columns are deleted, and new
    columns are inserted."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    database = Database(database_name="ov_db", sqlalchemy_uri="sqlite://")
    table = SqlaTable(table_name="ov_t", schema="main", database=database)
    table.columns = [TableColumn(column_name="a"), TableColumn(column_name="b")]
    db.session.add_all([database, table])
    db.session.flush()
    a_id = next(c.id for c in table.columns if c.column_name == "a")

    # Keep "a" (payload carries a bogus id + a real change), drop "b", add "c".
    DatasetDAO._override_columns(
        table,
        [
            {"column_name": "a", "id": a_id + 9999, "verbose_name": "A!"},
            {"column_name": "c"},
        ],
    )
    db.session.flush()

    # Query fresh (new columns are added by FK, not via the relationship).
    cols = db.session.query(TableColumn).filter_by(table_id=table.id).all()
    by_name = {c.column_name: c for c in cols}
    # "b" removed, "c" inserted, "a" retained.
    assert set(by_name) == {"a", "c"}
    # "a" kept its original PK (payload id ignored) and took the change — this
    # is the property charts depend on across a metadata refresh.
    assert by_name["a"].id == a_id
    assert by_name["a"].verbose_name == "A!"


def test_override_columns_rename_flushes_delete_before_insert(
    session: Session,
) -> None:
    """A rename (old name removed, new name added) works: the removed column is
    flushed out before the new one is inserted, so it can't collide on
    ``UNIQUE(table_id, column_name)`` mid-flush (the MySQL case-insensitive
    edge; SQLite here just confirms the path is intact)."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    database = Database(database_name="ov_db2", sqlalchemy_uri="sqlite://")
    table = SqlaTable(table_name="ov_t2", schema="main", database=database)
    table.columns = [TableColumn(column_name="old")]
    db.session.add_all([database, table])
    db.session.flush()

    DatasetDAO._override_columns(table, [{"column_name": "new"}])
    db.session.flush()
    cols = db.session.query(TableColumn).filter_by(table_id=table.id).all()
    assert [c.column_name for c in cols] == ["new"]


def test_upsert_columns_clears_a_dangling_partition_mapping(
    session: Session,
) -> None:
    """The upsert path deletes every column the payload omits — including, when
    a metadata sync drops it, the dataset's partition column. The mapping has to
    be cleared with it, exactly as on the ``override_columns=true`` path."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    database = Database(database_name="pm_db", sqlalchemy_uri="sqlite://")
    table = SqlaTable(table_name="pm_t", schema="main", database=database)
    table.columns = [
        TableColumn(column_name="event_time"),
        TableColumn(column_name="dt_epoch"),
    ]
    table.partition_column = "dt_epoch"
    table.partition_mapped_column = "event_time"
    db.session.add_all([database, table])
    db.session.flush()
    event_time_id = next(c.id for c in table.columns if c.column_name == "event_time")

    # The payload keeps only "event_time", so "dt_epoch" is deleted.
    DatasetDAO.update_columns(
        table,
        [{"id": event_time_id, "column_name": "event_time"}],
        override_columns=False,
    )
    db.session.flush()

    assert table.partition_column is None
    assert table.partition_mapped_column is None


def test_upsert_columns_keeps_a_live_partition_mapping(session: Session) -> None:
    """A payload that keeps both columns must leave the mapping alone."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    database = Database(database_name="pm_db2", sqlalchemy_uri="sqlite://")
    table = SqlaTable(table_name="pm_t2", schema="main", database=database)
    table.columns = [
        TableColumn(column_name="event_time"),
        TableColumn(column_name="dt_epoch"),
    ]
    table.partition_column = "dt_epoch"
    table.partition_mapped_column = "event_time"
    db.session.add_all([database, table])
    db.session.flush()
    ids = {c.column_name: c.id for c in table.columns}

    DatasetDAO.update_columns(
        table,
        [
            {"id": ids["event_time"], "verbose_name": "Event time"},
            {"id": ids["dt_epoch"]},
        ],
        override_columns=False,
    )
    db.session.flush()

    assert table.partition_column == "dt_epoch"
    assert table.partition_mapped_column == "event_time"


def _mapped_dataset(session: Session, name: str) -> Any:
    """
    A dataset whose mapping sits explicitly on ``event_time2``.

    ``event_time`` is the default datetime column, so it is what the mapping
    falls back to the moment the override is cleared -- which is exactly why it
    must not be allowed to hold a transform of its own while the override is
    somewhere else.
    """
    from superset import db
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    database = Database(database_name=f"{name}_db", sqlalchemy_uri="sqlite://")
    table = SqlaTable(table_name=name, schema="main", database=database)
    table.columns = [
        TableColumn(column_name="event_time"),
        TableColumn(column_name="event_time2"),
        TableColumn(column_name="dt_epoch"),
    ]
    table.main_dttm_col = "event_time"
    table.partition_column = "dt_epoch"
    table.partition_mapped_column = "event_time2"
    db.session.add_all([database, table])
    db.session.flush()
    return table


def _transforms(table: Any) -> dict[str, Any]:
    return {
        column.column_name: (
            column.partition_value_transform,
            bool(column.partition_transform_is_monotonic),
        )
        for column in table.columns
    }


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_update_drops_a_transform_the_mapping_does_not_mirror(
    session: Session,
) -> None:
    """
    Only the mapped column may hold a transform, whoever is writing.

    The editor enforces this client-side, but a PUT or an import bypasses the
    editor entirely, and a transform parked on any other column is invisible --
    no row but the mapped one renders it -- while still being saved.
    """
    from superset import db

    table = _mapped_dataset(session, "pfm_api1")
    ids = {c.column_name: c.id for c in table.columns}

    DatasetDAO.update(
        table,
        {
            "columns": [
                {
                    "id": ids["event_time"],
                    "partition_value_transform": "unix_timestamp(:value)",
                    "partition_transform_is_monotonic": True,
                },
                {
                    "id": ids["event_time2"],
                    "partition_value_transform": "to_unixtime(:value)",
                    "partition_transform_is_monotonic": True,
                },
                {"id": ids["dt_epoch"]},
            ]
        },
    )
    db.session.flush()

    assert _transforms(table) == {
        "event_time": (None, False),
        "event_time2": ("to_unixtime(:value)", True),
        "dt_epoch": (None, False),
    }


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_clearing_the_override_cannot_resurrect_a_transform(
    session: Session,
) -> None:
    """
    The API half of BUG-1.

    A null override means "follow the default datetime column", so clearing it
    moves the mapping to ``event_time``. That is fine on its own -- what must
    never happen is the move landing on a transform nobody chose, turning a
    request to drop a mapping into a request to activate a different one.
    """
    from superset import db

    table = _mapped_dataset(session, "pfm_api2")
    ids = {c.column_name: c.id for c in table.columns}

    # A caller tries to park a transform on the fallback column.
    DatasetDAO.update(
        table,
        {
            "columns": [
                {
                    "id": ids["event_time"],
                    "partition_value_transform": "unix_timestamp(:value)",
                    "partition_transform_is_monotonic": True,
                },
                {
                    "id": ids["event_time2"],
                    "partition_value_transform": "to_unixtime(:value)",
                },
                {"id": ids["dt_epoch"]},
            ]
        },
    )
    db.session.flush()

    DatasetDAO.update(table, {"partition_mapped_column": None})
    db.session.flush()

    assert table.partition_mapped_column is None
    # The mapping now follows `event_time`, and finds nothing there to mirror.
    assert _transforms(table)["event_time"] == (None, False)
    assert table.partition_filter_mapping_summary["active"] is False


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_repointing_the_default_datetime_column_leaves_nothing_behind(
    session: Session,
) -> None:
    """
    The API half of BUG-2.

    While the mapping follows the default datetime column, re-pointing that
    column moves the mapping. The transform must not stay behind on the old
    column, where it is invisible and still saved.
    """
    from superset import db

    table = _mapped_dataset(session, "pfm_api3")
    ids = {c.column_name: c.id for c in table.columns}
    DatasetDAO.update(
        table,
        {
            "partition_mapped_column": None,
            "columns": [
                {
                    "id": ids["event_time"],
                    "partition_value_transform": "unix_timestamp(:value)",
                    "partition_transform_is_monotonic": True,
                },
                {"id": ids["event_time2"]},
                {"id": ids["dt_epoch"]},
            ],
        },
    )
    db.session.flush()
    assert _transforms(table)["event_time"] == ("unix_timestamp(:value)", True)

    DatasetDAO.update(table, {"main_dttm_col": "event_time2"})
    db.session.flush()

    assert _transforms(table)["event_time"] == (None, False)


@with_feature_flags(PARTITION_FILTER_MAPPING=False)
def test_transforms_are_left_alone_while_the_feature_is_off(
    session: Session,
) -> None:
    """
    Nothing mirrors with the flag off, so there is no stale mapping to disarm --
    only an operator's stored configuration to lose if this ran anyway.
    """
    from superset import db

    table = _mapped_dataset(session, "pfm_api4")
    ids = {c.column_name: c.id for c in table.columns}

    DatasetDAO.update(
        table,
        {
            "columns": [
                {
                    "id": ids["event_time"],
                    "partition_value_transform": "unix_timestamp(:value)",
                },
                {"id": ids["event_time2"]},
                {"id": ids["dt_epoch"]},
            ]
        },
    )
    db.session.flush()

    assert _transforms(table)["event_time"] == ("unix_timestamp(:value)", False)


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_clearing_the_partition_column_disarms_the_transforms_too(
    session: Session,
) -> None:
    """
    With no partition column there is no mapped column, so no column may hold a
    transform.

    The same argument `nextMappedColumnOverride` makes about the override in the
    editor: a value left behind here does nothing now and silently re-arms the
    next partition column the owner picks.
    """
    from superset import db

    table = _mapped_dataset(session, "pfm_api5")
    ids = {c.column_name: c.id for c in table.columns}
    DatasetDAO.update(
        table,
        {
            "columns": [
                {
                    "id": ids["event_time2"],
                    "partition_value_transform": "to_unixtime(:value)",
                    "partition_transform_is_monotonic": True,
                },
                {"id": ids["event_time"]},
                {"id": ids["dt_epoch"]},
            ]
        },
    )
    db.session.flush()
    assert _transforms(table)["event_time2"] == ("to_unixtime(:value)", True)

    DatasetDAO.update(table, {"partition_column": None})
    db.session.flush()

    assert _transforms(table)["event_time2"] == (None, False)
