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

from collections.abc import Iterator
from pathlib import Path
from unittest.mock import MagicMock

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from superset.common.query_context_processor import QueryContextProcessor
from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.exceptions import QueryObjectValidationError
from superset.models.core import Database
from superset.models.sql_lab import Query


@pytest.mark.parametrize(
    "sql", ["SELECT col1 FROM physical", "SELECT col1 FROM main.physical"]
)
@pytest.mark.parametrize("cached", [False, True])
@pytest.mark.parametrize("with_rls", [False, True])
@pytest.mark.parametrize("datasource_class", [SqlaTable, Query])
@pytest.mark.parametrize("dynamic_schema", [False, True])
def test_virtual_dataset_avoids_schema_connections(
    mocker: MockerFixture,
    tmp_path: Path,
    app_context: None,
    cached: bool,
    with_rls: bool,
    sql: str,
    datasource_class: type[SqlaTable] | type[Query],
    dynamic_schema: bool,
) -> None:
    """Dynamic or statically proven schemas need no introspection connections."""
    uri = f"sqlite:///{tmp_path / 'analytic.db'}"
    engine = create_engine(uri, poolclass=NullPool)
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE physical (col1 INTEGER)")
        connection.exec_driver_sql("INSERT INTO physical VALUES (1), (2)")
    connections = MagicMock()
    event.listen(engine, "connect", connections)
    database = Database(id=1, database_name="analytic", sqlalchemy_uri=uri)
    mocker.patch.object(database, "_get_sqla_engine", return_value=engine)
    mocker.patch.object(
        database.db_engine_spec, "supports_dynamic_schema", dynamic_schema
    )
    if not dynamic_schema:
        # Model a schema encoded in connection parameters, without an inspector probe.
        mocker.patch.object(
            database.db_engine_spec,
            "get_schema_from_engine_params",
            return_value="main",
        )
    physical = SqlaTable(id=1, table_name="physical", schema="main", database=database)
    virtual = datasource_class(
        id=2,
        sql=sql,
        schema="main",
        database=database,
    )
    if isinstance(virtual, SqlaTable):
        virtual.table_name = "virtual"
        virtual.columns = [TableColumn(column_name="col1", type="INTEGER")]
    else:
        virtual.extra = {
            "columns": [{"column_name": "col1", "type": "INTEGER", "is_dttm": False}]
        }
    rule = MagicMock(clause="col1 = 1", group_key=None)
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        side_effect=lambda dataset: [rule] if with_rls and dataset.id == 1 else [],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch("superset.utils.rls.find_datasets", return_value=[physical])
    mocker.patch(
        "superset.common.query_context_processor.security_manager.get_rls_cache_key",
        return_value=[],
    )
    context = MagicMock(
        datasource=virtual,
        force=False,
        is_async_execution=False,
        custom_cache_timeout=300,
        result_type="full",
    )
    processor = QueryContextProcessor(context)
    query = QueryObject(datasource=virtual, columns=["col1"], metrics=[])
    cache = MagicMock(is_loaded=cached, status="success", bq_memory_limited=False)
    cache.df = pd.DataFrame({"col1": [1] if with_rls else [1, 2]})
    mocker.patch(
        "superset.common.query_context_processor.QueryCacheManager.get",
        return_value=cache,
    )
    cache_key = mocker.spy(query, "cache_key")
    result = processor.get_df_payload_result(query)

    assert cache_key.call_args.kwargs["extra_cache_keys"] == (
        ["(col1 = 1)"] if with_rls else []
    )

    assert result.payload["status"] == "success"
    if not cached:
        query_result = cache.set_query_result.call_args.kwargs["query_result"]
        assert query_result.df["col1"].tolist() == ([1] if with_rls else [1, 2])
    assert connections.call_count == (0 if cached else 1)
    engine.dispose()


@pytest.mark.parametrize("schema", [None, ""])
@pytest.mark.parametrize("datasource_class", [SqlaTable, Query])
@pytest.mark.parametrize("dynamic_schema", [False, True])
def test_virtual_dataset_preserves_default_schema_fallback(
    mocker: MockerFixture,
    app_context: None,
    schema: str | None,
    datasource_class: type[SqlaTable] | type[Query],
    dynamic_schema: bool,
) -> None:
    """Datasets without a schema still resolve the default for both RLS paths."""
    database = Database(database_name="analytic", sqlalchemy_uri="sqlite://")
    virtual = datasource_class(
        id=2,
        sql="SELECT col1 FROM physical",
        schema=schema,
        database=database,
    )
    mocker.patch.object(
        database.db_engine_spec, "supports_dynamic_schema", dynamic_schema
    )
    default_schema = mocker.patch.object(
        database.db_engine_spec, "get_default_schema", return_value="main"
    )
    collect = mocker.patch(
        "superset.utils.rls.collect_rls_predicates_for_sql", return_value=[]
    )
    apply = mocker.patch("superset.models.helpers.apply_rls", return_value=False)

    virtual.get_extra_cache_keys({})
    assert collect.call_args.args[3] == "main"
    virtual.get_from_clause()
    assert apply.call_args.args[2] == "main"
    assert default_schema.call_count == 2


