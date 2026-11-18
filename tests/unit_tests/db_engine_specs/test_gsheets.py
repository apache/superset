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

# ``GSheetsEngineSpec`` is imported inside each test on purpose: its module
# binds ``superset.db`` and ``superset.security_manager`` at import time, so it
# has to load after the app fixture has initialized them.

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone, UTC
from typing import Any, TYPE_CHECKING
from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlparse

import numpy as np
import pandas as pd
import pytest
import sqlalchemy
from pytest_mock import MockerFixture
from requests.exceptions import HTTPError
from shillelagh.exceptions import UnauthenticatedError
from sqlalchemy.engine.url import make_url, URL

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import OAuth2TokenRefreshError, SupersetException
from superset.models.core import Database
from superset.sql.parse import Table
from superset.superset_typing import OAuth2ClientConfig
from superset.utils import json
from superset.utils.oauth2 import decode_oauth2_state
from tests.unit_tests.conftest import with_feature_flags
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401

if TYPE_CHECKING:
    from superset.db_engine_specs.base import OAuth2State

# Skip these tests if shillelagh can't import pip
# This happens in some environments where pip is not available as a module
skip_reason = None
try:
    import shillelagh.functions  # noqa: F401
except ImportError as e:
    if "No module named 'pip'" in str(e):
        skip_reason = (
            "shillelagh requires 'pip' module which is not available in this "
            "environment"
        )

if skip_reason:
    pytestmark = pytest.mark.skip(reason=skip_reason)


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


