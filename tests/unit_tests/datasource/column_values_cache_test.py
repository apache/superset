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
The shared column-values cache must keep viewers apart when their RLS differs
only on a table read inside a virtual dataset's SQL.

Executing a virtual dataset injects the RLS of every table its SQL reads, so
two viewers with the same rules on the virtual dataset itself but different
rules on an inner table see different values, and must not share an entry.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any, TYPE_CHECKING

import pytest
from flask_caching.backends import SimpleCache
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.orm.session import Session
from sqlalchemy.pool import StaticPool

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.sql_lab import Query

# Per-viewer RLS rules on the physical table ``t``; neither viewer has a rule on
# the virtual dataset that reads it.
INNER_RLS: dict[str, str] = {
    "alice": "tenant = 1",
    "bob": "tenant = 2",
    "carol": "tenant = 1",
}


@pytest.fixture
def viewer(mocker: MockerFixture) -> SimpleNamespace:
    """Current viewer, and RLS rules that depend on it and on the dataset."""
    from superset import security_manager

    current = SimpleNamespace(name="alice")

    def get_rls_filters(table: Any) -> list[SimpleNamespace]:
        if getattr(table, "table_name", None) != "t":
            return []
        return [SimpleNamespace(id=1, clause=INNER_RLS[current.name], group_key=None)]

    mocker.patch.object(security_manager, "get_rls_filters", new=get_rls_filters)
    return current


@pytest.fixture
def data_cache(mocker: MockerFixture) -> SimpleCache:
    cache = SimpleCache()
    mocker.patch("superset.datasource.api.cache_manager", data_cache=cache)
    return cache


@pytest.fixture
def virtual_dataset(mocker: MockerFixture, session: Session) -> Iterator[SqlaTable]:
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    connection = engine.raw_connection()
    connection.execute("CREATE TABLE t (tenant INTEGER, name TEXT)")
    connection.execute("INSERT INTO t VALUES (1, 'alpha'), (2, 'beta')")
    connection.commit()

    database = Database(database_name="db", sqlalchemy_uri="sqlite://")

    @contextmanager
    def get_sqla_engine(*args: Any, **kwargs: Any) -> Iterator[Any]:
        yield engine

    mocker.patch.object(database, "get_sqla_engine", new=get_sqla_engine)

    physical = SqlaTable(
        database=database,
        schema="main",
        table_name="t",
        columns=[TableColumn(column_name="tenant"), TableColumn(column_name="name")],
    )
    virtual = SqlaTable(
        database=database,
        schema="main",
        table_name="v",
        sql="SELECT tenant, name FROM t",
        columns=[TableColumn(column_name="tenant"), TableColumn(column_name="name")],
    )
    session.add_all([database, physical, virtual])
    session.flush()
    yield virtual
    session.rollback()


def _key(datasource: Any) -> str:
    from superset.datasource.api import _column_values_cache_key

    return _column_values_cache_key(datasource, {"col": "name"})


def test_inner_table_rls_partitions_column_values_cache_key(
    virtual_dataset: SqlaTable, viewer: SimpleNamespace
) -> None:
    """Different RLS on a table inside the virtual SQL yields different keys."""
    viewer.name = "alice"
    alice_key = _key(virtual_dataset)
    viewer.name = "bob"
    bob_key = _key(virtual_dataset)

    assert alice_key != bob_key


def test_inner_table_rls_viewers_only_see_their_own_cached_values(
    virtual_dataset: SqlaTable, viewer: SimpleNamespace, data_cache: SimpleCache
) -> None:
    """A viewer is never served values cached for another viewer's inner RLS."""
    from superset.datasource.api import get_cached_column_values

    def values() -> tuple[list[Any], bool]:
        return get_cached_column_values(
            virtual_dataset,
            column_name="name",
            limit=100,
            denormalize_column=False,
        )

    viewer.name = "alice"
    assert values() == (["alpha"], False)
    assert values() == (["alpha"], True)

    viewer.name = "bob"
    assert values() == (["beta"], False)
    assert values() == (["beta"], True)


def test_same_inner_table_rls_shares_column_values_cache_key(
    virtual_dataset: SqlaTable, viewer: SimpleNamespace
) -> None:
    """Different viewers with identical effective RLS keep sharing one entry."""
    viewer.name = "alice"
    alice_key = _key(virtual_dataset)
    viewer.name = "carol"
    carol_key = _key(virtual_dataset)

    assert alice_key == carol_key


def test_physical_dataset_key_has_no_inner_rls_component(
    virtual_dataset: SqlaTable, viewer: SimpleNamespace
) -> None:
    """A physical dataset's key bytes are unchanged: its own RLS covers it."""
    import hashlib

    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.utils import json

    physical = db.session.query(SqlaTable).filter_by(table_name="t").one()

    def legacy_key(rls: list[str]) -> str:
        material = {
            "col": "name",
            "uid": physical.uid,
            "rls": rls,
            "changed_on": str(physical.changed_on or ""),
        }
        digest = hashlib.sha256(json.dumps(material, sort_keys=True).encode())
        return "col_values:" + digest.hexdigest()

    viewer.name = "alice"
    assert _key(physical) == legacy_key(["tenant = 1-"])
    viewer.name = "bob"
    assert _key(physical) == legacy_key(["tenant = 2-"])


def test_query_inner_table_rls_partitions_column_values_cache_key(
    virtual_dataset: SqlaTable, viewer: SimpleNamespace
) -> None:
    """A SQL Lab query datasource keys on the RLS of the tables it reads."""
    from superset.models.sql_lab import Query

    query: Query = Query(
        database=virtual_dataset.database,
        schema="main",
        sql="SELECT tenant, name FROM t",
        client_id="client",
    )

    viewer.name = "alice"
    alice_key = _key(query)
    viewer.name = "bob"
    bob_key = _key(query)

    assert alice_key != bob_key


def test_inner_rls_collection_failure_falls_back_to_viewer_scoped_key(
    virtual_dataset: SqlaTable, viewer: SimpleNamespace, mocker: MockerFixture
) -> None:
    """If the inner predicates can't be collected, the key is viewer-scoped."""
    mocker.patch("superset.sql.parse.SQLScript", side_effect=ValueError("bad sql"))
    user_ids = iter([1, 2])
    mocker.patch("superset.utils.rls.get_user_id", side_effect=lambda: next(user_ids))

    viewer.name = "alice"
    alice_key = _key(virtual_dataset)
    viewer.name = "bob"
    bob_key = _key(virtual_dataset)

    assert alice_key != bob_key


def test_chart_cache_key_carries_the_same_inner_rls(
    virtual_dataset: SqlaTable, viewer: SimpleNamespace
) -> None:
    """The chart cache key keys on the same inner predicates as column values."""
    from superset.models.sql_lab import Query

    query: Query = Query(
        database=virtual_dataset.database,
        schema="main",
        sql="SELECT tenant, name FROM t",
        client_id="client",
    )
    for datasource in (virtual_dataset, query):
        viewer.name = "alice"
        assert "(tenant = 1)" in datasource.get_extra_cache_keys({})
        assert datasource.get_inner_rls_cache_key() == ["(tenant = 1)"]
        viewer.name = "bob"
        assert "(tenant = 2)" in datasource.get_extra_cache_keys({})
        assert datasource.get_inner_rls_cache_key() == ["(tenant = 2)"]
