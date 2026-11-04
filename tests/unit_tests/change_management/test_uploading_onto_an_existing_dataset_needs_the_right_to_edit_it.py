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
"""``can_upload`` on a database is not the right to rewrite a dataset.

An upload whose table already backs a dataset replaces that table (with
``already_exists=replace``, irreversibly) and re-syncs the dataset's columns,
which breaks every chart on a column the file no longer has. Editing the same
dataset through the API takes editorship, so the upload takes the same, and
takes it before any byte reaches the analytics database. Creating a new dataset
by upload stays open to anyone who may upload.
"""

import io
from types import SimpleNamespace
from typing import Any

import pytest
from pytest_mock import MockerFixture
from werkzeug.datastructures import FileStorage

from superset.commands.dataset.exceptions import DatasetForbiddenError
from superset.commands.database.uploaders.base import UploadCommand


def _upload(
    mocker: MockerFixture,
    existing: Any,
    *,
    editor: bool,
    reader: Any = None,
) -> tuple[Any, Any]:
    """Run an upload as someone who may upload; return (reader, new rows)."""
    database = mocker.MagicMock()
    database.db_engine_spec.supports_file_upload = True
    database.db_engine_spec.normalize_table_name_for_upload.side_effect = (
        lambda table, schema: (table, schema)
    )
    database.get_default_catalog.return_value = None
    database.get_default_schema.return_value = None
    base = "superset.commands.database.uploaders.base"
    mocker.patch(f"{base}.DatabaseDAO.find_by_id", return_value=database)
    mocker.patch(f"{base}.schema_allows_file_upload", return_value=True)
    session = mocker.patch(f"{base}.db.session")
    session.query.return_value.filter.return_value.one_or_none.return_value = existing
    mocker.patch(
        "superset.daos.dataset.DatasetDAO.find_soft_deleted_logical_duplicate",
        return_value=None,
    )
    mocker.patch("superset.subjects.utils.get_user_subject", return_value=None)
    mocker.patch(f"{base}.get_user", return_value=None)
    # The real ``raise_for_editorship``, fed the one fact that differs.
    from superset import security_manager as real

    mocker.patch.object(real, "is_admin", return_value=False)
    mocker.patch.object(real, "is_editor", return_value=editor)
    mocker.patch.object(real, "is_guest_user", return_value=False)
    reader = reader or mocker.MagicMock()
    UploadCommand(
        1, "t", FileStorage(stream=io.BytesIO(b"a\n1\n"), filename="t.csv"), None, reader
    ).run()
    return reader, session


def _dataset(**fields: Any) -> SimpleNamespace:
    return SimpleNamespace(
        catalog=None, is_managed_externally=False, fetch_metadata=lambda: None, **fields
    )


def test_a_non_editor_cannot_replace_an_existing_datasets_table(
    app_context: None, mocker: MockerFixture
) -> None:
    reader = mocker.MagicMock()
    with pytest.raises(DatasetForbiddenError):
        _upload(mocker, _dataset(), editor=False, reader=reader)
    # The refusal comes before the write, so nothing was replaced.
    reader.read.assert_not_called()


def test_an_editor_can_still_replace_their_datasets_table(
    app_context: None, mocker: MockerFixture
) -> None:
    reader, _ = _upload(mocker, _dataset(), editor=True)
    reader.read.assert_called_once()


def test_an_externally_managed_dataset_is_not_overwritten_by_an_upload(
    app_context: None, mocker: MockerFixture
) -> None:
    managed = _dataset()
    managed.is_managed_externally = True
    with pytest.raises(DatasetForbiddenError):
        _upload(mocker, managed, editor=True)


def test_creating_a_new_dataset_by_upload_needs_no_editorship(
    app_context: None, mocker: MockerFixture
) -> None:
    created = mocker.patch(
        "superset.commands.database.uploaders.base.SqlaTable",
        return_value=_dataset(),
    )
    reader, session = _upload(mocker, None, editor=False)
    reader.read.assert_called_once()
    created.assert_called_once()
    session.add.assert_called_once()
