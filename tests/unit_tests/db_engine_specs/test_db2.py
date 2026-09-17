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

import pytest  # noqa: F401
from pytest_mock import MockerFixture

from superset.sql_parse import Table


def test_epoch_to_dttm() -> None:
    """
    Test the `epoch_to_dttm` method.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    assert (
        Db2EngineSpec.epoch_to_dttm().format(col="epoch_dttm")
        == "(TIMESTAMP('1970-01-01', '00:00:00') + epoch_dttm SECONDS)"
    )


def test_get_table_comment(mocker: MockerFixture):
    """
    Test the `get_table_comment` method.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    mock_inspector = mocker.MagicMock()
    mock_inspector.get_table_comment.return_value = {
        "text": ("This is a table comment",)
    }

    assert (
        Db2EngineSpec.get_table_comment(mock_inspector, Table("my_table", "my_schema"))
        == "This is a table comment"
    )


def test_get_table_comment_empty(mocker: MockerFixture):
    """
    Test the `get_table_comment` method
    when no comment is returned.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    mock_inspector = mocker.MagicMock()
    mock_inspector.get_table_comment.return_value = {}

    assert (
        Db2EngineSpec.get_table_comment(mock_inspector, Table("my_table", "my_schema"))
        is None
    )


def test_get_prequeries(mocker: MockerFixture) -> None:
    """
    Test the ``get_prequeries`` method.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    database = mocker.MagicMock()

    assert Db2EngineSpec.get_prequeries(database) == []
    assert Db2EngineSpec.get_prequeries(database, schema="my_schema") == [
        'set current_schema "my_schema"'
    ]
