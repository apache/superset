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
# pylint: disable=import-outside-toplevel, unused-argument, unused-import, invalid-name

import copy
import io
import re
import uuid
from datetime import datetime
from typing import Any
from unittest.mock import Mock, patch
from urllib import request

import pytest
import yaml
from flask import current_app
from flask_appbuilder.security.sqla.models import Role, User
from marshmallow import ValidationError
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.commands.dataset.exceptions import (
    DatasetAccessDeniedError,
    DatasetForbiddenDataURI,
    MultiCatalogDisabledValidationError,
)
from superset.commands.dataset.importers.v1.utils import (
    import_dataset,
    validate_data_uri,
)
from superset.commands.exceptions import ImportFailedError
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.datasets.schemas import ImportV1DatasetSchema
from superset.models.core import Database
from superset.utils import json
from superset.utils.core import override_user
from tests.integration_tests.fixtures.importexport import (
    database_config,
    dataset_config as dataset_fixture,
)


def test_import_dataset(mocker: MockerFixture, session: Session) -> None:
    """
    Test importing a dataset.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset_uuid = uuid.uuid4()
    config = {
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "description": "This is the description",
        "default_endpoint": None,
        "offset": -8,
        "cache_timeout": 3600,
        "catalog": "public",
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": {
            "answer": "42",
        },
        "filter_select_enabled": True,
        "fetch_values_predicate": "foo IN (1, 2)",
        "extra": {"warning_markdown": "*WARNING*"},
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "verbose_name": None,
                "metric_type": None,
                "expression": "COUNT(*)",
                "description": None,
                "d3format": None,
                "extra": {"warning_markdown": None},
                "warning_text": None,
                "uuid": "00000000-0000-0000-0000-000000000001",
            }
        ],
        "columns": [
            {
                "column_name": "profit",
                "verbose_name": None,
                "is_dttm": None,
                "is_active": None,
                "type": "INTEGER",
                "groupby": None,
                "filterable": None,
                "expression": "revenue-expenses",
                "description": None,
                "python_date_format": None,
                "extra": {
                    "certified_by": "User",
                },
                "uuid": "00000000-0000-0000-0000-000000000002",
            }
        ],
        "folders": [
            {
                "uuid": "00000000-0000-0000-0000-000000000000",
                "type": "folder",
                "name": "Engineering",
                "children": [
                    {
                        "uuid": "00000000-0000-0000-0000-000000000001",
                        "type": "folder",
                        "name": "Core",
                        "children": [
                            {
                                "uuid": "00000000-0000-0000-0000-000000000004",
                                "type": "metric",
                                "name": "cnt",
                            },
                        ],
                    },
                ],
            },
            {
                "uuid": "00000000-0000-0000-0000-000000000002",
                "type": "folder",
                "name": "Sales",
                "children": [
                    {
                        "uuid": "00000000-0000-0000-0000-000000000003",
                        "type": "folder",
                        "name": "Core",
                        "children": [
                            {
                                "uuid": "00000000-0000-0000-0000-000000000005",
                                "type": "column",
                                "name": "profit",
                            },
                        ],
                    },
                ],
            },
        ],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    sqla_table = import_dataset(config)
    assert sqla_table.table_name == "my_table"
    assert sqla_table.main_dttm_col == "ds"
    assert sqla_table.description == "This is the description"
    assert sqla_table.default_endpoint is None
    assert sqla_table.offset == -8
    assert sqla_table.cache_timeout == 3600
    assert sqla_table.catalog == "public"
    assert sqla_table.schema == "my_schema"
    assert sqla_table.sql is None
    assert sqla_table.params == json.dumps(
        {"remote_id": 64, "database_name": "examples", "import_time": 1606677834}
    )
    assert sqla_table.template_params == json.dumps({"answer": "42"})
    assert sqla_table.filter_select_enabled is True
    assert sqla_table.fetch_values_predicate == "foo IN (1, 2)"
    assert sqla_table.extra == '{"warning_markdown": "*WARNING*"}'
    assert sqla_table.uuid == dataset_uuid
    assert len(sqla_table.metrics) == 1
    assert sqla_table.metrics[0].metric_name == "cnt"
    assert sqla_table.metrics[0].verbose_name is None
    assert sqla_table.metrics[0].metric_type is None
    assert sqla_table.metrics[0].expression == "COUNT(*)"
    assert sqla_table.metrics[0].description is None
    assert sqla_table.metrics[0].d3format is None
    assert sqla_table.metrics[0].extra == '{"warning_markdown": null}'
    assert sqla_table.metrics[0].warning_text is None
    assert sqla_table.metrics[0].uuid == uuid.UUID(
        "00000000-0000-0000-0000-000000000001"
    )
    assert len(sqla_table.columns) == 1
    assert sqla_table.columns[0].column_name == "profit"
    assert sqla_table.columns[0].verbose_name is None
    assert sqla_table.columns[0].is_dttm is False
    assert sqla_table.columns[0].is_active is True
    assert sqla_table.columns[0].type == "INTEGER"
    assert sqla_table.columns[0].groupby is True
    assert sqla_table.columns[0].filterable is True
    assert sqla_table.columns[0].expression == "revenue-expenses"
    assert sqla_table.columns[0].description is None
    assert sqla_table.columns[0].python_date_format is None
    assert sqla_table.columns[0].extra == '{"certified_by": "User"}'
    assert sqla_table.columns[0].uuid == uuid.UUID(
        "00000000-0000-0000-0000-000000000002"
    )
    assert sqla_table.folders == [
        {
            "uuid": "00000000-0000-0000-0000-000000000000",
            "type": "folder",
            "name": "Engineering",
            "children": [
                {
                    "uuid": "00000000-0000-0000-0000-000000000001",
                    "type": "folder",
                    "name": "Core",
                    "children": [
                        {
                            "uuid": "00000000-0000-0000-0000-000000000004",
                            "type": "metric",
                            "name": "cnt",
                        },
                    ],
                },
            ],
        },
        {
            "uuid": "00000000-0000-0000-0000-000000000002",
            "type": "folder",
            "name": "Sales",
            "children": [
                {
                    "uuid": "00000000-0000-0000-0000-000000000003",
                    "type": "folder",
                    "name": "Core",
                    "children": [
                        {
                            "uuid": "00000000-0000-0000-0000-000000000005",
                            "type": "column",
                            "name": "profit",
                        },
                    ],
                },
            ],
        },
    ]
    assert sqla_table.database.uuid == database.uuid
    assert sqla_table.database.id == database.id


def test_export_import_round_trip_preserves_metric_folder_membership(
    mocker: MockerFixture, session: Session
) -> None:
    """
    A metric (or column) assigned to a custom folder must stay in that folder
    after the dataset is exported and imported into another workspace.

    Folder leaves reference metrics/columns by UUID. If the export drops the
    metric/column UUIDs, the importer recreates them with fresh random UUIDs
    while the ``folders`` JSON still points at the originals — so the metric can
    no longer be matched to its folder and is re-homed to the default folder.
    This exercises the full export -> import round trip and asserts the
    imported metric/column keep the UUIDs the folder leaves reference.
    """
    from superset.commands.dataset.export import ExportDatasetsCommand
    from superset.connectors.sqla.models import SqlMetric

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    # --- source workspace: a dataset with a metric + column pinned to a custom
    # folder, referenced by UUID ---
    source_db = Database(database_name="source_db", sqlalchemy_uri="sqlite://")
    db.session.add(source_db)
    db.session.flush()

    metric_uuid = uuid.UUID("00000000-0000-0000-0000-0000000000a1")
    column_uuid = uuid.UUID("00000000-0000-0000-0000-0000000000b2")
    folder_uuid = uuid.UUID("00000000-0000-0000-0000-0000000000c3")

    sqla_table = SqlaTable(
        table_name="my_table",
        database=source_db,
        columns=[
            TableColumn(column_name="profit", type="INTEGER", uuid=column_uuid),
        ],
        metrics=[
            SqlMetric(metric_name="cnt", expression="COUNT(*)", uuid=metric_uuid),
        ],
        folders=[
            {
                "uuid": str(folder_uuid),
                "type": "folder",
                "name": "Custom",
                "children": [
                    {"uuid": str(metric_uuid), "type": "metric"},
                    {"uuid": str(column_uuid), "type": "column"},
                ],
            },
        ],
    )
    db.session.add(sqla_table)
    db.session.flush()

    # --- export (command-level YAML payload) ---
    config = yaml.safe_load(ExportDatasetsCommand._file_content(sqla_table))  # pylint: disable=protected-access

    # The exported metric/column must carry their UUIDs so the folder
    # references survive the round trip.
    assert config["metrics"][0].get("uuid") == str(metric_uuid)
    assert any(col.get("uuid") == str(column_uuid) for col in config["columns"])

    # The import schema must accept and preserve those UUIDs; without the schema
    # fields it would reject them as unknown and the round trip would break.
    loaded = ImportV1DatasetSchema().load(config)
    assert loaded["metrics"][0]["uuid"] == metric_uuid
    assert any(col["uuid"] == column_uuid for col in loaded["columns"])

    # --- import into another workspace ---
    # Model a separate workspace: drop the source dataset so its UUIDs are free
    # (a fresh workspace has never seen them), then import against a fresh
    # database and a brand-new dataset UUID so the importer creates the
    # metric/column anew from the exported payload.
    db.session.delete(sqla_table)
    db.session.flush()

    target_db = Database(database_name="target_db", sqlalchemy_uri="sqlite://")
    db.session.add(target_db)
    db.session.flush()
    config["database_id"] = target_db.id
    config["uuid"] = str(uuid.uuid4())

    imported = import_dataset(config)

    # The metric/column must be recreated with their original UUIDs so the
    # typed folder leaves still resolve to them — i.e. they stay in the custom
    # folder rather than being re-homed to the default one.
    imported_metric = next(m for m in imported.metrics if m.metric_name == "cnt")
    assert imported_metric.uuid == metric_uuid
    imported_column = next(c for c in imported.columns if c.column_name == "profit")
    assert imported_column.uuid == column_uuid

    # The folders JSON is stored verbatim (it round-trips with or without the
    # fix); the uuid assertions above are the real gate that its leaves still
    # resolve to the imported children. This just documents the expected shape.
    assert imported.folders == [
        {
            "uuid": str(folder_uuid),
            "type": "folder",
            "name": "Custom",
            "children": [
                {"uuid": str(metric_uuid), "type": "metric"},
                {"uuid": str(column_uuid), "type": "column"},
            ],
        },
    ]


def test_import_dataset_clone_with_duplicate_child_uuid_gets_fresh_uuid(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Cloning a dataset by importing its config under a new dataset UUID must not
    fail when the original — and its metric/column UUIDs — still exist.

    Metric/column UUIDs are globally unique but matched only within their parent
    on import, so an unchanged child UUID under a *new* dataset would otherwise
    violate the unique constraint on INSERT. The importer drops the colliding
    UUID and lets a fresh one be assigned, so the clone imports cleanly (the
    pre-uuid-export behavior for that workflow).
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    metric_uuid = "00000000-0000-0000-0000-0000000000d4"
    column_uuid = "00000000-0000-0000-0000-0000000000e5"
    config = {
        "table_name": "my_table",
        "uuid": str(uuid.uuid4()),
        "metrics": [
            {"metric_name": "cnt", "expression": "COUNT(*)", "uuid": metric_uuid},
        ],
        "columns": [
            {"column_name": "profit", "type": "INTEGER", "uuid": column_uuid},
        ],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    original = import_dataset(copy.deepcopy(config))
    assert str(original.metrics[0].uuid) == metric_uuid
    assert str(original.columns[0].uuid) == column_uuid

    # Clone: same child UUIDs, but a new dataset UUID and name (as a user editing
    # the exported config to duplicate the dataset would produce).
    clone_config = copy.deepcopy(config)
    clone_config["table_name"] = "my_table_clone"
    clone_config["uuid"] = str(uuid.uuid4())

    clone = import_dataset(clone_config)

    # The clone imports without hitting the unique constraint, and its children
    # receive fresh UUIDs while the original keeps its own.
    assert clone.id != original.id
    assert [m.metric_name for m in clone.metrics] == ["cnt"]
    assert [c.column_name for c in clone.columns] == ["profit"]
    assert str(clone.metrics[0].uuid) != metric_uuid
    assert str(clone.columns[0].uuid) != column_uuid
    assert str(original.metrics[0].uuid) == metric_uuid
    assert str(original.columns[0].uuid) == column_uuid


def test_import_dataset_clone_overwrite_reimport_keeps_fresh_child_uuid(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Overwriting a cloned dataset with its own bundle must not resurrect the
    original's child UUIDs.

    On the overwrite path children sync with ``sync=["columns", "metrics"]`` and
    are matched within the parent by name, so re-importing the clone bundle
    (which still carries the original's metric/column UUIDs) would otherwise
    ``setattr`` those UUIDs onto the clone's children and violate the global
    unique constraint at flush. The importer drops any incoming child UUID owned
    by a different row on the UPDATE branch too, so the overwrite succeeds and
    the clone's children keep the fresh UUIDs assigned on first import.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    metric_uuid = "00000000-0000-0000-0000-0000000000d6"
    column_uuid = "00000000-0000-0000-0000-0000000000e7"
    config = {
        "table_name": "my_table",
        "uuid": str(uuid.uuid4()),
        "metrics": [
            {"metric_name": "cnt", "expression": "COUNT(*)", "uuid": metric_uuid},
        ],
        "columns": [
            {"column_name": "profit", "type": "INTEGER", "uuid": column_uuid},
        ],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    original = import_dataset(copy.deepcopy(config))

    # Clone under a new dataset UUID and name; its children get fresh UUIDs
    # because the originals still exist.
    clone_config = copy.deepcopy(config)
    clone_config["table_name"] = "my_table_clone"
    clone_config["uuid"] = str(uuid.uuid4())
    clone = import_dataset(copy.deepcopy(clone_config))
    fresh_metric_uuid = str(clone.metrics[0].uuid)
    fresh_column_uuid = str(clone.columns[0].uuid)
    assert fresh_metric_uuid != metric_uuid
    assert fresh_column_uuid != column_uuid

    # Re-import the same clone bundle with overwrite=True. The children match by
    # (table_id, name), and the bundle still carries the original's UUIDs; the
    # guard must keep this from writing them onto the clone's children.
    reimported = import_dataset(copy.deepcopy(clone_config), overwrite=True)

    assert reimported.id == clone.id
    assert [m.metric_name for m in reimported.metrics] == ["cnt"]
    assert [c.column_name for c in reimported.columns] == ["profit"]
    # The clone keeps its fresh child UUIDs and the original is untouched.
    assert str(reimported.metrics[0].uuid) == fresh_metric_uuid
    assert str(reimported.columns[0].uuid) == fresh_column_uuid
    assert str(original.metrics[0].uuid) == metric_uuid
    assert str(original.columns[0].uuid) == column_uuid


def test_import_dataset_null_child_uuid_keeps_existing(
    mocker: MockerFixture, session: Session
) -> None:
    """
    An explicit ``uuid: null`` must not wipe an existing child's UUID.

    The child import schemas accept ``uuid=None``. Without the guard the
    overwrite path would ``setattr`` that ``None`` onto the matched child and
    persist a literal NULL — the column is nullable and ``unique`` permits
    repeated NULLs, so it would fail silently and orphan every folder leaf
    pointing at that child.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    metric_uuid = "00000000-0000-0000-0000-0000000000f8"
    config: dict[str, Any] = {
        "table_name": "my_table",
        "uuid": str(uuid.uuid4()),
        "metrics": [
            {"metric_name": "cnt", "expression": "COUNT(*)", "uuid": metric_uuid},
        ],
        "columns": [],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }
    dataset = import_dataset(copy.deepcopy(config))
    assert str(dataset.metrics[0].uuid) == metric_uuid

    # Re-import the same bundle with the child uuid explicitly nulled.
    nulled = copy.deepcopy(config)
    nulled["metrics"][0]["uuid"] = None
    reimported = import_dataset(nulled, overwrite=True)

    assert reimported.id == dataset.id
    assert reimported.metrics[0].uuid is not None
    assert str(reimported.metrics[0].uuid) == metric_uuid


