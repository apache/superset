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
from superset.connectors.sqla.models import (
    SqlaTable,
    SqlMetric,
    TableColumn,
    validate_stored_expression,
)
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.couchbase import CouchbaseEngineSpec
from superset.db_engine_specs.druid import DruidEngineSpec
from superset.db_engine_specs.tdengine import TDengineEngineSpec
from superset.exceptions import QueryObjectValidationError, SupersetParseError
from superset.models import helpers
from superset.models.core import Database
from superset.models.helpers import (
    validate_rendered_expression,
    validate_stored_expression_at_query_time,
)
from superset.models.sql_lab import Query
from superset.sql.parse import SQLStatement
from superset.superset_typing import QueryObjectDict
from tests.unit_tests.conftest import with_feature_flags


@pytest.fixture(
    params=[
        "column",
        "arithmetic",
        "metric",
        "where",
        "having",
        "orderby",
        "filter_column",
    ]
)
def adhoc_subquery(request: pytest.FixtureRequest) -> QueryObjectDict:
    """Build each adhoc sink around an independently RLS-protected subquery."""
    expression = "(SELECT MAX(col1) FROM physical)"
    if request.param in {"column", "arithmetic"}:
        if request.param == "arithmetic":
            expression = f"0 + {expression}"
        return {
            "columns": [{"sqlExpression": expression, "label": "restricted"}],
            "metrics": [],
        }
    if request.param == "metric":
        return {
            "columns": [],
            "metrics": [
                {
                    "expressionType": "SQL",
                    "sqlExpression": f"MAX({expression})",
                    "label": "restricted",
                }
            ],
        }
    query: QueryObjectDict = {
        "columns": [],
        "metrics": [
            {
                "expressionType": "SQL",
                "sqlExpression": "MAX(col1)",
                "label": "restricted",
            }
        ],
    }
    if request.param == "orderby":
        query["orderby"] = [
            (
                {
                    "expressionType": "SQL",
                    "sqlExpression": f"MAX({expression})",
                    "label": "ordering",
                },
                True,
            )
        ]
    elif request.param == "filter_column":
        query["filter"] = [
            {
                "col": {"sqlExpression": expression, "label": "filtering"},
                "op": "==",
                "val": 1,
            }
        ]
    else:
        query["extras"] = {request.param: f"1 = {expression}"}
    return query


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_adhoc_subquery_rls_uses_connection_schema(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    adhoc_subquery: QueryObjectDict,
) -> None:
    """Column, metric and filter subqueries must read only RLS-visible rows."""
    virtual, _ = static_schema_datasource
    query = QueryObject(
        datasource=virtual,
        columns=adhoc_subquery.get("columns"),
        metrics=adhoc_subquery.get("metrics"),
        filters=adhoc_subquery.get("filter"),
        extras=adhoc_subquery.get("extras"),
        orderby=adhoc_subquery.get("orderby"),
    )

    result = virtual.get_query_result(query)

    assert result.status == "success"
    assert result.df["restricted"].tolist() == [1]
    # The outer virtual SQL and the independent expression each need RLS.
    assert result.query.count("col1 = 1") == (3 if adhoc_subquery["columns"] else 2)


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_adhoc_subquery_rls_cache_uses_connection_schema(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    adhoc_subquery: QueryObjectDict,
) -> None:
    """An expression-only table reference must contribute its rules to the key."""
    virtual, rule = static_schema_datasource
    # The base SQL deliberately reads no table: only the expression needs RLS.
    virtual.sql = "SELECT 1 AS col1"
    query = QueryObject(
        datasource=virtual,
        columns=adhoc_subquery.get("columns"),
        metrics=adhoc_subquery.get("metrics"),
        filters=adhoc_subquery.get("filter"),
        extras=adhoc_subquery.get("extras"),
        orderby=adhoc_subquery.get("orderby"),
    )

    assert virtual.get_extra_cache_keys(query.to_dict()) == ["(col1 = 1)"]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys(query.to_dict()) == ["(col1 = 2)"]


