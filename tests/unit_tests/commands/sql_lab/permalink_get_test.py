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
"""Unit tests for GetSqlLabPermalinkCommand's handling of legacy keys."""

from unittest.mock import PropertyMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.sql_lab.permalink.get import GetSqlLabPermalinkCommand
from superset.key_value.exceptions import KeyValueParseKeyError
from superset.sqllab.permalink.exceptions import SqlLabPermalinkGetFailedError


def test_legacy_kv_keys_are_not_special_cased(mocker: MockerFixture) -> None:
    """
    Regression: ``kv:<int>`` keys used to be resolved by a raw sequential
    primary-key lookup against the legacy ``keyvalue`` table, which has no
    owner column -- any authenticated caller could enumerate other users'
    saved SQL Lab editor state (SQL text, connection/schema context) by
    incrementing the id. Such keys must now be treated like any other
    permalink key: decoded via the salted hashid scheme (and rejected,
    since ``kv:<int>`` never was a valid hashid), never looked up by raw
    integer id.
    """
    decode = mocker.patch(
        "superset.commands.sql_lab.permalink.get.decode_permalink_id",
        side_effect=KeyValueParseKeyError(),
    )
    mocker.patch.object(
        GetSqlLabPermalinkCommand,
        "salt",
        new_callable=PropertyMock,
        return_value="salt",
    )

    command = GetSqlLabPermalinkCommand("kv:1")
    with pytest.raises(SqlLabPermalinkGetFailedError):
        command.run()

    decode.assert_called_once_with("kv:1", salt="salt")


def test_legacy_kv_keys_do_not_touch_the_keyvalue_table(mocker: MockerFixture) -> None:
    """
    A ``kv:<int>``-shaped key must never trigger a query against the
    legacy ``KeyValue`` model, regardless of whether that id exists.
    """
    mock_session = mocker.patch("superset.db.session")
    mocker.patch(
        "superset.commands.sql_lab.permalink.get.decode_permalink_id",
        side_effect=KeyValueParseKeyError(),
    )
    mocker.patch.object(
        GetSqlLabPermalinkCommand,
        "salt",
        new_callable=PropertyMock,
        return_value="salt",
    )

    command = GetSqlLabPermalinkCommand("kv:1")
    with pytest.raises(SqlLabPermalinkGetFailedError):
        command.run()

    mock_session.query.assert_not_called()


def test_get_command_has_no_legacy_kv_branch() -> None:
    """The command module no longer imports the legacy KeyValue model."""
    import superset.commands.sql_lab.permalink.get as get_module

    assert not hasattr(get_module, "db")
    assert not hasattr(get_module, "models")
