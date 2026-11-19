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
from unittest.mock import patch, PropertyMock

import pytest
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.dashboard.permalink.get import GetDashboardPermalinkCommand
from superset.dashboards.permalink.exceptions import (
    DashboardPermalinkGetFailedError,
    DashboardPermalinkInvalidKeyError,
)

MODULE = "superset.commands.dashboard.permalink.get"


@pytest.fixture(autouse=True)
def salt():
    with patch(
        f"{MODULE}.GetDashboardPermalinkCommand.salt",
        new_callable=PropertyMock,
        return_value="test-salt",
    ):
        yield


def test_invalid_key_raises_invalid_key_error() -> None:
    with pytest.raises(DashboardPermalinkInvalidKeyError) as excinfo:
        GetDashboardPermalinkCommand("undefined").run()
    assert excinfo.value.status == 404


def test_storage_failure_still_raises_generic_error() -> None:
    with (
        patch(f"{MODULE}.decode_permalink_id", return_value=1),
        patch(f"{MODULE}.KeyValueDAO.get_value", side_effect=SQLAlchemyError()),
        pytest.raises(DashboardPermalinkGetFailedError) as excinfo,
    ):
        GetDashboardPermalinkCommand("abc").run()
    assert not isinstance(excinfo.value, DashboardPermalinkInvalidKeyError)
    assert excinfo.value.status == 500