@pytest.mark.parametrize("sink", ["stored", "rendered", "save", "fragment"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_expression_validation_rls_uses_connection_schema(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    sink: str,
) -> None:
    """Stored, rendered and save-time validators share the adhoc RLS resolver."""
    virtual, _ = static_schema_datasource
    expression = "(SELECT MAX(col1) FROM physical)"
    if sink == "fragment":
        expression = f"DISTINCT {expression}"
    apply = mocker.spy(helpers, "apply_rls")
    args = (expression, virtual.database, virtual.catalog, virtual.schema)
    if sink == "save":
        validate_stored_expression(
            virtual.database, virtual.catalog, virtual.schema, expression
        )
    elif sink == "rendered":
        validate_rendered_expression(*args)
    else:
        rewritten = validate_stored_expression_at_query_time(
            *args, virtual.database.backend
        )
        assert "col1 = 1" in rewritten

    assert apply.call_args.args[2] == "main"
    assert "col1 = 1" in apply.call_args.args[3].format()


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize("kind", ["column", "metric"])
@pytest.mark.parametrize("templated", [False, True])
@pytest.mark.parametrize("cache_key", [False, True])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_stored_subquery_rls_uses_connection_schema(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    kind: str,
    templated: bool,
    cache_key: bool,
) -> None:
    """Stored and rendered column/metric subqueries affect execution and caching."""
    virtual, rule = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    expression = "(SELECT MAX(col1) FROM physical)"
    virtual.template_params = '{"subquery": "(SELECT MAX(col1) FROM physical)"}'
    if templated:
        expression = "{{ subquery }}"
    if kind == "column":
        virtual.columns.append(
            TableColumn(column_name="restricted", expression=expression)
        )
        query = QueryObject(datasource=virtual, columns=["restricted"], metrics=[])
    else:
        virtual.metrics = [
            SqlMetric(metric_name="restricted", expression=f"MAX({expression})")
        ]
        query = QueryObject(datasource=virtual, columns=[], metrics=["restricted"])

    if cache_key:
        assert virtual.get_extra_cache_keys(query.to_dict()) == ["(col1 = 1)"]
        rule.clause = "col1 = 2"
        assert virtual.get_extra_cache_keys(query.to_dict()) == ["(col1 = 2)"]
    else:
        result = virtual.get_query_result(query)
        assert result.status == "success"
        assert result.df["restricted"].tolist() == [1]


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_adhoc_subquery_rls_schema_discovery_fails_closed(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """An expression cannot silently lose RLS when execution-schema discovery fails."""
    virtual, _ = static_schema_datasource
    mocker.patch.object(
        virtual.database,
        "resolve_query_default_schema",
        side_effect=RuntimeError("discovery failed"),
    )
    apply = mocker.patch("superset.models.helpers.apply_rls")

    with pytest.raises(RuntimeError, match="discovery failed"):
        helpers.validate_adhoc_subquery(
            "SELECT (SELECT MAX(col1) FROM physical)",
            virtual.database,
            virtual.catalog,
            virtual.schema,
            virtual.database.backend,
        )
    apply.assert_not_called()


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_stored_subquery_rls_dialect_fallback_fails_closed(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """A detector-only dialect must not discard the required RLS rewrite."""
    virtual, _ = static_schema_datasource

    def parse(sql: str, engine: str) -> SQLStatement:
        """Model a fragment understood only by the permissive detector dialect."""
        if engine != "base":
            raise SupersetParseError("unsupported dialect syntax")
        return SQLStatement(sql, engine)

    mocker.patch("superset.models.helpers.SQLStatement", side_effect=parse)
    with pytest.raises(QueryObjectValidationError, match="safely rewritten"):
        validate_stored_expression_at_query_time(
            "MAX((SELECT MAX(col1) FROM physical))",
            virtual.database,
            virtual.catalog,
            virtual.schema,
            virtual.database.backend,
        )


def test_expression_without_subquery_avoids_schema_discovery(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """Ordinary expressions do not acquire a connection just to resolve RLS."""
    virtual, _ = static_schema_datasource
    resolve = mocker.spy(virtual.database, "resolve_query_default_schema")
    assert (
        helpers.validate_adhoc_subquery(
            "MAX(col1)",
            virtual.database,
            virtual.catalog,
            virtual.schema,
            virtual.database.backend,
        )
        == "MAX(col1)"
    )
    resolve.assert_not_called()


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
@pytest.mark.parametrize("adhoc", [False, True])
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
    adhoc: bool,
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
    query = QueryObject(
        datasource=virtual,
        columns=[
            {
                "sqlExpression": "col1 + 0 * (SELECT MAX(col1) FROM physical)",
                "label": "col1",
            }
        ]
        if adhoc
        else ["col1"],
        metrics=[],
    )
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


@pytest.fixture(params=[False, True], ids=["sqlite", "druid"])
def unresolved_schema_datasource(
    request: pytest.FixtureRequest,
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> tuple[SqlaTable | Query, MagicMock]:
    """Model static engines whose URI and inspector expose no default schema."""
    virtual, rule = static_schema_datasource
    virtual.schema = "main"
    if request.param:
        mocker.patch.object(
            Database, "get_db_engine_spec", return_value=DruidEngineSpec
        )
    mocker.patch.object(
        virtual.database.db_engine_spec, "get_default_schema", return_value=None
    )
    return virtual, rule


def test_virtual_dataset_rls_preserves_unresolved_schema(
    unresolved_schema_datasource: tuple[SqlaTable | Query, MagicMock],
) -> None:
    """Unknown runtime defaults must retain RLS on the configured physical table."""
    virtual, _ = unresolved_schema_datasource
    query = QueryObject(datasource=virtual, columns=["col1"], metrics=[])

    result = virtual.get_query_result(query)

    assert result.status == "success"
    assert result.df["col1"].tolist() == [1]


def test_virtual_dataset_rls_cache_preserves_unresolved_schema(
    unresolved_schema_datasource: tuple[SqlaTable | Query, MagicMock],
) -> None:
    """An undiscoverable default must not remove tenant predicates from cache keys."""
    virtual, rule = unresolved_schema_datasource

    assert virtual.get_extra_cache_keys({}) == ["(col1 = 1)"]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys({}) == ["(col1 = 2)"]


def test_virtual_dataset_rls_retry_preserves_unresolved_schema(
    unresolved_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """The injection-error retry must retain the fallback schema and fail closed."""
    virtual, _ = unresolved_schema_datasource
    mocker.patch(
        "superset.models.helpers.apply_rls", side_effect=ValueError("cannot apply RLS")
    )
    mocker.patch("superset.models.helpers.db.session.rollback")

    with pytest.raises(QueryObjectValidationError):
        virtual.get_from_clause()


@pytest.mark.parametrize("spec", [TDengineEngineSpec, CouchbaseEngineSpec])
@pytest.mark.parametrize("datasource_class", [SqlaTable, Query])
@pytest.mark.parametrize("operation", ["get_from_clause", "get_extra_cache_keys"])
def test_virtual_dataset_without_uri_database(
    mocker: MockerFixture,
    app_context: None,
    spec: type[BaseEngineSpec],
    datasource_class: type[SqlaTable] | type[Query],
    operation: str,
) -> None:
    """Fully qualified SQL must survive schema resolution without a URI database."""
    database = Database(
        database_name="analytic", sqlalchemy_uri=f"{spec.engine}://host"
    )
    mocker.patch.object(Database, "get_db_engine_spec", return_value=spec)
    mocker.patch.object(spec, "get_default_schema", return_value=None)
    extractor = mocker.spy(spec, "get_schema_from_engine_params")
    mocker.patch("superset.models.helpers.apply_rls", return_value=False)
    mocker.patch("superset.utils.rls.collect_rls_predicates_for_sql", return_value=[])
    virtual = datasource_class(
        id=2,
        sql="SELECT ts, value FROM metrics.readings",
        schema="metrics",
        database=database,
    )

    if operation == "get_from_clause":
        virtual.get_from_clause()
    else:
        assert virtual.get_extra_cache_keys({}) == []

    extractor.assert_called_once()
    assert extractor.call_args.args[0].database is None


@pytest.mark.parametrize("datasource_class", [SqlaTable, Query])
@pytest.mark.parametrize("dynamic_schema", [False, True])
@pytest.mark.parametrize("adhoc", [False, True])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_cache_hit_schema_discovery_connection_budget(
    mocker: MockerFixture,
    tmp_path: Path,
    app_context: None,
    datasource_class: type[SqlaTable] | type[Query],
    dynamic_schema: bool,
    adhoc: bool,
) -> None:
    """Expression cache keys must reuse the datasource's single inspector lookup."""
    uri = f"sqlite:///{tmp_path / 'analytic.db'}"
    engine = create_engine(uri, poolclass=NullPool)
    connections = MagicMock()
    event.listen(engine, "connect", connections)
    database = Database(id=1, database_name="analytic", sqlalchemy_uri=uri)
    mocker.patch.object(database, "_get_sqla_engine", return_value=engine)
    mocker.patch.object(
        database.db_engine_spec, "supports_dynamic_schema", dynamic_schema
    )
    # SQLite needs its inspector to discover "main". The static-engine case
    # deliberately disagrees with the dataset's configured schema.
    virtual = datasource_class(
        id=2,
        sql="SELECT col1 FROM physical",
        schema=None if dynamic_schema else "not_the_default",
        database=database,
    )
    if isinstance(virtual, SqlaTable):
        virtual.table_name = "virtual"
        virtual.columns = [TableColumn(column_name="col1", type="INTEGER")]
    else:
        virtual.extra = {
            "columns": [{"column_name": "col1", "type": "INTEGER", "is_dttm": False}]
        }
    physical = SqlaTable(id=1, table_name="physical", schema="main", database=database)
    rule = MagicMock(clause="col1 = 1", group_key=None)
    mocker.patch("superset.utils.rls.find_datasets", return_value=[physical])
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        side_effect=lambda dataset: [rule] if dataset.id == 1 else [],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.common.query_context_processor.security_manager.get_rls_cache_key",
        return_value=[],
    )
    cache = MagicMock(is_loaded=True, status="success", bq_memory_limited=False)
    cache.df = pd.DataFrame({"restricted": [1]})
    mocker.patch(
        "superset.common.query_context_processor.QueryCacheManager.get",
        return_value=cache,
    )
    processor = QueryContextProcessor(
        MagicMock(
            datasource=virtual,
            force=False,
            is_async_execution=False,
            custom_cache_timeout=300,
            result_type="full",
        )
    )
    query = QueryObject(
        datasource=virtual,
        columns=[
            {"sqlExpression": "(SELECT MAX(col1) FROM physical)", "label": "restricted"}
        ]
        if adhoc
        else ["col1"],
        metrics=[],
    )
    cache_key = mocker.spy(query, "cache_key")
    result = processor.get_df_payload_result(query)

    assert result.payload["status"] == "success"
    assert cache_key.call_args.kwargs["extra_cache_keys"] == ["(col1 = 1)"]
    assert connections.call_count == 1
    cache.set_query_result.assert_not_called()
    engine.dispose()


@pytest.mark.parametrize(
    "static_schema_datasource,extra_cache_macro",
    [(SqlaTable, False), (SqlaTable, True), (Query, False)],
    indirect=["static_schema_datasource"],
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_hit_series_limit_does_not_execute_prequery(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    extra_cache_macro: bool,
) -> None:
    """No-join engines must not execute top-series queries for cache keys."""
    virtual, _ = static_schema_datasource
    # Use Druid's no-join planner with the fixture's SQLite transport.
    mocker.patch.object(
        virtual.database, "get_db_engine_spec", return_value=DruidEngineSpec
    )
    mocker.patch.object(DruidEngineSpec, "allows_joins", False)
    if extra_cache_macro:
        virtual.sql += " WHERE 1 = {{ cache_key_wrapper(1) }}"
    execute = mocker.spy(virtual, "query")
    cache = MagicMock(is_loaded=True, status="success", bq_memory_limited=False)
    cache.df = pd.DataFrame({"col1": [1], "total": [1]})
    mocker.patch(
        "superset.common.query_context_processor.QueryCacheManager.get",
        return_value=cache,
    )
    mocker.patch(
        "superset.common.query_context_processor.security_manager.get_rls_cache_key",
        return_value=[],
    )
    processor = QueryContextProcessor(
        MagicMock(
            datasource=virtual,
            force=False,
            is_async_execution=False,
            custom_cache_timeout=300,
            result_type="full",
        )
    )
    query = QueryObject(
        datasource=virtual,
        columns=["col1"],
        metrics=[
            {"expressionType": "SQL", "sqlExpression": "SUM(col1)", "label": "total"}
        ],
        series_columns=["col1"],
        series_limit=1,
    )

    result = processor.get_df_payload_result(query)

    assert result.payload["status"] == "success"
    execute.assert_not_called()
    cache.set_query_result.assert_not_called()


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize(
    "fields",
    [
        {"columns": ["calculated"]},
        {
            "columns": [
                {
                    "sqlExpression": "calculated",
                    "label": "axis",
                    "columnType": "BASE_AXIS",
                    "timeGrain": "P1D",
                }
            ]
        },
        {"groupby": ["calculated"]},
        {"columns": ["(SELECT MAX(col1) FROM physical)"], "metrics": ["restricted"]},
        {"metrics": ["restricted"]},
        {
            "metrics": [
                {
                    "expressionType": "SIMPLE",
                    "aggregate": "MAX",
                    "column": {"column_name": "calculated"},
                    "label": "total",
                }
            ]
        },
        {"orderby": [("restricted", True)]},
        {"orderby": [("calculated", True)]},
        {"filter": [{"col": "calculated", "op": "==", "val": 1}]},
        {"filter": [{"col": "caption", "op": "==", "val": 1}]},
        {"filter": [{"col": "restricted", "op": "==", "val": 1}]},
        {
            "series_limit": 1,
            "series_columns": ["col1"],
            "series_limit_metric": "restricted",
        },
        {"timeseries_limit": 1, "timeseries_limit_metric": "restricted"},
        {
            "series_limit": 1,
            "series_columns": ["col1"],
            "series_limit_metric": {
                "expressionType": "SQL",
                "sqlExpression": "MAX({{ subquery }})",
                "label": "total",
            },
        },
        {"granularity": "calculated", "is_timeseries": True},
        {"extras": {"where": "1 = {{ subquery }}"}},
        {"extras": {"having": "1 = {{ subquery }}"}},
        {"apply_fetch_values_predicate": True},
    ],
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_expression_cache_key_sibling_fields(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    fields: QueryObjectDict,
) -> None:
    """Every expression entry point contributes RLS without a full query build."""
    virtual, rule = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    virtual.template_params = '{"subquery": "(SELECT MAX(col1) FROM physical)"}'
    virtual.columns.append(
        TableColumn(
            column_name="calculated",
            verbose_name="caption",
            is_dttm=True,
            expression="{{ subquery }}",
        )
    )
    virtual.metrics.append(
        SqlMetric(
            metric_name="restricted",
            expression="MAX({{ subquery }})",
        )
    )
    virtual.fetch_values_predicate = "1 = (SELECT MAX(col1) FROM physical)"
    build = mocker.spy(virtual, "get_sqla_query")
    query: QueryObjectDict = {
        "columns": ["col1"],
        "metrics": [],
        "is_timeseries": False,
    }
    query.update(fields)

    assert virtual.get_extra_cache_keys(query) == ["(col1 = 1)"]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys(query) == ["(col1 = 2)"]
    build.assert_not_called()


def test_series_limit_execution_still_runs_prequery(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """Skipping prequeries for keys must not disable top-series execution."""
    virtual, _ = static_schema_datasource
    mocker.patch.object(
        virtual.database, "get_db_engine_spec", return_value=DruidEngineSpec
    )
    mocker.patch.object(DruidEngineSpec, "allows_joins", False)
    execute = mocker.spy(virtual, "query")
    query = QueryObject(
        datasource=virtual,
        columns=["col1"],
        metrics=[
            {"expressionType": "SQL", "sqlExpression": "SUM(col1)", "label": "total"}
        ],
        series_columns=["col1"],
        series_limit=1,
    )

    result = virtual.get_query_result(query)

    assert result.status == "success"
    assert result.df.to_dict(orient="list") == {"col1": [1], "total": [1]}
    assert execute.call_count == 2


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize("sink", ["metric", "column", "verbose", "rendered_reference"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_expression_cache_key_reference_precedence(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    sink: str,
) -> None:
    """Name collisions and rendered column references retain the executed rules."""
    virtual, rule = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    protected = "(SELECT MAX(col1) FROM physical)"
    unrelated = "(SELECT MAX(col1) FROM unrelated)"
    virtual.columns.append(
        TableColumn(
            column_name="restricted",
            expression=unrelated if sink == "metric" else protected,
        )
    )
    virtual.columns.append(
        TableColumn(
            column_name="another",
            verbose_name="restricted",
            expression=unrelated,
        )
    )
    virtual.metrics.append(
        SqlMetric(
            metric_name="restricted",
            expression=protected if sink == "metric" else unrelated,
        )
    )
    query: QueryObjectDict = {
        "columns": ["restricted"],
        "metrics": [],
        "is_timeseries": False,
    }
    if sink == "metric":
        query.update(columns=[], metrics=["restricted"])
    elif sink == "verbose":
        query.update(
            columns=["col1"], filter=[{"col": "restricted", "op": "==", "val": 1}]
        )
    elif sink == "rendered_reference":
        query["columns"] = [{"sqlExpression": "{{ 'restricted' }}", "label": "result"}]
    build = mocker.spy(virtual, "get_sqla_query")

    assert virtual.get_extra_cache_keys(query) == ["(col1 = 1)"]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys(query) == ["(col1 = 2)"]
    build.assert_not_called()


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize("subquery", [False, True])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_physical_expression_cache_key_schema_budget(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    subquery: bool,
) -> None:
    """Physical datasets discover a schema only once, and only for subqueries."""
    physical, _ = static_schema_datasource
    physical.sql = None
    expression = "(SELECT MAX(col1) FROM physical)" if subquery else "col1 + 1"
    query: QueryObjectDict = {
        "columns": [
            {"sqlExpression": expression, "label": str(index)} for index in range(3)
        ],
        "metrics": [],
        "is_timeseries": False,
    }
    discover = mocker.spy(physical.database, "resolve_query_default_schema")
    build = mocker.spy(physical, "get_sqla_query")

    assert physical.get_extra_cache_keys(query) == (["(col1 = 1)"] if subquery else [])
    assert discover.call_count == (1 if subquery else 0)
    build.assert_not_called()


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_expression_cache_key_parse_failure_is_user_scoped(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """Unparseable expressions must retain the collector's per-user sentinel."""
    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    user_id = mocker.patch("superset.utils.rls.get_user_id", return_value=41)
    mocker.patch(
        "superset.utils.rls.security_manager.get_current_guest_user_if_guest",
        return_value=None,
    )
    query: QueryObjectDict = {
        "columns": [{"sqlExpression": "(SELECT FROM !)", "label": "broken"}],
        "metrics": [],
        "is_timeseries": False,
    }
    build = mocker.spy(virtual, "get_sqla_query")

    assert virtual.get_extra_cache_keys(query) == [
        "rls-predicate-parse-failed-for-user-41"
    ]
    user_id.return_value = 42
    assert virtual.get_extra_cache_keys(query) == [
        "rls-predicate-parse-failed-for-user-42"
    ]
    build.assert_not_called()
