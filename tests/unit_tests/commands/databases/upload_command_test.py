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
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from werkzeug.datastructures import FileStorage

from superset.commands.database.exceptions import DatabaseUploadFileTooLarge
from superset.commands.database.uploaders.base import UploadCommand


def _file(contents: bytes) -> FileStorage:
    return FileStorage(stream=io.BytesIO(contents), filename="data.bin")


def test_file_size_bytes_does_not_consume_stream() -> None:
    file = _file(b"abcdefghij")  # 10 bytes
    assert UploadCommand._file_size_bytes(file) == 10
    # the stream is left at its original position so processing still works
    assert file.stream.read() == b"abcdefghij"


def _command(file: FileStorage) -> UploadCommand:
    # the reader is not exercised by validate(); a stub is sufficient
    return UploadCommand(
        model_id=1,
        table_name="t",
        file=file,
        schema=None,
        reader=MagicMock(),
    )


def _stub_passing_checks(mocker: MockerFixture) -> None:
    model = mocker.MagicMock()
    model.db_engine_spec.supports_file_upload = True
    mocker.patch(
        "superset.commands.database.uploaders.base.DatabaseDAO.find_by_id",
        return_value=model,
    )
    mocker.patch(
        "superset.commands.database.uploaders.base.schema_allows_file_upload",
        return_value=True,
    )


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


def _stub_run_environment(mocker: MockerFixture) -> MagicMock:
    """Stub everything ``run()`` needs up to the dataset lookup."""
    model = mocker.MagicMock()
    model.db_engine_spec.supports_file_upload = True
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
    db_mock.session.query.return_value.filter_by.return_value.one_or_none.return_value = None  # noqa: E501
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
