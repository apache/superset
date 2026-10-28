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

from collections.abc import Hashable, Iterator
from datetime import datetime
from pathlib import Path
from typing import cast
from unittest.mock import MagicMock, patch, PropertyMock

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
from superset.db_engine_specs.bigquery import BigQueryEngineSpec
from superset.db_engine_specs.couchbase import CouchbaseEngineSpec
from superset.db_engine_specs.druid import DruidEngineSpec
from superset.db_engine_specs.duckdb import DuckDBEngineSpec
from superset.db_engine_specs.tdengine import TDengineEngineSpec
from superset.exceptions import QueryObjectValidationError, SupersetParseError
from superset.jinja_context import BaseTemplateProcessor, PrestoTemplateProcessor
from superset.models import helpers
from superset.models.core import Database
from superset.models.helpers import (
    validate_rendered_expression,
    validate_stored_expression_at_query_time,
)
from superset.models.sql_lab import Query
from superset.sql.parse import SQLStatement
from superset.superset_typing import AdhocColumn, AdhocMetric, QueryObjectDict
from superset.utils import json
from superset.utils.core import QueryObjectFilterClause
from tests.unit_tests.conftest import with_feature_flags

PHYSICAL_RLS_KEYS = {
    tenant: json.dumps(["rls", None, "main", "physical", f"(col1 = {tenant})"])
    for tenant in (1, 2)
}


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

    assert virtual.get_extra_cache_keys(query.to_dict()) == [PHYSICAL_RLS_KEYS[1]]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys(query.to_dict()) == [PHYSICAL_RLS_KEYS[2]]


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
        assert virtual.get_extra_cache_keys(query.to_dict()) == [PHYSICAL_RLS_KEYS[1]]
        rule.clause = "col1 = 2"
        assert virtual.get_extra_cache_keys(query.to_dict()) == [PHYSICAL_RLS_KEYS[2]]
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
        [PHYSICAL_RLS_KEYS[1]] if with_rls else []
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