def test_import_dataset_ambiguous_child_aborts_instead_of_half_applying(
    mocker: MockerFixture, session: Session
) -> None:
    """
    An ambiguous metric/column match must abort the import, not half-apply it.

    Children are matched within their parent by name *or* UUID, so a payload
    metric can match one existing metric by name and a *different* one by UUID.
    That raises ``MultipleResultsFound`` from inside the child import — after
    the dataset's own fields were already updated and after earlier siblings
    were already imported. Swallowing it (the legacy dataset-level contract)
    would report success over a partially-applied import, so the importer must
    raise ``ImportFailedError`` and let the transaction roll everything back.
    """
    from superset.connectors.sqla.models import SqlMetric

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    a_uuid = "00000000-0000-0000-0000-0000000000a1"
    cnt_uuid = "00000000-0000-0000-0000-0000000000a2"
    dataset_uuid = str(uuid.uuid4())
    config: dict[str, Any] = {
        "table_name": "my_table",
        "description": "as exported",
        "uuid": dataset_uuid,
        "metrics": [
            {"metric_name": "a", "expression": "COUNT(*)", "uuid": a_uuid},
            {"metric_name": "cnt", "expression": "COUNT(*)", "uuid": cnt_uuid},
        ],
        "columns": [],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }
    dataset = import_dataset(copy.deepcopy(config))

    # Simulate the target instance drifting: ``cnt`` is renamed to ``cnt_old``
    # (keeping its UUID) and a brand-new metric takes the name ``cnt``. The
    # dataset itself is edited too.
    renamed = next(m for m in dataset.metrics if m.metric_name == "cnt")
    renamed.metric_name = "cnt_old"
    new_cnt_uuid = str(uuid.uuid4())
    dataset.metrics.append(
        SqlMetric(metric_name="cnt", expression="COUNT(1)", uuid=new_cnt_uuid)
    )
    dataset.description = "edited in the UI"
    db.session.flush()
    db.session.commit()

    # Re-import the *original* bundle: its ``cnt``/``cnt_uuid`` metric matches
    # the new ``cnt`` by name and ``cnt_old`` by UUID.
    with pytest.raises(ImportFailedError) as excinfo:
        import_dataset(copy.deepcopy(config), overwrite=True)

    assert "matches two different existing" in str(excinfo.value)
    assert "my_table" in str(excinfo.value)

    # Because it raised, the caller's transaction can undo everything; nothing
    # from the aborted import is visible afterwards.
    db.session.rollback()

    reloaded = db.session.query(SqlaTable).filter_by(uuid=dataset_uuid).one()
    # The parent's scalar fields were NOT overwritten by the aborted payload.
    assert reloaded.description == "edited in the UI"
    # No metric was added, renamed, or deleted by the aborted import.
    assert sorted(m.metric_name for m in reloaded.metrics) == ["a", "cnt", "cnt_old"]
    assert {m.metric_name: str(m.uuid) for m in reloaded.metrics} == {
        "a": a_uuid,
        "cnt_old": cnt_uuid,
        "cnt": new_cnt_uuid,
    }


