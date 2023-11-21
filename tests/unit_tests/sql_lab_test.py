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
# pylint: disable=import-outside-toplevel, invalid-name, unused-argument, too-many-locals

import sqlparse
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.utils.core import override_user


def test_execute_sql_statement(mocker: MockerFixture, app: None) -> None:
    """
    Simple test for `execute_sql_statement`.
    """
    from superset.sql_lab import execute_sql_statement

    sql_statement = "SELECT 42 AS answer"

    query = mocker.MagicMock()
    query.limit = 1
    query.select_as_cta_used = False
    database = query.database
    database.allow_dml = False
    database.apply_limit_to_sql.return_value = "SELECT 42 AS answer LIMIT 2"
    db_engine_spec = database.db_engine_spec
    db_engine_spec.is_select_query.return_value = True
    db_engine_spec.fetch_data.return_value = [(42,)]

    session = mocker.MagicMock()
    cursor = mocker.MagicMock()
    SupersetResultSet = mocker.patch("superset.sql_lab.SupersetResultSet")

    execute_sql_statement(
        sql_statement,
        query,
        session=session,
        cursor=cursor,
        log_params={},
        apply_ctas=False,
    )

    database.apply_limit_to_sql.assert_called_with("SELECT 42 AS answer", 2, force=True)
    db_engine_spec.execute_with_cursor.assert_called_with(
        cursor, "SELECT 42 AS answer LIMIT 2", query, session
    )
    SupersetResultSet.assert_called_with([(42,)], cursor.description, db_engine_spec)


def test_execute_sql_statement_with_rls(
    mocker: MockerFixture,
) -> None:
    """
    Test for `execute_sql_statement` when an RLS rule is in place.
    """
    from superset.sql_lab import execute_sql_statement

    sql_statement = "SELECT * FROM sales"

    query = mocker.MagicMock()
    query.limit = 100
    query.select_as_cta_used = False
    database = query.database
    database.allow_dml = False
    database.apply_limit_to_sql.return_value = (
        "SELECT * FROM sales WHERE organization_id=42 LIMIT 101"
    )
    db_engine_spec = database.db_engine_spec
    db_engine_spec.is_select_query.return_value = True
    db_engine_spec.fetch_data.return_value = [(42,)]

    session = mocker.MagicMock()
    cursor = mocker.MagicMock()
    SupersetResultSet = mocker.patch("superset.sql_lab.SupersetResultSet")
    mocker.patch(
        "superset.sql_lab.insert_rls_as_subquery",
        return_value=sqlparse.parse("SELECT * FROM sales WHERE organization_id=42")[0],
    )
    mocker.patch("superset.sql_lab.is_feature_enabled", return_value=True)

    execute_sql_statement(
        sql_statement,
        query,
        session=session,
        cursor=cursor,
        log_params={},
        apply_ctas=False,
    )

    database.apply_limit_to_sql.assert_called_with(
        "SELECT * FROM sales WHERE organization_id=42",
        101,
        force=True,
    )
    db_engine_spec.execute_with_cursor.assert_called_with(
        cursor, "SELECT * FROM sales WHERE organization_id=42 LIMIT 101", query, session
    )
    SupersetResultSet.assert_called_with([(42,)], cursor.description, db_engine_spec)


def test_sql_lab_insert_rls_as_subquery(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Integration test for `insert_rls_as_subquery`.
    """
    from flask_appbuilder.security.sqla.models import Role, User

    from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
    from superset.models.core import Database
    from superset.models.sql_lab import Query
    from superset.security.manager import SupersetSecurityManager
    from superset.sql_lab import execute_sql_statement
    from superset.utils.core import RowLevelSecurityFilterType

    engine = session.connection().engine
    Query.metadata.create_all(engine)  # pylint: disable=no-member

    connection = engine.raw_connection()
    connection.execute("CREATE TABLE t (c INTEGER)")
    for i in range(10):
        connection.execute("INSERT INTO t VALUES (?)", (i,))

    cursor = connection.cursor()

    query = Query(
        sql="SELECT c FROM t",
        client_id="abcde",
        database=Database(database_name="test_db", sqlalchemy_uri="sqlite://"),
        schema=None,
        limit=5,
        select_as_cta_used=False,
    )
    session.add(query)
    session.commit()

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    # first without RLS
    with override_user(admin):
        superset_result_set = execute_sql_statement(
            sql_statement=query.sql,
            query=query,
            session=session,
            cursor=cursor,
            log_params=None,
            apply_ctas=False,
        )
    assert (
        superset_result_set.to_pandas_df().to_markdown()
        == """
|    |   c |
|---:|----:|
|  0 |   0 |
|  1 |   1 |
|  2 |   2 |
|  3 |   3 |
|  4 |   4 |""".strip()
    )
    assert query.executed_sql == "SELECT c FROM t\nLIMIT 6"

    # now with RLS
    rls = RowLevelSecurityFilter(
        name="sqllab_rls1",
        filter_type=RowLevelSecurityFilterType.REGULAR,
        tables=[SqlaTable(database_id=1, schema=None, table_name="t")],
        roles=[admin.roles[0]],
        group_key=None,
        clause="c > 5",
    )
    session.add(rls)
    session.flush()
    mocker.patch.object(SupersetSecurityManager, "find_user", return_value=admin)
    mocker.patch("superset.sql_lab.is_feature_enabled", return_value=True)

    with override_user(admin):
        superset_result_set = execute_sql_statement(
            sql_statement=query.sql,
            query=query,
            session=session,
            cursor=cursor,
            log_params=None,
            apply_ctas=False,
        )
    assert (
        superset_result_set.to_pandas_df().to_markdown()
        == """
|    |   c |
|---:|----:|
|  0 |   6 |
|  1 |   7 |
|  2 |   8 |
|  3 |   9 |""".strip()
    )
    assert (
        query.executed_sql
        == "SELECT c FROM (SELECT * FROM t WHERE (t.c > 5)) AS t\nLIMIT 6"
    )
