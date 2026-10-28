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
RLS on the inner SQL of a chart built on a SQL Lab ``Query`` datasource.

``get_from_clause`` skips a virtual dataset's own RLS and the global guest RLS
in its inner SQL, since the outer ``WHERE`` already applies them. A ``Query``
applies no RLS outside its SQL, and its ``id`` is the query's id, which is
unrelated to dataset ids, so it must not be used to skip the RLS of whichever
dataset happens to share that number.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import QueryObjectValidationError
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.security.guest_token import (
    GuestTokenResourceType,
    GuestTokenRlsRule,
    GuestUser,
)
from superset.utils import json

PREDICATE = "tenant_id = 1"


def _row_level_filters(self: Any, include_global_guest_rls: bool = True) -> list[Any]:
    return [text(PREDICATE)] if self.table_name == "t" else []


@pytest.fixture
def global_guest_rule() -> Iterator[None]:
    """
    Run as a guest whose token carries a global (not dataset-scoped) RLS rule,
    through the real ``SqlaTable.get_sqla_row_level_filters``.
    """
    guest = GuestUser(
        token={
            "user": {},
            "resources": [
                {"type": GuestTokenResourceType.DASHBOARD, "id": "dashboard-uuid"}
            ],
            "rls_rules": [GuestTokenRlsRule(dataset=None, clause=PREDICATE)],
            "iat": 10,
            "exp": 20,
        },
        roles=[],
    )
    with (
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=True,
        ),
        patch.object(security_manager, "get_rls_filters", return_value=[]),
        patch.object(
            security_manager, "get_current_guest_user_if_guest", return_value=guest
        ),
    ):
        yield


@pytest.fixture
def database(session: Session) -> Database:
    SqlaTable.metadata.create_all(session.get_bind())
    database = Database(database_name="rls_query_db", sqlalchemy_uri="sqlite://")
    # The dataset with RLS on table ``t`` has id 7.
    session.add_all(
        [database, SqlaTable(id=7, table_name="t", schema="main", database=database)]
    )
    session.flush()
    return database


@pytest.mark.parametrize("query_id", [7, 8])
def test_query_datasource_inner_sql_gets_rls_of_dataset_sharing_its_id(
    query_id: int,
    database: Database,
    session: Session,
) -> None:
    """
    A ``Query`` whose id equals the id of the dataset with RLS on the table it
    reads still gets that dataset's predicate injected into its SQL.
    """
    query = Query(
        id=query_id,
        client_id=f"rls{query_id}",
        database=database,
        schema="main",
        sql="SELECT * FROM t",
    )
    session.add(query)
    session.flush()

    with patch.object(
        SqlaTable,
        "get_sqla_row_level_filters",
        autospec=True,
        side_effect=_row_level_filters,
    ):
        from_clause, _ = query.get_from_clause()

    assert PREDICATE in str(from_clause)


def test_query_datasource_fail_closed_counts_rls_of_dataset_sharing_its_id(
    database: Database,
    session: Session,
) -> None:
    """
    When RLS injection fails, the fail-closed check also counts the RLS of the
    dataset sharing the ``Query``'s id, so the query is refused rather than run
    without the predicate.
    """
    query = Query(
        id=7,
        client_id="rls-fail",
        database=database,
        schema="main",
        sql="SELECT * FROM t",
    )
    session.add(query)
    session.flush()

    with (
        patch.object(
            SqlaTable,
            "get_sqla_row_level_filters",
            autospec=True,
            side_effect=_row_level_filters,
        ),
        patch(
            "superset.models.helpers.apply_rls",
            side_effect=ValueError("cannot inject"),
        ),
        patch("superset.models.helpers.db.session.rollback"),
        pytest.raises(QueryObjectValidationError),
    ):
        query.get_from_clause()


def test_virtual_dataset_inner_sql_skips_its_own_rls(
    database: Database,
    session: Session,
) -> None:
    """
    A virtual dataset still skips its own RLS in its inner SQL, where the outer
    ``WHERE`` already applies it.
    """
    dataset = SqlaTable(
        table_name="t",
        schema="other",
        sql="SELECT * FROM other.t",
        database=database,
    )
    session.add(dataset)
    session.flush()

    def row_level_filters(
        self: Any, include_global_guest_rls: bool = True
    ) -> list[Any]:
        return [text(PREDICATE)] if self.id == dataset.id else []

    # The virtual dataset's own table name and schema match the table its SQL
    # reads, so without the exclusion its own predicate would be injected.
    with patch.object(
        SqlaTable,
        "get_sqla_row_level_filters",
        autospec=True,
        side_effect=row_level_filters,
    ):
        from_clause, _ = dataset.get_from_clause()

    assert PREDICATE not in str(from_clause)


def test_query_datasource_inner_sql_gets_global_guest_rls(
    database: Database,
    session: Session,
    global_guest_rule: None,
) -> None:
    """
    A ``Query`` applies no RLS outside its SQL, so the global guest rules are
    injected into its SQL rather than left to an outer query.
    """
    query = Query(
        id=8,
        client_id="rls-guest",
        database=database,
        schema="main",
        sql="SELECT * FROM t",
    )
    session.add(query)
    session.flush()

    from_clause, _ = query.get_from_clause()

    assert PREDICATE in str(from_clause)


def test_query_datasource_fail_closed_counts_global_guest_rls(
    database: Database,
    session: Session,
    global_guest_rule: None,
) -> None:
    """
    When RLS injection fails, the fail-closed check counts the global guest
    rules for a ``Query``, so the query is refused rather than run without them.
    """
    query = Query(
        id=8,
        client_id="rls-guest-fail",
        database=database,
        schema="main",
        sql="SELECT * FROM t",
    )
    session.add(query)
    session.flush()

    with (
        patch(
            "superset.models.helpers.apply_rls",
            side_effect=ValueError("cannot inject"),
        ),
        patch("superset.models.helpers.db.session.rollback"),
        pytest.raises(QueryObjectValidationError),
    ):
        query.get_from_clause()


def test_virtual_dataset_inner_sql_skips_global_guest_rls(
    database: Database,
    session: Session,
    global_guest_rule: None,
) -> None:
    """
    A virtual dataset still leaves the global guest rules out of its inner SQL,
    where its outer ``WHERE`` applies them.
    """
    dataset = SqlaTable(
        table_name="v",
        schema="main",
        sql="SELECT * FROM t",
        database=database,
    )
    session.add(dataset)
    session.flush()

    from_clause, _ = dataset.get_from_clause()

    assert PREDICATE not in str(from_clause)


def test_query_datasource_cache_key_has_rls_of_dataset_sharing_its_id(
    database: Database,
    session: Session,
) -> None:
    """
    The cache key of a ``Query`` keys on the RLS its SQL is run with, including
    that of the dataset sharing the query's id.
    """
    query = Query(
        id=7,
        client_id="rls-key",
        database=database,
        schema="main",
        sql="SELECT * FROM t",
    )
    session.add(query)
    session.flush()

    with patch.object(
        SqlaTable,
        "get_sqla_row_level_filters",
        autospec=True,
        side_effect=_row_level_filters,
    ):
        cache_keys = query.get_extra_cache_keys({})

    assert cache_keys == [json.dumps(["rls", None, "main", "t", PREDICATE])]