def test_validate_parameters_malformed_credentials(mocker: MockerFixture) -> None:
    from superset.db_engine_specs.gsheets import (
        GSheetsEngineSpec,
        GSheetsPropertiesType,
    )

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user.email = "admin@example.org"

    properties: GSheetsPropertiesType = {
        "parameters": {
            "service_account_info": "{not valid json",
            "catalog": {},
        },
        "catalog": {},
    }
    errors = GSheetsEngineSpec.validate_parameters(properties)
    assert errors == [
        SupersetError(
            message=(
                "The service account credentials are not valid JSON. "
                "Please check that the field contains a valid service "
                "account key."
            ),
            error_type=SupersetErrorType.INVALID_PAYLOAD_FORMAT_ERROR,
            level=ErrorLevel.ERROR,
            extra={"invalid": ["service_account_info"]},
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
    register_engine_events = mocker.patch.object(
        GSheetsEngineSpec, "register_engine_events"
    )
    conn = create_engine.return_value.connect.return_value
    results = conn.execute.return_value
    results.fetchall.side_effect = [
        ProgrammingError("The caller does not have permission"),
        [(1,)],
        ProgrammingError("Unsupported table: https://www.google.com/"),
    ]

    properties: GSheetsPropertiesType = {
        "impersonate_user": True,
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
        connect_args={
            "adapter_kwargs": {
                "gsheetsapi": {
                    "service_account_info": {},
                    "subject": None,
                }
            }
        },
    )
    register_engine_events.assert_called_once_with(create_engine.return_value)


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
        connect_args={
            "adapter_kwargs": {
                "gsheetsapi": {
                    "service_account_info": {},
                    "subject": None,
                }
            }
        },
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


def test_impersonate_user_username(mocker: MockerFixture) -> None:
    """
    Test passing a username to `impersonate_user`.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    database = mocker.MagicMock()
    database.get_encrypted_extra.return_value = {}
    database.get_impersonation_email.return_value = "alice@example.org"
    url = make_url("gsheets://")

    assert GSheetsEngineSpec.impersonate_user(
        database,
        username="alice",
        user_token=None,
        url=url,
        engine_kwargs={},
    ) == (make_url("gsheets://?subject=alice%40example.org"), {})

    # Resolved from the same URL `Database._get_sqla_engine()` passes down, so
    # both paths read the effective user from the same place.
    database.get_impersonation_email.assert_called_once_with(url)


@with_feature_flags(IMPERSONATE_WITH_EMAIL_PREFIX=True)
def test_impersonate_user_email_prefix_flag(mocker: MockerFixture) -> None:
    """
    Test that the subject is the full email when the prefix flag is on.

    With the flag enabled the caller has already substituted the email prefix
    into ``username``, so resolving the subject from that value would find no
    user whenever the login and the prefix differ -- silently leaving the
    subject unset. Resolving from the database is correct either way.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    user = mocker.MagicMock()
    user.email = "alice.doe@example.org"
    mocker.patch(
        "superset.models.core.find_user_for_impersonation",
        return_value=user,
    )
    mocker.patch("superset.models.core.get_username", return_value="alice")

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="gsheets://",
        impersonate_user=True,
    )

    url, _ = GSheetsEngineSpec.impersonate_user(
        database,
        username="alice.doe",
        user_token=None,
        url=make_url("gsheets://"),
        engine_kwargs={},
    )
    assert url == make_url("gsheets://?subject=alice.doe%40example.org")


def test_impersonate_user_access_token(mocker: MockerFixture) -> None:
    """
    Test passing an access token to `impersonate_user`.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    database = mocker.MagicMock()
    database.get_encrypted_extra.return_value = {}

    assert GSheetsEngineSpec.impersonate_user(
        database,
        username=None,
        user_token="access-token",  # noqa: S106
        url=make_url("gsheets://"),
        engine_kwargs={},
    ) == (
        make_url("gsheets://"),
        {
            "connect_args": {
                "adapter_kwargs": {"gsheetsapi": {"access_token": "access-token"}}
            }
        },
    )


def test_impersonate_user_access_token_with_catalog(mocker: MockerFixture) -> None:
    """
    Test that the access token reaches the adapter when a catalog is configured.

    The catalog is stored in ``connect_args``, which SQLAlchemy merges shallowly
    over the dialect arguments built from the URL.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    database: MagicMock = mocker.MagicMock(encrypted_extra=None)
    database.get_encrypted_extra.return_value = {}
    catalog = {"sheet": "https://docs.google.com/spreadsheets/d/1/edit#gid=0"}
    url, engine_kwargs = GSheetsEngineSpec.impersonate_user(
        database,
        username=None,
        user_token="access-token",  # noqa: S106
        url=make_url("gsheets://"),
        engine_kwargs={"catalog": catalog},
    )
    GSheetsEngineSpec.update_params_from_encrypted_extra(database, engine_kwargs)

    engine = sqlalchemy.create_engine(url, **engine_kwargs)
    connect = mocker.patch.object(engine.dialect, "connect")
    engine.pool._creator()

    adapter_kwargs = connect.call_args.kwargs["adapter_kwargs"]["gsheetsapi"]
    assert adapter_kwargs["access_token"] == "access-token"  # noqa: S105
    assert adapter_kwargs["catalog"] == catalog


def test_impersonate_user_username_and_access_token(mocker: MockerFixture) -> None:
    """
    Test that ``subject`` and the access token both reach the adapter alongside a
    catalog.

    The catalog puts its own ``adapter_kwargs`` in ``connect_args``, which
    SQLAlchemy merges shallowly over the URL-derived ones, so anything left only
    on the URL would be dropped.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    database: MagicMock = mocker.MagicMock(encrypted_extra=None)
    database.get_impersonation_email.return_value = "alice@example.org"
    database.get_encrypted_extra.return_value = {}
    catalog = {"sheet": "https://docs.google.com/spreadsheets/d/1/edit#gid=0"}
    url, engine_kwargs = GSheetsEngineSpec.impersonate_user(
        database,
        username="alice",
        user_token="access-token",  # noqa: S106
        url=make_url("gsheets://"),
        engine_kwargs={"catalog": catalog},
    )
    GSheetsEngineSpec.update_params_from_encrypted_extra(database, engine_kwargs)

    engine = sqlalchemy.create_engine(url, **engine_kwargs)
    connect = mocker.patch.object(engine.dialect, "connect")
    engine.pool._creator()

    adapter_kwargs = connect.call_args.kwargs["adapter_kwargs"]["gsheetsapi"]
    assert adapter_kwargs["access_token"] == "access-token"  # noqa: S105
    assert adapter_kwargs["subject"] == "alice@example.org"
    assert adapter_kwargs["catalog"] == catalog


def test_is_oauth2_enabled_no_config(mocker: MockerFixture) -> None:
    """
    Test `is_oauth2_enabled` when OAuth2 is not configured.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mocker.patch(
        "flask.current_app.config",
        new={"DATABASE_OAUTH2_CLIENTS": {}},
    )

    assert GSheetsEngineSpec.is_oauth2_enabled() is False


def test_is_oauth2_enabled_config(mocker: MockerFixture) -> None:
    """
    Test `is_oauth2_enabled` when OAuth2 is configured.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mocker.patch(
        "flask.current_app.config",
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

    # Verify Google-specific OAuth parameters are included
    assert query["access_type"][0] == "offline"
    assert query["include_granted_scopes"][0] == "false"
    assert query["prompt"][0] == "consent"


def test_get_oauth2_token(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_token`.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mock_get_requester = mocker.patch(
        "superset.db_engine_specs.base.get_ssrf_safe_requester"
    )
    requests = mock_get_requester.return_value
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
        allow_redirects=False,
    )


def test_get_oauth2_fresh_token(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_token`.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mock_get_requester = mocker.patch(
        "superset.db_engine_specs.base.get_ssrf_safe_requester"
    )
    requests = mock_get_requester.return_value
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
        allow_redirects=False,
    )


def test_update_params_from_encrypted_extra(mocker: MockerFixture) -> None:
    """
    Test `update_params_from_encrypted_extra`.

    - oauth2_client_info must be removed
    - service_account_info must be moved to connect_args.adapter_kwargs.gsheetsapi
    - catalog must be copied to connect_args.adapter_kwargs.gsheetsapi (and kept
      top-level)
    - other keys must remain as top-level params
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    database = mocker.MagicMock(
        encrypted_extra=json.dumps(
            {
                "oauth2_client_info": "SECRET",
                "service_account_info": {
                    "private_key": "KEY",
                    "client_email": "x@y.com",
                },
                "catalog": {"Sheet1": "https://docs.google.com/spreadsheets/d/1/edit"},
                "foo": "bar",
            }
        )
    )
    params: dict[str, Any] = {}

    GSheetsEngineSpec.update_params_from_encrypted_extra(database, params)

    assert "oauth2_client_info" not in params
    assert "service_account_info" not in params
    assert params["connect_args"]["adapter_kwargs"]["gsheetsapi"][
        "service_account_info"
    ] == {"private_key": "KEY", "client_email": "x@y.com"}
    assert params["connect_args"]["adapter_kwargs"]["gsheetsapi"]["catalog"] == {
        "Sheet1": "https://docs.google.com/spreadsheets/d/1/edit"
    }
    assert params["catalog"] == {
        "Sheet1": "https://docs.google.com/spreadsheets/d/1/edit"
    }
    assert params["foo"] == "bar"


def test_needs_oauth2_with_credentials_error(mocker: MockerFixture) -> None:
    """
    Test that needs_oauth2 returns True for google-auth credentials error.

    When a token is manually revoked on Google side, google-auth tries to
    refresh credentials but fails with this message.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user = mocker.MagicMock()

    ex = Exception("credentials do not contain the necessary fields")
    assert GSheetsEngineSpec.needs_oauth2(ex) is True


def test_needs_oauth2_with_default_credentials_not_found(
    mocker: MockerFixture,
) -> None:
    """
    Test that needs_oauth2 returns True when Application Default Credentials
    are not configured.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user = mocker.MagicMock()

    ex = Exception(
        "Your default credentials were not found. To set up Application Default "
        "Credentials, see https://cloud.google.com/docs/authentication/external/"
        "set-up-adc for more information."
    )
    assert GSheetsEngineSpec.needs_oauth2(ex) is True


def test_needs_oauth2_with_other_error(mocker: MockerFixture) -> None:
    """
    Test that needs_oauth2 returns False for other errors.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user = mocker.MagicMock()

    ex = Exception("Some other error")
    assert GSheetsEngineSpec.needs_oauth2(ex) is False


def test_needs_oauth2_with_shillelagh_unauthenticated_error(
    mocker: MockerFixture,
) -> None:
    """
    Test that needs_oauth2 returns True when UnauthenticatedError is raised.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user = mocker.MagicMock()

    ex = UnauthenticatedError("Token has been revoked")
    assert GSheetsEngineSpec.needs_oauth2(ex) is True


def test_needs_oauth2_with_unrelated_exception_type(
    mocker: MockerFixture,
) -> None:
    """
    Test that an unrelated exception type (with no matching message) returns
    False.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user = mocker.MagicMock()

    assert GSheetsEngineSpec.needs_oauth2(ValueError("unrelated")) is False


def test_get_oauth2_fresh_token_success(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
) -> None:
    """
    Test that get_oauth2_fresh_token returns token on success.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mock_get_requester = mocker.patch(
        "superset.db_engine_specs.base.get_ssrf_safe_requester"
    )
    requests = mock_get_requester.return_value
    requests.post().json.return_value = {
        "access_token": "new-access-token",
        "expires_in": 3600,
    }

    result = GSheetsEngineSpec.get_oauth2_fresh_token(oauth2_config, "refresh-token")
    assert result == {
        "access_token": "new-access-token",
        "expires_in": 3600,
    }


def test_get_oauth2_fresh_token_invalid_grant(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
) -> None:
    """
    Test that get_oauth2_fresh_token raises OAuth2TokenRefreshError for a 400 response.

    When a token is revoked on Google side, the refresh request returns 400.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mock_get_requester = mocker.patch(
        "superset.db_engine_specs.base.get_ssrf_safe_requester"
    )
    requests = mock_get_requester.return_value
    requests.post().status_code = 400
    requests.post().text = (
        '{"error": "invalid_grant",'
        ' "error_description": "Token has been expired or revoked."}'
    )

    with pytest.raises(OAuth2TokenRefreshError):
        GSheetsEngineSpec.get_oauth2_fresh_token(oauth2_config, "refresh-token")


def test_get_oauth2_fresh_token_other_http_error(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
) -> None:
    """
    Test that get_oauth2_fresh_token re-raises non-invalid_grant HTTP errors.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mock_response = mocker.MagicMock()
    mock_response.status_code = 500
    mock_response.json.return_value = {"error": "server_error"}

    http_error = HTTPError()
    http_error.response = mock_response

    mock_get_requester = mocker.patch(
        "superset.db_engine_specs.base.get_ssrf_safe_requester"
    )
    requests = mock_get_requester.return_value
    requests.post().raise_for_status.side_effect = http_error

    with pytest.raises(HTTPError):
        GSheetsEngineSpec.get_oauth2_fresh_token(oauth2_config, "refresh-token")


def test_get_table_names_triggers_oauth2_dance(mocker: MockerFixture) -> None:
    """
    Test that get_table_names triggers OAuth2 dance when no token exists.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user.id = 1

    get_oauth2_access_token = mocker.patch(
        "superset.db_engine_specs.gsheets.get_oauth2_access_token",
        return_value=None,
    )

    database = mocker.MagicMock()
    database.id = 1
    database.is_oauth2_enabled.return_value = True
    database.get_oauth2_config.return_value = {"id": "client-id"}
    database.db_engine_spec = GSheetsEngineSpec

    inspector = mocker.MagicMock()

    GSheetsEngineSpec.get_table_names(database, inspector, None)

    database.start_oauth2_dance.assert_called_once()
    get_oauth2_access_token.assert_called_once()


def test_get_table_names_does_not_trigger_oauth2_when_token_exists(
    mocker: MockerFixture,
) -> None:
    """
    Test that get_table_names does not trigger OAuth2 dance when token exists.
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user.id = 1

    get_oauth2_access_token = mocker.patch(
        "superset.db_engine_specs.gsheets.get_oauth2_access_token",
        return_value="valid-token",
    )

    mocker.patch(
        "superset.db_engine_specs.shillelagh.ShillelaghEngineSpec.get_table_names",
        return_value={"sheet1", "sheet2"},
    )

    database = mocker.MagicMock()
    database.id = 1
    database.is_oauth2_enabled.return_value = True
    database.get_oauth2_config.return_value = {"id": "client-id"}
    database.db_engine_spec = GSheetsEngineSpec

    inspector = mocker.MagicMock()

    result = GSheetsEngineSpec.get_table_names(database, inspector, None)

    database.start_oauth2_dance.assert_not_called()
    get_oauth2_access_token.assert_called_once()
    assert result == {"sheet1", "sheet2"}


def test_validate_parameters_skips_oauth2_connections_with_parameters(
    mocker: MockerFixture,
) -> None:
    """
    Test that validate_parameters skips validation for OAuth2 connections.

    When oauth2_client_info is present in parameters, the validation should
    skip URL checks since the user will authenticate via OAuth2.
    """
    from superset.db_engine_specs.gsheets import (
        GSheetsEngineSpec,
        GSheetsPropertiesType,
    )

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user.email = "admin@example.org"

    create_engine = mocker.patch("superset.db_engine_specs.gsheets.create_engine")
    conn = create_engine.return_value.connect.return_value
    results = conn.execute.return_value
    results.fetchall.side_effect = ProgrammingError(
        "The caller does not have permission"
    )

    properties: GSheetsPropertiesType = {
        "parameters": {
            "service_account_info": "",
            "catalog": {},
            "oauth2_client_info": {"id": "client-id", "secret": "client-secret"},
        },
        "catalog": {
            "sheet1": "https://docs.google.com/spreadsheets/d/1/edit",
        },
    }
    errors = GSheetsEngineSpec.validate_parameters(properties)

    assert errors == []
    conn.execute.assert_not_called()


def test_validate_parameters_skips_oauth2_connections_with_masked_encrypted_extra(
    mocker: MockerFixture,
) -> None:
    """
    Test validate_parameters skips validation for OAuth2 via masked_encrypted_extra.

    When oauth2_client_info is present in masked_encrypted_extra (used during
    create/update), the validation should skip URL checks.
    """
    from superset.db_engine_specs.gsheets import (
        GSheetsEngineSpec,
        GSheetsPropertiesType,
    )

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user.email = "admin@example.org"

    create_engine = mocker.patch("superset.db_engine_specs.gsheets.create_engine")
    conn = create_engine.return_value.connect.return_value
    results = conn.execute.return_value
    results.fetchall.side_effect = ProgrammingError(
        "The caller does not have permission"
    )

    properties: GSheetsPropertiesType = {
        "parameters": {
            "service_account_info": "",
            "catalog": {},
        },
        "catalog": {
            "sheet1": "https://docs.google.com/spreadsheets/d/1/edit",
        },
        "masked_encrypted_extra": json.dumps(
            {
                "oauth2_client_info": {"id": "client-id", "secret": "XXXXXXXXXX"},
            }
        ),
    }
    errors = GSheetsEngineSpec.validate_parameters(properties)

    assert errors == []
    conn.execute.assert_not_called()


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "'2019-01-02'"),
        ("DateTime", "'2019-01-02 03:04:05'"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: str | None,
    dttm: datetime,  # noqa: F811
) -> None:
    """
    A Date-typed column must produce a plain ISO date literal ('YYYY-MM-DD').

    Without this, ``SqliteEngineSpec.convert_dttm`` (inherited via
    ``ShillelaghEngineSpec``) returns ``None`` for ``types.Date``, and Superset falls
    back to a full ``'YYYY-MM-DD HH:MM:SS.ffffff'`` literal. shillelagh's virtual
    table layer parses that bound value with ``datetime.date.fromisoformat``, which
    rejects the trailing time-of-day and silently coerces the constraint to ``None``,
    which the GSheets adapter renders as the SQL literal ``null`` -- an unquoted
    bareword that Google's Chart API parses as a missing column reference, raising
    "Invalid query: NO_COLUMN: null".
    """
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    assert_convert_dttm(GSheetsEngineSpec, target_type, expected_result, dttm)


