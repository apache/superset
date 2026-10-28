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
Shared caches must keep viewers apart when their RLS differs only on a table
read inside a virtual dataset's SQL.

Executing a virtual dataset injects the RLS of every table its SQL reads, so
two viewers with the same rules on the virtual dataset itself but different
rules on an inner table see different rows, and must not share an entry. This
covers the column-values cache, the chart cache key, and the annotation data
cached on a parent chart's entry.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any, TYPE_CHECKING
from unittest.mock import MagicMock

import pytest
from flask_caching.backends import SimpleCache
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.orm.session import Session
from sqlalchemy.pool import StaticPool

from tests.unit_tests.conftest import with_feature_flags

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice
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


def _inner_key(predicate: str) -> str:
    """Expected component binding an RLS predicate to the physical table."""
    from superset.utils import json

    return json.dumps(["rls", None, "main", "t", predicate])


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


@pytest.fixture(params=["physical", "virtual"])
def templated_own_rls(
    request: pytest.FixtureRequest,
    virtual_dataset: SqlaTable,
    session: Session,
    mocker: MockerFixture,
) -> tuple[SqlaTable, SimpleNamespace]:
    """A shared own-RLS rule whose rendered value depends on the viewer."""
    from superset import security_manager
    from superset.connectors.sqla.models import SqlaTable

    datasource = (
        virtual_dataset
        if request.param == "virtual"
        else session.query(SqlaTable).filter_by(table_name="t").one()
    )
    current = SimpleNamespace(name="alpha")
    rule = SimpleNamespace(
        id=1, clause="name = '{{ current_username() }}'", group_key=None
    )
    mocker.patch.object(
        security_manager,
        "get_rls_filters",
        side_effect=lambda table: [rule] if table.id == datasource.id else [],
    )
    mocker.patch(
        "superset.jinja_context.get_username", side_effect=lambda: current.name
    )
    return datasource, current


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
def test_templated_own_rls_partitions_column_values_cache_key(
    templated_own_rls: tuple[SqlaTable, SimpleNamespace],
    data_cache: SimpleCache,
) -> None:
    """Shared templated rules partition keys and cached values by rendered RLS."""
    from superset import security_manager
    from superset.datasource.api import get_cached_column_values

    datasource, current = templated_own_rls

    def values() -> tuple[list[Any], bool]:
        """Read column values through the shared cache."""
        return get_cached_column_values(
            datasource, column_name="name", limit=100, denormalize_column=False
        )

    raw_rls = security_manager.get_rls_cache_key(datasource)
    first_key = _key(datasource)
    assert values() == (["alpha"], False)
    assert values() == (["alpha"], True)
    current.name = "beta"
    assert security_manager.get_rls_cache_key(datasource) == raw_rls
    assert _key(datasource) != first_key
    assert values() == (["beta"], False)
    assert values() == (["beta"], True)


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


def test_cached_column_values_are_served_without_reaching_the_database(
    virtual_dataset: SqlaTable,
    viewer: SimpleNamespace,
    data_cache: SimpleCache,
    mocker: MockerFixture,
) -> None:
    """
    A dynamic-schema engine with an explicit schema does not connect while
    building the key, so a warm cache entry survives a warehouse outage.
    """
    from superset.datasource.api import get_cached_column_values
    from superset.models.sql_lab import Query

    def values() -> tuple[list[Any], bool]:
        return get_cached_column_values(
            virtual_dataset,
            column_name="name",
            limit=100,
            denormalize_column=False,
        )

    # PostgreSQL honors the explicit query schema; SQLite discovers its
    # connection schema through the inspector even when a schema is supplied.
    virtual_dataset.database.sqlalchemy_uri = "postgresql://"
    viewer.name = "alice"
    assert values() == (["alpha"], False)

    # Catch any warehouse discovery path, not just Database.get_default_schema.
    unreachable = mocker.patch.object(
        virtual_dataset.database,
        "get_inspector",
        side_effect=ConnectionError("database unreachable"),
    )
    assert values() == (["alpha"], True)

    query: Query = Query(
        database=virtual_dataset.database,
        schema="main",
        sql="SELECT tenant, name FROM t",
        client_id="client",
    )
    assert query.get_inner_rls_cache_key() == [_inner_key("(tenant = 1)")]
    unreachable.assert_not_called()


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
        assert _inner_key("(tenant = 1)") in datasource.get_extra_cache_keys({})
        assert datasource.get_inner_rls_cache_key() == [_inner_key("(tenant = 1)")]
        viewer.name = "bob"
        assert _inner_key("(tenant = 2)") in datasource.get_extra_cache_keys({})
        assert datasource.get_inner_rls_cache_key() == [_inner_key("(tenant = 2)")]


