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
"""``UpdateDatasetCommand`` validation of the ``extra["freshness"]`` setting."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.dataset.exceptions import DatasetInvalidError
from superset.commands.dataset.update import UpdateDatasetCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.core import Database
from superset.utils import json

FRESHNESS_SQL = "SELECT MAX(finished_at) FROM ops.load_log"


@pytest.fixture
def dataset(mocker: MockerFixture) -> MagicMock:
    database = Database(id=1, database_name="warehouse", sqlalchemy_uri="sqlite://")
    column = MagicMock(
        id=10, column_name="loaded_at", is_dttm=True, python_date_format=None
    )
    region = MagicMock(
        id=11, column_name="region", is_dttm=False, python_date_format=None
    )
    dataset = MagicMock(
        is_managed_externally=False,
        database=database,
        catalog=None,
        schema="sales",
        table_name="invoices",
        sql=None,
        template_params=None,
        editors=[],
        partition_column=None,
        columns=[column, region],
        extra=json.dumps({"warning_markdown": "check me"}),
    )
    dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    dao.find_by_id.return_value = dataset
    dao.validate_update_uniqueness.return_value = True
    dao.update.return_value = dataset
    mocker.patch("superset.commands.dataset.update.security_manager")
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)
    return dataset


@pytest.fixture
def raise_for_access(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("superset.datasets.freshness.security_manager.raise_for_access")


def _freshness_extra(**freshness: Any) -> str:
    return json.dumps({"warning_markdown": "check me", "freshness": freshness})


def test_new_freshness_sql_is_authorized_without_editorship(
    dataset: MagicMock, raise_for_access: MagicMock
) -> None:
    UpdateDatasetCommand(1, {"extra": _freshness_extra(sql=FRESHNESS_SQL)}).run()

    raise_for_access.assert_called_once_with(
        database=dataset.database,
        sql=FRESHNESS_SQL,
        catalog=None,
        schema="sales",
        template_params={},
        allow_editorship=False,
    )


def test_freshness_sql_access_denied_is_a_validation_error(
    dataset: MagicMock, raise_for_access: MagicMock
) -> None:
    raise_for_access.side_effect = SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
            message="You need access to ops.load_log",
            level=ErrorLevel.ERROR,
        )
    )

    with pytest.raises(DatasetInvalidError) as excinfo:
        UpdateDatasetCommand(1, {"extra": _freshness_extra(sql=FRESHNESS_SQL)}).run()

    assert excinfo.value.normalized_messages() == {
        "extra": {"freshness": {"sql": ["You need access to ops.load_log"]}}
    }


def test_unchanged_freshness_sql_is_not_reauthorized(
    dataset: MagicMock, raise_for_access: MagicMock
) -> None:
    dataset.extra = _freshness_extra(sql=FRESHNESS_SQL)

    UpdateDatasetCommand(
        1, {"extra": _freshness_extra(sql=FRESHNESS_SQL), "description": "new"}
    ).run()

    raise_for_access.assert_not_called()


def test_schema_move_reauthorizes_unchanged_freshness_sql(
    dataset: MagicMock, raise_for_access: MagicMock
) -> None:
    dataset.extra = _freshness_extra(sql=FRESHNESS_SQL)

    UpdateDatasetCommand(
        1, {"extra": _freshness_extra(sql=FRESHNESS_SQL), "schema": "finance"}
    ).run()

    raise_for_access.assert_called_once()
    assert raise_for_access.call_args.kwargs["schema"] == "finance"


def test_mutating_freshness_sql_is_rejected(
    dataset: MagicMock, raise_for_access: MagicMock
) -> None:
    with pytest.raises(DatasetInvalidError) as excinfo:
        UpdateDatasetCommand(
            1, {"extra": _freshness_extra(sql="DROP TABLE ops.load_log")}
        ).run()

    assert excinfo.value.normalized_messages() == {
        "extra": {
            "freshness": {"sql": ["The freshness query must be a read-only SELECT."]}
        }
    }
    raise_for_access.assert_not_called()


def test_freshness_column_must_exist(
    dataset: MagicMock, raise_for_access: MagicMock
) -> None:
    with pytest.raises(DatasetInvalidError) as excinfo:
        UpdateDatasetCommand(1, {"extra": _freshness_extra(column="missing")}).run()

    assert excinfo.value.normalized_messages() == {
        "extra": {"freshness": {"column": ["Column missing does not exist."]}}
    }


def test_freshness_column_must_be_a_time_column(
    dataset: MagicMock, raise_for_access: MagicMock
) -> None:
    with pytest.raises(DatasetInvalidError) as excinfo:
        UpdateDatasetCommand(1, {"extra": _freshness_extra(column="region")}).run()

    assert excinfo.value.normalized_messages() == {
        "extra": {
            "freshness": {
                "column": [
                    "Column region is not a time column. Mark it as temporal or "
                    "set its datetime format."
                ]
            }
        }
    }


def test_freshness_column_may_be_marked_temporal_in_the_same_update(
    dataset: MagicMock, mocker: MockerFixture
) -> None:
    validate = mocker.patch("superset.commands.dataset.update.validate_freshness_extra")
    mocker.patch.object(UpdateDatasetCommand, "_validate_semantics")

    UpdateDatasetCommand(
        1,
        {
            "extra": _freshness_extra(column="region"),
            # ``loaded_at`` leaves ``is_dttm`` out, so it keeps the stored value.
            "columns": [
                {"id": 10, "column_name": "loaded_at"},
                {"id": 11, "column_name": "region", "is_dttm": True},
            ],
        },
    ).run()

    assert validate.call_args.kwargs["columns"] == {
        "loaded_at": True,
        "region": True,
    }


def test_freshness_column_may_be_one_added_in_the_same_update(
    dataset: MagicMock, mocker: MockerFixture
) -> None:
    validate = mocker.patch("superset.commands.dataset.update.validate_freshness_extra")
    mocker.patch.object(UpdateDatasetCommand, "_validate_semantics")
    extra = _freshness_extra(column="new_col")

    UpdateDatasetCommand(
        1,
        {"extra": extra, "columns": [{"column_name": "new_col", "is_dttm": True}]},
    ).run()

    assert validate.call_args.kwargs["columns"] == {"new_col": True}


def test_update_without_extra_skips_freshness(
    dataset: MagicMock, mocker: MockerFixture
) -> None:
    validate = mocker.patch("superset.commands.dataset.update.validate_freshness_extra")

    UpdateDatasetCommand(1, {"description": "new"}).run()

    validate.assert_not_called()
