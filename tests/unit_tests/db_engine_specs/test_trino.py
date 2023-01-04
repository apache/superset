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
from unittest import mock


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