def _dataset_config_with_children(
    metrics: list[dict[str, Any]],
    columns: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "version": "1.0.0",
        "table_name": "my_table",
        "uuid": str(uuid.uuid4()),
        "database_uuid": str(uuid.uuid4()),
        "metrics": metrics,
        "columns": columns,
    }


def test_import_dataset_schema_rejects_duplicate_metric_uuids() -> None:
    """
    Two metrics sharing a UUID must be rejected by the import schema.

    UUIDs are globally unique, so such a payload cannot be imported faithfully:
    the second metric would match the first one by UUID and overwrite it in
    place, silently collapsing two metrics into one.
    """
    duplicate = str(uuid.uuid4())
    config = _dataset_config_with_children(
        metrics=[
            {"metric_name": "cnt", "expression": "COUNT(*)", "uuid": duplicate},
            {"metric_name": "cnt2", "expression": "COUNT(1)", "uuid": duplicate},
        ],
        columns=[],
    )

    with pytest.raises(ValidationError) as excinfo:
        ImportV1DatasetSchema().load(config)

    assert "metrics" in excinfo.value.messages
    assert duplicate in str(excinfo.value.messages["metrics"])


def test_import_dataset_schema_rejects_duplicate_column_uuids() -> None:
    """
    Two columns sharing a UUID must be rejected by the import schema.
    """
    duplicate = str(uuid.uuid4())
    config = _dataset_config_with_children(
        metrics=[],
        columns=[
            {"column_name": "profit", "type": "INTEGER", "uuid": duplicate},
            {"column_name": "revenue", "type": "INTEGER", "uuid": duplicate},
        ],
    )

    with pytest.raises(ValidationError) as excinfo:
        ImportV1DatasetSchema().load(config)

    assert "columns" in excinfo.value.messages
    assert duplicate in str(excinfo.value.messages["columns"])


def test_import_dataset_schema_allows_distinct_and_missing_child_uuids() -> None:
    """
    Distinct UUIDs — and children with no UUID at all — remain valid.

    Only the ``null``/absent case may repeat: a pre-uuid-export bundle has no
    child UUIDs whatsoever and must keep importing.
    """
    config = _dataset_config_with_children(
        metrics=[
            {"metric_name": "cnt", "expression": "COUNT(*)", "uuid": str(uuid.uuid4())},
            {"metric_name": "cnt2", "expression": "COUNT(1)"},
            {"metric_name": "cnt3", "expression": "COUNT(2)", "uuid": None},
        ],
        columns=[
            {"column_name": "profit", "type": "INTEGER", "uuid": str(uuid.uuid4())},
            {"column_name": "revenue", "type": "INTEGER"},
            {"column_name": "expenses", "type": "INTEGER", "uuid": None},
        ],
    )

    loaded = ImportV1DatasetSchema().load(config)

    assert len(loaded["metrics"]) == 3
    assert len(loaded["columns"]) == 3


