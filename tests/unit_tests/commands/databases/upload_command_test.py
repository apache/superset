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
import io
from typing import Any
from unittest.mock import MagicMock

import pytest
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session
from werkzeug.datastructures import FileStorage

from superset.commands.database.exceptions import DatabaseUploadFileTooLarge
from superset.commands.database.uploaders.base import UploadCommand
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.extensions import db
from superset.models.core import Database
from superset.utils.core import override_user
from tests.unit_tests.conftest import with_feature_flags


def _file(contents: bytes) -> FileStorage:
    return FileStorage(stream=io.BytesIO(contents), filename="data.bin")


def test_file_size_bytes_does_not_consume_stream() -> None:
    file = _file(b"abcdefghij")  # 10 bytes
    assert UploadCommand._file_size_bytes(file) == 10
    # the stream is left at its original position so processing still works
    assert file.stream.read() == b"abcdefghij"


def _command(file: FileStorage, schema: str | None = None) -> UploadCommand:
    # the reader is not exercised by validate(); a stub is sufficient
    return UploadCommand(
        model_id=1,
        table_name="t",
        file=file,
        schema=schema,
        reader=MagicMock(),
    )


def _stub_passing_checks(mocker: MockerFixture) -> MagicMock:
    model = mocker.MagicMock()
    model.db_engine_spec.supports_file_upload = True
    # keep default-schema resolution inert so a MagicMock does not leak
    # into the command's schema
    model.get_default_catalog.return_value = None
    model.get_default_schema.return_value = None
    mocker.patch(
        "superset.commands.database.uploaders.base.DatabaseDAO.find_by_id",
        return_value=model,
    )
    mocker.patch(
        "superset.commands.database.uploaders.base.schema_allows_file_upload",
        return_value=True,
    )
    return model


def test_validate_rejects_file_over_limit(
    app_context: None, mocker: MockerFixture
) -> None:
    _stub_passing_checks(mocker)
    mocker.patch.dict(
        "superset.commands.database.uploaders.base.current_app.config",
        {"UPLOAD_MAX_FILE_SIZE_BYTES": 4},
    )
    command = _command(_file(b"too many bytes"))
    with pytest.raises(DatabaseUploadFileTooLarge):
        command.validate()


def test_validate_allows_file_within_limit(
    app_context: None, mocker: MockerFixture
) -> None:
    _stub_passing_checks(mocker)
    mocker.patch.dict(
        "superset.commands.database.uploaders.base.current_app.config",
        {"UPLOAD_MAX_FILE_SIZE_BYTES": 1024},
    )
    command = _command(_file(b"small"))
    command.validate()  # should not raise


def test_validate_no_limit_when_disabled(
    app_context: None, mocker: MockerFixture
) -> None:
    _stub_passing_checks(mocker)
    mocker.patch.dict(
        "superset.commands.database.uploaders.base.current_app.config",
        {"UPLOAD_MAX_FILE_SIZE_BYTES": None},
    )
    command = _command(_file(b"x" * 10_000))
    command.validate()  # limit explicitly disabled (None) -> no rejection


def test_validate_file_size_rejects_over_limit(
    app_context: None, mocker: MockerFixture
) -> None:
    # the shared helper is used by both the upload and metadata paths
    mocker.patch.dict(
        "superset.commands.database.uploaders.base.current_app.config",
        {"UPLOAD_MAX_FILE_SIZE_BYTES": 4},
    )
    with pytest.raises(DatabaseUploadFileTooLarge):
        UploadCommand.validate_file_size(_file(b"too many bytes"))


def test_validate_file_size_allows_within_limit(
    app_context: None, mocker: MockerFixture
) -> None:
    mocker.patch.dict(
        "superset.commands.database.uploaders.base.current_app.config",
        {"UPLOAD_MAX_FILE_SIZE_BYTES": 1024},
    )
    UploadCommand.validate_file_size(_file(b"small"))  # should not raise


class _NonSeekableStream(io.RawIOBase):
    def seekable(self) -> bool:
        return False

    def tell(self) -> int:
        raise OSError("not seekable")


def _non_seekable_file() -> FileStorage:
    return FileStorage(stream=_NonSeekableStream(), filename="data.bin")


def test_file_size_bytes_returns_none_when_not_seekable() -> None:
    # a non-seekable stream raises on seek/tell; the size is unknown
    assert UploadCommand._file_size_bytes(_non_seekable_file()) is None


def test_validate_file_size_skips_when_not_seekable(
    app_context: None, mocker: MockerFixture
) -> None:
    mocker.patch.dict(
        "superset.commands.database.uploaders.base.current_app.config",
        {"UPLOAD_MAX_FILE_SIZE_BYTES": 4},
    )
    # size can't be determined cheaply -> skip rather than raising a 500
    UploadCommand.validate_file_size(_non_seekable_file())


