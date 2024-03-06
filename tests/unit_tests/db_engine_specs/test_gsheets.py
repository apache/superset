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

# pylint: disable=import-outside-toplevel, invalid-name, line-too-long

import json

import pandas as pd
import pytest
from pytest_mock import MockFixture

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetException
from superset.sql_parse import Table


class ProgrammingError(Exception):
    """
    Dummy ProgrammingError so we don't need to import the optional gsheets.
    """


def test_validate_parameters_simple() -> None:
    from superset.db_engine_specs.gsheets import (
        GSheetsEngineSpec,
        GSheetsPropertiesType,
    )

    properties: GSheetsPropertiesType = {
        "parameters": {
            "service_account_info": "",
            "catalog": {},
        },
        "catalog": {},
    }
    errors = GSheetsEngineSpec.validate_parameters(properties)
    assert errors == [
        SupersetError(
            message="Sheet name is required",
            error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
            level=ErrorLevel.WARNING,
            extra={"catalog": {"idx": 0, "name": True}},
        ),
    ]


def test_validate_parameters_simple_with_in_root_catalog() -> None:
    from superset.db_engine_specs.gsheets import (
        GSheetsEngineSpec,
        GSheetsPropertiesType,
    )

    properties: GSheetsPropertiesType = {
        "parameters": {
            "service_account_info": "",
            "catalog": {},
        },
        "catalog": {},
    }
    errors = GSheetsEngineSpec.validate_parameters(properties)
    assert errors == [
        SupersetError(
            message="Sheet name is required",
            error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
            level=ErrorLevel.WARNING,
            extra={"catalog": {"idx": 0, "name": True}},
        ),
    ]


def test_validate_parameters_catalog(
    mocker: MockFixture,
) -> None:
    from superset.db_engine_specs.gsheets import (
        GSheetsEngineSpec,
        GSheetsPropertiesType,
    )

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user.email = "admin@example.com"

    create_engine = mocker.patch("superset.db_engine_specs.gsheets.create_engine")
    conn = create_engine.return_value.connect.return_value
    results = conn.execute.return_value
    results.fetchall.side_effect = [
        ProgrammingError("The caller does not have permission"),
        [(1,)],
        ProgrammingError("Unsupported table: https://www.google.com/"),
    ]

    properties: GSheetsPropertiesType = {
        "parameters": {"service_account_info": "", "catalog": None},
        "catalog": {
            "private_sheet": "https://docs.google.com/spreadsheets/d/1/edit",
            "public_sheet": "https://docs.google.com/spreadsheets/d/1/edit#gid=1",
            "not_a_sheet": "https://www.google.com/",
        },
    }
    errors = GSheetsEngineSpec.validate_parameters(properties)  # ignore: type

    assert errors == [
        SupersetError(
            message=(
                "The URL could not be identified. Please check for typos "
                "and make sure that ‘Type of Google Sheets allowed’ "
                "selection matches the input."
            ),
            error_type=SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            level=ErrorLevel.WARNING,
            extra={
                "catalog": {
                    "idx": 0,
                    "url": True,
                },
                "issue_codes": [
                    {
                        "code": 1003,
                        "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",
                    },
                    {
                        "code": 1005,
                        "message": "Issue 1005 - The table was deleted or renamed in the database.",
                    },
                ],
            },
        ),
        SupersetError(
            message=(
                "The URL could not be identified. Please check for typos "
                "and make sure that ‘Type of Google Sheets allowed’ "
                "selection matches the input."
            ),
            error_type=SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            level=ErrorLevel.WARNING,
            extra={
                "catalog": {
                    "idx": 2,
                    "url": True,
                },
                "issue_codes": [
                    {
                        "code": 1003,
                        "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",
                    },
                    {
                        "code": 1005,
                        "message": "Issue 1005 - The table was deleted or renamed in the database.",
                    },
                ],
            },
        ),
    ]

    create_engine.assert_called_with(
        "gsheets://",
        service_account_info={},
        subject="admin@example.com",
    )


def test_validate_parameters_catalog_and_credentials(
    mocker: MockFixture,
) -> None:
    from superset.db_engine_specs.gsheets import (
        GSheetsEngineSpec,
        GSheetsPropertiesType,
    )

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user.email = "admin@example.com"

    create_engine = mocker.patch("superset.db_engine_specs.gsheets.create_engine")
    conn = create_engine.return_value.connect.return_value
    results = conn.execute.return_value
    results.fetchall.side_effect = [
        [(2,)],
        [(1,)],
        ProgrammingError("Unsupported table: https://www.google.com/"),
    ]

    properties: GSheetsPropertiesType = {
        "parameters": {
            "service_account_info": "",
            "catalog": None,
        },
        "catalog": {
            "private_sheet": "https://docs.google.com/spreadsheets/d/1/edit",
            "public_sheet": "https://docs.google.com/spreadsheets/d/1/edit#gid=1",
            "not_a_sheet": "https://www.google.com/",
        },
    }
    errors = GSheetsEngineSpec.validate_parameters(properties)  # ignore: type
    assert errors == [
        SupersetError(
            message=(
                "The URL could not be identified. Please check for typos "
                "and make sure that ‘Type of Google Sheets allowed’ "
                "selection matches the input."
            ),
            error_type=SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            level=ErrorLevel.WARNING,
            extra={
                "catalog": {
                    "idx": 2,
                    "url": True,
                },
                "issue_codes": [
                    {
                        "code": 1003,
                        "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",
                    },
                    {
                        "code": 1005,
                        "message": "Issue 1005 - The table was deleted or renamed in the database.",
                    },
                ],
            },
        )
    ]

    create_engine.assert_called_with(
        "gsheets://",
        service_account_info={},
        subject="admin@example.com",
    )


