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
# pylint: disable=unused-argument, import-outside-toplevel, protected-access
import json
from typing import Any, Dict
from unittest import mock

import pytest
from pytest_mock import MockerFixture

from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY


@mock.patch("sqlalchemy.engine.Engine.connect")
def test_cancel_query_success(engine_mock: mock.Mock) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.return_value.__enter__.return_value
    assert TrinoEngineSpec.cancel_query(cursor_mock, query, "123") is True


@mock.patch("sqlalchemy.engine.Engine.connect")
def test_cancel_query_failed(engine_mock: mock.Mock) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.raiseError.side_effect = Exception()
    assert TrinoEngineSpec.cancel_query(cursor_mock, query, "123") is False


@pytest.mark.parametrize(
    "initial_extra,final_extra",
    [
        ({}, {QUERY_EARLY_CANCEL_KEY: True}),
        ({QUERY_CANCEL_KEY: "my_key"}, {QUERY_CANCEL_KEY: "my_key"}),
    ],
)
def test_prepare_cancel_query(
    initial_extra: Dict[str, Any],
    final_extra: Dict[str, Any],
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    session_mock = mocker.MagicMock()
    query = Query(extra_json=json.dumps(initial_extra))
    TrinoEngineSpec.prepare_cancel_query(query=query, session=session_mock)
    assert query.extra == final_extra


@pytest.mark.parametrize("cancel_early", [True, False])
@mock.patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@mock.patch("sqlalchemy.engine.Engine.connect")
def test_handle_cursor_early_cancel(
    engine_mock: mock.Mock,
    cancel_query_mock: mock.Mock,
    cancel_early: bool,
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    query_id = "myQueryId"

    cursor_mock = engine_mock.return_value.__enter__.return_value
    cursor_mock.stats = {"queryId": query_id}
    session_mock = mocker.MagicMock()

    query = Query()

    if cancel_early:
        TrinoEngineSpec.prepare_cancel_query(query=query, session=session_mock)

    TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query, session=session_mock)

    if cancel_early:
        assert cancel_query_mock.call_args[1]["cancel_query_id"] == query_id
    else:
        assert cancel_query_mock.call_args is None