def test_validate_resolves_default_schema(
    app_context: None, mocker: MockerFixture
) -> None:
    model = _stub_passing_checks(mocker)
    model.get_default_schema.return_value = "public"
    command = _command(_file(b"x"), schema=None)
    command.validate()
    assert command._schema == "public"
    model.get_default_schema.assert_called_once_with(None)


def test_validate_keeps_explicit_schema(
    app_context: None, mocker: MockerFixture
) -> None:
    model = _stub_passing_checks(mocker)
    command = _command(_file(b"x"), schema="other")
    command.validate()
    assert command._schema == "other"
    model.get_default_schema.assert_not_called()


def test_validate_treats_empty_string_schema_as_unset(
    app_context: None, mocker: MockerFixture
) -> None:
    model = _stub_passing_checks(mocker)
    model.get_default_schema.return_value = "public"
    command = _command(_file(b"x"), schema="")
    command.validate()
    assert command._schema == "public"


def test_validate_default_schema_resolution_failure_falls_back_to_none(
    app_context: None, mocker: MockerFixture
) -> None:
    model = _stub_passing_checks(mocker)
    model.get_default_schema.side_effect = Exception("no inspector")
    command = _command(_file(b"x"), schema=None)
    command.validate()  # must not raise
    assert command._schema is None


def test_validate_resolved_schema_checked_against_allowlist(
    app_context: None, mocker: MockerFixture
) -> None:
    model = _stub_passing_checks(mocker)
    model.get_default_schema.return_value = "public"
    allows = mocker.patch(
        "superset.commands.database.uploaders.base.schema_allows_file_upload",
        return_value=True,
    )
    command = _command(_file(b"x"), schema=None)
    command.validate()
    allows.assert_called_once_with(model, "public", engine_resolved=True)


def test_validate_explicit_schema_checked_exactly(
    app_context: None, mocker: MockerFixture
) -> None:
    model = _stub_passing_checks(mocker)
    allows = mocker.patch(
        "superset.commands.database.uploaders.base.schema_allows_file_upload",
        return_value=True,
    )
    command = _command(_file(b"x"), schema="other")
    command.validate()
    allows.assert_called_once_with(model, "other", engine_resolved=False)


@pytest.mark.parametrize(
    "schema,allowed,expected",
    [
        # user-supplied schemas match the allow-list exactly: on engines with
        # quoted, case-sensitive identifiers (e.g. PostgreSQL), ``PUBLIC`` and
        # ``public`` are distinct physical schemas, and case-folding here
        # would widen the allow-list to case-variant siblings
        ("public", {"public"}, True),
        ("PUBLIC", {"public"}, False),
        ("public", {"PUBLIC"}, False),
        ("other", {"public"}, False),
        (None, {"public"}, False),
    ],
)
def test_schema_allows_file_upload_explicit_schema_exact_match(
    schema: str | None,
    allowed: set[str],
    expected: bool,
    mocker: MockerFixture,
) -> None:
    from superset.views.database.validators import schema_allows_file_upload

    database = mocker.MagicMock()
    database.allow_file_upload = True
    database.get_schema_access_for_file_upload.return_value = allowed
    assert schema_allows_file_upload(database, schema) is expected


@pytest.mark.parametrize(
    "schema,allowed,expected",
    [
        # the engine may report its default schema in a different case than
        # the manually-inputted allow-list; the write uses the engine-reported
        # name itself, so the case-fold cannot change the physical target
        ("PUBLIC", {"public"}, True),
        ("public", {"PUBLIC"}, True),
        ("public", {"public"}, True),
        ("other", {"public"}, False),
        (None, {"public"}, False),
    ],
)
def test_schema_allows_file_upload_engine_resolved_case_insensitive(
    schema: str | None,
    allowed: set[str],
    expected: bool,
    mocker: MockerFixture,
) -> None:
    from superset.views.database.validators import schema_allows_file_upload

    database = mocker.MagicMock()
    database.allow_file_upload = True
    database.get_schema_access_for_file_upload.return_value = allowed
    assert schema_allows_file_upload(database, schema, engine_resolved=True) is expected