def test_upload_dates(mocker: MockerFixture) -> None:
    """
    Test that date and numpy values are uploaded as JSON values.
    """
    from datetime import date
    from decimal import Decimal

    import numpy as np

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

    df = pd.DataFrame(
        {
            "i": np.array([1, 2], dtype="int64"),
            "f": [1.5, np.nan],
            "d": [date(2024, 2, 29), None],
            "ts": pd.to_datetime(["2024-02-29 23:59:58", None]),
            "dec": [Decimal("1.10"), None],
        }
    )
    GSheetsEngineSpec.df_to_sql(database, Table("sample_data"), df, {})

    body = session.post.call_args_list[-1].kwargs["json"]
    assert json.loads(json.dumps(body["values"])) == [
        ["i", "f", "d", "ts", "dec"],
        [1, 1.5, "2024-02-29", "2024-02-29 23:59:58", "1.10"],
        [2, "", "", "", ""],
    ]


@pytest.mark.parametrize(
    "column, expected",
    [
        (
            pd.Series(pd.to_datetime(["2024-03-01 00:30:00.123456+02:00", None])),
            ["2024-02-29 22:30:00.123456", ""],
        ),
        (
            pd.Series(pd.to_datetime(["2024-02-29 23:30:00-05:00", None])),
            ["2024-03-01 04:30:00", ""],
        ),
        (
            pd.Series([1, None, 9007199254740993], dtype="Int64"),
            [1, "", 9007199254740993],
        ),
        (
            pd.Series([time(12, 34, 56, 123456), None, time(0, 0)]),
            ["12:34:56.123456", "", "00:00:00"],
        ),
        (
            pd.Series(pd.to_timedelta([5, 90_000_000_000, None], unit="ns")),
            ["0:00:00", "0:01:30", ""],
        ),
    ],
    ids=["positive-offset", "negative-offset", "nullable-int", "time", "ns-duration"],
)
def test_upload_cell_types(
    mocker: MockerFixture,
    column: pd.Series,
    expected: list[str | int],
) -> None:
    """Serialize cells without offsets or pandas' integer-to-float inference."""
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    mocker.patch("superset.db_engine_specs.gsheets.db")
    get_adapter = mocker.patch(
        "shillelagh.backends.apsw.dialects.base.get_adapter_for_table_name"
    )
    session = get_adapter.return_value._get_session.return_value
    session.post.return_value.json.return_value = {
        "spreadsheetId": 1,
        "spreadsheetUrl": "https://docs.example.org",
        "sheets": [{"properties": {"title": "sample_data"}}],
    }
    database = mocker.MagicMock()
    database.get_extra.return_value = {}
    df = pd.DataFrame({"value": column})
    original = df.copy(deep=True)

    GSheetsEngineSpec.df_to_sql(database, Table("sample_data"), df, {})

    request = session.post.call_args.kwargs
    assert request["params"] == {"valueInputOption": "USER_ENTERED"}
    values = json.loads(json.dumps(request["json"]["values"]))
    assert values == [["value"], *[[value] for value in expected]]
    # Numeric equality alone would accept 1.0 in place of 1.
    assert [type(row[0]) for row in values[1:]] == [type(value) for value in expected]
    pd.testing.assert_frame_equal(df, original)


