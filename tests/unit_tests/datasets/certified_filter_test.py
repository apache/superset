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
from typing import Any
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects import sqlite

from superset.datasets.filters import dataset_certified_clause, DatasetCertifiedFilter


def _sql(clause: Any) -> str:
    return str(clause.compile(dialect=sqlite.dialect()))


def test_certified_clause_matches_the_certification_key() -> None:
    assert "LIKE" in _sql(dataset_certified_clause(True)).upper()
    assert "NOT LIKE" not in _sql(dataset_certified_clause(True)).upper()


def test_uncertified_clause_also_matches_datasets_without_extra() -> None:
    sql = _sql(dataset_certified_clause(False)).upper()

    assert "NOT LIKE" in sql
    assert "IS NULL" in sql


@pytest.mark.parametrize("value", [True, False])
def test_certified_filter_applies_the_clause(value: bool) -> None:
    query = MagicMock()

    result = DatasetCertifiedFilter("id", MagicMock()).apply(query, value)

    query.filter.assert_called_once()
    assert result is query.filter.return_value


def test_certified_filter_leaves_the_query_alone_for_other_values() -> None:
    query = MagicMock()

    result = DatasetCertifiedFilter("id", MagicMock()).apply(query, None)  # type: ignore[arg-type]

    query.filter.assert_not_called()
    assert result is query