def _stub_run_environment(mocker: MockerFixture) -> MagicMock:
    """Stub everything ``run()`` needs up to the dataset lookup."""
    model = mocker.MagicMock()
    model.db_engine_spec.supports_file_upload = True
    model.get_default_catalog.return_value = None
    model.get_default_schema.return_value = None
    model.db_engine_spec.normalize_table_name_for_upload.return_value = ("t", None)
    mocker.patch(
        "superset.commands.database.uploaders.base.DatabaseDAO.find_by_id",
        return_value=model,
    )
    mocker.patch(
        "superset.commands.database.uploaders.base.schema_allows_file_upload",
        return_value=True,
    )
    mocker.patch.dict(
        "superset.commands.database.uploaders.base.current_app.config",
        {"UPLOAD_MAX_FILE_SIZE_BYTES": 1024},
    )
    db_mock = mocker.patch("superset.commands.database.uploaders.base.db")
    # No visible dataset over the target table.
    db_mock.session.query.return_value.filter.return_value.one_or_none.return_value = (
        None
    )
    db_mock.session.query.return_value.filter_by.return_value.one_or_none.return_value = None  # noqa: E501
    mocker.patch(
        "superset.commands.database.uploaders.base.or_",
        side_effect=lambda *args: mocker.MagicMock(),
    )
    return model


def test_run_blocks_upload_over_soft_deleted_twin(
    app_context: None, mocker: MockerFixture
) -> None:
    """An upload targeting a table held by a soft-deleted dataset must be
    refused BEFORE any file data is written.

    The dataset lookup in ``run()`` goes through the soft-delete visibility
    filter, so the hidden twin is invisible and, unguarded, the upload would
    create an active twin (permanently blocking restore) or hit the legacy
    unique constraint — after ``reader.read`` had already loaded the file's
    contents into the analytics database, outside the metadata transaction.
    """
    from superset.commands.database.exceptions import (
        DatabaseUploadSoftDeletedDatasetExistsError,
    )

    _stub_run_environment(mocker)
    soft_twin = MagicMock()
    soft_twin.uuid = "11111111-2222-3333-4444-555555555555"
    mocker.patch(
        # the guard imports DatasetDAO inside run() (deferred to avoid a
        # circular import), so patch it at the source module
        "superset.daos.dataset.DatasetDAO.find_soft_deleted_logical_duplicate",
        return_value=soft_twin,
    )

    reader = MagicMock()
    command = UploadCommand(
        model_id=1, table_name="t", file=_file(b"x"), schema=None, reader=reader
    )
    with pytest.raises(DatabaseUploadSoftDeletedDatasetExistsError) as excinfo:
        command.run()

    assert "11111111-2222-3333-4444-555555555555" in str(excinfo.value)
    # The guard must fire before the file contents are written.
    reader.read.assert_not_called()


def test_run_proceeds_when_no_soft_deleted_twin(
    app_context: None, mocker: MockerFixture
) -> None:
    """Control: with no hidden twin, the upload reads the file and creates
    the dataset as before."""
    _stub_run_environment(mocker)
    mocker.patch(
        # the guard imports DatasetDAO inside run() (deferred to avoid a
        # circular import), so patch it at the source module
        "superset.daos.dataset.DatasetDAO.find_soft_deleted_logical_duplicate",
        return_value=None,
    )
    mocker.patch(
        "superset.commands.database.uploaders.base.SqlaTable",
        return_value=MagicMock(),
    )
    user = MagicMock()
    user.id = 1
    mocker.patch(
        "superset.commands.database.uploaders.base.get_user",
        return_value=user,
    )
    mocker.patch("superset.subjects.utils.get_user_subject", return_value=None)

    reader = MagicMock()
    command = UploadCommand(
        model_id=1, table_name="t", file=_file(b"x"), schema=None, reader=reader
    )
    command.run()
    reader.read.assert_called_once()


def test_run_sets_default_catalog_on_dataset_creation(
    app_context: None, mocker: MockerFixture
) -> None:
    """UploadCommand sets default catalog on newly created dataset."""
    model = _stub_run_environment(mocker)
    model.get_default_catalog.return_value = "default_catalog"
    mocker.patch(
        "superset.daos.dataset.DatasetDAO.find_soft_deleted_logical_duplicate",
        return_value=None,
    )
    sqla_table_mock = mocker.patch(
        "superset.commands.database.uploaders.base.SqlaTable",
        return_value=MagicMock(),
    )
    mocker.patch(
        "superset.commands.database.uploaders.base.get_user",
        return_value=None,
    )

    reader = MagicMock()
    command = UploadCommand(
        model_id=1, table_name="t", file=_file(b"x"), schema="public", reader=reader
    )
    command.run()

    sqla_table_mock.assert_called_once()
    assert sqla_table_mock.call_args.kwargs.get("catalog") == "default_catalog"