@pytest.mark.parametrize("partition_discovery_fails", [False, True])
@pytest.mark.parametrize("sink", ["column", "filter", "time", "expression"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_does_not_render_unneeded_partition_macro(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    partition_discovery_fails: bool,
    sink: str,
) -> None:
    """A warehouse macro must not run before a plain-column cache lookup."""
    virtual, _ = static_schema_datasource
    virtual.sql = (
        "SELECT col1, '2020-01-01' AS ds FROM physical "
        "WHERE col1 = {{ presto.latest_sub_partition('physical', ds='2020-01-01') }}"
    )
    # Exercise the real Presto macro with SQLite-backed RLS metadata. The
    # engine method would discover indexes and query partitions in a warehouse.
    mocker.patch(
        "superset.jinja_context.get_template_processors",
        return_value={"sqlite": PrestoTemplateProcessor},
    )
    partition_query = mocker.patch.object(
        virtual.database.db_engine_spec,
        "latest_sub_partition",
        create=True,
        return_value="1",
        side_effect=RuntimeError("Partition discovery failed")
        if partition_discovery_fails
        else None,
    )
    columns = [
        *virtual.columns,
        TableColumn(column_name="ds", type="DATETIME", is_dttm=True),
    ]
    if isinstance(virtual, SqlaTable):
        virtual.columns = columns
    else:
        mocker.patch.object(
            Query, "columns", new_callable=PropertyMock, return_value=columns
        )
    query = QueryObject(
        datasource=virtual,
        columns=[
            {"sqlExpression": "(SELECT MAX(col1) FROM physical)", "label": "value"}
        ]
        if sink == "expression"
        else ["col1"],
        metrics=[],
        filters=[{"col": "col1", "op": "==", "val": 1}] if sink == "filter" else [],
        granularity="ds" if sink == "time" else None,
        is_timeseries=False,
    )
    render = mocker.spy(virtual, "get_rendered_sql")

    assert virtual.get_extra_cache_keys(query.to_dict()) == [PHYSICAL_RLS_KEYS[1]]
    render.assert_not_called()
    partition_query.assert_not_called()

    # The template is executable, and normal SQL generation still runs it.
    if partition_discovery_fails:
        with pytest.raises(RuntimeError, match="Partition discovery failed"):
            virtual.get_rendered_sql(virtual.get_template_processor())
    else:
        assert "WHERE col1 = 1" in virtual.get_rendered_sql(
            virtual.get_template_processor()
        )
    partition_query.assert_called_once()


@pytest.mark.parametrize("partition_discovery_fails", [False, True])
@pytest.mark.parametrize(
    "sink",
    [
        "calculated_filter",
        "calculated_time",
        "literal_filter",
        "literal_time",
        "tableless_filter",
        "tableless_time",
        "calculated_time_alias",
        "primary_time",
        "where",
        "having",
        "calculated_column",
        "saved_metric",
        "adhoc_sql",
        "fetch_values_predicate",
        "adhoc_column_reference",
        "sql_named_column_reference",
        "orderby",
        "series_metric",
        "groupby",
        "adhoc_metric",
    ],
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_skips_partition_templates_without_subqueries(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    partition_discovery_fails: bool,
    sink: str,
) -> None:
    """No non-subquery chart field may trigger warehouse partition discovery."""
    virtual, _ = static_schema_datasource
    macro = "{{ presto.latest_sub_partition('physical', ds='2020-01-01') }}"
    virtual.sql = "SELECT col1 FROM physical"
    expression = f"col1 + {macro}"
    # For these two paths it is FROM, rather than the chart expression,
    # that used to be rendered solely to populate filter-removal state.
    if sink in {
        "calculated_filter",
        "calculated_time",
        "literal_filter",
        "literal_time",
        "tableless_filter",
        "tableless_time",
        "calculated_time_alias",
        "primary_time",
    }:
        virtual.sql += f" WHERE col1 = {macro}"
        expression = "UPPER(col1)"
        if sink in {"literal_filter", "literal_time"}:
            expression = "UPPER('SELECT')"
        elif sink in {"tableless_filter", "tableless_time"}:
            expression = "(SELECT 1)"
    mocker.patch(
        "superset.jinja_context.get_template_processors",
        return_value={"sqlite": PrestoTemplateProcessor},
    )
    partition_query = mocker.patch.object(
        virtual.database.db_engine_spec,
        "latest_sub_partition",
        create=True,
        return_value="1",
        side_effect=RuntimeError("Partition discovery failed")
        if partition_discovery_fails
        else None,
    )
    columns = [
        *virtual.columns,
        TableColumn(column_name="ds", type="DATETIME", is_dttm=True),
        TableColumn(
            column_name="calculated",
            type="DATETIME",
            is_dttm=True,
            expression=expression,
        ),
        TableColumn(
            column_name="(SELECT MAX(col1) FROM physical)",
            type="INTEGER",
            expression=expression,
        ),
    ]
    metrics = [SqlMetric(metric_name="total", expression=f"MAX({expression})")]
    if isinstance(virtual, SqlaTable):
        virtual.columns = columns
        virtual.metrics = metrics
        virtual.main_dttm_col = "calculated"
        virtual.always_filter_main_dttm = sink == "primary_time"
    else:
        mocker.patch.object(
            Query, "columns", new_callable=PropertyMock, return_value=columns
        )
        mocker.patch.object(
            Query, "metrics", new_callable=PropertyMock, return_value=metrics
        )
        mocker.patch.object(
            Query, "main_dttm_col", new_callable=PropertyMock, return_value="calculated"
        )
        mocker.patch.object(
            Query,
            "always_filter_main_dttm",
            new_callable=PropertyMock,
            return_value=sink == "primary_time",
        )
    query: QueryObjectDict = {
        "columns": ["col1"],
        "metrics": [],
        "is_timeseries": False,
    }
    virtual.fetch_values_predicate = f"1 = {macro}"
    fields: dict[str, QueryObjectDict] = {
        "calculated_filter": {
            "filter": [{"col": "calculated", "op": "==", "val": 1}],
        },
        "calculated_time": {"granularity": "calculated"},
        "literal_filter": {"filter": [{"col": "calculated", "op": "==", "val": 1}]},
        "literal_time": {"granularity": "calculated"},
        "tableless_filter": {"filter": [{"col": "calculated", "op": "==", "val": 1}]},
        "tableless_time": {"granularity": "calculated"},
        "calculated_time_alias": {
            "granularity": "calculated",
            "is_timeseries": True,
            "filter": [
                {"col": "__timestamp", "op": "TEMPORAL_RANGE", "val": "No filter"}
            ],
        },
        "primary_time": {"granularity": "ds", "is_timeseries": True},
        "where": {"extras": {"where": f"1 = {macro}"}},
        "having": {"extras": {"having": f"1 = {macro}"}},
        "calculated_column": {"columns": ["calculated"]},
        "saved_metric": {"metrics": ["total"]},
        "adhoc_sql": {"columns": [{"sqlExpression": expression, "label": "axis"}]},
        "fetch_values_predicate": {"apply_fetch_values_predicate": True},
        "adhoc_column_reference": {
            "columns": [{"sqlExpression": "calculated", "label": "axis"}],
        },
        "sql_named_column_reference": {
            "columns": [
                {"sqlExpression": "(SELECT MAX(col1) FROM physical)", "label": "axis"},
            ],
        },
        "orderby": {"orderby": [("total", True)]},
        "series_metric": {
            "series_limit": 1,
            "series_columns": ["col1"],
            "series_limit_metric": "total",
        },
        "groupby": {"groupby": ["calculated"]},
        "adhoc_metric": {
            "metrics": [
                {"expressionType": "SQL", "sqlExpression": expression, "label": "total"}
            ],
        },
    }
    query.update(fields[sink])
    render = mocker.spy(virtual, "get_rendered_sql")
    process = mocker.spy(BaseTemplateProcessor, "process_template")

    keys = virtual.get_extra_cache_keys(query)
    assert PHYSICAL_RLS_KEYS[1] in keys
    render.assert_not_called()
    assert not any(macro in call.args[1] for call in process.call_args_list)
    assert expression not in [call.args[1] for call in process.call_args_list]
    assert "calculated" not in [call.args[1] for call in process.call_args_list]
    partition_query.assert_not_called()

    # Prove the live macro is callable; skipping is specific to cache keys.
    if partition_discovery_fails:
        with pytest.raises(RuntimeError, match="Partition discovery failed"):
            virtual.get_template_processor().process_template(macro)
    else:
        assert virtual.get_template_processor().process_template(macro) == "1"
    partition_query.assert_called_once()


@pytest.mark.parametrize("source", ["macro", "string_operation"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_opaque_expression_cache_key_is_viewer_scoped_without_rendering(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    source: str,
) -> None:
    """An opaque macro can emit SQL; avoid rendering it without sharing its scope."""
    from flask import g
    from flask_appbuilder.security.sqla.models import User

    virtual, rule = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    macro = MagicMock(return_value="(SELECT MAX(col1) FROM physical)")

    def opaque_sql() -> str:
        """Return an SQL fragment through a live, sandbox-callable macro."""
        return cast(str, macro())

    mocker.patch(
        "superset.jinja_context.context_addons", return_value={"opaque_sql": opaque_sql}
    )
    query = QueryObject(
        datasource=virtual,
        columns=[
            {
                "sqlExpression": "{{ opaque_sql() }}"
                if source == "macro"
                else "{{ '(' ~ ('SEL' * 1) ~ 'ECT MAX(col1) FROM physical)' }}",
                "label": "axis",
            }
        ],
        metrics=[],
    )
    keys = []
    for user_id in (1, 2):
        g.user = User(id=user_id, username=f"viewer{user_id}")
        rule.clause = f"col1 = {user_id}"
        macro.reset_mock()
        extra_keys = virtual.get_extra_cache_keys(query.to_dict())
        assert extra_keys == [f"rls-predicate-parse-failed-for-user-{user_id}"]
        macro.assert_not_called()
        keys.append(query.cache_key(extra_cache_keys=extra_keys))
        result = virtual.get_query_result(query)
        assert result.status == "success"
        assert result.df["axis"].tolist() == [user_id]
        if source == "macro":
            macro.assert_called()
    assert keys[0] != keys[1]


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize("source", ["nested_parameter", "literal_numeric"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_nested_template_parameter_subquery_cache_keys(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    source: str,
) -> None:
    """A subquery in a nested literal parameter must retain its table's RLS key."""
    virtual, rule = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    params = {"params": {"query": "(SELECT MAX(col1) FROM physical)"}}
    virtual.template_params = json.dumps(params)
    query = QueryObject(
        datasource=virtual,
        columns=[
            {
                "sqlExpression": "{{ params.query }}"
                if source == "nested_parameter"
                else "{{ '(SEL' ~ 'ECT MAX(col' ~ (0 + 1) ~ ') FROM physical)' }}",
                "label": "axis",
            }
        ],
        metrics=[],
    )
    for user_id in (1, 2):
        rule.clause = f"col1 = {user_id}"
        assert virtual.get_extra_cache_keys(query.to_dict()) == [
            PHYSICAL_RLS_KEYS[user_id]
        ]


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_inspection_does_not_execute_jinja_filters(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """Constant folding must not run a configured Jinja filter during inspection."""
    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    processor = virtual.get_template_processor()
    probe = MagicMock(side_effect=RuntimeError("Partition discovery failed"))
    processor.env.filters["partition_probe"] = probe
    mocker.patch.object(virtual, "get_template_processor", return_value=processor)
    query = QueryObject(
        datasource=virtual,
        columns=[{"sqlExpression": "{{ '1' | partition_probe }}", "label": "axis"}],
        metrics=[],
    )
    assert virtual.get_extra_cache_keys(query.to_dict())
    probe.assert_not_called()


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_unused_template_parameter_subquery_does_not_trigger_macro(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """Unused SQL in the same parameter object must not justify a live render."""
    virtual, _ = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    virtual.template_params = json.dumps(
        {"params": {"query": "(SELECT MAX(col1) FROM physical)", "value": "1"}}
    )
    probe = MagicMock(side_effect=RuntimeError("Partition discovery failed"))

    def partition_probe() -> str:
        """Represent a warehouse-querying macro that must not execute."""
        return cast(str, probe())

    mocker.patch(
        "superset.jinja_context.context_addons",
        return_value={"partition_probe": partition_probe},
    )
    query = QueryObject(
        datasource=virtual,
        columns=[
            {
                "sqlExpression": "{{ params.value }} + {{ partition_probe() }}",
                "label": "axis",
            }
        ],
        metrics=[],
    )
    assert virtual.get_extra_cache_keys(query.to_dict())
    probe.assert_not_called()


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

    assert first_keys == [PHYSICAL_RLS_KEYS[1]]
    assert second_keys == [PHYSICAL_RLS_KEYS[2]]
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

    assert virtual.get_extra_cache_keys({}) == [PHYSICAL_RLS_KEYS[1]]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys({}) == [PHYSICAL_RLS_KEYS[2]]


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
    assert cache_key.call_args.kwargs["extra_cache_keys"] == [PHYSICAL_RLS_KEYS[1]]
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
        {
            "is_timeseries": True,
            "timeseries_limit": 1,
            "timeseries_limit_metric": "restricted",
        },
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
@pytest.mark.parametrize(
    "subquery", ["(SELECT MAX(col1) FROM physical)", "(FROM physical)"]
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_expression_cache_key_sibling_fields(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    fields: QueryObjectDict,
    subquery: str,
) -> None:
    """Every expression entry point contributes RLS without a full query build."""
    virtual, rule = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    virtual.template_params = json.dumps({"subquery": subquery})
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
    virtual.fetch_values_predicate = f"1 = {subquery}"
    build = mocker.spy(virtual, "get_sqla_query")
    query: QueryObjectDict = {
        "columns": ["col1"],
        "metrics": [],
        "is_timeseries": False,
    }
    query.update(fields)

    assert virtual.get_extra_cache_keys(query) == [PHYSICAL_RLS_KEYS[1]]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys(query) == [PHYSICAL_RLS_KEYS[2]]
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
        query["columns"] = []
        query["metrics"] = ["restricted"]
    elif sink == "verbose":
        query["columns"] = ["col1"]
        query["filter"] = [{"col": "restricted", "op": "==", "val": 1}]
    elif sink == "rendered_reference":
        query["columns"] = [{"sqlExpression": "{{ 'restricted' }}", "label": "result"}]
    build = mocker.spy(virtual, "get_sqla_query")

    assert virtual.get_extra_cache_keys(query) == [PHYSICAL_RLS_KEYS[1]]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys(query) == [PHYSICAL_RLS_KEYS[2]]
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

    assert physical.get_extra_cache_keys(query) == (
        [PHYSICAL_RLS_KEYS[1]] if subquery else []
    )
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


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize(
    "sink", ["series_columns", "series_limit_metric", "fetch_values_predicate"]
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_expression_cache_key_ignores_unused_series_fields(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    sink: str,
) -> None:
    """Unused series fields and disabled fetch predicates must not render SQL."""
    virtual, _ = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    virtual.columns.append(TableColumn(column_name="unused", expression="{{ 1 / 0 }}"))
    virtual.metrics.append(SqlMetric(metric_name="unused", expression="{{ 1 / 0 }}"))
    query: QueryObjectDict = {
        "columns": ["col1"],
        "metrics": [],
        "is_timeseries": False,
        "series_limit": 0,
    }
    if sink == "series_columns":
        query["series_columns"] = ["unused"]
    elif sink == "series_limit_metric":
        query["series_limit_metric"] = "unused"
    else:
        virtual.fetch_values_predicate = "{{ 1 / 0 }}"
    build = mocker.spy(virtual, "get_sqla_query")

    assert virtual.get_extra_cache_keys(query) == []
    build.assert_not_called()


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_expression_cache_key_reuses_catalog_discovery(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """Catalog-inspecting engines share one lookup with the dataset SQL collector."""
    virtual, _ = static_schema_datasource
    catalog = mocker.spy(virtual.database, "get_default_catalog")
    query: QueryObjectDict = {
        "columns": [
            {"sqlExpression": "(SELECT MAX(col1) FROM physical)", "label": str(index)}
            for index in range(3)
        ],
        "metrics": [],
        "is_timeseries": False,
    }

    assert virtual.get_extra_cache_keys(query) == [PHYSICAL_RLS_KEYS[1]]
    assert catalog.call_count == 1


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize("sink", ["columns", "groupby", "filter"])
@pytest.mark.parametrize("expression_type", [None, "SQL"])
@pytest.mark.parametrize(
    "reference", ["calculated", " calculated ", " {{ 'calculated' }} "]
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_adhoc_saved_column_cache_keys_are_user_scoped(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    sink: str,
    expression_type: str | None,
    reference: str,
) -> None:
    """Rendered saved-column references separate two users' RLS result caches."""
    from flask import g
    from flask_appbuilder.security.sqla.models import User

    virtual, _ = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    virtual.columns.append(
        TableColumn(
            column_name="calculated",
            type="INTEGER",
            expression="(SELECT MAX(col1) FROM physical)",
        )
    )
    rules = {
        user_id: MagicMock(clause=f"col1 = {user_id}", group_key=None)
        for user_id in (1, 2)
    }
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        side_effect=lambda dataset: [rules[g.user.id]] if dataset.id == 1 else [],
    )
    payload = {"sqlExpression": reference, "label": "axis"}
    if expression_type:
        payload["expressionType"] = expression_type
    adhoc = cast(AdhocColumn, payload)
    fields: QueryObjectDict = {"columns": [adhoc], "metrics": []}
    if sink == "groupby":
        fields["groupby"] = [adhoc]
    elif sink == "filter":
        fields["columns"] = ["col1"]
        fields["filter"] = [{"col": adhoc, "op": "==", "val": 1}]
    query = QueryObject(
        datasource=virtual,
        columns=fields["columns"],
        groupby=fields.get("groupby"),
        metrics=[],
        filters=fields.get("filter"),
    )
    cache_keys = []
    predicates = []
    for user_id in (1, 2):
        g.user = User(id=user_id, username=f"viewer{user_id}")
        extra_keys = virtual.get_extra_cache_keys(query.to_dict())
        cache_keys.append(query.cache_key(extra_cache_keys=extra_keys))
        predicates.append(extra_keys)
        result = virtual.get_query_result(query)
        assert result.status == "success"
        assert result.df["col1" if sink == "filter" else "axis"].tolist() == (
            ([1] if user_id == 1 else []) if sink == "filter" else [user_id]
        )
    assert cache_keys[0] != cache_keys[1]
    assert predicates == [[PHYSICAL_RLS_KEYS[1]], [PHYSICAL_RLS_KEYS[2]]]


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize("protected_first", [True, False])
@pytest.mark.parametrize("exact_name", [True, False])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_duplicate_verbose_filter_cache_keys_are_user_scoped(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    protected_first: bool,
    exact_name: bool,
) -> None:
    """Filters prefer real names, then the first verbose match, in SQL and keys."""
    from flask import g
    from flask_appbuilder.security.sqla.models import User

    virtual, _ = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1, 1 AS plain, 1 AS caption"
    protected = TableColumn(
        column_name="calculated",
        verbose_name="caption",
        type="INTEGER",
        expression="(SELECT MAX(col1) FROM physical)",
    )
    plain = TableColumn(column_name="plain", verbose_name="caption", type="INTEGER")
    virtual.columns.extend(
        [protected, plain] if protected_first else [plain, protected]
    )
    if exact_name:
        virtual.columns.append(TableColumn(column_name="caption", type="INTEGER"))
    # The saved metric fallback must lose to the resolved saved column.
    virtual.metrics.append(SqlMetric(metric_name="caption", expression="{{ 1 / 0 }}"))
    query = QueryObject(
        datasource=virtual,
        columns=["col1"],
        metrics=[],
        filters=[{"col": "caption", "op": "==", "val": 1}],
    )
    rules = {
        user_id: MagicMock(clause=f"col1 = {user_id}", group_key=None)
        for user_id in (1, 2)
    }
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        side_effect=lambda dataset: [rules[g.user.id]] if dataset.id == 1 else [],
    )
    cache_keys = []
    predicates = []
    uses_subquery = protected_first and not exact_name
    for user_id in (1, 2):
        g.user = User(id=user_id, username=f"viewer{user_id}")
        extra_keys = virtual.get_extra_cache_keys(query.to_dict())
        cache_keys.append(query.cache_key(extra_cache_keys=extra_keys))
        predicates.append(extra_keys)
        result = virtual.get_query_result(query)
        assert result.status == "success"
        assert result.df["col1"].tolist() == (
            [] if uses_subquery and user_id == 2 else [1]
        )
    assert (cache_keys[0] != cache_keys[1]) == uses_subquery
    assert predicates == (
        [[PHYSICAL_RLS_KEYS[1]], [PHYSICAL_RLS_KEYS[2]]] if uses_subquery else [[], []]
    )


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable, Query], indirect=True)
@pytest.mark.parametrize(
    "unused_expression",
    [
        "{{ 1 / 0 }}",
        "(SELECT MAX(col1) FROM physical) + {{ 1 / 0 }}",
        "(FROM physical) + {{ 1 / 0 }}",
    ],
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_uses_only_executed_time_column(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    unused_expression: str,
) -> None:
    """A valid SQL Lab time column and an unused broken primary column are safe."""
    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT '2020-01-01' AS ds, 1 AS col1"
    if isinstance(virtual, SqlaTable):
        virtual.columns.extend(
            [
                TableColumn(column_name="ds", type="DATETIME", is_dttm=True),
                TableColumn(
                    column_name="unused",
                    type="DATETIME",
                    is_dttm=True,
                    expression=unused_expression,
                ),
            ]
        )
        virtual.main_dttm_col = "unused"
        virtual.always_filter_main_dttm = False
    else:
        virtual.extra = {
            "columns": [
                {"column_name": "ds", "type": "DATETIME", "is_dttm": True},
                {"column_name": "col1", "type": "INTEGER", "is_dttm": False},
            ]
        }
    query = QueryObject(
        datasource=virtual,
        columns=["col1"],
        granularity="ds",
        is_timeseries=True,
        metrics=[],
    )
    # Execution succeeds before the cache lookup; cache collection must agree.
    assert (
        "ds"
        in virtual.get_sqla_query(
            columns=["col1"], granularity="ds", is_timeseries=True, metrics=[]
        )
        .sqla_query.compile()
        .string
    )
    assert virtual.get_extra_cache_keys(query.to_dict()) == []


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize("granularity", ["ds", "not_temporal"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_collects_effective_primary_time_column(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    granularity: str,
) -> None:
    """Fallback and always-filter-primary time expressions still contribute RLS."""
    virtual, rule = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT '2020-01-01' AS ds, 1 AS col1"
    virtual.columns.extend(
        [
            TableColumn(column_name="ds", type="DATETIME", is_dttm=True),
            TableColumn(
                column_name="not_temporal", type="INTEGER", expression="{{ 1 / 0 }}"
            ),
            TableColumn(
                column_name="primary",
                type="DATETIME",
                is_dttm=True,
                expression="(SELECT '2020-01-01' FROM physical LIMIT 1)",
            ),
        ]
    )
    virtual.main_dttm_col = "primary"
    virtual.always_filter_main_dttm = granularity == "ds"
    query = QueryObject(
        datasource=virtual,
        columns=["col1"],
        granularity=granularity,
        is_timeseries=True,
        metrics=[],
    )
    assert "col1 = 1" in str(
        virtual.get_sqla_query(
            columns=["col1"],
            granularity=granularity,
            from_dttm=datetime(2020, 1, 1),
            is_timeseries=True,
            metrics=[],
        ).sqla_query
    )
    assert virtual.get_extra_cache_keys(query.to_dict()) == [PHYSICAL_RLS_KEYS[1]]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys(query.to_dict()) == [PHYSICAL_RLS_KEYS[2]]


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize("sink", ["metrics", "orderby", "series_limit_metric"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_sql_metric_cache_key_does_not_resolve_saved_column(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    sink: str,
) -> None:
    """SQL metrics use SQL literally, even if it names a saved calculated column."""
    virtual, _ = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    virtual.columns.append(
        TableColumn(column_name="calculated", expression="{{ 1 / 0 }}")
    )
    metric: AdhocMetric = {
        "expressionType": "SQL",
        "sqlExpression": "calculated",
        "label": "total",
    }
    query: QueryObjectDict = {
        "columns": ["col1"],
        "metrics": [],
        "is_timeseries": False,
    }
    if sink == "metrics":
        query["metrics"] = [metric]
    elif sink == "orderby":
        query["orderby"] = [(metric, True)]
    else:
        query["series_limit"] = 1
        query["series_limit_metric"] = metric
    assert (
        str(
            virtual.adhoc_metric_to_sqla(
                metric, {c.column_name: c for c in virtual.columns}
            )
        )
        == "calculated"
    )
    assert virtual.get_extra_cache_keys(query) == []


def test_rls_schema_fallback_documented(mocker: MockerFixture) -> None:
    """Document the configured-schema fallback retained when discovery is empty."""
    from superset.utils.rls import get_rls_schema

    database = MagicMock()
    database.db_engine_spec.supports_dynamic_schema = False
    database.resolve_query_default_schema.return_value = None
    assert (
        get_rls_schema(database, None, "configured", "SELECT * FROM physical")
        == "configured"
    )
    documentation = (
        Path(__file__).resolve().parents[4] / "docs/admin_docs/security/security.mdx"
    ).read_text()
    assert "execution schema takes precedence" in documentation
    assert "dataset schema remains the fallback" in documentation


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize(
    "sink", ["column_name", "adhoc_column", "groupby", "orderby", "metric_label"]
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_expression_cache_key_ignores_shadowed_references(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    sink: str,
) -> None:
    """Namespace aliases and overridden selections must not render unused SQL."""
    virtual, _ = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1, 1 AS caption"
    virtual.columns.append(
        TableColumn(
            column_name="calculated", verbose_name="caption", expression="{{ 1 / 0 }}"
        )
    )
    virtual.metrics.append(SqlMetric(metric_name="axis", expression="{{ 1 / 0 }}"))
    query: QueryObjectDict = {
        "columns": ["caption"],
        "metrics": [],
        "is_timeseries": False,
    }
    if sink == "adhoc_column":
        query["columns"] = [{"sqlExpression": "caption", "label": "axis"}]
    elif sink == "groupby":
        query["columns"] = ["calculated"]
        query["groupby"] = ["col1"]
    elif sink == "orderby":
        query["columns"] = [{"sqlExpression": "col1", "label": "axis"}]
        query["orderby"] = [("axis", True)]
    elif sink == "metric_label":
        query["columns"] = ["col1"]
        query["metrics"] = [
            {
                "expressionType": "SQL",
                "sqlExpression": "MAX(col1)",
                "label": "calculated",
            }
        ]
        query["orderby"] = [("calculated", True)]
    executed = virtual.get_sqla_query(
        columns=query.get("columns"),
        groupby=query.get("groupby"),
        metrics=query.get("metrics"),
        orderby=query.get("orderby"),
        is_timeseries=False,
    )
    assert "virtual_table" in str(executed.sqla_query)
    assert virtual.get_extra_cache_keys(query) == []


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize("sink", ["filter", "orderby"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_groupby_alias_retains_saved_column_rls(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    sink: str,
) -> None:
    """Labels used outside an overriding GROUP BY must retain their saved SQL."""
    virtual, rule = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    virtual.columns.append(
        TableColumn(
            column_name="calculated",
            type="INTEGER",
            expression="(SELECT MAX(col1) FROM physical)",
        )
    )
    query: QueryObjectDict = {
        "columns": [
            cast(
                AdhocColumn,
                {
                    "sqlExpression": "calculated",
                    "label": "axis",
                    "expressionType": "SQL",
                },
            )
        ],
        "groupby": ["col1"],
        "metrics": [],
        "is_timeseries": False,
    }
    if sink == "filter":
        query["filter"] = [{"col": "axis", "op": "==", "val": 1}]
    else:
        query["orderby"] = [("axis", True)]
    executed = virtual.get_sqla_query(
        columns=query.get("columns"),
        groupby=query.get("groupby"),
        metrics=[],
        filter=query.get("filter"),
        orderby=query.get("orderby"),
        is_timeseries=False,
    )
    assert "col1 = 1" in str(executed.sqla_query)
    assert virtual.get_extra_cache_keys(query) == [PHYSICAL_RLS_KEYS[1]]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys(query) == [PHYSICAL_RLS_KEYS[2]]


@pytest.mark.parametrize(
    "static_schema_datasource,template_source",
    [
        (SqlaTable, "raw"),
        (SqlaTable, "parameter"),
        (Query, "raw"),
        (Query, "raw_division"),
    ],
    indirect=["static_schema_datasource"],
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_adhoc_metric_literal_template_cache_request(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    template_source: str,
) -> None:
    """Literal Jinja produced by one render must survive cache-key acquisition."""
    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    virtual.template_params = '{"literal": "{{ 1 / 0 }}", "x": "not literal"}'
    expression = (
        "MAX('{% raw %}{{ 1 / 0 }}{% endraw %}')"
        if template_source == "raw_division"
        else "MAX('{% raw %}{{ x }}{% endraw %}')"
        if template_source == "raw"
        else "MAX('{{ literal }}')"
    )
    expected = "{{ x }}" if template_source == "raw" else "{{ 1 / 0 }}"
    query = QueryObject(
        datasource=virtual,
        columns=[],
        metrics=[
            {"expressionType": "SQL", "sqlExpression": expression, "label": "total"}
        ],
    )
    # Execution is valid independently of cache-key collection.
    executed = virtual.get_query_result(query)
    assert executed.status == "success"
    assert executed.df["total"].tolist() == [expected]
    render = mocker.spy(BaseTemplateProcessor, "process_template")
    parse = mocker.spy(helpers, "SQLStatement")
    assert virtual.get_extra_cache_keys(query.to_dict()) == []
    assert [
        call.args[1]
        for call in render.call_args_list
        if call.args[1] in {expression, f"MAX('{expected}')"}
    ] == []
    parse.assert_not_called()

    cache = MagicMock(is_loaded=True, status="success", bq_memory_limited=False)
    cache.df = executed.df
    lookup = mocker.patch(
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
    result = processor.get_df_payload_result(query)
    assert result.payload["status"] == "success"
    assert result.payload["df"]["total"].tolist() == [expected]
    lookup.assert_called_once()
    cache.set_query_result.assert_not_called()


@pytest.mark.parametrize(
    "sink",
    ["column", "groupby", "metric", "orderby", "filter", "series", "where", "having"],
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_single_render_subquery_cache_keys_are_user_scoped(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    sink: str,
) -> None:
    """A second-pass Jinja conditional must not hide an executed RLS subquery."""
    from flask import g
    from flask_appbuilder.security.sqla.models import User

    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    expression = (
        "0 /*{% raw %}{% if false %}{% endraw %}*/"
        " + (SELECT MAX(col1) FROM physical)"
        " /*{% raw %}{% endif %}{% endraw %}*/"
    )
    column: AdhocColumn = {"sqlExpression": expression, "label": "axis"}
    metric: AdhocMetric = {
        "expressionType": "SQL",
        "sqlExpression": f"MAX({expression})",
        "label": "total",
    }
    fields: QueryObjectDict = {"columns": ["col1"], "metrics": []}
    if sink == "column":
        fields["columns"] = [column]
    elif sink == "groupby":
        fields["groupby"] = [column]
    elif sink == "metric":
        fields["columns"] = []
        fields["metrics"] = [metric]
    elif sink == "orderby":
        fields["orderby"] = [(metric, True)]
    elif sink == "filter":
        fields["filter"] = [{"col": column, "op": "==", "val": 1}]
    elif sink == "series":
        fields["metrics"] = [
            {"expressionType": "SQL", "sqlExpression": "MAX(col1)", "label": "main"}
        ]
        fields["series_limit"] = 1
        fields["series_limit_metric"] = metric
    else:
        fields["metrics"] = [
            {"expressionType": "SQL", "sqlExpression": "MAX(col1)", "label": "main"}
        ]
        fields["extras"] = {sink: f"1 = {expression}"}
    query = QueryObject(
        datasource=virtual,
        columns=fields["columns"],
        groupby=fields.get("groupby"),
        metrics=fields["metrics"],
        filters=fields.get("filter"),
        orderby=fields.get("orderby"),
        extras=fields.get("extras"),
        series_columns=["col1"],
        series_limit=fields.get("series_limit") or 0,
        series_limit_metric=fields.get("series_limit_metric"),
    )
    rules = {
        user_id: MagicMock(clause=f"col1 = {user_id}", group_key=None)
        for user_id in (1, 2)
    }
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        side_effect=lambda dataset: [rules[g.user.id]] if dataset.id == 1 else [],
    )
    predicates = []
    cache_keys = []
    for user_id in (1, 2):
        g.user = User(id=user_id, username=f"viewer{user_id}")
        executed = virtual.get_query_result(query)
        assert executed.status == "success"
        assert f"col1 = {user_id}" in executed.query
        if sink in {"column", "groupby", "metric"}:
            assert executed.df["total" if sink == "metric" else "axis"].tolist() == [
                user_id
            ]
        extra_keys = virtual.get_extra_cache_keys(query.to_dict())
        predicates.append(extra_keys)
        cache_keys.append(query.cache_key(extra_cache_keys=extra_keys))
    assert predicates == [[PHYSICAL_RLS_KEYS[1]], [PHYSICAL_RLS_KEYS[2]]]
    assert cache_keys[0] != cache_keys[1]


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize(
    "sink", ["column", "metric", "adhoc_reference", "filter", "fetch"]
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_stored_expression_cache_collection_renders_once(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    sink: str,
) -> None:
    """Stored SQL still renders once when discovery returns fully rendered SQL."""
    virtual, rule = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    expression = (
        "0 /*{% raw %}{% if false %}{% endraw %}*/"
        " + (SELECT MAX(col1) FROM physical)"
        " /*{% raw %}{% endif %}{% endraw %}*/"
    )
    virtual.columns.append(
        TableColumn(column_name="calculated", type="INTEGER", expression=expression)
    )
    virtual.metrics.append(
        SqlMetric(metric_name="total", expression=f"MAX({expression})")
    )
    query: QueryObjectDict = {"columns": ["col1"], "metrics": []}
    if sink == "column":
        query["columns"] = ["calculated"]
    elif sink == "metric":
        query["metrics"] = ["total"]
    elif sink == "adhoc_reference":
        query["columns"] = [{"sqlExpression": "{{ 'calculated' }}", "label": "axis"}]
    elif sink == "filter":
        query["filter"] = [{"col": "calculated", "op": "==", "val": 1}]
    else:
        virtual.fetch_values_predicate = f"1 = {expression}"
        query["apply_fetch_values_predicate"] = True
    assert virtual.get_extra_cache_keys(query) == [PHYSICAL_RLS_KEYS[1]]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys(query) == [PHYSICAL_RLS_KEYS[2]]


@pytest.mark.parametrize("name", ["a{#b", "a{%b", "{{ 1/0 }}"])
@pytest.mark.parametrize(
    "sink", ["column", "groupby", "filter", "orderby", "simple_metric"]
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_bare_column_names_are_not_templates_in_cache_collection(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    name: str,
    sink: str,
) -> None:
    """Cache collection must treat plain identifiers exactly as execution does."""
    virtual, _ = static_schema_datasource
    with virtual.database.get_sqla_engine() as engine:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                f'ALTER TABLE physical ADD COLUMN "{name}" INTEGER DEFAULT 1'
            )
    virtual.sql = "SELECT * FROM physical"
    if isinstance(virtual, SqlaTable):
        virtual.columns.append(TableColumn(column_name=name, type="INTEGER"))
    else:
        virtual.extra = {
            "columns": [
                {"column_name": col, "type": "INTEGER", "is_dttm": False}
                for col in ("col1", name)
            ]
        }
    fields: QueryObjectDict = {"columns": ["col1"], "metrics": []}
    if sink == "column":
        fields["columns"] = [name]
    elif sink == "groupby":
        fields["groupby"] = [name]
    elif sink == "filter":
        fields["filter"] = [{"col": name, "op": "==", "val": 1}]
    elif sink == "orderby":
        fields["orderby"] = [(name, True)]
    else:
        fields["columns"] = []
        fields["metrics"] = [
            {
                "expressionType": "SIMPLE",
                "aggregate": "MAX",
                "column": {"column_name": name},
                "label": "total",
            }
        ]
    query = QueryObject(
        datasource=virtual,
        columns=fields["columns"],
        groupby=fields.get("groupby"),
        metrics=fields["metrics"],
        filters=fields.get("filter"),
        orderby=fields.get("orderby"),
    )
    executed = virtual.get_query_result(query)
    assert executed.status == "success"
    assert executed.df.iloc[:, 0].tolist() == [1]

    render = mocker.spy(BaseTemplateProcessor, "process_template")
    assert virtual.get_extra_cache_keys(query.to_dict()) == [PHYSICAL_RLS_KEYS[1]]
    assert name not in [call.args[1] for call in render.call_args_list]


@pytest.mark.parametrize("base_reads_both", [False, True])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_swapped_table_rules_have_distinct_cache_keys(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    session: Session,
    mocker: MockerFixture,
    base_reads_both: bool,
) -> None:
    """Swapping predicates between tables must not reuse another viewer's result."""
    virtual, _ = static_schema_datasource
    database = virtual.database
    engine = database._get_sqla_engine()  # pylint: disable=protected-access
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE t1 (tenant_id INTEGER, amount INTEGER)"
        )
        connection.exec_driver_sql(
            "CREATE TABLE t2 (tenant_id INTEGER, amount INTEGER)"
        )
        connection.exec_driver_sql("INSERT INTO t1 VALUES (1, 10), (2, 20)")
        connection.exec_driver_sql("INSERT INTO t2 VALUES (1, 100), (2, 200)")
    tables = [
        SqlaTable(id=i, table_name=name, schema="main", database=database)
        for i, name in ((3, "t1"), (4, "t2"))
    ]
    session.add_all(tables)
    session.flush()
    virtual.sql = (
        "SELECT t1.amount + t2.amount AS amount FROM t1 CROSS JOIN t2"
        if base_reads_both
        else "SELECT amount FROM t1"
    )
    if isinstance(virtual, SqlaTable):
        virtual.columns = [TableColumn(column_name="amount", type="INTEGER")]
    else:
        virtual.extra = {
            "columns": [{"column_name": "amount", "type": "INTEGER", "is_dttm": False}]
        }
    metric = "MAX(amount)"
    if not base_reads_both:
        metric += " + (SELECT SUM(amount) FROM t2)"
    query = QueryObject(
        datasource=virtual,
        columns=[],
        metrics=[{"expressionType": "SQL", "sqlExpression": metric, "label": "value"}],
    )
    rule1 = MagicMock(clause="tenant_id = 1", group_key=None)
    rule2 = MagicMock(clause="tenant_id = 2", group_key=None)
    keys = []
    results = []
    for rules in ((rule1, rule2), (rule2, rule1)):
        mocker.patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            side_effect=lambda dataset, rules=rules: (
                [rules[dataset.id - 3]] if dataset.id in (3, 4) else []
            ),
        )
        keys.append(
            query.cache_key(
                extra_cache_keys=virtual.get_extra_cache_keys(query.to_dict())
            )
        )
        result = virtual.get_query_result(query)
        assert result.status == "success"
        results.append(result.df["value"].item())
    assert results == [210, 120]
    assert keys[0] != keys[1]


@pytest.mark.parametrize(
    "validator",
    [
        "adhoc",
        "stored",
        "stored_fragment",
        "rendered",
        "select",
        "metric_select",
        "orderby",
        "metric_orderby",
    ],
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_comment_keywords_survive_rls_expression_unwrap(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    validator: str,
) -> None:
    """Synthetic clauses must not be stripped at keywords inside comments."""
    virtual, _ = static_schema_datasource
    expression = (
        "/* SELECT reporting value */ (SELECT MAX(col1) FROM physical)"
        if validator in {"adhoc", "stored"}
        else "/* SELECT reporting value ORDER BY */ (SELECT MAX(col1) FROM physical)"
    )
    if validator == "stored_fragment":
        expression = expression.replace("*/ ", "*/ DISTINCT ", 1)
    database = virtual.database
    if validator == "adhoc":
        validated = helpers.validate_adhoc_subquery(
            expression, database, None, "main", "sqlite"
        )
    elif validator in {"stored", "stored_fragment"}:
        validated = validate_stored_expression_at_query_time(
            expression, database, None, "main", "sqlite"
        )
    elif validator == "rendered":
        validated = validate_rendered_expression(expression, database, None, "main")
    else:
        method = getattr(virtual, f"_process_{validator}_expression")
        validated = method(expression, "sqlite", "main", None)
    assert validated is not None
    assert "col1 = 1" in validated
    engine = database._get_sqla_engine()  # pylint: disable=protected-access
    with engine.connect() as connection:
        assert connection.exec_driver_sql(f"SELECT {validated}").scalar() == 1


@pytest.mark.parametrize(
    "method", ["select", "metric_select", "orderby", "metric_orderby"]
)
def test_comment_unwrap_preserves_numeric_precision(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    method: str,
) -> None:
    """Unwrapping comments must not introduce Postgres ROUND/DECIMAL rewrites."""
    virtual, _ = static_schema_datasource
    expression = "/* SELECT reporting ORDER BY */ ROUND(AVG(col1), 2)"
    processed = getattr(virtual, f"_process_{method}_expression")(
        expression, "postgresql", "main", None
    )
    assert processed is not None
    prefix = "SELECT 1 ORDER BY" if "orderby" in method else "SELECT"
    SQLStatement(f"{prefix} {processed}", "postgresql")
    assert "CAST" not in processed.upper()


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_skips_removed_primary_time_column(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """Primary time column removed by get_time_filter(remove_filter=True)."""
    virtual, _ = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = (
        "SELECT '2020-01-01' AS ds, 1 AS col1 "
        "/*{% set _t = get_time_filter('primary', remove_filter=True) %}*/"
    )
    virtual.columns.extend(
        [
            TableColumn(column_name="ds", type="DATETIME", is_dttm=True),
            TableColumn(
                column_name="primary",
                type="DATETIME",
                is_dttm=True,
                expression="{{ 1 / 0 }}",
            ),
        ]
    )
    virtual.main_dttm_col = "primary"
    virtual.always_filter_main_dttm = True
    form_data = {
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": "primary",
                "operator": "TEMPORAL_RANGE",
                "comparator": "No filter",
            }
        ]
    }
    mocker.patch("superset.views.utils.get_form_data", return_value=(form_data, None))
    query = QueryObject(
        datasource=virtual,
        columns=["col1"],
        granularity="ds",
        is_timeseries=True,
        metrics=[],
    )
    result = virtual.get_query_result(query)
    assert result.status == "success"
    assert virtual.get_extra_cache_keys(query.to_dict()) == []


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable, Query], indirect=True)
@pytest.mark.parametrize("filter_name", ["broken", "caption"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_skips_removed_filter_column(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    filter_name: str,
) -> None:
    """Filter column removed by get_filters(remove_filter=True)."""
    virtual, _ = static_schema_datasource
    virtual.sql = (
        "SELECT 1 AS col1 /*{% set _f = get_filters('"
        + filter_name
        + "', remove_filter=True) %}*/"
    )
    columns = [
        *virtual.columns,
        TableColumn(
            column_name="broken",
            verbose_name="caption",
            type="INTEGER",
            expression="{{ 1 / 0 }}",
        ),
    ]
    if isinstance(virtual, SqlaTable):
        virtual.columns = columns
    else:
        mocker.patch.object(
            Query, "columns", new_callable=PropertyMock, return_value=columns
        )
    form_data = {
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": filter_name,
                "operator": "==",
                "comparator": 1,
            }
        ]
    }
    mocker.patch("superset.views.utils.get_form_data", return_value=(form_data, None))
    query = QueryObject(
        datasource=virtual,
        columns=["col1"],
        metrics=[],
        filters=[{"col": filter_name, "op": "==", "val": 1}],
    )
    result = virtual.get_query_result(query)
    assert result.status == "success"
    assert virtual.get_extra_cache_keys(query.to_dict()) == []


@pytest.mark.parametrize("removed_column", ["ds", "__timestamp"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_skips_removed_time_filter_column(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    removed_column: str,
) -> None:
    """Removed time filters need neither the granularity nor its alias rendered."""
    virtual, _ = static_schema_datasource
    virtual.sql = (
        "SELECT 1 AS col1 "
        "/*{% set _t = get_time_filter('"
        + removed_column
        + "', remove_filter=True) %}*/"
    )
    columns = [
        *virtual.columns,
        TableColumn(
            column_name="ds", type="DATETIME", is_dttm=True, expression="{{ 1 / 0 }}"
        ),
    ]
    if isinstance(virtual, SqlaTable):
        virtual.columns = columns
    else:
        mocker.patch.object(
            Query, "columns", new_callable=PropertyMock, return_value=columns
        )
    form_data = {
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": removed_column,
                "operator": "TEMPORAL_RANGE",
                "comparator": "No filter",
            }
        ]
    }
    mocker.patch("superset.views.utils.get_form_data", return_value=(form_data, None))
    query = QueryObject(
        datasource=virtual,
        columns=["col1"],
        metrics=[],
        granularity="ds",
        is_timeseries=False,
        filters=[{"col": "__timestamp", "op": "TEMPORAL_RANGE", "val": "No filter"}],
    )
    assert virtual.get_query_result(query).status == "success"
    assert virtual.get_extra_cache_keys(query.to_dict()) == []


@pytest.mark.parametrize("sink", ["column", "timeseries"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_keeps_removed_filter_column_when_selected(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    sink: str,
) -> None:
    """Removing a filter must not remove selected/grouped expression RLS."""
    virtual, rule = static_schema_datasource
    virtual.sql = (
        "SELECT 1 AS col1 /*{% set _t = get_time_filter('ds', remove_filter=True) %}*/"
    )
    columns = [
        *virtual.columns,
        TableColumn(
            column_name="ds",
            type="DATETIME",
            is_dttm=True,
            expression="(SELECT '2020-01-01' FROM physical LIMIT 1)",
            database=virtual.database,
        ),
    ]
    if isinstance(virtual, SqlaTable):
        virtual.columns = columns
    else:
        mocker.patch.object(
            Query, "columns", new_callable=PropertyMock, return_value=columns
        )
    form_data = {
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": "ds",
                "operator": "TEMPORAL_RANGE",
                "comparator": "No filter",
            }
        ]
    }
    mocker.patch("superset.views.utils.get_form_data", return_value=(form_data, None))
    query = QueryObject(
        datasource=virtual,
        columns=["ds"] if sink == "column" else ["col1"],
        metrics=[],
        granularity="ds",
        is_timeseries=sink == "timeseries",
        filters=[{"col": "__timestamp", "op": "TEMPORAL_RANGE", "val": "No filter"}],
    )
    assert virtual.get_query_result(query).status == "success"
    render = mocker.spy(BaseTemplateProcessor, "process_template")
    assert virtual.get_extra_cache_keys(query.to_dict()) == [PHYSICAL_RLS_KEYS[1]]
    assert [call.args[1] for call in render.call_args_list].count(
        columns[-1].expression
    ) == 1
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys(query.to_dict()) == [PHYSICAL_RLS_KEYS[2]]


@pytest.mark.parametrize("sink", ["adhoc", "metric", "adhoc_label"])
@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_removed_filter_only_renders_non_subquery_during_execution(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    sink: str,
) -> None:
    """Execution renders adhoc/metric filters before checking removal state."""
    virtual, _ = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = (
        "SELECT 1 AS col1 /*{% set _f = get_filters('broken', remove_filter=True) %}*/"
    )
    expression: AdhocColumn = {"sqlExpression": "{{ 1 / 0 }}", "label": "broken"}
    columns: list[str | AdhocColumn] = ["col1"]
    if sink == "metric":
        virtual.metrics.append(
            SqlMetric(metric_name="broken", expression="{{ 1 / 0 }}")
        )
    elif sink == "adhoc_label":
        columns.append(expression)
    form_data = {
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": "broken",
                "operator": "==",
                "comparator": 1,
            }
        ]
    }
    mocker.patch("superset.views.utils.get_form_data", return_value=(form_data, None))
    query = QueryObject(
        datasource=virtual,
        columns=columns,
        metrics=[],
        filters=[
            {"col": expression if sink == "adhoc" else "broken", "op": "==", "val": 1}
        ],
    )
    with pytest.raises(ZeroDivisionError):
        virtual.get_query_result(query)
    assert virtual.get_extra_cache_keys(query.to_dict()) == []


@pytest.mark.parametrize("missing", ["col", "op"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_skips_incomplete_filters(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    missing: str,
) -> None:
    """Incomplete filters are ignored before their columns reach the renderer."""
    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    columns = [
        *virtual.columns,
        TableColumn(column_name="broken", expression="{{ 1 / 0 }}"),
    ]
    if isinstance(virtual, SqlaTable):
        virtual.columns = columns
    else:
        mocker.patch.object(
            Query, "columns", new_callable=PropertyMock, return_value=columns
        )
    flt: QueryObjectFilterClause = {"val": 1}
    if missing != "col":
        flt["col"] = "broken"
    if missing != "op":
        flt["op"] = "=="
    query: QueryObjectDict = {"columns": ["col1"], "metrics": [], "filter": [flt]}
    assert "col1" in str(
        virtual.get_sqla_query(
            columns=["col1"], metrics=[], filter=[flt], is_timeseries=False
        ).sqla_query
    )
    assert virtual.get_extra_cache_keys(query) == []


@pytest.mark.parametrize("no_groupby", [True, False])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_skips_unused_series_limit_metric(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    no_groupby: bool,
) -> None:
    """An enabled series limit still needs matching grouped series to render SQL."""
    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    query: QueryObjectDict = {
        "columns": [] if no_groupby else ["col1"],
        "metrics": [
            {"expressionType": "SQL", "sqlExpression": "MAX(col1)", "label": "total"}
        ],
        "is_timeseries": False,
        "series_limit": 1,
        "series_columns": ["col1"] if no_groupby else ["not_selected"],
        "series_limit_metric": {
            "expressionType": "SQL",
            "sqlExpression": "{{ 1 / 0 }}",
            "label": "unused",
        },
    }
    assert "col1" in str(
        virtual.get_sqla_query(
            columns=query["columns"],
            metrics=query["metrics"],
            is_timeseries=False,
            series_limit=1,
            series_columns=query["series_columns"],
            series_limit_metric=query["series_limit_metric"],
        ).sqla_query
    )
    assert virtual.get_extra_cache_keys(query) == []


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_cache_key_skips_selected_timestamp_pseudo_column(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """Execution discards the pseudo column before resolving selected metadata."""
    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    columns = [
        *virtual.columns,
        TableColumn(column_name="__timestamp", expression="{{ 1 / 0 }}"),
    ]
    if isinstance(virtual, SqlaTable):
        virtual.columns = columns
    else:
        mocker.patch.object(
            Query, "columns", new_callable=PropertyMock, return_value=columns
        )
    query = QueryObject(
        datasource=virtual,
        columns=["col1", "__timestamp"],
        metrics=[],
        is_timeseries=False,
    )
    assert virtual.get_query_result(query).status == "success"
    assert virtual.get_extra_cache_keys(query.to_dict()) == []


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_cache_key_collects_series_metric_for_normalized_labels(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """Engine-compatible series labels still select their limit metric's RLS."""
    virtual, rule = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    mocker.patch.object(
        virtual.db_engine_spec,
        "make_label_compatible",
        side_effect=lambda name: name.replace(" ", "_"),
    )
    query: QueryObjectDict = {
        "columns": [{"sqlExpression": "col1", "label": "series label"}],
        "metrics": [
            {"expressionType": "SQL", "sqlExpression": "MAX(col1)", "label": "total"}
        ],
        "is_timeseries": False,
        "series_limit": 1,
        "series_columns": ["series_label"],
        "series_limit_metric": {
            "expressionType": "SQL",
            "sqlExpression": "MAX((SELECT MAX(col1) FROM physical))",
            "label": "restricted",
        },
    }
    assert "col1 = 1" in str(
        virtual.get_sqla_query(
            columns=query["columns"],
            metrics=query["metrics"],
            is_timeseries=False,
            series_limit=1,
            series_columns=query["series_columns"],
            series_limit_metric=query["series_limit_metric"],
            execute_prequeries=False,
        ).sqla_query
    )
    assert virtual.get_extra_cache_keys(query) == [PHYSICAL_RLS_KEYS[1]]
    rule.clause = "col1 = 2"
    assert virtual.get_extra_cache_keys(query) == [PHYSICAL_RLS_KEYS[2]]


@pytest.mark.parametrize(
    ("static_schema_datasource", "sink"),
    [
        (datasource, sink)
        for datasource in (SqlaTable, Query)
        for sink in (
            "columns",
            "groupby",
            "orderby_adhoc",
            "orderby_saved",
            "series",
            "series_prequery",
        )
        if datasource is SqlaTable or sink != "orderby_saved"
    ],
    indirect=["static_schema_datasource"],
)
@pytest.mark.parametrize("single_render", [False, True])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_raw_string_groupby_cache_keys_are_user_scoped(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    sink: str,
    single_render: bool,
) -> None:
    """Unknown GROUP BY strings are SQL, including grouping enabled by ORDER BY."""
    from flask import g
    from flask_appbuilder.security.sqla.models import User

    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    expression = "(SELECT MAX(col1) FROM physical)"
    if single_render:
        expression = (
            "0 /*{% raw %}{% if false %}{% endraw %}*/ + "
            + expression
            + " /*{% raw %}{% endif %}{% endraw %}*/"
        )
    metric: AdhocMetric = {
        "expressionType": "SQL",
        "sqlExpression": "COUNT(*)",
        "label": "total",
    }
    fields: QueryObjectDict = {"columns": [expression], "metrics": [metric]}
    if sink == "groupby":
        fields.update({"columns": ["col1"], "groupby": [expression], "metrics": None})
    elif sink == "orderby_adhoc":
        fields.update({"metrics": None, "orderby": [(metric, True)]})
    elif sink == "orderby_saved":
        assert isinstance(virtual, SqlaTable)
        virtual.metrics = [SqlMetric(metric_name="total", expression="COUNT(*)")]
        fields.update({"metrics": None, "orderby": [("total", True)]})
    elif sink in {"series", "series_prequery"}:
        if sink == "series_prequery":
            mocker.patch.object(virtual.db_engine_spec, "allows_joins", False)
        fields.update(
            {
                "columns": [expression, "col1"],
                "series_columns": ["col1"],
                "series_limit": 1,
                "series_limit_metric": metric,
            }
        )
    query = QueryObject(
        datasource=virtual,
        columns=fields["columns"],
        metrics=fields["metrics"],
        groupby=fields.get("groupby"),
        orderby=fields.get("orderby"),
        series_columns=fields.get("series_columns"),
        series_limit=fields.get("series_limit") or 0,
        series_limit_metric=fields.get("series_limit_metric"),
        is_timeseries=False,
    )
    query_dict = query.to_dict()
    if sink == "groupby":
        # QueryObject normalizes this legacy field into columns. Pin the direct
        # datasource entry point as well, where groupby is still accepted.
        query_dict.update(
            {"columns": ["col1"], "groupby": [expression], "metrics": None}
        )
    rules = {
        user_id: MagicMock(clause=f"col1 = {user_id}", group_key=None)
        for user_id in (1, 2)
    }
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        side_effect=lambda dataset: [rules[g.user.id]] if dataset.id == 1 else [],
    )
    predicates = []
    cache_keys = []
    rendered_sources = []
    for user_id in (1, 2):
        g.user = User(id=user_id, username=f"viewer{user_id}")
        executed = virtual.query(query_dict)
        assert executed.status == "success", executed.error_message
        assert executed.df.iloc[:, 0].tolist() == [user_id]
        assert f"col1 = {user_id}" in executed.query
        render = mocker.spy(BaseTemplateProcessor, "process_template")
        extra_keys = virtual.get_extra_cache_keys(query_dict)
        # Collect the original SQL once, never its already-rendered output.
        rendered_sources.append(
            [
                call.args[1]
                for call in render.call_args_list
                if "SELECT MAX(col1) FROM physical" in call.args[1]
            ]
        )
        mocker.stop(render)
        predicates.append(extra_keys)
        cache_keys.append(query.cache_key(extra_cache_keys=extra_keys))
    assert cache_keys[0] != cache_keys[1], predicates
    assert predicates == [[PHYSICAL_RLS_KEYS[1]], [PHYSICAL_RLS_KEYS[2]]]
    assert rendered_sources == [[expression], [expression]]


@pytest.mark.parametrize("templated", [False, True])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_raw_string_detail_selection_matches_execution(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    templated: bool,
) -> None:
    """Ungrouped unknown strings are quoted before their single template pass."""
    from flask import g
    from flask_appbuilder.security.sqla.models import User

    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    expression = "(SELECT MAX(col1) FROM physical)"
    if templated:
        # Quoting precedes rendering: Jinja opens an SQL expression afterward.
        expression = r"{{ '\x22' }} || (SELECT MAX(col1) FROM physical) || {{ '\x22' }}"
    query = QueryObject(
        datasource=virtual, columns=[expression], metrics=None, is_timeseries=False
    )
    rules = {
        user_id: MagicMock(clause=f"col1 = {user_id}", group_key=None)
        for user_id in (1, 2)
    }
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        side_effect=lambda dataset: [rules[g.user.id]] if dataset.id == 1 else [],
    )
    cache_keys = []
    for user_id in (1, 2):
        g.user = User(id=user_id, username=f"viewer{user_id}")
        executed = virtual.get_query_result(query)
        assert executed.status == "success", executed.error_message
        assert executed.df.iloc[:, 0].tolist() == [
            str(user_id) if templated else expression
        ]
        render = mocker.spy(BaseTemplateProcessor, "process_template")
        parse = mocker.spy(helpers, "SQLStatement")
        extra_keys = virtual.get_extra_cache_keys(query.to_dict())
        assert extra_keys == ([PHYSICAL_RLS_KEYS[user_id]] if templated else [])
        assert [
            call.args[1] for call in render.call_args_list if expression in call.args[1]
        ] == ([virtual.database.quote_identifier(expression)] if templated else [])
        parsed_sql = (
            'SELECT "" || (SELECT MAX(col1) FROM physical) || ""'
            if templated
            else f'SELECT "{expression}"'
        )
        if templated:
            parse.assert_called_once_with(parsed_sql, virtual.db_engine_spec.engine)
        else:
            parse.assert_not_called()
        mocker.stop(render)
        mocker.stop(parse)
        cache_keys.append(query.cache_key(extra_cache_keys=extra_keys))
    assert (cache_keys[0] != cache_keys[1]) == templated


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_orderby_grouping_collects_series_metric_rls(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
) -> None:
    """ORDER BY can activate a series metric without metrics or explicit groupby."""
    from flask import g
    from flask_appbuilder.security.sqla.models import User

    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    query = QueryObject(
        datasource=virtual,
        columns=["col1"],
        metrics=None,
        orderby=[
            ({"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "n"}, True)
        ],
        series_columns=["col1"],
        series_limit=1,
        series_limit_metric={
            "expressionType": "SQL",
            "sqlExpression": "MAX((SELECT MAX(col1) FROM physical))",
            "label": "restricted",
        },
        is_timeseries=False,
    )
    rules = {
        user_id: MagicMock(clause=f"col1 = {user_id}", group_key=None)
        for user_id in (1, 2)
    }
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        side_effect=lambda dataset: [rules[g.user.id]] if dataset.id == 1 else [],
    )
    cache_keys = []
    for user_id in (1, 2):
        g.user = User(id=user_id, username=f"viewer{user_id}")
        executed = virtual.get_query_result(query)
        assert executed.status == "success", executed.error_message
        assert f"col1 = {user_id}" in executed.query
        extra_keys = virtual.get_extra_cache_keys(query.to_dict())
        assert extra_keys == [PHYSICAL_RLS_KEYS[user_id]]
        cache_keys.append(query.cache_key(extra_cache_keys=extra_keys))
    assert cache_keys[0] != cache_keys[1]


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize("sink", ["column", "groupby", "filter", "orderby", "x_axis"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_quoted_adhoc_reference_fallback_cache_keys_are_user_scoped(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    sink: str,
) -> None:
    """Missing column references render the quoted source, not its raw output."""
    from flask import g
    from flask_appbuilder.security.sqla.models import User

    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    expression = r"{{ '\x22' }} || (SELECT MAX(col1) FROM physical) || {{ '\x22' }}"
    adhoc: AdhocColumn = {
        "sqlExpression": expression,
        "label": "axis",
        "isColumnReference": True,
    }
    fields: QueryObjectDict = {"columns": [adhoc], "metrics": []}
    if sink == "groupby":
        fields["groupby"] = [adhoc]
    elif sink == "filter":
        fields["columns"] = ["col1"]
        fields["filter"] = [{"col": adhoc, "op": "!=", "val": "0"}]
    elif sink == "orderby":
        # Omit expressionType: this is a selected adhoc column's label,
        # not the separate SQL-metric ORDER BY namespace.
        fields["orderby"] = [("axis", True)]
    elif sink == "x_axis":
        adhoc.update({"columnType": "BASE_AXIS", "timeGrain": "P1D"})
    query = QueryObject(
        datasource=virtual,
        columns=fields["columns"],
        metrics=fields["metrics"],
        groupby=fields.get("groupby"),
        filters=fields.get("filter"),
        orderby=fields.get("orderby"),
        is_timeseries=False,
    )
    rules = {
        user_id: MagicMock(clause=f"col1 = {user_id}", group_key=None)
        for user_id in (1, 2)
    }
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        side_effect=lambda dataset: [rules[g.user.id]] if dataset.id == 1 else [],
    )
    predicates = []
    cache_keys = []
    rendered_sources = []
    for user_id in (1, 2):
        g.user = User(id=user_id, username=f"viewer{user_id}")
        executed = virtual.get_query_result(query)
        assert executed.status == "success", executed.error_message
        assert f"col1 = {user_id}" in executed.query
        assert executed.df.iloc[:, 0].tolist() == [
            1 if sink == "filter" else str(user_id)
        ]
        render = mocker.spy(BaseTemplateProcessor, "process_template")
        extra_keys = virtual.get_extra_cache_keys(query.to_dict())
        rendered_sources.append(
            [
                call.args[1]
                for call in render.call_args_list
                if "SELECT MAX(col1) FROM physical" in call.args[1]
            ]
        )
        mocker.stop(render)
        predicates.append(extra_keys)
        cache_keys.append(query.cache_key(extra_cache_keys=extra_keys))
    assert cache_keys[0] != cache_keys[1], predicates
    assert predicates == [[PHYSICAL_RLS_KEYS[1]], [PHYSICAL_RLS_KEYS[2]]]
    expected_sources = [expression, virtual.database.quote_identifier(expression)]
    if sink == "orderby":
        expected_sources *= 2
    assert rendered_sources == [expected_sources, expected_sources]


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_adhoc_sql_looking_saved_name_matches_datasource_execution(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
) -> None:
    """SqlaTable quotes metadata names; Query executes adhoc SQL even on a match."""
    virtual, rule = static_schema_datasource
    expression = "(SELECT MAX(col1) FROM physical)"
    virtual.sql = f'SELECT 7 AS "{expression}"'
    if isinstance(virtual, SqlaTable):
        virtual.columns = [TableColumn(column_name=expression, type="INTEGER")]
    else:
        virtual.extra = {
            "columns": [
                {"column_name": expression, "type": "INTEGER", "is_dttm": False}
            ]
        }
    query = QueryObject(
        datasource=virtual,
        columns=[{"sqlExpression": expression, "label": "axis"}],
        metrics=[],
        is_timeseries=False,
    )
    for user_id in (1, 2):
        rule.clause = f"col1 = {user_id}"
        executed = virtual.get_query_result(query)
        assert executed.status == "success", executed.error_message
        assert executed.df["axis"].tolist() == [
            7 if isinstance(virtual, SqlaTable) else user_id
        ]
        assert virtual.get_extra_cache_keys(query.to_dict()) == (
            [] if isinstance(virtual, SqlaTable) else [PHYSICAL_RLS_KEYS[user_id]]
        )


@pytest.mark.parametrize(
    "planner", ["join", "no_joins", "no_subqueries", "inline", "no_series_groupby"]
)
@pytest.mark.parametrize("removed_column", ["ds", "__timestamp"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_removed_time_filter_series_limit_cache_matches_execution(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    planner: str,
    removed_column: str,
) -> None:
    """Only the join planner reapplies a removed time filter to top series."""
    virtual, rule = static_schema_datasource
    spec = virtual.db_engine_spec
    mocker.patch.object(spec, "allows_joins", planner != "no_joins")
    mocker.patch.object(spec, "allows_subqueries", planner != "no_subqueries")
    mocker.patch.object(spec, "time_groupby_inline", planner == "inline")
    virtual.sql = (
        "SELECT 1 AS col1 /*{% set _t = get_time_filter('"
        + removed_column
        + "', remove_filter=True) %}*/"
    )
    time_expression = (
        "{{ \"(SELECT CASE WHEN MAX(col1) = 1 THEN '2020-01-01' "
        "ELSE '2022-01-01' END FROM physical)\" }}"
    )
    columns = [
        *virtual.columns,
        TableColumn(
            column_name="ds",
            type="DATETIME",
            is_dttm=True,
            expression=time_expression,
            database=virtual.database,
        ),
    ]
    if isinstance(virtual, SqlaTable):
        virtual.columns = columns
    else:
        mocker.patch.object(
            Query, "columns", new_callable=PropertyMock, return_value=columns
        )
    form_data = {
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": removed_column,
                "operator": "TEMPORAL_RANGE",
                "comparator": "2019-01-01 : 2021-01-01",
            }
        ]
    }
    mocker.patch("superset.views.utils.get_form_data", return_value=(form_data, None))
    query = QueryObject(
        datasource=virtual,
        columns=["col1"],
        metrics=[
            {"expressionType": "SQL", "sqlExpression": "SUM(col1)", "label": "total"}
        ],
        granularity="ds",
        is_timeseries=False,
        from_dttm=datetime(2019, 1, 1),
        to_dttm=datetime(2021, 1, 1),
        series_columns=["missing"] if planner == "no_series_groupby" else ["col1"],
        series_limit=1,
    )
    rows: list[list[int]] = []
    cache_keys: list[str] = []
    rls_keys: list[list[Hashable]] = []
    render_counts: list[int] = []
    uses_inner_time_filter = planner == "join"
    execute = mocker.spy(virtual, "query")
    render = mocker.spy(BaseTemplateProcessor, "process_template")
    for tenant in (1, 2):
        rule.clause = f"col1 = {tenant}"
        execute.reset_mock()
        result = virtual.get_query_result(query)
        assert execute.call_count == (
            2 if planner in {"no_joins", "no_subqueries"} else 1
        )
        assert result.status == "success"
        rows.append(result.df["col1"].tolist())
        assert ("FROM physical" in result.query) == uses_inner_time_filter

        render.reset_mock()
        with patch.object(
            virtual, "get_sqla_query", side_effect=AssertionError("cache built a query")
        ):
            extra_keys = virtual.get_extra_cache_keys(query.to_dict())
            rls_keys.append(extra_keys)
            render_counts.append(
                [call.args[1] for call in render.call_args_list].count(time_expression)
            )
        cache_keys.append(query.cache_key(extra_cache_keys=extra_keys))

    assert rows == ([[1], []] if uses_inner_time_filter else [[1], [1]])
    assert (cache_keys[0] != cache_keys[1]) == uses_inner_time_filter
    assert rls_keys == (
        [[PHYSICAL_RLS_KEYS[1]], [PHYSICAL_RLS_KEYS[2]]]
        if uses_inner_time_filter
        else [[], []]
    )
    assert render_counts == [int(uses_inner_time_filter)] * 2


FROM_FIRST_SUBQUERIES = [
    "(FROM physical)",
    "(from physical)",
    "( /* table subquery */ FROM physical)",
    "(FROM /* table */ physical)",
    "(\n FROM\tphysical\n)",
    "(FROM physical -- table\n)",
    "((FROM physical))",
]


def set_viewer_rls(mocker: MockerFixture) -> None:
    """Assign independent physical-table rules to two chart viewers."""
    from flask import g

    rules = {
        user_id: MagicMock(clause=f"col1 = {user_id}", group_key=None)
        for user_id in (1, 2)
    }
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        side_effect=lambda dataset: [rules[g.user.id]] if dataset.id == 1 else [],
    )


@pytest.mark.parametrize("expression", FROM_FIRST_SUBQUERIES)
@pytest.mark.parametrize("sink", ["column", "metric", "where", "having"])
@pytest.mark.parametrize("templated", [False, True])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_from_first_subquery_cache_keys_are_user_scoped(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    expression: str,
    sink: str,
    templated: bool,
) -> None:
    """Every SELECT-less subquery protected at execution needs an RLS cache key."""
    from flask import g
    from flask_appbuilder.security.sqla.models import User

    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    set_viewer_rls(mocker)
    if templated:
        expression = "{{ " + json.dumps(expression) + " }}"
    fields: QueryObjectDict = {"columns": ["col1"], "metrics": []}
    if sink == "column":
        fields["columns"] = [{"sqlExpression": expression, "label": "axis"}]
    elif sink == "metric":
        fields["columns"] = []
        fields["metrics"] = [
            {
                "expressionType": "SQL",
                "sqlExpression": f"MAX({expression})",
                "label": "axis",
            }
        ]
    elif sink == "where":
        fields["extras"] = {"where": f"col1 IN {expression}"}
    else:
        fields["metrics"] = [
            {"expressionType": "SQL", "sqlExpression": "MAX(col1)", "label": "axis"}
        ]
        fields["extras"] = {"having": f"MAX(col1) IN {expression}"}
    query = QueryObject(
        datasource=virtual,
        is_timeseries=False,
        columns=fields["columns"],
        metrics=fields["metrics"],
        extras=fields.get("extras"),
    )
    keys = []
    predicates = []
    results = []
    for user_id in (1, 2):
        g.user = User(id=user_id, username=f"viewer{user_id}")
        result = virtual.get_query_result(query)
        assert result.status == "success", result.error_message
        assert f"col1 = {user_id}" in result.query
        results.append(result.df.to_dict("list"))
        extra = virtual.get_extra_cache_keys(query.to_dict())
        predicates.append(extra)
        keys.append(query.cache_key(extra_cache_keys=extra))
    assert results[0] != results[1]
    assert keys[0] != keys[1]
    assert predicates == [[PHYSICAL_RLS_KEYS[1]], [PHYSICAL_RLS_KEYS[2]]]


@pytest.mark.parametrize("static_schema_datasource", [SqlaTable], indirect=True)
@pytest.mark.parametrize("expression", FROM_FIRST_SUBQUERIES)
@pytest.mark.parametrize(
    "sink", ["reference", "spaced_reference", "column", "filter", "time", "metric"]
)
@pytest.mark.parametrize("templated", [False, True])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_from_first_saved_expression_cache_keys_are_user_scoped(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    expression: str,
    sink: str,
    templated: bool,
) -> None:
    """Saved-column resolution and its sibling sinks retain SELECT-less RLS."""
    from flask import g
    from flask_appbuilder.security.sqla.models import User

    virtual, _ = static_schema_datasource
    assert isinstance(virtual, SqlaTable)
    virtual.sql = "SELECT 1 AS col1"
    set_viewer_rls(mocker)
    if templated:
        virtual.template_params = json.dumps({"subquery": expression})
        expression = "{{ subquery }}"
    virtual.columns.append(
        TableColumn(
            column_name="calc",
            type="INTEGER",
            is_dttm=sink == "time",
            expression=expression,
        )
    )
    virtual.metrics.append(
        SqlMetric(metric_name="total", expression=f"MAX({expression})")
    )
    fields: QueryObjectDict = {"columns": ["col1"], "metrics": []}
    if sink in {"reference", "spaced_reference"}:
        fields["columns"] = [
            cast(
                AdhocColumn,
                {
                    "sqlExpression": " calc " if sink == "spaced_reference" else "calc",
                    "expressionType": "SQL",
                    "label": "axis",
                },
            )
        ]
    elif sink == "column":
        fields["columns"] = ["calc"]
    elif sink == "filter":
        fields["filter"] = [{"col": "calc", "op": "==", "val": 1}]
    elif sink == "time":
        fields["granularity"] = "calc"
    else:
        fields["columns"] = []
        fields["metrics"] = ["total"]
    query = QueryObject(
        datasource=virtual,
        is_timeseries=sink == "time",
        filters=fields.get("filter"),
        columns=fields["columns"],
        metrics=fields["metrics"],
        granularity=fields.get("granularity"),
    )
    keys = []
    predicates = []
    for user_id in (1, 2):
        g.user = User(id=user_id, username=f"viewer{user_id}")
        sql = str(
            virtual.get_sqla_query(
                is_timeseries=sink == "time",
                columns=fields["columns"],
                metrics=fields["metrics"],
                filter=fields.get("filter"),
                granularity=fields.get("granularity"),
            ).sqla_query.compile()
        )
        assert f"col1 = {user_id}" in sql
        extra = virtual.get_extra_cache_keys(query.to_dict())
        predicates.append(extra)
        keys.append(query.cache_key(extra_cache_keys=extra))
    assert keys[0] != keys[1]
    assert predicates == [[PHYSICAL_RLS_KEYS[1]], [PHYSICAL_RLS_KEYS[2]]]


@pytest.mark.parametrize(
    "spec,expression",
    [
        (DuckDBEngineSpec, "(FROM physical)"),
        (DuckDBEngineSpec, "1 IN (FROM physical)"),
        (BigQueryEngineSpec, "(FROM physical |> AGGREGATE MAX(col1))"),
        (DuckDBEngineSpec, "(SELECT MAX(col1) FROM physical)"),
    ],
)
@pytest.mark.parametrize("sink", ["column", "metric", "where", "having"])
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_from_first_dialect_subquery_cache_keys_are_user_scoped(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
    mocker: MockerFixture,
    spec: type[BaseEngineSpec],
    expression: str,
    sink: str,
) -> None:
    """Match execution's parser for FROM-first dialects and boolean fragments."""
    from flask import g
    from flask_appbuilder.security.sqla.models import User

    virtual, _ = static_schema_datasource
    virtual.sql = "SELECT 1 AS col1"
    virtual.schema = "main"
    mocker.patch.object(
        Database, "db_engine_spec", new_callable=PropertyMock, return_value=spec
    )
    mocker.patch.object(virtual.database, "get_default_catalog", return_value=None)
    set_viewer_rls(mocker)
    fields: QueryObjectDict = {"columns": ["col1"], "metrics": []}
    if sink == "column":
        fields["columns"] = [{"sqlExpression": expression, "label": "axis"}]
    elif sink == "metric":
        fields["metrics"] = [
            {
                "expressionType": "SQL",
                "sqlExpression": f"MAX({expression})",
                "label": "axis",
            }
        ]
    else:
        fields["extras"] = {sink: f"1 = {expression}"}
    query = QueryObject(
        datasource=virtual,
        columns=fields["columns"],
        metrics=fields["metrics"],
        extras=fields.get("extras"),
    )
    keys = []
    predicates = []
    for user_id in (1, 2):
        g.user = User(id=user_id, username=f"viewer{user_id}")
        executed = helpers.validate_adhoc_subquery(
            expression, virtual.database, None, "main", spec.engine
        )
        assert f"col1 = {user_id}" in executed
        extra = virtual.get_extra_cache_keys(query.to_dict())
        predicates.append(extra)
        keys.append(query.cache_key(extra_cache_keys=extra))
    assert keys[0] != keys[1]
    assert predicates == [[PHYSICAL_RLS_KEYS[1]], [PHYSICAL_RLS_KEYS[2]]]


@pytest.mark.parametrize("static_schema_datasource", [Query], indirect=True)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True, ENABLE_TEMPLATE_PROCESSING=True)
def test_query_column_metadata_does_not_expand_saved_expressions(
    static_schema_datasource: tuple[SqlaTable | Query, MagicMock],
) -> None:
    """SQL Lab result metadata has no saved expressions to inject or collect."""
    virtual, _ = static_schema_datasource
    assert isinstance(virtual, Query)
    virtual.sql = "SELECT 1 AS calc"
    virtual.extra = {
        "columns": [
            {
                "column_name": "calc",
                "type": "INTEGER",
                "is_dttm": False,
                "expression": "(FROM physical)",
            }
        ]
    }
    query = QueryObject(
        datasource=virtual,
        columns=[{"sqlExpression": "calc", "label": "axis"}],
        metrics=[],
        is_timeseries=False,
    )
    assert virtual.columns[0].expression is None
    result = virtual.get_query_result(query)
    assert result.status == "success"
    assert result.df["axis"].tolist() == [1]
    assert "physical" not in result.query
    assert virtual.get_extra_cache_keys(query.to_dict()) == []
