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
The freshness check on the dataset write paths that bypass
``UpdateDatasetCommand``: import, the legacy ``/datasource/save/`` endpoint, and
duplication.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset.commands.dataset.duplicate import DuplicateDatasetCommand
from superset.commands.dataset.exceptions import (
    DatasetAccessDeniedError,
    DatasetForbiddenError,
)
from superset.commands.dataset.importers.v1.utils import _raise_for_import_freshness
from superset.commands.importers.exceptions import IncorrectFormatError
from superset.connectors.sqla.models import SqlaTable
from superset.datasets.freshness import FreshnessValidationError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.sql.parse import Table
from superset.utils import json
from superset.views.datasource.views import _authorize_freshness

FRESHNESS = {"freshness": {"sql": "SELECT MAX(finished_at) FROM ops.load_log"}}
DENIED = SupersetSecurityException(
    SupersetError(
        error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
        message="denied",
        level=ErrorLevel.ERROR,
    )
)


def _existing(**overrides: Any) -> MagicMock:
    attrs: dict[str, Any] = {
        "database_id": 1,
        "catalog": None,
        "schema": "sales",
        "template_params": None,
        "extra": json.dumps(FRESHNESS),
        "columns": [
            MagicMock(
                id=10, column_name="loaded_at", is_dttm=True, python_date_format=None
            )
        ],
    }
    attrs.update(overrides)
    return MagicMock(spec=SqlaTable, **attrs)


# --- import -------------------------------------------------------------------


@pytest.fixture
def import_validate(mocker: MockerFixture) -> MagicMock:
    query = mocker.patch("superset.commands.dataset.importers.v1.utils.db.session")
    query.query.return_value.filter_by.return_value.first.return_value = MagicMock()
    return mocker.patch(
        "superset.commands.dataset.importers.v1.utils.validate_freshness_extra"
    )


def test_import_new_dataset_always_authorizes(import_validate: MagicMock) -> None:
    config = {"database_id": 1, "schema": "sales", "extra": FRESHNESS, "columns": []}
    _raise_for_import_freshness(config, None)
    kwargs = import_validate.call_args.kwargs
    assert kwargs["binding_changed"] is True
    assert kwargs["stored_extra"] is None


def test_import_echo_over_unchanged_binding(import_validate: MagicMock) -> None:
    config = {"database_id": 1, "schema": "sales", "extra": FRESHNESS}
    _raise_for_import_freshness(config, _existing())
    kwargs = import_validate.call_args.kwargs
    assert kwargs["binding_changed"] is False
    assert kwargs["columns"] == {"loaded_at": True}


def test_import_reads_column_types_from_the_bundle(import_validate: MagicMock) -> None:
    config = {
        "database_id": 1,
        "extra": FRESHNESS,
        "columns": [{"column_name": "loaded_at", "is_dttm": False}],
    }
    _raise_for_import_freshness(config, _existing())
    assert import_validate.call_args.kwargs["columns"] == {"loaded_at": False}


def test_import_schema_move_is_a_binding_change(import_validate: MagicMock) -> None:
    config = {"database_id": 1, "schema": "finance", "extra": FRESHNESS}
    _raise_for_import_freshness(config, _existing())
    assert import_validate.call_args.kwargs["binding_changed"] is True


def test_import_maps_errors(import_validate: MagicMock) -> None:
    config = {"database_id": 1, "extra": FRESHNESS}
    import_validate.side_effect = FreshnessValidationError("bad")
    with pytest.raises(IncorrectFormatError):
        _raise_for_import_freshness(config, None)
    import_validate.side_effect = DENIED
    with pytest.raises(DatasetAccessDeniedError):
        _raise_for_import_freshness(config, None)


def test_import_without_extra_is_skipped(import_validate: MagicMock) -> None:
    _raise_for_import_freshness({"database_id": 1}, None)
    import_validate.assert_not_called()


# --- legacy /datasource/save/ ---------------------------------------------------


@pytest.fixture
def save_validate(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("superset.views.datasource.views.validate_freshness_extra")


def _authorize(datasource: Any, **overrides: Any) -> Any:
    kwargs: dict[str, Any] = {
        "datasource_dict": {
            "extra": json.dumps(FRESHNESS),
            "columns": [{"id": 10, "column_name": "loaded_at"}],
        },
        "database_id": 1,
        "database_changed": False,
        "requested_table": Table("invoices", "sales"),
        "raw_template_params": None,
    }
    kwargs.update(overrides)
    return _authorize_freshness(datasource, **kwargs)


def test_save_echo_is_not_a_binding_change(save_validate: MagicMock) -> None:
    assert _authorize(_existing()) is None
    kwargs = save_validate.call_args.kwargs
    assert kwargs["binding_changed"] is False
    # The column dict leaves out ``is_dttm``: the stored value applies.
    assert kwargs["columns"] == {"loaded_at": True}


def test_save_schema_move_is_a_binding_change(save_validate: MagicMock) -> None:
    _authorize(_existing(), requested_table=Table("invoices", "finance"))
    assert save_validate.call_args.kwargs["binding_changed"] is True


def test_save_invalid_setting_is_a_422(save_validate: MagicMock) -> None:
    save_validate.side_effect = FreshnessValidationError("bad")
    response = _authorize(_existing())
    assert response.status_code == 422


def test_save_access_denied_is_forbidden(save_validate: MagicMock) -> None:
    save_validate.side_effect = DENIED
    with pytest.raises(DatasetForbiddenError):
        _authorize(_existing())


def test_save_rejects_non_string_extra(save_validate: MagicMock) -> None:
    response = _authorize(_existing(), datasource_dict={"extra": {"freshness": {}}})
    assert response.status_code == 422
    save_validate.assert_not_called()


# --- duplicate ----------------------------------------------------------------


def test_duplicate_authorizes_inherited_freshness_sql(mocker: MockerFixture) -> None:
    validate = mocker.patch(
        "superset.commands.dataset.duplicate.validate_freshness_extra"
    )
    base = _existing()
    exceptions: list[ValidationError] = []

    DuplicateDatasetCommand._validate_copy_freshness(base, exceptions)

    kwargs = validate.call_args.kwargs
    assert kwargs["binding_changed"] is True
    assert kwargs["stored_extra"] is None
    assert kwargs["columns"] == {"loaded_at": True}
    assert exceptions == []


def test_duplicate_denied_when_copier_lacks_access(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.commands.dataset.duplicate.validate_freshness_extra",
        side_effect=DENIED,
    )
    with pytest.raises(DatasetAccessDeniedError):
        DuplicateDatasetCommand._validate_copy_freshness(_existing(), [])