def test_unmask_encrypted_extra() -> None:
    """
    Test that the private key can be reused from the previous ``encrypted_extra``.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    old = json.dumps(
        {
            "service_account_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "SECRET",
            },
        }
    )
    new = json.dumps(
        {
            "service_account_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "XXXXXXXXXX",
            },
        }
    )

    assert json.loads(str(GSheetsEngineSpec.unmask_encrypted_extra(old, new))) == {
        "service_account_info": {
            "project_id": "yellow-unicorn-314419",
            "private_key": "SECRET",
        },
    }


def test_unmask_encrypted_extra_when_old_is_none() -> None:
    """
    Test that a None value works for ``encrypted_extra``.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    old = None
    new = json.dumps(
        {
            "service_account_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "XXXXXXXXXX",
            },
        }
    )

    assert json.loads(str(GSheetsEngineSpec.unmask_encrypted_extra(old, new))) == {
        "service_account_info": {
            "project_id": "yellow-unicorn-314419",
            "private_key": "XXXXXXXXXX",
        },
    }


def test_unmask_encrypted_extra_when_new_is_none() -> None:
    """
    Test that a None value works for ``encrypted_extra``.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    old = json.dumps(
        {
            "service_account_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "XXXXXXXXXX",
            },
        }
    )
    new = None

    assert GSheetsEngineSpec.unmask_encrypted_extra(old, new) is None


def test_upload_new(mocker: MockFixture) -> None:
    """
    Test file upload when the table does not exist.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mocker.patch("superset.db_engine_specs.gsheets.db")
    get_adapter_for_table_name = mocker.patch(
        "shillelagh.backends.apsw.dialects.base.get_adapter_for_table_name"
    )
    session = get_adapter_for_table_name()._get_session()
    session.post().json.return_value = {
        "spreadsheetId": 1,
        "spreadsheetUrl": "https://docs.example.org",
        "sheets": [{"properties": {"title": "sample_data"}}],
    }

    database = mocker.MagicMock()
    database.get_extra.return_value = {}

    df = pd.DataFrame({"col": [1, "foo", 3.0]})
    table = Table("sample_data")

    GSheetsEngineSpec.df_to_sql(database, table, df, {})
    assert database.extra == json.dumps(
        {"engine_params": {"catalog": {"sample_data": "https://docs.example.org"}}}
    )


def test_upload_existing(mocker: MockFixture) -> None:
    """
    Test file upload when the table does exist.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mocker.patch("superset.db_engine_specs.gsheets.db")
    get_adapter_for_table_name = mocker.patch(
        "shillelagh.backends.apsw.dialects.base.get_adapter_for_table_name"
    )
    adapter = get_adapter_for_table_name()
    adapter._spreadsheet_id = 1
    adapter._sheet_name = "sheet0"
    session = adapter._get_session()
    session.post().json.return_value = {
        "spreadsheetId": 1,
        "spreadsheetUrl": "https://docs.example.org",
        "sheets": [{"properties": {"title": "sample_data"}}],
    }

    database = mocker.MagicMock()
    database.get_extra.return_value = {
        "engine_params": {"catalog": {"sample_data": "https://docs.example.org"}}
    }

    df = pd.DataFrame({"col": [1, "foo", 3.0]})
    table = Table("sample_data")

    with pytest.raises(SupersetException) as excinfo:
        GSheetsEngineSpec.df_to_sql(database, table, df, {"if_exists": "append"})
    assert str(excinfo.value) == "Append operation not currently supported"

    with pytest.raises(SupersetException) as excinfo:
        GSheetsEngineSpec.df_to_sql(database, table, df, {"if_exists": "fail"})
    assert str(excinfo.value) == "Table already exists"

    GSheetsEngineSpec.df_to_sql(database, table, df, {"if_exists": "replace"})
    session.post.assert_has_calls(
        [
            mocker.call(),
            mocker.call(
                "https://sheets.googleapis.com/v4/spreadsheets/1/values/sheet0:clear",
                json={},
            ),
            mocker.call().json(),
            mocker.call(
                "https://sheets.googleapis.com/v4/spreadsheets/1/values/sheet0:append",
                json={
                    "range": "sheet0",
                    "majorDimension": "ROWS",
                    "values": [["col"], [1], ["foo"], [3.0]],
                },
                params={"valueInputOption": "USER_ENTERED"},
            ),
            mocker.call().json(),
        ]
    )