def test_import_dataset_no_folder(mocker: MockerFixture, session: Session) -> None:
    """
    Test importing a dataset that was exported without folders.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset_uuid = uuid.uuid4()
    config = {
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "description": "This is the description",
        "default_endpoint": None,
        "offset": -8,
        "cache_timeout": 3600,
        "catalog": "public",
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": {
            "answer": "42",
        },
        "filter_select_enabled": True,
        "fetch_values_predicate": "foo IN (1, 2)",
        "extra": {"warning_markdown": "*WARNING*"},
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "verbose_name": None,
                "metric_type": None,
                "expression": "COUNT(*)",
                "description": None,
                "d3format": None,
                "extra": {"warning_markdown": None},
                "warning_text": None,
            }
        ],
        "columns": [
            {
                "column_name": "profit",
                "verbose_name": None,
                "is_dttm": None,
                "is_active": None,
                "type": "INTEGER",
                "groupby": None,
                "filterable": None,
                "expression": "revenue-expenses",
                "description": None,
                "python_date_format": None,
                "extra": {
                    "certified_by": "User",
                },
            }
        ],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    sqla_table = import_dataset(config)
    assert sqla_table.folders is None


def test_import_dataset_rejects_non_default_catalog_when_multi_catalog_disabled(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Importing a non-default catalog must fail when the target database has
    multi-catalog disabled, matching the dataset update validation so an import
    can't silently bind a dataset to an unintended catalog.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    # the connection supports catalogs, defaults to "primary", multi-catalog off
    engine_spec = database.db_engine_spec
    mocker.patch.object(engine_spec, "supports_catalog", True)
    mocker.patch.object(engine_spec, "get_default_catalog", return_value="primary")

    config = {
        "table_name": "my_table",
        "schema": "my_schema",
        "catalog": "other_catalog",
        "uuid": uuid.uuid4(),
        "metrics": [],
        "columns": [],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    with pytest.raises(MultiCatalogDisabledValidationError):
        import_dataset(config)


def test_import_dataset_skips_catalog_validation_for_trusted_imports(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Trusted imports (ignore_permissions=True, e.g. example loading) bypass
    catalog validation, so a non-default catalog does not abort the import even
    when the target database has multi-catalog disabled.
    """
    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    # the connection supports catalogs, defaults to "primary", multi-catalog off
    engine_spec = database.db_engine_spec
    mocker.patch.object(engine_spec, "supports_catalog", True)
    mocker.patch.object(engine_spec, "get_default_catalog", return_value="primary")

    config = {
        "table_name": "my_table",
        "schema": "my_schema",
        "catalog": "other_catalog",
        "uuid": uuid.uuid4(),
        "metrics": [],
        "columns": [],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    sqla_table = import_dataset(config, ignore_permissions=True)
    assert sqla_table.catalog == "other_catalog"


def test_import_command_surfaces_non_default_catalog_as_validation_error(
    mocker: MockerFixture, session: Session
) -> None:
    """
    The dataset import command surfaces a disallowed catalog as a 422
    CommandInvalidError carrying the catalog message, instead of a generic 500.
    """
    from superset.commands.dataset.importers.v1 import ImportDatasetsCommand
    from superset.commands.exceptions import CommandInvalidError

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    db_config = copy.deepcopy(database_config)
    # a URI with a database gives PostgresEngineSpec a non-None default catalog
    db_config["sqlalchemy_uri"] = "postgresql://user:pass@host1/primary"

    ds_config = copy.deepcopy(dataset_fixture)
    ds_config["catalog"] = "other_catalog"

    configs = {
        "databases/imported_database.yaml": db_config,
        "datasets/imported_dataset.yaml": ds_config,
    }

    with pytest.raises(CommandInvalidError) as excinfo:
        ImportDatasetsCommand._import(configs, overwrite=False)

    assert "Only the default catalog is supported for this connection" in str(
        excinfo.value
    )


def test_import_dataset_overwrite_cannot_flip_to_non_default_catalog(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Overwriting an existing dataset with a non-default catalog must fail when
    multi-catalog is disabled, so a UUID-matched import can't flip a
    correctly-bound dataset onto an unintended catalog.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    engine_spec = database.db_engine_spec
    mocker.patch.object(engine_spec, "supports_catalog", True)
    mocker.patch.object(engine_spec, "get_default_catalog", return_value="primary")

    dataset_uuid = uuid.uuid4()
    existing = SqlaTable(
        uuid=dataset_uuid,
        table_name="my_table",
        catalog="primary",
        database_id=database.id,
    )
    db.session.add(existing)
    db.session.flush()

    config = {
        "table_name": "my_table",
        "schema": "my_schema",
        "catalog": "other_catalog",
        "uuid": dataset_uuid,
        "metrics": [],
        "columns": [],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    with pytest.raises(MultiCatalogDisabledValidationError):
        import_dataset(config, overwrite=True)

    assert existing.catalog == "primary"


def test_import_dataset_allows_non_default_catalog_when_multi_catalog_enabled(
    mocker: MockerFixture, session: Session
) -> None:
    """
    A non-default catalog imports cleanly when the target database has
    multi-catalog enabled.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(
        database_name="my_database",
        sqlalchemy_uri="sqlite://",
        extra=json.dumps({"allow_multi_catalog": True}),
    )
    db.session.add(database)
    db.session.flush()

    engine_spec = database.db_engine_spec
    mocker.patch.object(engine_spec, "supports_catalog", True)
    mocker.patch.object(engine_spec, "get_default_catalog", return_value="primary")

    config = {
        "table_name": "my_table",
        "schema": "my_schema",
        "catalog": "other_catalog",
        "uuid": uuid.uuid4(),
        "metrics": [],
        "columns": [],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    sqla_table = import_dataset(config)
    assert sqla_table.catalog == "other_catalog"


def test_import_dataset_allows_default_catalog_when_multi_catalog_disabled(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Re-importing the connection's default catalog is allowed even with
    multi-catalog disabled.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    engine_spec = database.db_engine_spec
    mocker.patch.object(engine_spec, "supports_catalog", True)
    mocker.patch.object(engine_spec, "get_default_catalog", return_value="primary")

    config = {
        "table_name": "my_table",
        "schema": "my_schema",
        "catalog": "primary",
        "uuid": uuid.uuid4(),
        "metrics": [],
        "columns": [],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    sqla_table = import_dataset(config)
    assert sqla_table.catalog == "primary"


def test_import_dataset_duplicate_column(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test importing a dataset with a column that already exists.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    dataset_uuid = uuid.uuid4()

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")

    db.session.add(database)
    db.session.flush()

    dataset = SqlaTable(
        uuid=dataset_uuid, table_name="existing_dataset", database_id=database.id
    )
    column = TableColumn(column_name="existing_column")
    db.session.add(dataset)
    db.session.add(column)
    db.session.flush()

    config = {
        "table_name": dataset.table_name,
        "main_dttm_col": "ds",
        "description": "This is the description",
        "default_endpoint": None,
        "offset": -8,
        "cache_timeout": 3600,
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": {
            "answer": "42",
        },
        "filter_select_enabled": True,
        "fetch_values_predicate": "foo IN (1, 2)",
        "extra": {"warning_markdown": "*WARNING*"},
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "verbose_name": None,
                "metric_type": None,
                "expression": "COUNT(*)",
                "description": None,
                "d3format": None,
                "extra": {"warning_markdown": None},
                "warning_text": None,
            }
        ],
        "columns": [
            {
                "column_name": column.column_name,
                "verbose_name": None,
                "is_dttm": None,
                "is_active": None,
                "type": "INTEGER",
                "groupby": None,
                "filterable": None,
                "expression": "revenue-expenses",
                "description": None,
                "python_date_format": None,
                "extra": {
                    "certified_by": "User",
                },
            }
        ],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    sqla_table = import_dataset(config, overwrite=True)
    assert sqla_table.table_name == dataset.table_name
    assert sqla_table.main_dttm_col == "ds"
    assert sqla_table.description == "This is the description"
    assert sqla_table.default_endpoint is None
    assert sqla_table.offset == -8
    assert sqla_table.cache_timeout == 3600
    assert sqla_table.schema == "my_schema"
    assert sqla_table.sql is None
    assert sqla_table.params == json.dumps(
        {"remote_id": 64, "database_name": "examples", "import_time": 1606677834}
    )
    assert sqla_table.template_params == json.dumps({"answer": "42"})
    assert sqla_table.filter_select_enabled is True
    assert sqla_table.fetch_values_predicate == "foo IN (1, 2)"
    assert sqla_table.extra == '{"warning_markdown": "*WARNING*"}'
    assert sqla_table.uuid == dataset_uuid
    assert len(sqla_table.metrics) == 1
    assert sqla_table.metrics[0].metric_name == "cnt"
    assert sqla_table.metrics[0].verbose_name is None
    assert sqla_table.metrics[0].metric_type is None
    assert sqla_table.metrics[0].expression == "COUNT(*)"
    assert sqla_table.metrics[0].description is None
    assert sqla_table.metrics[0].d3format is None
    assert sqla_table.metrics[0].extra == '{"warning_markdown": null}'
    assert sqla_table.metrics[0].warning_text is None
    assert len(sqla_table.columns) == 1
    assert sqla_table.columns[0].column_name == column.column_name
    assert sqla_table.columns[0].verbose_name is None
    assert sqla_table.columns[0].is_dttm is False
    assert sqla_table.columns[0].is_active is True
    assert sqla_table.columns[0].type == "INTEGER"
    assert sqla_table.columns[0].groupby is True
    assert sqla_table.columns[0].filterable is True
    assert sqla_table.columns[0].expression == "revenue-expenses"
    assert sqla_table.columns[0].description is None
    assert sqla_table.columns[0].python_date_format is None
    assert sqla_table.columns[0].extra == '{"certified_by": "User"}'
    assert sqla_table.database.uuid == database.uuid
    assert sqla_table.database.id == database.id


def test_import_column_extra_is_string(mocker: MockerFixture, session: Session) -> None:
    """
    Test importing a dataset when the column extra is a string.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset_uuid = uuid.uuid4()
    yaml_config: dict[str, Any] = {
        "version": "1.0.0",
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "description": "This is the description",
        "default_endpoint": None,
        "offset": -8,
        "cache_timeout": 3600,
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": {
            "answer": "42",
        },
        "filter_select_enabled": True,
        "fetch_values_predicate": "foo IN (1, 2)",
        "extra": '{"warning_markdown": "*WARNING*"}',
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "verbose_name": None,
                "metric_type": None,
                "expression": "COUNT(*)",
                "description": None,
                "d3format": None,
                "extra": '{"warning_markdown": null}',
                "warning_text": None,
            }
        ],
        "columns": [
            {
                "column_name": "profit",
                "verbose_name": None,
                "is_dttm": False,
                "is_active": True,
                "type": "INTEGER",
                "groupby": False,
                "filterable": False,
                "expression": "revenue-expenses",
                "description": None,
                "python_date_format": None,
                "extra": '{"certified_by": "User"}',
            }
        ],
        "database_uuid": database.uuid,
    }

    # the Marshmallow schema should convert strings to objects
    schema = ImportV1DatasetSchema()
    dataset_config = schema.load(yaml_config)
    dataset_config["database_id"] = database.id
    sqla_table = import_dataset(dataset_config)

    assert sqla_table.metrics[0].extra == '{"warning_markdown": null}'
    assert sqla_table.columns[0].extra == '{"certified_by": "User"}'
    assert sqla_table.extra == '{"warning_markdown": "*WARNING*"}'