@pytest.mark.parametrize(
    "value, expected",
    [
        (datetime(2024, 3, 1, 0, 30, tzinfo=UTC), "2024-03-01 00:30:00"),
        (
            datetime(2024, 3, 1, 0, 30, tzinfo=timezone(timedelta(hours=2))),
            "2024-02-29 22:30:00",
        ),
        (pd.Timestamp("2024-03-01 00:30:00", tz="Asia/Kolkata"), "2024-02-29 19:00:00"),
        (datetime(2024, 3, 1, 0, 30), "2024-03-01 00:30:00"),
    ],
)
def test_to_json_value_datetime_utc(value: datetime, expected: str) -> None:
    """Aware timestamps become naive UTC; naive timestamps retain their clock time."""
    from superset.db_engine_specs.gsheets import to_json_value

    assert to_json_value(value) == expected


@pytest.mark.parametrize(
    "value, expected",
    [
        (np.datetime64("2024-02-29T23:59:58", "us"), "2024-02-29 23:59:58"),
        (np.datetime64("2024-02-29T23:59:58", "ns"), "2024-02-29 23:59:58"),
        (np.datetime64("2024-02-29", "D"), "2024-02-29 00:00:00"),
        (np.datetime64("NaT"), None),
        (np.timedelta64(90, "s"), "0:01:30"),
        (np.timedelta64(90_000_000_000, "ns"), "0:01:30"),
        (np.timedelta64(5, "ns"), "0:00:00"),
        (np.timedelta64("NaT", "ns"), None),
        (pd.Timedelta(seconds=90), "0:01:30"),
        (timedelta(hours=1), "1:00:00"),
        (timedelta(days=2, seconds=61), "48:01:01"),
        (timedelta(seconds=-90), "-0:01:30"),
        (timedelta(days=-2), "-48:00:00"),
        (timedelta(microseconds=1), "0:00:00.000001"),
        (timedelta(microseconds=-1), "-0:00:00.000001"),
        (pd.Timedelta(days=2, microseconds=123456), "48:00:00.123456"),
        (np.int64(3), 3),
        (time(12, 34, 56, 123456), "12:34:56.123456"),
    ],
)
def test_to_json_value_numpy_dates_and_durations(value: Any, expected: Any) -> None:
    """
    Test that numpy dates and durations become JSON-serializable values.
    """
    from superset.db_engine_specs.gsheets import to_json_value

    result = to_json_value(value)
    assert result == expected
    json.dumps(result)


