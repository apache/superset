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

``always_filter_main_dttm`` is the template these follow: a dataset-level setting
that names a column and appears in the ORM, the ``data`` payload, the API schemas
and the frontend types. A field missing from any one of them is dropped silently,
which is exactly the failure mode these tests exist to catch.

Export and import get a shorter list than they would with real columns: the
mapping lives inside ``tables.extra``, which is already in ``export_fields`` and
already one of `ExportDatasetsCommand`'s ``JSON_KEYS``, so it travels with no
bundle-format change. What has to be proved instead is that it comes back out
the other side, and that nothing else in the blob is lost on the way.
"""

from __future__ import annotations

from typing import Any

import pytest
from flask import Flask

from superset.commands.dataset.export import ExportDatasetsCommand, JSON_KEYS
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.connectors.sqla.partition_mapping_storage import (
    clear_dangling,
    ColumnTransform,
    EXTRA_KEY,
    extra_with_partition_mapping,
    parse_mapping,
    StoredPartitionMapping,
)
from superset.datasets.schemas import (
    DatasetColumnsPutSchema,
    DatasetPutSchema,
    ImportV1DatasetSchema,
)
from superset.exceptions import SupersetMarshmallowValidationError
from superset.models.core import Database
from superset.utils import json

DATASET_FIELDS = ["partition_column", "partition_mapped_column"]
COLUMN_FIELDS = ["partition_value_transform", "partition_transform_is_monotonic"]

MAPPING = StoredPartitionMapping(
    partition_column="dt_epoch",
    mapped_column=None,
    column_transforms={
        "event_time": ColumnTransform("unix_timestamp(:value)", is_monotonic=True)
    },
)


@pytest.fixture(autouse=True)
def enable_partition_filter_mapping(app: Flask) -> Any:
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = True
    yield
    del app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"]


def _table(
    mapping: StoredPartitionMapping = MAPPING, extra: str | None = None
) -> SqlaTable:
    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    table = SqlaTable(
        table_name="web_events",
        database=database,
        main_dttm_col="event_time",
        columns=[
            TableColumn(column_name="event_time", is_dttm=True, type="TIMESTAMP"),
            TableColumn(column_name="dt_epoch", type="BIGINT"),
        ],
    )
    # Stored state, not attribute assignment: the model's four mapping attributes
    # are read-only properties over the configured store.
    table.extra = extra_with_partition_mapping(extra, mapping)
    return table


# ---------------------------------------------------------------------------
# The Explore and dashboard payloads
# ---------------------------------------------------------------------------


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


def test_the_transform_is_reported_only_on_the_mapped_column(app: Flask) -> None:
    """
    Each column reports what its own row would say after the migration, so the
    partition column must not claim the mapped column's transform. Scoping this
    is also what stops `resolve_partition_mapping` reading a transform off the
    wrong column.
    """
    with app.app_context():
        columns = {column["column_name"]: column for column in _table().data["columns"]}

    assert (
        columns["event_time"]["partition_value_transform"] == "unix_timestamp(:value)"
    )
    assert columns["event_time"]["partition_transform_is_monotonic"] is True
    assert columns["dt_epoch"]["partition_value_transform"] is None
    assert columns["dt_epoch"]["partition_transform_is_monotonic"] is False


def test_a_transform_does_not_follow_a_re_pointed_main_dttm_col(app: Flask) -> None:
    """
    The reason transforms are keyed by column name rather than flattened onto the
    mapping. An owner who declares a transform on ``event_time`` and later
    re-points ``main_dttm_col`` at another column must not have that column's
    values mirrored through ``event_time``'s expression -- the mapping goes
    inactive instead, which is what four real columns would do.
    """
    table = _table()
    table.main_dttm_col = "dt_epoch"

    with app.app_context():
        summary = table.data["partition_filter_mapping"]

    # `dt_epoch` is now both the partition column and the effective mapped one,
    # and it carries no transform of its own.
    assert summary is not None
    assert summary["active"] is False


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


def test_the_mapping_summary_reports_inactive_without_a_transform(app: Flask) -> None:
    table = _table(StoredPartitionMapping(partition_column="dt_epoch"))

    with app.app_context():
        summary = table.data["partition_filter_mapping"]

    assert summary is not None
    assert summary["active"] is False


@pytest.mark.parametrize(
    "transform",
    [
        # Missing the placeholder, so there is no filter value to substitute.
        "unix_timestamp(event_time)",
        # Unparseable, so nothing can be emitted from it.
        "unix_timestamp(:value",
        # Blocking on PUT, but create, import and the free-text Extra box do not
        # go through that validation, so it can still be read back.
        "{{ current_username() }}",
        # Non-deterministic: rejected on PUT, and inactive wherever it lands.
        "unix_timestamp(now())",
    ],
)
def test_the_mapping_summary_reports_inactive_for_an_invalid_transform(
    app: Flask,
    transform: str,
) -> None:
    """
    A transform that fails validation is saved inactive on purpose. The indicator
    has to say the same thing, or it advertises a mapping that will never mirror
    a filter.
    """
    table = _table(
        StoredPartitionMapping(
            partition_column="dt_epoch",
            column_transforms={"event_time": ColumnTransform(transform)},
        )
    )

    with app.app_context():
        summary = table.data["partition_filter_mapping"]

    assert summary is not None
    assert summary["active"] is False


def test_the_mapping_summary_still_names_the_columns_when_inactive(app: Flask) -> None:
    """
    An inactive mapping is exactly the one worth naming: the editor has to tell
    the owner which columns to fix.
    """
    table = _table(
        StoredPartitionMapping(
            partition_column="dt_epoch",
            column_transforms={
                "event_time": ColumnTransform("unix_timestamp(event_time)")
            },
        )
    )

    with app.app_context():
        summary = table.data["partition_filter_mapping"]

    assert summary == {
        "partition_column": "dt_epoch",
        "mapped_column": "event_time",
        "active": False,
    }


def test_there_is_no_mapping_summary_without_a_partition_column(app: Flask) -> None:
    table = _table(StoredPartitionMapping())

    with app.app_context():
        assert table.data["partition_filter_mapping"] is None


# ---------------------------------------------------------------------------
# The API schemas
# ---------------------------------------------------------------------------


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


def test_put_schema_leaves_out_a_monotonic_flag_the_payload_omits() -> None:
    """
    The DAO's patch carries present keys only, so a default here would let a
    partial column update clear a monotonic flag the request never mentioned --
    and silently stop mirroring range filters.
    """
    loaded = DatasetColumnsPutSchema().load({"column_name": "event_time"})
    assert "partition_transform_is_monotonic" not in loaded


def test_put_schema_allows_clearing_the_mapping() -> None:
    """Removing a mapping is a null, not an omission."""
    loaded = DatasetPutSchema().load({"partition_column": None})
    assert loaded["partition_column"] is None


@pytest.mark.parametrize("field", DATASET_FIELDS + COLUMN_FIELDS)
def test_the_api_exposes_the_mapping(field: str) -> None:
    """
    The two column fields are not optional here. The dataset editor seeds itself
    from `GET /api/v1/dataset/<pk>` and then PUTs every column back, so a
    transform this payload omits is one the next save clears.
    """
    from superset.datasets.api import DatasetRestApi

    names = set(DatasetRestApi.show_columns)
    assert field in names or f"columns.{field}" in names


@pytest.mark.parametrize("field", DATASET_FIELDS)
def test_the_api_accepts_the_dataset_fields(field: str) -> None:
    from superset.datasets.api import DatasetRestApi

    assert field in DatasetRestApi.edit_columns


def test_the_mapping_is_hidden_from_an_inaccessible_dashboard_dataset() -> None:
    """
    ``partition_column`` is a physical column name, the same class of detail as
    ``columns`` and ``sql``, so a caller who cannot access the dataset must not
    receive it in the dashboard payload.
    """
    from superset.dashboards.api import DASHBOARD_DATASET_INACCESSIBLE_FIELDS

    for field in (*DATASET_FIELDS, "partition_filter_mapping"):
        assert field in DASHBOARD_DATASET_INACCESSIBLE_FIELDS


# ---------------------------------------------------------------------------
# Export and import, which carry the mapping inside ``extra``
# ---------------------------------------------------------------------------


def test_export_writes_the_mapping_as_nested_yaml(app: Flask) -> None:
    """
    No export-format change was needed: ``extra`` is already in
    ``SqlaTable.export_fields`` and already one of ``JSON_KEYS``, so the command
    parses it into a nested mapping in the YAML for free.
    """
    assert "extra" in SqlaTable.export_fields
    assert "extra" in JSON_KEYS

    with app.app_context():
        content = ExportDatasetsCommand._file_content(_table())

    assert EXTRA_KEY in content
    assert "unix_timestamp(:value)" in content


def test_the_mapping_round_trips_through_the_import_schema(app: Flask) -> None:
    """
    The bundle carries a nested ``extra`` mapping; `fix_extra` also accepts the
    string form, and `import_dataset` re-encodes it before
    `import_from_dict` writes it. Either way the mapping comes back.
    """
    with app.app_context():
        exported = _table().extra

    for payload_extra in (json.loads(exported), exported):
        loaded = ImportV1DatasetSchema().load(
            {
                "table_name": "web_events",
                "uuid": "00000000-0000-0000-0000-000000000001",
                "database_uuid": "00000000-0000-0000-0000-000000000002",
                "version": "1.0.0",
                "extra": payload_extra,
            }
        )
        assert parse_mapping(json.dumps(loaded["extra"])) == MAPPING


def test_a_bundle_predating_the_flag_does_not_claim_monotonicity() -> None:
    """
    The flag gates range mirroring, so a blob that omits it -- or carries
    something merely truthy -- must not silently claim the transform preserves
    ordering.
    """
    for value in (None, "true", 1, "no"):
        blob: dict[str, Any] = {
            "partition_column": "dt_epoch",
            "column_transforms": {
                "event_time": {"value_transform": "unix_timestamp(:value)"}
            },
        }
        if value is not None:
            blob["column_transforms"]["event_time"]["is_monotonic"] = value
        mapping = parse_mapping(json.dumps({EXTRA_KEY: blob}))
        assert mapping.transform_for("event_time").is_monotonic is False


def test_writing_the_mapping_preserves_the_rest_of_extra() -> None:
    """
    ``extra`` is shared: ``certification``, ``warning_markdown``, ``timezone``
    and ``disallow_adhoc_metrics`` all live in the same blob, and the dataset
    editor round-trips the whole string verbatim. A mapping write merges.
    """
    neighbours = {
        "certification": {"certified_by": "Data Eng", "details": "reviewed"},
        "warning_markdown": "**beware**",
        "timezone": "Europe/Berlin",
        "disallow_adhoc_metrics": True,
    }
    written = extra_with_partition_mapping(json.dumps(neighbours), MAPPING)
    decoded = json.loads(str(written))

    assert {key: decoded[key] for key in neighbours} == neighbours
    assert parse_mapping(written) == MAPPING

    # And clearing it takes only the one key with it.
    cleared = json.loads(
        str(extra_with_partition_mapping(written, StoredPartitionMapping()))
    )
    assert cleared == neighbours


# ---------------------------------------------------------------------------
# A column sync can pull the partition column out from under the mapping
# ---------------------------------------------------------------------------


def test_a_sync_that_removes_the_partition_column_clears_the_mapping() -> None:
    """
    An API-driven ``override_columns=true`` sync must not leave a dangling
    mapping. This is the authoritative path -- the client-side sync clears the
    mapping too, but a caller can bypass the editor entirely.
    """
    cleared = clear_dangling(MAPPING, {"event_time"})

    assert cleared.partition_column is None
    assert cleared.mapped_column is None


def test_a_sync_that_removes_the_mapped_column_clears_only_the_override() -> None:
    """
    The partition column is still real, so the designation survives; the mapping
    falls back to "no mapped column" and goes inactive until one is chosen.
    """
    mapping = StoredPartitionMapping(
        partition_column="dt_epoch",
        mapped_column="event_time",
        column_transforms=dict(MAPPING.column_transforms),
    )
    cleared = clear_dangling(mapping, {"dt_epoch"})

    assert cleared.partition_column == "dt_epoch"
    assert cleared.mapped_column is None


def test_a_sync_drops_transforms_for_columns_that_are_gone() -> None:
    """A transform keyed on a deleted column would linger forever otherwise."""
    cleared = clear_dangling(MAPPING, {"dt_epoch"})

    assert cleared.column_transforms == {}


def test_a_sync_that_keeps_both_columns_leaves_the_mapping_alone() -> None:
    assert clear_dangling(MAPPING, {"event_time", "dt_epoch"}) == MAPPING


# ---------------------------------------------------------------------------
# The second door: a mapping typed into the free-text Extra box
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "blob",
    [
        42,
        "a string",
        [],
        {"partition_column": 7},
        {"mapped_column": ["event_time"]},
        {"partition_column": "x" * 251},
        {"column_transforms": "nope"},
        {"column_transforms": {"event_time": "nope"}},
        {"column_transforms": {"event_time": {"value_transform": 7}}},
        {"column_transforms": {"event_time": {"is_monotonic": "yes"}}},
    ],
)
def test_a_mistyped_mapping_in_extra_is_rejected(blob: Any) -> None:
    """
    `parse_mapping` degrades any of these to "not configured", which an owner has
    no way to diagnose. `DatasetPutSchema.extra` turns the silence into a message.
    """
    with pytest.raises(SupersetMarshmallowValidationError) as excinfo:
        DatasetPutSchema().load({"extra": json.dumps({EXTRA_KEY: blob})})

    # One readable sentence, not a list of single characters -- which is what
    # marshmallow makes of a `LazyString` passed straight to `ValidationError`.
    message = excinfo.value.error.extra["messages"]["extra"][0]
    assert isinstance(message, str)
    assert message.endswith(".")


@pytest.mark.parametrize(
    "extra",
    [
        # Never validated on this endpoint before, so a deployment may already
        # hold one of these. Failing an owner's next save over a field they did
        # not touch would be a regression.
        "not json at all",
        "[1, 2, 3]",
        # Everything else in the blob is somebody else's business.
        '{"certification": {"certified_by": "Data Eng"}, "unknown_key": 1}',
        '{"timezone": "Europe/Berlin"}',
    ],
)
def test_extra_validation_is_scoped_to_the_mapping_key(extra: str) -> None:
    assert DatasetPutSchema().load({"extra": extra})["extra"] == extra


def test_a_well_formed_mapping_in_extra_is_accepted() -> None:
    extra = extra_with_partition_mapping('{"timezone": "Europe/Berlin"}', MAPPING)
    assert DatasetPutSchema().load({"extra": extra})["extra"] == extra