def test_import_dataset_extra_empty_string(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test importing a dataset when the extra field is an empty string.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset_uuid = uuid.uuid4()
    yaml_config: dict[str, Any] = {
        "version": "1.0.0",
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "extra": " ",
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "expression": "COUNT(*)",
            }
        ],
        "columns": [
            {
                "column_name": "profit",
                "is_dttm": False,
                "is_active": True,
                "type": "INTEGER",
                "groupby": False,
                "filterable": False,
                "expression": "revenue-expenses",
            }
        ],
        "database_uuid": database.uuid,
    }

    schema = ImportV1DatasetSchema()
    dataset_config = schema.load(yaml_config)
    dataset_config["database_id"] = database.id
    sqla_table = import_dataset(dataset_config)

    assert sqla_table.extra is None  # noqa: E711


def test_import_dataset_template_params_is_empty_string(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test importing a dataset when the template_params field is an empty string.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset_uuid = uuid.uuid4()
    yaml_config: dict[str, Any] = {
        "version": "1.0.0",
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": "",
        "extra": None,
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "expression": "COUNT(*)",
            }
        ],
        "columns": [
            {
                "column_name": "profit",
                "is_dttm": False,
                "is_active": True,
                "type": "INTEGER",
                "groupby": False,
                "filterable": False,
                "expression": "revenue-expenses",
            }
        ],
        "database_uuid": database.uuid,
    }

    schema = ImportV1DatasetSchema()
    dataset_config = schema.load(yaml_config)
    dataset_config["database_id"] = database.id
    sqla_table = import_dataset(dataset_config)

    assert sqla_table.template_params is None  # noqa: E711


@patch("superset.commands.dataset.importers.v1.utils.is_safe_host", return_value=True)
@patch("superset.commands.dataset.importers.v1.utils.request.build_opener")
def test_import_column_allowed_data_url(
    mock_build_opener: Mock,
    mock_is_safe_host: Mock,
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test importing a dataset when using data key to fetch data from a URL.
    """
    mock_opener = Mock()
    mock_opener.open.return_value = io.StringIO("col1\nvalue1\nvalue2\n")
    mock_build_opener.return_value = mock_opener

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset_uuid = uuid.uuid4()
    yaml_config: dict[str, Any] = {
        "version": "1.0.0",
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "description": "This is the description",
        "default_endpoint": None,
        "offset": -8,
        "cache_timeout": 3600,
        "schema": None,
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": None,
        "filter_select_enabled": True,
        "fetch_values_predicate": None,
        "extra": None,
        "uuid": dataset_uuid,
        "metrics": [],
        "columns": [
            {
                "column_name": "col1",
                "verbose_name": None,
                "is_dttm": False,
                "is_active": True,
                "type": "TEXT",
                "groupby": False,
                "filterable": False,
                "expression": None,
                "description": None,
                "python_date_format": None,
                "extra": None,
            }
        ],
        "database_uuid": database.uuid,
        "data": "https://some-external-url.com/data.csv",
    }

    # the Marshmallow schema should convert strings to objects
    schema = ImportV1DatasetSchema()
    dataset_config = schema.load(yaml_config)
    dataset_config["database_id"] = database.id
    import_dataset(dataset_config, force_data=True)


def test_import_dataset_managed_externally(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test importing a dataset that is managed externally.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["is_managed_externally"] = True
    config["external_url"] = "https://example.org/my_table"
    config["database_id"] = database.id

    sqla_table = import_dataset(config)
    assert sqla_table.is_managed_externally is True
    assert sqla_table.external_url == "https://example.org/my_table"


def test_import_dataset_column_datetime_format(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test importing a dataset with a column including a datetime format.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    for column in config["columns"]:
        column["datetime_format"] = "%Y-%m-%d"

    schema = ImportV1DatasetSchema()
    dataset_config = schema.load(config)

    dataset_config["database_id"] = database.id

    sqla_table = import_dataset(dataset_config)
    for column in sqla_table.columns:
        assert column.datetime_format == "%Y-%m-%d"


def test_import_dataset_without_editor_permission(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test overwriting a dataset without editorship.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_is_editor = mocker.patch.object(
        security_manager, "is_editor", return_value=False
    )

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id

    import_dataset(config)
    user = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Gamma")],
    )

    with override_user(user):
        with pytest.raises(ImportFailedError) as excinfo:
            import_dataset(config, overwrite=True)

        assert (
            str(excinfo.value)
            == "Dataset 'imported_dataset' (uuid 10808100-158b-42c4-842e-f32b99d88dfb) "
            "already exists and user doesn't have permissions to overwrite it"  # noqa: E501
        )

    # Assert that the can write to dataset was checked and editorship was enforced.
    mock_can_access.assert_called_with("can_write", "Dataset")
    mock_is_editor.assert_called_once()


def test_import_dataset_access_check(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test that import_dataset raises DatasetAccessDeniedError when the user does not
    have datasource-level access to the target dataset.
    """
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(
        security_manager,
        "raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                message="User does not have access to this datasource",
                level=ErrorLevel.ERROR,
            )
        ),
    )

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id

    with pytest.raises(DatasetAccessDeniedError):
        import_dataset(config)