@pytest.mark.parametrize("datasource_class", [SqlaTable, Query])
@pytest.mark.parametrize("rls_required", [False, True])
def test_virtual_dataset_rls_retry_uses_configured_schema(
    mocker: MockerFixture,
    app_context: None,
    datasource_class: type[SqlaTable] | type[Query],
    rls_required: bool,
) -> None:
    """Dynamic schema selection scopes both RLS injection and its fail-closed retry."""
    database = Database(database_name="analytic", sqlalchemy_uri="sqlite://")
    mocker.patch.object(database.db_engine_spec, "supports_dynamic_schema", True)
    virtual = datasource_class(
        id=2,
        sql="SELECT col1 FROM physical",
        schema="configured",
        database=database,
    )
    default_schema = mocker.patch.object(
        database, "get_default_schema", return_value="other"
    )
    apply = mocker.patch(
        "superset.models.helpers.apply_rls", side_effect=ValueError("cannot apply RLS")
    )
    predicates = mocker.patch(
        "superset.models.helpers.get_predicates_for_table",
        return_value=["col1 = 1"] if rls_required else [],
    )
    rollback = mocker.patch("superset.models.helpers.db.session.rollback")

    if rls_required:
        with pytest.raises(QueryObjectValidationError):
            virtual.get_from_clause()
    else:
        virtual.get_from_clause()

    default_schema.assert_not_called()
    assert apply.call_args.args[2] == "configured"
    assert predicates.call_args.args[0].schema == "configured"
    rollback.assert_called_once_with()


@pytest.fixture(params=[SqlaTable, Query])
def static_schema_datasource(
    request: pytest.FixtureRequest,
    mocker: MockerFixture,
    session: Session,
    app_context: None,
) -> Iterator[tuple[SqlaTable | Query, MagicMock]]:
    """Register RLS on the real default-schema table, not the dataset's schema."""
    SqlaTable.metadata.create_all(session.get_bind())
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE physical (col1 INTEGER)")
        connection.exec_driver_sql("INSERT INTO physical VALUES (1), (2)")
    database = Database(id=1, database_name="analytic", sqlalchemy_uri="sqlite://")
    mocker.patch.object(database, "_get_sqla_engine", return_value=engine)
    physical = SqlaTable(id=1, table_name="physical", schema="main", database=database)
    session.add(physical)
    session.flush()
    virtual = request.param(
        id=2,
        sql="SELECT col1 FROM physical",
        schema="not_the_default",
        database=database,
    )
    if isinstance(virtual, SqlaTable):
        virtual.table_name = "virtual"
        virtual.columns = [TableColumn(column_name="col1", type="INTEGER")]
    else:
        virtual.extra = {
            "columns": [{"column_name": "col1", "type": "INTEGER", "is_dttm": False}]
        }
    rule = MagicMock(clause="col1 = 1", group_key=None)
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        side_effect=lambda dataset: [rule] if dataset.id == physical.id else [],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    assert not database.db_engine_spec.supports_dynamic_schema
    # The query-backed datasource is transient, like an unsaved Explore chart.
    with session.no_autoflush:
        yield virtual, rule
    engine.dispose()


def test_virtual_dataset_rls_uses_connection_schema(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
) -> None:
    """An ignored dataset schema must not hide RLS on an unqualified table."""
    virtual, _ = static_schema_datasource
    query = QueryObject(datasource=virtual, columns=["col1"], metrics=[])

    result = virtual.get_query_result(query)

    assert result.status == "success"
    assert result.df["col1"].tolist() == [1]


def test_virtual_dataset_rls_cache_uses_connection_schema(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
) -> None:
    """Different rules on the table actually read must produce different keys."""
    virtual, rule = static_schema_datasource

    first_keys = virtual.get_extra_cache_keys({})
    rule.clause = "col1 = 2"
    second_keys = virtual.get_extra_cache_keys({})

    assert first_keys == ["(col1 = 1)"]
    assert second_keys == ["(col1 = 2)"]
    assert first_keys != second_keys


def test_virtual_dataset_rls_retry_uses_connection_schema(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """An injection failure must not bypass RLS by retrying the wrong schema."""
    virtual, _ = static_schema_datasource
    mocker.patch(
        "superset.models.helpers.apply_rls", side_effect=ValueError("cannot apply RLS")
    )
    mocker.patch("superset.models.helpers.db.session.rollback")

    with pytest.raises(QueryObjectValidationError):
        virtual.get_from_clause()


def test_virtual_dataset_denylist_uses_connection_schema(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
) -> None:
    """Adhoc-expression denylist checks must use the same runtime table schema."""
    virtual, _ = static_schema_datasource

    assert virtual._resolve_denylist_schema("SELECT col1 FROM physical") == "main"
