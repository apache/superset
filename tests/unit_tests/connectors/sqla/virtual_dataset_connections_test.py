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

from pathlib import Path
from unittest.mock import MagicMock

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, event
from sqlalchemy.pool import NullPool

from superset.common.query_context_processor import QueryContextProcessor
from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database


@pytest.mark.parametrize(
    "sql", ["SELECT col1 FROM physical", "SELECT col1 FROM main.physical"]
)
@pytest.mark.parametrize("cached", [False, True])
@pytest.mark.parametrize("with_rls", [False, True])
def test_virtual_dataset_avoids_schema_connections(
    mocker: MockerFixture,
    tmp_path: Path,
    app_context: None,
    cached: bool,
    with_rls: bool,
    sql: str,
) -> None:
    """Configured schemas need no introspection on cache hits or query execution."""
    uri = f"sqlite:///{tmp_path / 'analytic.db'}"
    engine = create_engine(uri, poolclass=NullPool)
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE physical (col1 INTEGER)")
        connection.exec_driver_sql("INSERT INTO physical VALUES (1), (2)")
    connections = MagicMock()
    event.listen(engine, "connect", connections)
    database = Database(id=1, database_name="analytic", sqlalchemy_uri=uri)
    mocker.patch.object(database, "_get_sqla_engine", return_value=engine)
    physical = SqlaTable(id=1, table_name="physical", schema="main", database=database)
    virtual = SqlaTable(
        id=2,
        table_name="virtual",
        sql=sql,
        schema="main",
        database=database,
        columns=[TableColumn(column_name="col1", type="INTEGER")],
    )
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
def test_virtual_dataset_preserves_default_schema_fallback(
    mocker: MockerFixture,
    app_context: None,
    schema: str | None,
) -> None:
    """Datasets without a schema still resolve the default for both RLS paths."""
    database = Database(database_name="analytic", sqlalchemy_uri="sqlite://")
    virtual = SqlaTable(
        id=2,
        table_name="virtual",
        sql="SELECT col1 FROM physical",
        schema=schema,
        database=database,
    )
    default_schema = mocker.patch.object(
        database, "get_default_schema", return_value="main"
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