@pytest.mark.parametrize("impersonate_user", [None, False, True])
@pytest.mark.parametrize(
    "serialized_credentials", [False, True], ids=["edit", "create"]
)
@pytest.mark.parametrize("catalog_in_parameters", [False, True])
def test_validate_parameters_service_account_subject(
    mocker: MockerFixture,
    impersonate_user: bool | None,
    serialized_credentials: bool,
    catalog_in_parameters: bool,
) -> None:
    """Create and edit validate as the service account, even with the modal flag."""
    from superset.db_engine_specs.gsheets import (
        GSheetsEngineSpec,
        GSheetsPropertiesType,
    )

    g = mocker.patch("superset.db_engine_specs.gsheets.g")
    g.user.email = "admin@example.com"
    create_engine = mocker.patch("superset.db_engine_specs.gsheets.create_engine")
    mocker.patch.object(GSheetsEngineSpec, "register_engine_events")
    credentials = {"client_email": "service@example.com", "private_key": "KEY"}
    sheet_url = "https://docs.google.com/spreadsheets/d/1/edit"
    properties: GSheetsPropertiesType = {
        "parameters": {
            "service_account_info": (
                json.dumps(credentials) if serialized_credentials else credentials
            ),
        },
    }
    if catalog_in_parameters:
        properties["parameters"]["catalog"] = {"sheet": sheet_url}
    else:
        properties["catalog"] = {"sheet": sheet_url}
    if impersonate_user is not None:
        properties["impersonate_user"] = impersonate_user

    assert GSheetsEngineSpec.validate_parameters(properties) == []

    create_engine.assert_called_once_with(
        "gsheets://",
        connect_args={
            "adapter_kwargs": {
                "gsheetsapi": {"service_account_info": credentials, "subject": None},
            },
        },
    )
    conn = create_engine.return_value.connect.return_value
    assert str(conn.execute.call_args.args[0]) == (
        'SELECT * FROM "https://docs.google.com/spreadsheets/d/1/edit" LIMIT 1'
    )
    conn.execute.return_value.fetchall.assert_called_once()


