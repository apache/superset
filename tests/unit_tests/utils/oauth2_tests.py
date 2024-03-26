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

# pylint: disable=invalid-name, disallowed-name

from datetime import datetime
from uuid import UUID

import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.exceptions import CreateAuthLockFailedException
from superset.key_value.exceptions import KeyValueCreateFailedError
from superset.key_value.types import KeyValueResource
from superset.utils.oauth2 import AuthLock, get_oauth2_access_token, integers_to_uuid


def test_get_oauth2_access_token_base_no_token(mocker: MockerFixture) -> None:
    """
    Test `get_oauth2_access_token` when there's no token.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    db_engine_spec = mocker.MagicMock()
    db.session.query().filter_by().one_or_none.return_value = None

    assert get_oauth2_access_token(1, 1, db_engine_spec) is None


def test_get_oauth2_access_token_base_token_valid(mocker: MockerFixture) -> None:
    """
    Test `get_oauth2_access_token` when the token is valid.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    db_engine_spec = mocker.MagicMock()
    token = mocker.MagicMock()
    token.access_token = "access-token"
    token.access_token_expiration = datetime(2024, 1, 2)
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-01"):
        assert get_oauth2_access_token(1, 1, db_engine_spec) == "access-token"


def test_get_oauth2_access_token_base_refresh(mocker: MockerFixture) -> None:
    """
    Test `get_oauth2_access_token` when the token needs to be refreshed.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    db_engine_spec = mocker.MagicMock()
    db_engine_spec.get_oauth2_fresh_token.return_value = {
        "access_token": "new-token",
        "expires_in": 3600,
    }
    token = mocker.MagicMock()
    token.access_token = "access-token"
    token.access_token_expiration = datetime(2024, 1, 1)
    token.refresh_token = "refresh-token"
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-02"):
        assert get_oauth2_access_token(1, 1, db_engine_spec) == "new-token"

    # check that token was updated
    assert token.access_token == "new-token"
    assert token.access_token_expiration == datetime(2024, 1, 2, 1)
    db.session.add.assert_called_with(token)


def test_get_oauth2_access_token_base_no_refresh(mocker: MockerFixture) -> None:
    """
    Test `get_oauth2_access_token` when token is expired and there's no refresh.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    db_engine_spec = mocker.MagicMock()
    token = mocker.MagicMock()
    token.access_token = "access-token"
    token.access_token_expiration = datetime(2024, 1, 1)
    token.refresh_token = None
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-02"):
        assert get_oauth2_access_token(1, 1, db_engine_spec) is None

    # check that token was deleted
    db.session.delete.assert_called_with(token)


def test_integers_to_uuid() -> None:
    """
    Test `integers_to_uuid`.
    """
    assert integers_to_uuid(1, 1) == UUID("4a426d86-eae0-53be-8f9a-8113ffc5a445")
    assert integers_to_uuid(2, 1) == UUID("0a81e791-1685-5239-bc04-4cdd6aacc18d")
    assert integers_to_uuid(1, 2) == UUID("83b19a49-b4f2-5ac5-9b52-5a63907dd160")


def test_AuthLock_happy_path(mocker: MockerFixture) -> None:
    """
    Test successfully acquiring the global auth lock.
    """
    CreateKeyValueCommand = mocker.patch(
        "superset.commands.key_value.create.CreateKeyValueCommand"
    )
    DeleteKeyValueCommand = mocker.patch(
        "superset.commands.key_value.delete.DeleteKeyValueCommand"
    )
    DeleteExpiredKeyValueCommand = mocker.patch(
        "superset.commands.key_value.delete_expired.DeleteExpiredKeyValueCommand"
    )
    PickleKeyValueCodec = mocker.patch("superset.utils.oauth2.PickleKeyValueCodec")

    with freeze_time("2024-01-01"):
        with AuthLock(1, 1):
            DeleteExpiredKeyValueCommand.assert_called_with(
                resource=KeyValueResource.OAUTH2,
            )
            CreateKeyValueCommand.assert_called_with(
                resource=KeyValueResource.OAUTH2,
                codec=PickleKeyValueCodec(),
                key=integers_to_uuid(1, 1),
                value=True,
                expires_on=datetime(2024, 1, 1, 0, 0, 30),
            )
            DeleteKeyValueCommand.assert_not_called()

        DeleteKeyValueCommand.assert_called_with(
            resource=KeyValueResource.OAUTH2,
            key=integers_to_uuid(1, 1),
        )


def test_AuthLock_no_lock(mocker: MockerFixture) -> None:
    """
    Test unsuccessfully acquiring the global auth lock.
    """
    mocker.patch(
        "superset.commands.key_value.create.CreateKeyValueCommand",
        side_effect=KeyValueCreateFailedError(),
    )
    DeleteKeyValueCommand = mocker.patch(
        "superset.commands.key_value.delete.DeleteKeyValueCommand"
    )

    with pytest.raises(CreateAuthLockFailedException) as excinfo:
        with AuthLock(1, 1):
            pass
    assert str(excinfo.value) == "Error acquiring lock"

    # confirm that key was deleted
    DeleteKeyValueCommand.assert_called_with(
        resource=KeyValueResource.OAUTH2,
        key=integers_to_uuid(1, 1),
    )