@pytest.fixture
def guest(mocker: MockerFixture, virtual_dataset: SqlaTable) -> SimpleNamespace:
    """
    Current embedded guest, whose token scopes one RLS rule to the physical
    table ``t`` and none to the virtual dataset that reads it.
    """
    from superset import db, security_manager
    from superset.connectors.sqla import models
    from superset.connectors.sqla.models import SqlaTable

    physical_id = db.session.query(SqlaTable).filter_by(table_name="t").one().id
    current = SimpleNamespace(clause="tenant = 1")

    def get_current_guest_user_if_guest() -> SimpleNamespace:
        rules = [{"dataset": physical_id, "clause": current.clause}]
        return SimpleNamespace(rls=rules, guest_token={"rls_rules": rules})

    mocker.patch.object(
        security_manager,
        "get_current_guest_user_if_guest",
        new=get_current_guest_user_if_guest,
    )
    mocker.patch.object(security_manager, "get_rls_filters", return_value=[])
    # Guest rules only apply with embedding on. Patched where the RLS filters
    # read it, so a flag callback left by another test cannot override it.
    is_feature_enabled = models.is_feature_enabled
    mocker.patch.object(
        models,
        "is_feature_enabled",
        new=lambda flag: flag == "EMBEDDED_SUPERSET" or is_feature_enabled(flag),
    )
    # Guests have no user id, so it cannot tell two guests' entries apart.
    mocker.patch(
        "superset.common.query_context_processor.get_user_id", return_value=None
    )
    return current


@pytest.fixture
def source_chart(
    mocker: MockerFixture, session: Session, virtual_dataset: SqlaTable
) -> Slice:
    """An annotation source chart on the virtual dataset."""
    from superset.models.slice import Slice

    chart = Slice(
        slice_name="source",
        viz_type="line",
        datasource_type="table",
        datasource_id=virtual_dataset.id,
    )
    session.add(chart)
    session.flush()
    mocker.patch(
        "superset.common.query_context_processor.ChartDAO.find_by_id",
        return_value=chart,
    )
    return chart


def _annotation_context(chart: Slice) -> dict[str, Any]:
    from superset.common.query_context_processor import QueryContextProcessor

    query = MagicMock(
        annotation_layers=[{"sourceType": "line", "name": "a", "value": chart.id}]
    )
    # The context reads nothing from the processor's query context.
    processor = QueryContextProcessor.__new__(QueryContextProcessor)
    return processor._annotation_cache_context(query)


def test_annotation_context_partitions_guests_by_inner_table_rls(
    guest: SimpleNamespace, source_chart: Slice
) -> None:
    """Guests with different rules on the source's inner table get different keys."""
    guest.clause = "tenant = 1"
    first = _annotation_context(source_chart)
    guest.clause = "tenant = 2"
    second = _annotation_context(source_chart)

    # The source dataset's own rules are the same for both guests, so only the
    # inner-table rules can keep their annotation data apart.
    assert first["source_rls"] == second["source_rls"]
    assert first != second
    assert first["source_inner_rls"] == {
        str(source_chart.id): [_inner_key("(tenant = 1)")]
    }
    assert second["source_inner_rls"] == {
        str(source_chart.id): [_inner_key("(tenant = 2)")]
    }


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
def test_templated_own_rls_partitions_annotation_context(
    templated_own_rls: tuple[SqlaTable, SimpleNamespace],
    source_chart: Slice,
    mocker: MockerFixture,
) -> None:
    """Rendered source rules isolate annotation entries even without a user id."""
    datasource, current = templated_own_rls
    mocker.patch(
        "superset.common.query_context_processor.QueryContextProcessor."
        "_annotation_source_datasource",
        return_value=datasource,
    )
    mocker.patch(
        "superset.common.query_context_processor.get_user_id", return_value=None
    )
    first = _annotation_context(source_chart)
    first_chart_keys = datasource.get_extra_cache_keys(
        {"columns": ["name"], "is_timeseries": False}
    )
    current.name = "beta"
    second = _annotation_context(source_chart)
    assert first["source_rls"] == second["source_rls"]
    assert first != second
    assert (
        datasource.get_extra_cache_keys({"columns": ["name"], "is_timeseries": False})
        != first_chart_keys
    )