def test_run_updates_catalog_on_existing_dataset_with_none_catalog(
    app_context: None, mocker: MockerFixture
) -> None:
    """UploadCommand updates catalog on an existing dataset if catalog was None."""
    model = _stub_run_environment(mocker)
    model.get_default_catalog.return_value = "default_catalog"

    existing_table = MagicMock()
    existing_table.catalog = None

    db_mock = mocker.patch("superset.commands.database.uploaders.base.db")
    db_mock.session.query.return_value.filter.return_value.one_or_none.return_value = (
        existing_table
    )

    reader = MagicMock()
    command = UploadCommand(
        model_id=1, table_name="t", file=_file(b"x"), schema="public", reader=reader
    )
    command.run()

    assert existing_table.catalog == "default_catalog"
    existing_table.fetch_metadata.assert_called_once()


def _mapped_upload_dataset(table_name: str) -> SqlaTable:
    """
    A persisted dataset over ``table_name`` mapping ``event_time`` onto
    ``dt_epoch``, as a re-upload into the same table would find.

    Written under `override_user` because `AuditMixinNullable` reads `g.user`
    on insert and these tests have no request context.
    """
    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member
    database = Database(database_name="pfm_upload_db", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset = SqlaTable(
        table_name=table_name,
        database=database,
        database_id=database.id,
        # The default schema the command resolves for SQLite, so the re-upload
        # lookup finds this dataset rather than creating a second one.
        schema="main",
        catalog=None,
        main_dttm_col="event_time",
        columns=[
            TableColumn(column_name="event_time", is_dttm=True, type="TIMESTAMP"),
            TableColumn(column_name="dt_epoch", type="BIGINT"),
        ],
    )
    dataset.partition_column = "dt_epoch"
    dataset.partition_mapped_column = "event_time"
    dataset.columns[0].partition_value_transform = "unix_timestamp(:value)"
    dataset.columns[0].partition_transform_is_monotonic = True
    with override_user(_upload_admin()):
        db.session.add(dataset)
        db.session.flush()
    return dataset


def _upload_admin() -> User:
    return User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )


def _run_upload_into(
    dataset: SqlaTable, mocker: MockerFixture, fetch_metadata: Any
) -> None:
    """Drive `UploadCommand.run` against an existing dataset, with the
    warehouse write and the metadata read both stubbed."""
    mocker.patch(
        "superset.commands.database.uploaders.base.DatabaseDAO.find_by_id",
        return_value=dataset.database,
    )
    mocker.patch(
        "superset.commands.database.uploaders.base.schema_allows_file_upload",
        return_value=True,
    )
    mocker.patch.object(SqlaTable, "fetch_metadata", fetch_metadata)
    command = UploadCommand(
        model_id=dataset.database_id,
        table_name=dataset.table_name,
        file=_file(b"col\n1\n"),
        schema=None,
        reader=MagicMock(),
    )
    with override_user(_upload_admin()):
        command.run()


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_a_reupload_clears_a_mapping_whose_partition_column_went_away(
    mocker: MockerFixture, session: Session
) -> None:
    """
    A re-upload replaces an existing dataset's columns through
    `fetch_metadata`, which writes them itself rather than going through
    `DatasetDAO.update` -- so neither of the mapping's repairs ran, and a file
    that no longer carries the partition column left `partition_column` naming
    a column that is gone. Every later edit of that dataset then failed the
    mapping validation.
    """
    dataset = _mapped_upload_dataset("pfm_upload")

    _run_upload_into(
        dataset,
        mocker,
        lambda self, commit=True: setattr(
            self,
            "columns",
            [c for c in self.columns if c.column_name != "dt_epoch"],
        ),
    )

    assert dataset.partition_column is None
    assert dataset.partition_mapped_column is None


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_a_reupload_disarms_a_transform_the_new_default_datetime_column_holds(
    mocker: MockerFixture, session: Session
) -> None:
    """
    The other half of the pair, for the same reason `RefreshDatasetCommand`
    runs the cleanup on both sides of the metadata write: `fetch_metadata` can
    *move* the effective mapped column by setting `main_dttm_col`, which brings
    a transform parked on the newly-default column live under a mapping nobody
    authored. Run only afterwards, the cleanup resolves the new mapping, finds
    that column effective, skips it, and erases the owner's real transform
    instead.
    """
    dataset = _mapped_upload_dataset("pfm_upload_move")
    dataset.partition_mapped_column = None
    parked = TableColumn(column_name="other_time", is_dttm=True, type="TIMESTAMP")
    parked.partition_value_transform = "to_unixtime(:value)"
    parked.partition_transform_is_monotonic = True
    dataset.columns.append(parked)
    with override_user(_upload_admin()):
        db.session.flush()

    _run_upload_into(
        dataset,
        mocker,
        lambda self, commit=True: setattr(self, "main_dttm_col", "other_time"),
    )

    transforms = {c.column_name: c.partition_value_transform for c in dataset.columns}
    assert transforms["event_time"] is None
    assert transforms["other_time"] is None