def test_import_soft_deleted_dataset_overwrite_restores_in_place(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Overwrite-importing a soft-deleted dataset must restore the row in
    place rather than hard-delete-and-replace. A hard delete would
    cascade through the chart back-reference and table_columns /
    sql_metrics rows; in-place restore preserves them.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id

    initial = import_dataset(config)
    original_id = initial.id

    existing = db.session.query(SqlaTable).filter_by(uuid=config["uuid"]).one()
    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
    db.session.flush()

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    with override_user(admin):
        restored = import_dataset(config, overwrite=True)

    assert restored.id == original_id
    assert restored.deleted_at is None


def test_import_soft_deleted_dataset_non_overwrite_restores_for_editor(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Non-overwrite re-import of a soft-deleted UUID is implicitly a
    restore-and-update: the user is bringing the dataset back by
    uploading it again. The same editorship rule as the overwrite path
    applies, so an editor (or admin) succeeds without setting
    overwrite=True.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "raise_for_access", return_value=None)
    mock_is_editor = mocker.patch.object(
        security_manager, "is_editor", return_value=True
    )

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id

    initial = import_dataset(config)
    original_id = initial.id

    existing = db.session.query(SqlaTable).filter_by(uuid=config["uuid"]).one()
    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
    db.session.flush()

    editor = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="editor",
        roles=[Role(name="Gamma")],
    )

    with override_user(editor):
        restored = import_dataset(config, overwrite=False)

    assert restored.id == original_id
    assert restored.deleted_at is None
    mock_is_editor.assert_called_once_with(existing)


def test_import_soft_deleted_dataset_non_overwrite_raises_for_non_editor(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Non-overwrite re-import that would resurrect a soft-deleted dataset
    must respect editorship: a non-editor without admin role cannot
    restore-via-import. Mirrors the explicit /restore endpoint's check.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mock_is_editor = mocker.patch.object(
        security_manager, "is_editor", return_value=False
    )

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id

    import_dataset(config)
    existing = db.session.query(SqlaTable).filter_by(uuid=config["uuid"]).one()
    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
    db.session.flush()

    non_editor = User(
        first_name="Bob",
        last_name="Roe",
        email="bob@example.org",
        username="bob",
        roles=[Role(name="Gamma")],
    )

    with override_user(non_editor):
        with pytest.raises(ImportFailedError) as excinfo:
            import_dataset(config, overwrite=False)
    assert "permissions to restore" in str(excinfo.value)
    mock_is_editor.assert_called_once_with(existing)
    # Verify the permission check fired before any mutation: if a regression
    # cleared ``deleted_at`` before raising, this would silently produce a
    # half-restored row and the test would still pass on the message check
    # alone.
    db.session.refresh(existing)
    assert existing.deleted_at is not None, (
        "deleted_at was cleared before the exception — restore mutation "
        "happened before the editorship check"
    )