@pytest.mark.parametrize("impersonate_user", [False, True])
def test_query_service_account_subject(
    mocker: MockerFixture,
    impersonate_user: bool,
) -> None:
    """Exercise SQLAlchemy's final DBAPI arguments, not just the URL subject."""
    from superset.models.core import Database

    user = mocker.MagicMock(email="admin@example.com")
    mocker.patch("superset.models.core.get_username", return_value="admin")
    mocker.patch(
        "superset.extensions.security_manager.find_user",
        return_value=user,
    )
    credentials = {"client_email": "service@example.com", "private_key": "KEY"}
    catalog = {"sheet": "https://docs.google.com/spreadsheets/d/1/edit"}
    database = Database(
        database_name="sheets",
        sqlalchemy_uri="gsheets://",
        impersonate_user=impersonate_user,
        encrypted_extra=json.dumps({"service_account_info": credentials}),
        extra=json.dumps({"engine_params": {"catalog": catalog}}),
    )
    engine = database._get_sqla_engine()
    connect = mocker.spy(engine.dialect.dbapi, "connect")
    try:
        # No network or Google credentials are needed for a literal query.
        with engine.connect() as conn:
            assert conn.exec_driver_sql("SELECT 1").scalar() == 1
        adapter_kwargs = connect.call_args.kwargs["adapter_kwargs"]["gsheetsapi"]
        assert adapter_kwargs["service_account_info"] == credentials
        assert adapter_kwargs["catalog"] == catalog
        assert adapter_kwargs.get("subject") is None
        # Without the delegation opt-in the subject is removed from the URL too,
        # since connect_args replaces the URL-derived adapter_kwargs.
        assert "subject" not in engine.url.query
    finally:
        engine.dispose()