def test_annotation_context_shares_entry_for_equal_inner_table_rls(
    guest: SimpleNamespace, source_chart: Slice
) -> None:
    """Guests with identical effective rules keep sharing one entry."""
    guest.clause = "tenant = 1"
    first = _annotation_context(source_chart)
    second = _annotation_context(source_chart)

    assert first == second


def test_annotation_context_falls_back_to_viewer_scoped_key(
    guest: SimpleNamespace, source_chart: Slice, mocker: MockerFixture
) -> None:
    """If the inner predicates can't be collected, the key is viewer-scoped."""
    mocker.patch("superset.sql.parse.SQLScript", side_effect=ValueError("bad sql"))

    guest.clause = "tenant = 1"
    first = _annotation_context(source_chart)
    guest.clause = "tenant = 2"
    second = _annotation_context(source_chart)

    assert first != second


def test_annotation_context_shape_unchanged_without_inner_rls(
    viewer: SimpleNamespace, source_chart: Slice
) -> None:
    """A source with no inner-table rules keeps the existing context shape."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable

    physical = db.session.query(SqlaTable).filter_by(table_name="t").one()
    source_chart.datasource_id = physical.id
    db.session.flush()
    db.session.expire(source_chart)

    assert set(_annotation_context(source_chart)) == {
        "user_id",
        "source_rls",
        "semantic_filter_protocol",
        "source_versions",
    }


@pytest.fixture(params=[False, True], ids=["user", "guest"])
def swapped_inner_rules(
    request: pytest.FixtureRequest,
    mocker: MockerFixture,
    virtual_dataset: SqlaTable,
    session: Session,
) -> SimpleNamespace:
    """Two scopes swap the same predicates between two different inner tables."""
    from superset import security_manager
    from superset.connectors.sqla import models
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    with virtual_dataset.database.get_sqla_engine() as engine:
        connection = engine.raw_connection()
        connection.execute("CREATE TABLE u (tenant INTEGER)")
        connection.execute("INSERT INTO u VALUES (1), (2)")
        connection.commit()
    other = SqlaTable(
        database=virtual_dataset.database,
        schema="main",
        table_name="u",
        columns=[TableColumn(column_name="tenant")],
    )
    session.add(other)
    virtual_dataset.sql = "SELECT t.tenant, t.name FROM t CROSS JOIN u"
    session.flush()
    physical = session.query(SqlaTable).filter_by(table_name="t").one()
    current = SimpleNamespace(swapped=False)

    def clause(table_name: str) -> str:
        """Return the rule attached to a table under the active scope."""
        tenant = 1 if (table_name == "t") != current.swapped else 2
        return f"tenant = {tenant}"

    if request.param:

        def guest_user() -> SimpleNamespace:
            """Build a guest token with dataset-scoped rules."""
            rules = [
                {"dataset": table.id, "clause": clause(table.table_name)}
                for table in (physical, other)
            ]
            return SimpleNamespace(rls=rules, guest_token={"rls_rules": rules})

        mocker.patch.object(
            security_manager, "get_current_guest_user_if_guest", new=guest_user
        )
        mocker.patch.object(security_manager, "get_rls_filters", return_value=[])
        is_feature_enabled = models.is_feature_enabled
        mocker.patch.object(
            models,
            "is_feature_enabled",
            new=lambda flag: flag == "EMBEDDED_SUPERSET" or is_feature_enabled(flag),
        )
    else:

        def filters(table: Any) -> list[SimpleNamespace]:
            """Return the registered rule for each inner table."""
            if table.table_name not in {"t", "u"}:
                return []
            return [
                SimpleNamespace(id=1, clause=clause(table.table_name), group_key=None)
            ]

        mocker.patch.object(security_manager, "get_rls_filters", new=filters)
    mocker.patch(
        "superset.common.query_context_processor.get_user_id", return_value=None
    )
    return current


@pytest.mark.parametrize("datasource_type", ["virtual", "query"])
def test_every_inner_table_contributes_its_own_component(
    virtual_dataset: SqlaTable,
    swapped_inner_rules: SimpleNamespace,
    datasource_type: str,
) -> None:
    """Each referenced table contributes its own qualified RLS component."""
    from superset.models.sql_lab import Query
    from superset.utils import json

    datasource = (
        virtual_dataset
        if datasource_type == "virtual"
        else Query(
            database=virtual_dataset.database,
            schema="main",
            sql=virtual_dataset.sql,
            client_id="client",
        )
    )
    assert datasource.get_inner_rls_cache_key() == sorted(
        [
            _inner_key("(tenant = 1)"),
            json.dumps(["rls", None, "main", "u", "(tenant = 2)"]),
        ]
    )


def test_swapped_table_rules_do_not_share_cached_column_values(
    virtual_dataset: SqlaTable,
    swapped_inner_rules: SimpleNamespace,
    data_cache: SimpleCache,
) -> None:
    """Equal predicate sets are not equal scopes when their tables differ."""
    from superset.datasource.api import get_cached_column_values

    def values(force: bool = False) -> tuple[list[Any], bool]:
        """Fetch the distinct names under the active scope."""
        return get_cached_column_values(
            virtual_dataset,
            column_name="name",
            limit=100,
            denormalize_column=False,
            force=force,
        )

    first_key = _key(virtual_dataset)
    first_chart_keys = virtual_dataset.get_extra_cache_keys({})
    assert values() == (["alpha"], False)
    swapped_inner_rules.swapped = True
    # Confirm execution returns different rows before testing the cache hit.
    assert values(force=True) == (["beta"], False)
    assert first_key != _key(virtual_dataset)
    assert first_chart_keys != virtual_dataset.get_extra_cache_keys({})
    swapped_inner_rules.swapped = False
    assert values() == (["alpha"], True)


def test_swapped_table_rules_do_not_share_annotation_context(
    source_chart: Slice, swapped_inner_rules: SimpleNamespace
) -> None:
    """An annotation fingerprint binds each predicate to its inner table."""
    first = _annotation_context(source_chart)
    swapped_inner_rules.swapped = True
    second = _annotation_context(source_chart)
    assert first["source_rls"] == second["source_rls"]
    assert first != second


def test_swapped_table_rules_do_not_share_query_keys(
    virtual_dataset: SqlaTable, swapped_inner_rules: SimpleNamespace
) -> None:
    """SQL Lab query fingerprints also preserve the predicate/table binding."""
    from superset.models.sql_lab import Query

    query = Query(
        database=virtual_dataset.database,
        schema="main",
        sql=virtual_dataset.sql,
        client_id="client",
    )
    first = _key(query)
    first_chart_keys = query.get_extra_cache_keys({})
    swapped_inner_rules.swapped = True
    assert first != _key(query)
    assert first_chart_keys != query.get_extra_cache_keys({})


@pytest.mark.parametrize("failure", ["parse", "resolve"])
def test_guest_column_values_fail_closed(
    guest: SimpleNamespace,
    virtual_dataset: SqlaTable,
    mocker: MockerFixture,
    failure: str,
) -> None:
    """Both parse and table-resolution failures isolate embedded guest scopes."""
    target = (
        "superset.sql.parse.SQLScript"
        if failure == "parse"
        else "superset.utils.rls.find_datasets"
    )
    mocker.patch(target, side_effect=ValueError("cannot resolve inner tables"))
    first = _key(virtual_dataset)
    guest.clause = "tenant = 2"
    assert first != _key(virtual_dataset)


@pytest.mark.parametrize("datasource_type", ["virtual", "query"])
def test_schema_lookup_outage_serves_viewer_scoped_column_values(
    virtual_dataset: SqlaTable,
    viewer: SimpleNamespace,
    data_cache: SimpleCache,
    mocker: MockerFixture,
    datasource_type: str,
) -> None:
    """Schema resolution failures allow scoped cache hits, never cross-viewer hits."""
    from superset.datasource.api import get_cached_column_values
    from superset.models.sql_lab import Query

    virtual_dataset.schema = None
    datasource = (
        virtual_dataset
        if datasource_type == "virtual"
        else Query(
            database=virtual_dataset.database,
            sql=virtual_dataset.sql,
            client_id="client",
        )
    )
    mocker.patch.object(
        datasource.database,
        "resolve_query_default_schema",
        side_effect=ConnectionError("database unreachable"),
    )
    mocker.patch("superset.utils.rls.get_user_id", side_effect=lambda: viewer.name)
    fetch = mocker.patch.object(datasource, "values_for_column", return_value=["alpha"])

    def values() -> tuple[list[Any], bool]:
        """Read through the column-values cache under the active viewer."""
        return get_cached_column_values(
            datasource, column_name="name", limit=100, denormalize_column=False
        )

    # A fallback entry can be populated when schema introspection fails but
    # execution succeeds; a healthy predicate-keyed entry is not reused blindly.
    assert values() == (["alpha"], False)
    fetch.side_effect = ConnectionError("database unreachable")
    assert values() == (["alpha"], True)
    fetch.assert_called_once()
    alice_key = _key(datasource)
    alice_chart_keys = datasource.get_extra_cache_keys({})
    viewer.name = "bob"
    assert datasource.get_extra_cache_keys({}) != alice_chart_keys
    assert _key(datasource) != alice_key
    with pytest.raises(ConnectionError):
        values()


def test_schema_lookup_outage_builds_guest_annotation_context(
    virtual_dataset: SqlaTable,
    guest: SimpleNamespace,
    source_chart: Slice,
    mocker: MockerFixture,
) -> None:
    """Annotation and chart keys survive schema outages without sharing guest scopes."""
    virtual_dataset.schema = None
    mocker.patch.object(
        virtual_dataset.database,
        "resolve_query_default_schema",
        side_effect=ConnectionError("database unreachable"),
    )
    first = _annotation_context(source_chart)
    first_chart_keys = virtual_dataset.get_extra_cache_keys({})
    assert first["source_inner_rls"][str(source_chart.id)]
    assert first == _annotation_context(source_chart)
    guest.clause = "tenant = 2"
    assert first != _annotation_context(source_chart)
    assert first_chart_keys != virtual_dataset.get_extra_cache_keys({})


@pytest.mark.parametrize("datasource_type", ["virtual", "query"])
@pytest.mark.parametrize("default_schema", ["main", None])
def test_schema_less_keys_preserve_resolved_table_rls(
    virtual_dataset: SqlaTable,
    viewer: SimpleNamespace,
    mocker: MockerFixture,
    datasource_type: str,
    default_schema: str | None,
) -> None:
    """Lazy schema resolution retains table identity and effective RLS on success."""
    from superset.models.sql_lab import Query

    virtual_dataset.schema = None
    virtual_dataset.sql = (
        "SELECT tenant, name FROM t"
        if default_schema
        else "SELECT tenant, name FROM main.t"
    )
    datasource = (
        virtual_dataset
        if datasource_type == "virtual"
        else Query(
            database=virtual_dataset.database,
            sql=virtual_dataset.sql,
            client_id="client",
        )
    )
    resolve = mocker.patch.object(
        datasource.database, "resolve_query_default_schema", return_value=default_schema
    )
    assert datasource.get_inner_rls_cache_key() == [_inner_key("(tenant = 1)")]
    resolve.assert_called_once_with(
        datasource.sql,
        datasource.schema,
        datasource.catalog,
        datasource.template_params_dict,
    )
    first = _key(datasource)
    viewer.name = "bob"
    assert datasource.get_inner_rls_cache_key() == [_inner_key("(tenant = 2)")]
    assert _key(datasource) != first


@pytest.mark.parametrize("datasource_type", ["virtual", "query", "physical"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_expression_schema_outage_keeps_chart_keys_viewer_scoped(
    virtual_dataset: SqlaTable,
    viewer: SimpleNamespace,
    mocker: MockerFixture,
    datasource_type: str,
) -> None:
    """Expression-only table reads retain isolation when schema discovery fails."""
    from superset.models.sql_lab import Query

    datasource: SqlaTable | Query = virtual_dataset
    if datasource_type == "query":
        datasource = Query(
            database=virtual_dataset.database, sql="SELECT 1", client_id="client"
        )
    elif datasource_type == "physical":
        datasource.sql = None
    else:
        datasource.sql = "SELECT 1"
    mocker.patch.object(
        datasource, "_get_rls_schema", side_effect=ConnectionError("unreachable")
    )
    mocker.patch("superset.utils.rls.get_user_id", side_effect=lambda: viewer.name)

    def keys() -> list[Any]:
        """Collect keys with independent expression subqueries enabled."""
        return datasource.get_extra_cache_keys(
            {
                "columns": [
                    {"sqlExpression": "(SELECT MAX(tenant) FROM t)", "label": "x"}
                ]
            }
        )

    assert keys() == ["rls-predicate-parse-failed-for-user-alice"]
    viewer.name = "bob"
    assert keys() == ["rls-predicate-parse-failed-for-user-bob"]
