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

from typing import TYPE_CHECKING
from urllib.parse import parse_qs, urlparse

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine.url import make_url

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetException
from superset.sql_parse import Table
from superset.superset_typing import OAuth2ClientConfig
from superset.utils import json
from superset.utils.oauth2 import decode_oauth2_state

if TYPE_CHECKING:
    from superset.db_engine_specs.base import OAuth2State


class ProgrammingError(Exception):
    """
    Dummy ProgrammingError so we don't need to import the optional gsheets.
    """


def test_validate_parameters_simple(mocker: MockerFixture) -> None:
    from superset.db_engine_specs.gsheets import (
        GSheetsEngineSpec,
        GSheetsPropertiesType,
    )

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user.email = "admin@example.org"

    properties: GSheetsPropertiesType = {
        "parameters": {
            "service_account_info": "",
            "catalog": {"test": "https://docs.google.com/spreadsheets/d/1/edit"},
        },
        "catalog": {},
    }
    assert GSheetsEngineSpec.validate_parameters(properties)


def test_validate_parameters_no_catalog(mocker: MockerFixture) -> None:
    from superset.db_engine_specs.gsheets import (
        GSheetsEngineSpec,
        GSheetsPropertiesType,
    )

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user.email = "admin@example.org"

    properties: GSheetsPropertiesType = {
        "parameters": {
            "service_account_info": "",
            "catalog": {"": "https://docs.google.com/spreadsheets/d/1/edit"},
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


def test_validate_parameters_simple_with_in_root_catalog(mocker: MockerFixture) -> None:
    from superset.db_engine_specs.gsheets import (
        GSheetsEngineSpec,
        GSheetsPropertiesType,
    )

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user.email = "admin@example.org"

    properties: GSheetsPropertiesType = {
        "parameters": {
            "service_account_info": "",
            "catalog": {},
        },
        "catalog": {"": "https://docs.google.com/spreadsheets/d/1/edit"},
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
    mocker: MockerFixture,
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
                        "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",  # noqa: E501
                    },
                    {
                        "code": 1005,
                        "message": "Issue 1005 - The table was deleted or renamed in the database.",  # noqa: E501
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
                        "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",  # noqa: E501
                    },
                    {
                        "code": 1005,
                        "message": "Issue 1005 - The table was deleted or renamed in the database.",  # noqa: E501
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
    mocker: MockerFixture,
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
                        "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",  # noqa: E501
                    },
                    {
                        "code": 1005,
                        "message": "Issue 1005 - The table was deleted or renamed in the database.",  # noqa: E501
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


def test_mask_encrypted_extra() -> None:
    """
    Test that the private key is masked when the database is edited.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    config = json.dumps(
        {
            "service_account_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "SECRET",
            },
        }
    )

    assert GSheetsEngineSpec.mask_encrypted_extra(config) == json.dumps(
        {
            "service_account_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "XXXXXXXXXX",
            },
        }
    )


def test_unmask_encrypted_extra() -> None:
    """
    Test that the private key can be reused from the previous `encrypted_extra`.
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

    assert GSheetsEngineSpec.unmask_encrypted_extra(old, new) == json.dumps(
        {
            "service_account_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "SECRET",
            },
        }
    )


def test_unmask_encrypted_extra_field_changeed() -> None:
    """
    Test that the private key is not reused when the field has changed.
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
                "private_key": "NEW-SECRET",
            },
        }
    )

    assert GSheetsEngineSpec.unmask_encrypted_extra(old, new) == json.dumps(
        {
            "service_account_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "NEW-SECRET",
            },
        }
    )


def test_unmask_encrypted_extra_when_old_is_none() -> None:
    """
    Test that a `None` value for the old field works for `encrypted_extra`.
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

    assert GSheetsEngineSpec.unmask_encrypted_extra(old, new) == json.dumps(
        {
            "service_account_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "XXXXXXXXXX",
            },
        }
    )


def test_unmask_encrypted_extra_when_new_is_none() -> None:
    """
    Test that a `None` value for the new field works for `encrypted_extra`.
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


def test_upload_new(mocker: MockerFixture) -> None:
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


def test_upload_existing(mocker: MockerFixture) -> None:
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


def test_get_url_for_impersonation_username(mocker: MockerFixture) -> None:
    """
    Test passing a username to `get_url_for_impersonation`.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch(
        "superset.db_engine_specs.gsheets.security_manager.find_user",
        return_value=user,
    )

    assert GSheetsEngineSpec.get_url_for_impersonation(
        url=make_url("gsheets://"),
        impersonate_user=True,
        username="alice",
        access_token=None,
    ) == make_url("gsheets://?subject=alice%40example.org")


def test_get_url_for_impersonation_access_token() -> None:
    """
    Test passing an access token to `get_url_for_impersonation`.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    assert GSheetsEngineSpec.get_url_for_impersonation(
        url=make_url("gsheets://"),
        impersonate_user=True,
        username=None,
        access_token="access-token",  # noqa: S106
    ) == make_url("gsheets://?access_token=access-token")


def test_is_oauth2_enabled_no_config(mocker: MockerFixture) -> None:
    """
    Test `is_oauth2_enabled` when OAuth2 is not configured.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mocker.patch(
        "superset.db_engine_specs.base.current_app.config",
        new={"DATABASE_OAUTH2_CLIENTS": {}},
    )

    assert GSheetsEngineSpec.is_oauth2_enabled() is False


def test_is_oauth2_enabled_config(mocker: MockerFixture) -> None:
    """
    Test `is_oauth2_enabled` when OAuth2 is configured.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mocker.patch(
        "superset.db_engine_specs.base.current_app.config",
        new={
            "DATABASE_OAUTH2_CLIENTS": {
                "Google Sheets": {
                    "id": "XXX.apps.googleusercontent.com",
                    "secret": "GOCSPX-YYY",
                },
            }
        },
    )

    assert GSheetsEngineSpec.is_oauth2_enabled() is True


@pytest.fixture
def oauth2_config() -> OAuth2ClientConfig:
    """
    Config for GSheets OAuth2.
    """
    return {
        "id": "XXX.apps.googleusercontent.com",
        "secret": "GOCSPX-YYY",
        "scope": " ".join(
            [
                "https://www.googleapis.com/auth/drive.readonly "
                "https://www.googleapis.com/auth/spreadsheets "
                "https://spreadsheets.google.com/feeds"
            ]
        ),
        "redirect_uri": "http://localhost:8088/api/v1/oauth2/",
        "authorization_request_uri": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_request_uri": "https://oauth2.googleapis.com/token",
        "request_content_type": "json",
    }


def test_get_oauth2_authorization_uri(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_authorization_uri`.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    state: OAuth2State = {
        "database_id": 1,
        "user_id": 1,
        "default_redirect_uri": "http://localhost:8088/api/v1/oauth2/",
        "tab_id": "1234",
    }

    url = GSheetsEngineSpec.get_oauth2_authorization_uri(oauth2_config, state)
    parsed = urlparse(url)
    assert parsed.netloc == "accounts.google.com"
    assert parsed.path == "/o/oauth2/v2/auth"

    query = parse_qs(parsed.query)
    assert query["scope"][0] == (
        "https://www.googleapis.com/auth/drive.readonly "
        "https://www.googleapis.com/auth/spreadsheets "
        "https://spreadsheets.google.com/feeds"
    )
    encoded_state = query["state"][0].replace("%2E", ".")
    assert decode_oauth2_state(encoded_state) == state


def test_get_oauth2_token(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_token`.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    requests = mocker.patch("superset.db_engine_specs.base.requests")
    requests.post().json.return_value = {
        "access_token": "access-token",
        "expires_in": 3600,
        "scope": "scope",
        "token_type": "Bearer",
        "refresh_token": "refresh-token",
    }

    assert GSheetsEngineSpec.get_oauth2_token(oauth2_config, "code") == {
        "access_token": "access-token",
        "expires_in": 3600,
        "scope": "scope",
        "token_type": "Bearer",
        "refresh_token": "refresh-token",
    }
    requests.post.assert_called_with(
        "https://oauth2.googleapis.com/token",
        json={
            "code": "code",
            "client_id": "XXX.apps.googleusercontent.com",
            "client_secret": "GOCSPX-YYY",
            "redirect_uri": "http://localhost:8088/api/v1/oauth2/",
            "grant_type": "authorization_code",
        },
        timeout=30.0,
    )


def test_get_oauth2_fresh_token(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_token`.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    requests = mocker.patch("superset.db_engine_specs.base.requests")
    requests.post().json.return_value = {
        "access_token": "access-token",
        "expires_in": 3600,
        "scope": "scope",
        "token_type": "Bearer",
        "refresh_token": "refresh-token",
    }

    assert GSheetsEngineSpec.get_oauth2_fresh_token(oauth2_config, "refresh-token") == {
        "access_token": "access-token",
        "expires_in": 3600,
        "scope": "scope",
        "token_type": "Bearer",
        "refresh_token": "refresh-token",
    }
    requests.post.assert_called_with(
        "https://oauth2.googleapis.com/token",
        json={
            "client_id": "XXX.apps.googleusercontent.com",
            "client_secret": "GOCSPX-YYY",
            "refresh_token": "refresh-token",
            "grant_type": "refresh_token",
        },
        timeout=30.0,
    )