def _service_account_adapter_kwargs(
    mocker: MockerFixture,
    encrypted_extra: dict[str, Any],
    email: str | None = "alice@example.org",
) -> tuple[URL, dict[str, Any]]:
    """What reaches shillelagh for a secure-extra service account, impersonating."""
    from superset.db_engine_specs.gsheets import GSheetsEngineSpec

    database: MagicMock = mocker.MagicMock(encrypted_extra=json.dumps(encrypted_extra))
    database.get_impersonation_email.return_value = email
    database.get_encrypted_extra.return_value = encrypted_extra
    url, engine_kwargs = GSheetsEngineSpec.impersonate_user(
        database,
        username="alice",
        user_token=None,
        url=make_url("gsheets://"),
        engine_kwargs={},
    )
    GSheetsEngineSpec.update_params_from_encrypted_extra(database, engine_kwargs)

    engine = sqlalchemy.create_engine(url, **engine_kwargs)
    connect = mocker.patch.object(engine.dialect, "connect")
    engine.pool._creator()
    return url, connect.call_args.kwargs["adapter_kwargs"]["gsheetsapi"]


def test_impersonate_user_service_account_without_delegation(
    mocker: MockerFixture,
) -> None:
    """
    Without the opt-in, a secure-extra service account is not asked to impersonate
    the user, and no ``subject`` is left on the URL to suggest otherwise.
    """
    service_account = {"type": "service_account", "client_email": "sa@example.org"}
    url, adapter_kwargs = _service_account_adapter_kwargs(
        mocker, {"service_account_info": service_account}
    )

    assert "subject" not in url.query
    assert adapter_kwargs.get("subject") is None
    assert adapter_kwargs["service_account_info"] == service_account


def test_impersonate_user_service_account_with_delegation(
    mocker: MockerFixture,
) -> None:
    """
    With ``domain_wide_delegation`` the user reaches shillelagh as the subject,
    instead of being dropped by the shallow ``connect_args`` merge.
    """
    service_account = {"type": "service_account", "client_email": "sa@example.org"}
    url, adapter_kwargs = _service_account_adapter_kwargs(
        mocker,
        {"service_account_info": service_account, "domain_wide_delegation": True},
    )

    assert adapter_kwargs["subject"] == "alice@example.org"
    assert adapter_kwargs["service_account_info"] == service_account
    assert "domain_wide_delegation" not in adapter_kwargs
    assert "subject" not in url.query


def test_impersonate_user_service_account_delegation_needs_an_email(
    mocker: MockerFixture,
) -> None:
    """A delegated connection never falls back to the service account's access."""
    with pytest.raises(SupersetException, match="no e-mail"):
        _service_account_adapter_kwargs(
            mocker,
            {
                "service_account_info": {"type": "service_account"},
                "domain_wide_delegation": True,
            },
            email=None,
        )
