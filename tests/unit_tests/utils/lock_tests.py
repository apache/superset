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

# pylint: disable=invalid-name

from datetime import datetime

import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.exceptions import CreateKeyValueDistributedLockFailedException
from superset.key_value.exceptions import KeyValueCreateFailedError
from superset.key_value.types import KeyValueResource
from superset.utils.lock import KeyValueDistributedLock


def test_KeyValueDistributedLock_happy_path(mocker: MockerFixture) -> None:
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
    PickleKeyValueCodec = mocker.patch("superset.utils.lock.PickleKeyValueCodec")

    with freeze_time("2024-01-01"):
        with KeyValueDistributedLock("ns", a=1, b=2) as key:
            DeleteExpiredKeyValueCommand.assert_called_with(
                resource=KeyValueResource.LOCK,
            )
            CreateKeyValueCommand.assert_called_with(
                resource=KeyValueResource.LOCK,
                codec=PickleKeyValueCodec(),
                key=key,
                value=True,
                expires_on=datetime(2024, 1, 1, 0, 0, 30),
            )
            DeleteKeyValueCommand.assert_not_called()

        DeleteKeyValueCommand.assert_called_with(
            resource=KeyValueResource.LOCK,
            key=key,
        )


def test_KeyValueDistributedLock_no_lock(mocker: MockerFixture) -> None:
    """
    Test unsuccessfully acquiring the global auth lock.
    """
    mocker.patch(
        "superset.commands.key_value.create.CreateKeyValueCommand",
        side_effect=KeyValueCreateFailedError(),
    )

    with pytest.raises(CreateKeyValueDistributedLockFailedException) as excinfo:
        with KeyValueDistributedLock("ns", a=1, b=2):
            pass
    assert str(excinfo.value) == "Error acquiring lock"
