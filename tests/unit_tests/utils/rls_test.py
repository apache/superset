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
import pytest
from pytest_mock import MockerFixture

from superset.utils.rls import (
    collect_rls_predicates_for_sql,
    collect_rls_predicates_for_sql_or_raise,
)


def test_rls_predicate_collection_preserves_explicit_failure_policy(
    mocker: MockerFixture,
) -> None:
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"
    database.get_default_catalog.return_value = None
    mocker.patch(
        "superset.utils.rls.get_predicates_for_table",
        side_effect=RuntimeError("metadata unavailable"),
    )

    assert (
        collect_rls_predicates_for_sql(
            "SELECT account_id FROM accounts",
            database,
            catalog=None,
            schema="main",
        )
        == []
    )
    with pytest.raises(RuntimeError, match="metadata unavailable"):
        collect_rls_predicates_for_sql_or_raise(
            "SELECT account_id FROM accounts",
            database,
            catalog=None,
            schema="main",
        )
