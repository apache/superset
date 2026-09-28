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
"""
Session hygiene for the RLS fallback in ``get_from_clause``.

When RLS injection fails, the handler re-queries to decide whether the query
can run without it. That retry issues its own ``db.session`` work and rebuilds
an engine, so it can re-poison the session the outer handler just rolled back.
Failing closed raises ``QueryObjectValidationError``, which callers catch and
carry on from, so a session left in "pending rollback" state would surface on
whatever they do next.
"""

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.exc import SQLAlchemyError

from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import QueryObjectValidationError


def _virtual_dataset(mocker: MockerFixture) -> SqlaTable:
    dataset = SqlaTable(table_name="virtual", sql="SELECT * FROM t", database_id=1)
    mocker.patch.object(
        type(dataset), "database", mocker.PropertyMock(return_value=mocker.MagicMock())
    )
    return dataset


def test_retry_db_error_rolls_back_session(mocker: MockerFixture) -> None:
    """A DB error in the fail-closed retry repairs the session before raising."""
    mocker.patch(
        "superset.models.helpers.apply_rls",
        side_effect=SQLAlchemyError("connection lost"),
    )
    mocker.patch(
        "superset.models.helpers.get_predicates_for_table",
        side_effect=SQLAlchemyError("still broken"),
    )
    session = mocker.patch("superset.models.helpers.db").session

    dataset = _virtual_dataset(mocker)
    with pytest.raises(QueryObjectValidationError):
        dataset.get_from_clause()

    # Once for the outer handler, once for the retry that re-poisoned it.
    assert session.rollback.call_count == 2


def test_retry_non_db_error_does_not_roll_back_again(mocker: MockerFixture) -> None:
    """A non-DB failure in the retry touches no session, so it rolls back once."""
    mocker.patch(
        "superset.models.helpers.apply_rls",
        side_effect=SQLAlchemyError("connection lost"),
    )
    mocker.patch(
        "superset.models.helpers.get_predicates_for_table",
        side_effect=ValueError("cannot parse"),
    )
    session = mocker.patch("superset.models.helpers.db").session

    dataset = _virtual_dataset(mocker)
    with pytest.raises(QueryObjectValidationError):
        dataset.get_from_clause()

    assert session.rollback.call_count == 1
