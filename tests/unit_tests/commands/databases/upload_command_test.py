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
