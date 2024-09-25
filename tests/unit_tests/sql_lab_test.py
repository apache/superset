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

import json
from uuid import UUID

import sqlparse
from freezegun import freeze_time
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db
from superset.common.db_query_status import QueryStatus
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import OAuth2Error
from superset.models.core import Database
from superset.sql_lab import get_sql_results
from superset.utils.core import override_user
from tests.unit_tests.models.core_test import oauth2_client_info


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
    database.mutate_sql_based_on_config.return_value = "SELECT 42 AS answer LIMIT 2"
    db_engine_spec = database.db_engine_spec
    db_engine_spec.is_select_query.return_value = True
    db_engine_spec.fetch_data.return_value = [(42,)]

    cursor = mocker.MagicMock()
    SupersetResultSet = mocker.patch("superset.sql_lab.SupersetResultSet")

    execute_sql_statement(
        sql_statement,
        query,
        cursor=cursor,
        log_params={},
        apply_ctas=False,
    )

    database.apply_limit_to_sql.assert_called_with("SELECT 42 AS answer", 2, force=True)
    db_engine_spec.execute_with_cursor.assert_called_with(
        cursor,
        "SELECT 42 AS answer LIMIT 2",
        query,
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
    sql_statement_with_rls = f"{sql_statement} WHERE organization_id=42"
    sql_statement_with_rls_and_limit = f"{sql_statement_with_rls} LIMIT 101"

    query = mocker.MagicMock()
    query.limit = 100
    query.select_as_cta_used = False
    database = query.database
    database.allow_dml = False
    database.apply_limit_to_sql.return_value = sql_statement_with_rls_and_limit
    database.mutate_sql_based_on_config.return_value = sql_statement_with_rls_and_limit
    db_engine_spec = database.db_engine_spec
    db_engine_spec.is_select_query.return_value = True
    db_engine_spec.fetch_data.return_value = [(42,)]

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
        cursor,
        "SELECT * FROM sales WHERE organization_id=42 LIMIT 101",
        query,
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

    engine = db.session.connection().engine
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
    db.session.add(query)
    db.session.commit()

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
    db.session.add(rls)
    db.session.flush()
    mocker.patch.object(SupersetSecurityManager, "find_user", return_value=admin)
    mocker.patch("superset.sql_lab.is_feature_enabled", return_value=True)

    with override_user(admin):
        superset_result_set = execute_sql_statement(
            sql_statement=query.sql,
            query=query,
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


@freeze_time("2021-04-01T00:00:00Z")
def test_get_sql_results_oauth2(mocker: MockerFixture, app) -> None:
    """
    Test that `get_sql_results` works with OAuth2.
    """
    app_context = app.test_request_context()
    app_context.push()

    mocker.patch(
        "superset.db_engine_specs.base.uuid4",
        return_value=UUID("fb11f528-6eba-4a8a-837e-6b0d39ee9187"),
    )

    g = mocker.patch("superset.db_engine_specs.base.g")
    g.user = mocker.MagicMock()
    g.user.id = 42

    database = Database(
        id=1,
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
        encrypted_extra=json.dumps(oauth2_client_info),
    )
    database.db_engine_spec.oauth2_exception = OAuth2Error  # type: ignore
    get_sqla_engine = mocker.patch.object(database, "get_sqla_engine")
    get_sqla_engine().__enter__().raw_connection.side_effect = OAuth2Error(
        "OAuth2 required"
    )

    query = mocker.MagicMock()
    query.database = database
    mocker.patch("superset.sql_lab.get_query", return_value=query)

    payload = get_sql_results(query_id=1, rendered_query="SELECT 1")
    assert payload == {
        "status": QueryStatus.FAILED,
        "error": "You don't have permission to access the data.",
        "errors": [
            {
                "message": "You don't have permission to access the data.",
                "error_type": SupersetErrorType.OAUTH2_REDIRECT,
                "level": ErrorLevel.WARNING,
                "extra": {
                    "url": "https://abcd1234.snowflakecomputing.com/oauth/authorize?scope=refresh_token+session%3Arole%3AUSERADMIN&access_type=offline&include_granted_scopes=false&response_type=code&state=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9%252EeyJleHAiOjE2MTcyMzU1MDAsImRhdGFiYXNlX2lkIjoxLCJ1c2VyX2lkIjo0MiwiZGVmYXVsdF9yZWRpcmVjdF91cmkiOiJodHRwOi8vbG9jYWxob3N0L2FwaS92MS9kYXRhYmFzZS9vYXV0aDIvIiwidGFiX2lkIjoiZmIxMWY1MjgtNmViYS00YThhLTgzN2UtNmIwZDM5ZWU5MTg3In0%252E7nLkei6-V8sVk_Pgm8cFhk0tnKRKayRE1Vc7RxuM9mw&redirect_uri=http%3A%2F%2Flocalhost%2Fapi%2Fv1%2Fdatabase%2Foauth2%2F&client_id=my_client_id&prompt=consent",
                    "tab_id": "fb11f528-6eba-4a8a-837e-6b0d39ee9187",
                    "redirect_uri": "http://localhost/api/v1/database/oauth2/",
                },
            }
        ],
    }
