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
The partition mapping has to survive every layer it passes through.

``always_filter_main_dttm`` is the template these follow: a dataset-level
setting that names a column and appears in the ORM, the export fields, the
``data`` payload, the API schemas and the frontend types. A field missing from
any one of them is dropped silently, which is exactly the failure mode these
tests exist to catch.
"""

from __future__ import annotations

from typing import Any

import pytest
from flask import Flask

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.datasets.schemas import (
    DatasetColumnsPutSchema,
    DatasetPutSchema,
    ImportV1ColumnSchema,
    ImportV1DatasetSchema,
)
from superset.models.core import Database

DATASET_FIELDS = ["partition_column", "partition_mapped_column"]
COLUMN_FIELDS = ["partition_value_transform", "partition_transform_is_monotonic"]


@pytest.fixture(autouse=True)
def enable_partition_filter_mapping(app: Flask) -> Any:
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = True
    yield
    del app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"]


def _table() -> SqlaTable:
    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    column = TableColumn(column_name="event_time", is_dttm=True, type="TIMESTAMP")
    column.partition_value_transform = "unix_timestamp(:value)"
    column.partition_transform_is_monotonic = True
    table = SqlaTable(
        table_name="web_events",
        database=database,
        main_dttm_col="event_time",
        columns=[column, TableColumn(column_name="dt_epoch", type="BIGINT")],
    )
    table.partition_column = "dt_epoch"
    table.partition_mapped_column = None
    return table


@pytest.mark.parametrize("field", DATASET_FIELDS)
def test_dataset_fields_are_exported(field: str) -> None:
    """
    Being in ``export_fields`` is what makes the mapping travel in dataset YAML,
    and what makes ``update_from_object`` write it back on import.
    """
    assert field in SqlaTable.export_fields


@pytest.mark.parametrize("field", COLUMN_FIELDS)
def test_column_fields_are_exported(field: str) -> None:
    assert field in TableColumn.export_fields


@pytest.mark.parametrize("field", DATASET_FIELDS)
def test_dataset_fields_reach_the_explore_payload(app: Flask, field: str) -> None:
    with app.app_context():
        data = _table().data
    assert field in data


@pytest.mark.parametrize("field", COLUMN_FIELDS)
def test_column_fields_reach_the_explore_payload(app: Flask, field: str) -> None:
    with app.app_context():
        data = _table().data
    assert field in data["columns"][0]


def test_the_mapping_summary_survives_dashboard_payload_pruning(app: Flask) -> None:
    """
    ``data_for_slices`` prunes columns no chart references, and the partition
    column is typically referenced by none of them. The Explore indicator
    therefore reads a self-contained dataset-level dict rather than looking the
    column up inside ``datasource.columns``.
    """
    with app.app_context():
        data = _table().data_for_slices([])

    assert data["partition_filter_mapping"] == {
        "partition_column": "dt_epoch",
        "mapped_column": "event_time",
        "active": True,
    }


def test_the_mapping_summary_reports_inactive_without_a_transform(
    app: Flask,
) -> None:
    table = _table()
    table.columns[0].partition_value_transform = None

    with app.app_context():
        summary = table.data["partition_filter_mapping"]

    assert summary is not None
    assert summary["active"] is False


def test_there_is_no_mapping_summary_without_a_partition_column(
    app: Flask,
) -> None:
    table = _table()
    table.partition_column = None

    with app.app_context():
        assert table.data["partition_filter_mapping"] is None


@pytest.mark.parametrize("field", DATASET_FIELDS)
def test_put_schema_accepts_the_dataset_fields(field: str) -> None:
    loaded = DatasetPutSchema().load({field: "dt_epoch"})
    assert loaded[field] == "dt_epoch"


def test_put_schema_accepts_the_column_fields() -> None:
    loaded = DatasetColumnsPutSchema().load(
        {
            "column_name": "event_time",
            "partition_value_transform": "unix_timestamp(:value)",
            "partition_transform_is_monotonic": True,
        }
    )
    assert loaded["partition_value_transform"] == "unix_timestamp(:value)"
    assert loaded["partition_transform_is_monotonic"] is True


def test_put_schema_allows_clearing_the_mapping() -> None:
    """Removing a mapping is a null, not an omission."""
    loaded = DatasetPutSchema().load({"partition_column": None})
    assert loaded["partition_column"] is None


def test_import_schema_round_trips_the_mapping() -> None:
    loaded = ImportV1DatasetSchema().load(
        {
            "table_name": "web_events",
            "uuid": "00000000-0000-0000-0000-000000000001",
            "database_uuid": "00000000-0000-0000-0000-000000000002",
            "version": "1.0.0",
            "partition_column": "dt_epoch",
            "partition_mapped_column": "event_time",
        }
    )
    assert loaded["partition_column"] == "dt_epoch"
    assert loaded["partition_mapped_column"] == "event_time"


def test_import_column_schema_round_trips_the_transform() -> None:
    loaded = ImportV1ColumnSchema().load(
        {
            "column_name": "event_time",
            "partition_value_transform": "unix_timestamp(:value)",
            "partition_transform_is_monotonic": True,
        }
    )
    assert loaded["partition_value_transform"] == "unix_timestamp(:value)"
    assert loaded["partition_transform_is_monotonic"] is True


def test_import_column_schema_defaults_the_monotonic_flag_to_false() -> None:
    """
    The flag gates range mirroring. A dataset imported from a bundle that
    predates the field must not silently claim its transform preserves ordering.
    """
    loaded = ImportV1ColumnSchema().load({"column_name": "event_time"})
    assert loaded["partition_transform_is_monotonic"] is False


@pytest.mark.parametrize("field", DATASET_FIELDS)
def test_the_api_exposes_and_accepts_the_dataset_fields(field: str) -> None:
    from superset.datasets.api import DatasetRestApi

    assert field in DatasetRestApi.show_select_columns
    assert field in DatasetRestApi.edit_columns


# ---------------------------------------------------------------------------
# §10 — a column sync can pull the partition column out from under the mapping
# ---------------------------------------------------------------------------


def test_a_sync_that_removes_the_partition_column_clears_the_mapping() -> None:
    """
    An API-driven ``override_columns=true`` sync must not leave a dangling
    mapping. This is the authoritative path -- the client-side sync clears the
    mapping too, but a caller can bypass the editor entirely.
    """
    from superset.daos.dataset import DatasetDAO

    table = _table()
    DatasetDAO.clear_dangling_partition_mapping(table, {"event_time"})

    assert table.partition_column is None
    assert table.partition_mapped_column is None


def test_a_sync_that_removes_the_mapped_column_clears_only_the_override() -> None:
    """
    The partition column is still real, so the designation survives; the mapping
    falls back to "no mapped column" and goes inactive until one is chosen.
    """
    from superset.daos.dataset import DatasetDAO

    table = _table()
    table.partition_mapped_column = "event_time"

    DatasetDAO.clear_dangling_partition_mapping(table, {"dt_epoch"})

    assert table.partition_column == "dt_epoch"
    assert table.partition_mapped_column is None


def test_a_sync_that_keeps_both_columns_leaves_the_mapping_alone() -> None:
    from superset.daos.dataset import DatasetDAO

    table = _table()
    DatasetDAO.clear_dangling_partition_mapping(table, {"event_time", "dt_epoch"})

    assert table.partition_column == "dt_epoch"


@pytest.mark.parametrize("field", COLUMN_FIELDS)
def test_column_fields_tolerate_a_null_write(field: str) -> None:
    """
    The legacy datasource editor saves through `update_from_object`, which does
    `setattr(self, attr, obj.get(attr))` for every field in
    `update_from_object_fields` -- so any field its payload omits is written as
    NULL. A NOT NULL column here makes that save fail with an IntegrityError
    (surfacing as a 422), which is how this was found.
    """
    column = TableColumn.__table__.columns[field]
    assert column.nullable, f"{field} must be nullable for the legacy save path"


@pytest.mark.parametrize("field", DATASET_FIELDS)
def test_dataset_fields_tolerate_a_null_write(field: str) -> None:
    assert SqlaTable.__table__.columns[field].nullable