def test_import_soft_deleted_dataset_raises_when_caller_lacks_can_write(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Case B: re-import of a soft-deleted UUID by a caller without
    can_write must raise, not silently return the soft-deleted row.

    Real-world scenario: a user has can_write Dashboard but not
    can_write Dataset, and they import a dashboard zip that references
    a soft-deleted dataset. Silently returning the row would let the
    dashboard importer wire the dashboard's charts to a deleted dataset
    and produce broken chart loads.
    """
    mocker.patch.object(security_manager, "can_access", return_value=False)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id

    # Seed a soft-deleted dataset with the matching UUID directly, so the
    # test doesn't need to flip permissions mid-test.
    existing = SqlaTable(
        table_name="soft_deleted_dataset",
        database_id=database.id,
        uuid=config["uuid"],
        deleted_at=datetime(2026, 1, 1, 12, 0, 0),
    )
    db.session.add(existing)
    db.session.flush()

    with pytest.raises(ImportFailedError) as excinfo:
        import_dataset(config, overwrite=False)
    assert "can_write" in str(excinfo.value)
    # Case B contract: deleted_at must remain set after the exception. A
    # regression that clears deleted_at before the can_write check would
    # leave the row in a half-restored state and silently pass the message
    # assertion above.
    db.session.refresh(existing)
    assert existing.deleted_at is not None, (
        "Case B: deleted_at was cleared before raising — mutation happened "
        "before the can_write check"
    )


def test_import_existing_active_dataset_overwrite_without_can_write_returns_existing(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    An *active* (not soft-deleted) dataset re-imported with overwrite=True by a
    caller without can_write must fall through to returning the existing row,
    not raise the restore error. Case B is keyed on ``is_soft_deleted``, so the
    fused ``needs_mutation`` condition must not pull active rows into the
    restore-without-permission branch (pre-soft-delete overwrite behaviour).
    """
    mocker.patch.object(security_manager, "can_access", return_value=False)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id

    existing = SqlaTable(
        table_name=config["table_name"],
        schema=config.get("schema"),
        catalog=config.get("catalog"),
        database_id=database.id,
        uuid=config["uuid"],
    )
    db.session.add(existing)
    db.session.flush()
    assert existing.deleted_at is None

    result = import_dataset(config, overwrite=True)

    assert result.id == existing.id
    assert result.deleted_at is None


def test_import_blocked_by_soft_deleted_logical_duplicate_with_new_uuid(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Importing a dataset with a fresh UUID but the same physical table as a
    soft-deleted dataset must raise. ``import_from_dict`` can't see the hidden
    row (the visibility filter hides soft-deleted rows), so creating would
    produce an active twin of a soft-deleted dataset. This mirrors the REST
    create path's ``validate_uniqueness`` block.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id

    # A soft-deleted dataset with a DIFFERENT UUID but the same physical table.
    twin = SqlaTable(
        table_name=config["table_name"],
        schema=config.get("schema"),
        catalog=config.get("catalog"),
        database_id=database.id,
        uuid="ffffffff-ffff-ffff-ffff-ffffffffffff",
        deleted_at=datetime(2026, 1, 1, 12, 0, 0),
    )
    db.session.add(twin)
    db.session.flush()

    with pytest.raises(ImportFailedError) as excinfo:
        import_dataset(config)
    assert "same physical table" in str(excinfo.value)


def test_import_soft_deleted_dataset_restore_removes_orphan_children(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Restoring a soft-deleted dataset via re-import (non-overwrite,
    Option C) syncs columns and metrics — children present in the live
    row but absent from the uploaded config are removed, not silently
    merged.

    Without forcing sync on the implicit-restore path, ``sync=[]``
    would mean "upsert by UUID, leave non-matching children alone",
    so the restored dataset would carry stale columns from before the
    soft-delete. That's a surprising merge of two states; treating
    re-import as a clean replacement is what an explicit ``overwrite``
    would do anyway.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id

    initial = import_dataset(config)
    original_id = initial.id

    existing = db.session.query(SqlaTable).filter_by(uuid=config["uuid"]).one()
    # Add an orphan column that the upload doesn't know about.
    orphan = TableColumn(
        column_name="orphan_col",
        type="STRING",
        table=existing,
    )
    db.session.add(orphan)
    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
    db.session.flush()
    orphan_uuid = orphan.uuid

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    with override_user(admin):
        restored = import_dataset(config, overwrite=False)

    assert restored.id == original_id
    assert restored.deleted_at is None
    assert orphan_uuid not in {c.uuid for c in restored.columns}, (
        "orphan column survived restore-via-import; the implicit-restore "
        "path must force sync so re-import is a clean replacement"
    )


def test_import_dataset_multiple_results_on_soft_delete_match_raises_and_rolls_back(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    When ``find_existing_for_import`` resolves a soft-deleted row by UUID
    and the subsequent ``import_from_dict`` hits the legacy NULL-schema
    ambiguity (``MultipleResultsFound``), the importer must:

      1. Roll back the ``deleted_at`` clear it just applied — without
         the rollback the dataset would be left half-restored
         (``deleted_at = None`` but no upload content applied).
      2. Raise ``ImportFailedError`` with the legacy-duplicate message
         so the operator resolves the duplicate manually before retrying.

    Reproduce: seed a soft-deleted row with the target UUID and monkey-
    patch ``import_from_dict`` to raise ``MultipleResultsFound``. The
    importer must surface the guard exception, and the row's
    ``deleted_at`` must still be set after the call returns.
    """
    from sqlalchemy.exc import MultipleResultsFound

    from superset.commands.exceptions import ImportFailedError
    from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(
        SqlaTable,
        "import_from_dict",
        side_effect=MultipleResultsFound("simulated duplicate"),
    )

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id

    original_deleted_at = datetime(2026, 1, 1, 12, 0, 0)
    soft_deleted = SqlaTable(
        table_name="ambiguous_dataset",
        database_id=database.id,
        uuid=config["uuid"],
        deleted_at=original_deleted_at,
    )
    db.session.add(soft_deleted)
    db.session.flush()

    with pytest.raises(ImportFailedError, match="matches more than one existing row"):
        import_dataset(config)

    reloaded = (
        db.session.query(SqlaTable)
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
        .filter_by(uuid=config["uuid"])
        .one()
    )
    assert reloaded.deleted_at == original_deleted_at, (
        "deleted_at was not rolled back after MultipleResultsFound on "
        "the soft-delete-match path; the row is left half-restored"
    )


def test_import_soft_deleted_dataset_ignore_permissions_restores_in_place(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    The example loader path: ignore_permissions=True with no logged-in
    user. Previously the rewrite gated id-preservation on `user`, so this
    path skipped both branches and INSERT collided on the UUID unique
    index. The fix restores master's behavior: id is preserved on the
    fallthrough overwrite path regardless of whether `user` is set.
    """
    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id

    initial = import_dataset(config, ignore_permissions=True)
    original_id = initial.id

    existing = db.session.query(SqlaTable).filter_by(uuid=config["uuid"]).one()
    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
    db.session.flush()

    restored = import_dataset(config, overwrite=True, ignore_permissions=True)
    assert restored.id == original_id
    assert restored.deleted_at is None


@pytest.mark.parametrize(
    "allowed_urls, data_uri, expected, exception_class",
    [
        ([r".*"], "https://some-url/data.csv", True, None),
        (
            [r"^https://.+\.domain1\.com\/?.*", r"^https://.+\.domain2\.com\/?.*"],
            "https://host1.domain1.com/data.csv",
            True,
            None,
        ),
        (
            [r"^https://.+\.domain1\.com\/?.*", r"^https://.+\.domain2\.com\/?.*"],
            "https://host2.domain1.com/data.csv",
            True,
            None,
        ),
        (
            [r"^https://.+\.domain1\.com\/?.*", r"^https://.+\.domain2\.com\/?.*"],
            "https://host1.domain2.com/data.csv",
            True,
            None,
        ),
        (
            [r"^https://.+\.domain1\.com\/?.*", r"^https://.+\.domain2\.com\/?.*"],
            "https://host1.domain3.com/data.csv",
            False,
            DatasetForbiddenDataURI,
        ),
        ([], "https://host1.domain3.com/data.csv", False, DatasetForbiddenDataURI),
        (["*"], "https://host1.domain3.com/data.csv", False, re.error),
    ],
)
def test_validate_data_uri(
    allowed_urls: list[str],
    data_uri: str,
    expected: bool,
    exception_class: type[Exception] | None,
) -> None:
    """Tests allowlist pattern matching. is_safe_host is stubbed out so that
    fake/unresolvable test hostnames do not interfere with DNS-based checks
    (those are covered by the dedicated is_safe_host tests below)."""
    current_app.config["DATASET_IMPORT_ALLOWED_DATA_URLS"] = allowed_urls
    current_app.config["DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS"] = False
    with patch(
        "superset.commands.dataset.importers.v1.utils.is_safe_host",
        return_value=True,
    ):
        if expected:
            validate_data_uri(data_uri)
        else:
            with pytest.raises(exception_class):
                validate_data_uri(data_uri)


def test_validate_data_uri_file_scheme_examples_allowed() -> None:
    """file:// URIs pointing inside the examples folder are permitted."""
    import os

    from superset.examples.helpers import get_examples_folder

    examples_folder = get_examples_folder()
    uri_in_examples = (
        f"file://{os.path.join(examples_folder, 'birth_names', 'data.parquet')}"
    )
    current_app.config["DATASET_IMPORT_ALLOWED_DATA_URLS"] = []
    current_app.config["DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS"] = False
    # Should not raise
    validate_data_uri(uri_in_examples)


def test_validate_data_uri_file_scheme_outside_examples_blocked() -> None:
    """file:// URIs outside the examples folder are blocked."""
    current_app.config["DATASET_IMPORT_ALLOWED_DATA_URLS"] = []
    current_app.config["DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS"] = False
    with pytest.raises(DatasetForbiddenDataURI):
        validate_data_uri("file:///etc/passwd")


@pytest.mark.parametrize(
    "data_uri",
    ["FiLe:///etc/passwd", "FILE:///etc/passwd", "file:/etc/passwd"],
)
def test_validate_data_uri_file_scheme_case_insensitive(data_uri: str) -> None:
    """Mixed-case / single-slash file URIs still go through the sandbox check
    and are blocked when outside the examples folder, so they cannot skip the
    local-file check via a case-sensitive scheme gate."""
    current_app.config["DATASET_IMPORT_ALLOWED_DATA_URLS"] = []
    current_app.config["DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS"] = False
    with pytest.raises(DatasetForbiddenDataURI):
        validate_data_uri(data_uri)


@pytest.mark.parametrize(
    "data_uri",
    [
        # Userinfo-injection: allowlist matches the trusted hostname in the
        # authority but urlparse().hostname resolves to the actual target.
        "https://allowed.example.com@169.254.169.254/latest/meta-data/",
        "https://allowed.example.com@10.0.0.1/internal",
        "https://allowed.example.com@127.0.0.1/admin",
    ],
)
def test_validate_data_uri_blocks_userinfo_ssrf_injection(data_uri: str) -> None:
    """Userinfo-injected private IPs must be rejected even when the leading
    hostname matches an allowlist pattern."""
    current_app.config["DATASET_IMPORT_ALLOWED_DATA_URLS"] = [r".*"]
    current_app.config["DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS"] = False
    with patch(
        "superset.commands.dataset.importers.v1.utils.is_safe_host",
        return_value=False,
    ):
        with pytest.raises(DatasetForbiddenDataURI):
            validate_data_uri(data_uri)


def test_validate_data_uri_allow_internal_flag_bypasses_host_check() -> None:
    """When DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS is True, internal hosts
    must be permitted to support air-gapped / on-premises deployments."""
    current_app.config["DATASET_IMPORT_ALLOWED_DATA_URLS"] = [r".*"]
    current_app.config["DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS"] = True
    with patch(
        "superset.commands.dataset.importers.v1.utils.is_safe_host",
        return_value=False,
    ) as mock_check:
        validate_data_uri("http://10.0.0.5/data.csv")
        mock_check.assert_not_called()


def test_validate_data_uri_no_hostname_raises() -> None:
    """A URI that produces no parseable hostname (e.g. opaque data: URIs) must
    be rejected — fail-closed: no hostname means no safe host confirmation."""
    current_app.config["DATASET_IMPORT_ALLOWED_DATA_URLS"] = [r".*"]
    current_app.config["DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS"] = False
    # urlparse("data:text/csv,...").hostname is None, which fails the
    # "not hostname or not is_safe_host(hostname)" guard.
    with pytest.raises(DatasetForbiddenDataURI):
        validate_data_uri("data:text/csv,col1,col2")


def test_redirect_handler_blocks_disallowed_redirect_target() -> None:
    """The redirect handler must reject a redirect to a disallowed host by
    re-running validate_data_uri() on the new URL before following it."""
    from superset.commands.dataset.importers.v1.utils import (
        _ValidatingRedirectHandler,
    )

    current_app.config["DATASET_IMPORT_ALLOWED_DATA_URLS"] = [r".*"]
    current_app.config["DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS"] = False

    handler = _ValidatingRedirectHandler()
    with patch(
        "superset.commands.dataset.importers.v1.utils.is_safe_host",
        return_value=False,
    ):
        with pytest.raises(DatasetForbiddenDataURI):
            handler.redirect_request(
                request.Request("http://public.example.com/data.csv"),
                None,
                302,
                "Found",
                {},
                "http://169.254.169.254/latest/meta-data/",
            )


def test_import_overwrite_rename_onto_soft_deleted_twin_blocked(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """Overwriting an alive dataset must not rename it onto a hidden twin's
    physical identity.

    ``import_from_dict``'s lookup cannot see the soft-deleted row (visibility
    filter), so without the identity re-validation the update would land
    cleanly and the live row would silently squat the trash row's identity —
    permanently blocking its restore. Mirrors ``UpdateDatasetCommand``'s
    ``validate_update_uniqueness`` contract.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id
    config["table_name"] = "squatted_tbl"  # rename onto the twin's identity

    # The alive dataset being overwritten (matches the config's UUID).
    existing = SqlaTable(
        table_name="original_tbl",
        schema=config.get("schema"),
        catalog=config.get("catalog"),
        database_id=database.id,
        uuid=config["uuid"],
    )
    # The hidden twin holding the target identity.
    twin = SqlaTable(
        table_name="squatted_tbl",
        schema=config.get("schema"),
        catalog=config.get("catalog"),
        database_id=database.id,
        uuid="ffffffff-ffff-ffff-ffff-fffffffffff0",
        deleted_at=datetime(2026, 1, 1, 12, 0, 0),
    )
    db.session.add_all([existing, twin])
    db.session.flush()

    with pytest.raises(ImportFailedError) as excinfo:
        import_dataset(config, overwrite=True)
    assert "cannot be overwritten" in str(excinfo.value)
    assert config["uuid"] in str(excinfo.value)
    # The alive row keeps its original identity.
    assert existing.table_name == "original_tbl"


def test_import_restore_blocked_by_active_twin_at_incoming_identity(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """The restore-via-import duplicate check probes the POST-update identity.

    An uploaded config that renames the soft-deleted dataset onto an ACTIVE
    dataset's identity must be refused up front (check-before-mutate: the row
    stays soft-deleted), not fall through to a downstream
    ``MultipleResultsFound`` with a misdiagnosing message.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_fixture)
    config["database_id"] = database.id
    config["table_name"] = "claimed_tbl"  # rename onto the active row's identity

    # The soft-deleted dataset being restored (matches the config's UUID).
    existing = SqlaTable(
        table_name="old_tbl",
        schema=config.get("schema"),
        catalog=config.get("catalog"),
        database_id=database.id,
        uuid=config["uuid"],
        deleted_at=datetime(2026, 1, 1, 12, 0, 0),
    )
    # An unrelated ACTIVE dataset already holding the target identity.
    active = SqlaTable(
        table_name="claimed_tbl",
        schema=config.get("schema"),
        catalog=config.get("catalog"),
        database_id=database.id,
        uuid="ffffffff-ffff-ffff-ffff-fffffffffff1",
    )
    db.session.add_all([existing, active])
    db.session.flush()

    with pytest.raises(ImportFailedError) as excinfo:
        import_dataset(config)
    assert "another active dataset" in str(excinfo.value)
    # Check-before-mutate: the failed import leaves the row soft-deleted.
    assert existing.deleted_at is not None


def test_peer_validating_connection_blocks_rebound_peer() -> None:
    """
    The import fetch validates the connected peer address, so a hostname that
    passes ``is_safe_host`` and then re-resolves to an internal address (DNS
    rebinding) is rejected before any request bytes are sent.
    """
    from http.client import HTTPConnection
    from unittest.mock import MagicMock, patch

    from superset.commands.dataset.exceptions import DatasetForbiddenDataURI
    from superset.commands.dataset.importers.v1.utils import (
        _PeerValidatingHTTPConnection,
    )

    sock = MagicMock()
    sock.getpeername.return_value = ("169.254.169.254", 80)

    with patch.object(
        HTTPConnection, "connect", lambda self: setattr(self, "sock", sock)
    ):
        conn = _PeerValidatingHTTPConnection("rebinder.example.com")
        with pytest.raises(DatasetForbiddenDataURI):
            conn.connect()


def test_load_data_disables_proxy_when_internal_urls_disallowed(
    mocker: MockerFixture,
) -> None:
    """
    ``load_data`` builds its opener with an explicit no-proxy handler when
    internal data URLs are disallowed, so a configured HTTP(S) proxy can't
    intercept the connection the peer check validates.
    """
    from superset.commands.dataset.importers.v1.utils import load_data

    current_app.config["DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS"] = False

    mocker.patch("superset.commands.dataset.importers.v1.utils.validate_data_uri")
    mocker.patch(
        "superset.examples.helpers.normalize_example_data_url",
        side_effect=lambda uri: uri,
    )
    mocker.patch(
        "superset.commands.dataset.importers.v1.utils._convert_temporal_columns"
    )
    mocker.patch("superset.commands.dataset.importers.v1.utils.db.session.connection")
    mock_df = Mock()
    mock_df.keys.return_value = []
    mocker.patch(
        "superset.commands.dataset.importers.v1.utils.pd.read_csv",
        return_value=mock_df,
    )
    mock_opener = Mock()
    mock_opener.open.return_value = io.BytesIO(b"")
    mock_build_opener = mocker.patch(
        "superset.commands.dataset.importers.v1.utils.request.build_opener",
        return_value=mock_opener,
    )

    dataset = Mock(spec=SqlaTable)
    dataset.columns = []
    dataset.table_name = "my_table"
    dataset.schema = None

    database = Mock(spec=Database)
    database.sqlalchemy_uri = current_app.config["SQLALCHEMY_DATABASE_URI"]

    load_data("https://example.org/data.csv", dataset, database)

    handlers = mock_build_opener.call_args.args
    assert any(
        isinstance(handler, request.ProxyHandler) and not handler.proxies  # type: ignore[attr-defined]
        for handler in handlers
    )


def test_load_data_bounds_gzip_download_before_decompression(
    mocker: MockerFixture,
) -> None:
    """
    For a ``.gz`` data URI, ``load_data`` must bound the raw (compressed)
    download before decompressing it, not just the decompressed output --
    otherwise an oversized or malformed compressed response could be read
    in full before any size check applies.
    """
    from superset.commands.dataset.importers.v1.utils import load_data

    mocker.patch("superset.commands.dataset.importers.v1.utils.validate_data_uri")
    mocker.patch(
        "superset.examples.helpers.normalize_example_data_url",
        side_effect=lambda uri: uri,
    )
    mocker.patch(
        "superset.commands.dataset.importers.v1.utils._convert_temporal_columns"
    )
    mocker.patch("superset.commands.dataset.importers.v1.utils.db.session.connection")
    mock_df = Mock()
    mock_df.keys.return_value = []
    mocker.patch(
        "superset.commands.dataset.importers.v1.utils.pd.read_csv",
        return_value=mock_df,
    )

    raw_response = Mock()
    mock_opener = Mock()
    mock_opener.open.return_value = raw_response
    mocker.patch(
        "superset.commands.dataset.importers.v1.utils.request.build_opener",
        return_value=mock_opener,
    )

    bounded_raw = io.BytesIO(b"")
    decompressed = Mock()
    mock_read_bounded = mocker.patch(
        "superset.commands.dataset.importers.v1.utils._read_bounded",
        side_effect=[bounded_raw, io.BytesIO(b"")],
    )
    mock_gzip_open = mocker.patch(
        "superset.commands.dataset.importers.v1.utils.gzip.open",
        return_value=decompressed,
    )

    dataset = Mock(spec=SqlaTable)
    dataset.columns = []
    dataset.table_name = "my_table"
    dataset.schema = None

    database = Mock(spec=Database)
    database.sqlalchemy_uri = current_app.config["SQLALCHEMY_DATABASE_URI"]

    load_data("https://example.org/data.csv.gz", dataset, database)

    # the raw (still compressed) response is bounded first...
    assert mock_read_bounded.call_args_list[0].args[0] is raw_response
    # ...then gzip.open() decompresses the bounded buffer...
    mock_gzip_open.assert_called_once_with(bounded_raw)
    # ...and the decompressed output is bounded again before parsing.
    assert mock_read_bounded.call_args_list[1].args[0] is decompressed
