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

from flask_appbuilder.models.sqla.interface import SQLAInterface
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from superset.databases.filters import can_access_databases, DatabaseFilter
from superset.extensions import security_manager


def test_can_access_databases(mocker: MockerFixture) -> None:
    """
    Test the `can_access_databases` function.
    """
    mocker.patch.object(
        security_manager,
        "user_view_menu_names",
        side_effect=[
            {
                "[my_db].[examples].[public].[table1](id:1)",
                "[my_other_db].[examples].[public].[table1](id:2)",
            },
            {"[my_db].(id:42)", "[my_other_db].(id:43)"},
            {"[my_db].[examples]", "[my_db].[other]"},
            {
                "[my_db].[examples].[information_schema]",
                "[my_db].[other].[secret]",
                "[third_db].[schema]",
            },
        ],
    )

    assert can_access_databases("datasource_access") == {"my_db", "my_other_db"}
    assert can_access_databases("database_access") == {"my_db", "my_other_db"}
    assert can_access_databases("catalog_access") == {"my_db"}
    assert can_access_databases("schema_access") == {"my_db", "third_db"}


def test_database_filter_full_db_access(mocker: MockerFixture) -> None:
    """
    Test the `DatabaseFilter` class when the user has full database access.

    In this case the query should be returned unmodified.
    """
    from superset.models.core import Database

    current_app = mocker.patch("superset.databases.filters.current_app")
    current_app.config = {"EXTRA_DYNAMIC_QUERY_FILTERS": False}
    mocker.patch.object(security_manager, "can_access_all_databases", return_value=True)

    engine = create_engine("sqlite://")
    Session = sessionmaker(bind=engine)  # noqa: N806
    session = Session()
    query = session.query(Database)

    filter_ = DatabaseFilter("id", SQLAInterface(Database))
    filtered_query = filter_.apply(query, None)

    assert filtered_query == query


def test_database_filter(mocker: MockerFixture) -> None:
    """
    Test the `DatabaseFilter` class with specific permissions.
    """
    from superset.models.core import Database

    current_app = mocker.patch("superset.databases.filters.current_app")
    current_app.config = {"EXTRA_DYNAMIC_QUERY_FILTERS": False}
    mocker.patch.object(
        security_manager,
        "can_access_all_databases",
        return_value=False,
    )
    mocker.patch.object(
        security_manager,
        "user_view_menu_names",
        side_effect=[
            # return lists instead of sets to ensure order
            ["[my_db].(id:42)", "[my_other_db].(id:43)"],
            ["[my_db].[examples]", "[my_db].[other]"],
            [
                "[my_db].[examples].[information_schema]",
                "[my_db].[other].[secret]",
                "[third_db].[schema]",
            ],
            [
                "[my_db].[examples].[public].[table1](id:1)",
                "[my_other_db].[examples].[public].[table1](id:2)",
            ],
        ],
    )

    engine = create_engine("sqlite://")
    Session = sessionmaker(bind=engine)  # noqa: N806
    session = Session()
    query = session.query(Database)

    filter_ = DatabaseFilter("id", SQLAInterface(Database))
    filtered_query = filter_.apply(query, None)

    compiled_query = filtered_query.statement.compile(
        engine,
        compile_kwargs={"literal_binds": True},
    )
    space = " "  # pre-commit removes trailing spaces...
    assert (
        str(compiled_query)
        == f"""SELECT dbs.uuid, dbs.created_on, dbs.changed_on, dbs.id, dbs.verbose_name, dbs.database_name, dbs.sqlalchemy_uri, dbs.password, dbs.cache_timeout, dbs.select_as_create_table_as, dbs.expose_in_sqllab, dbs.configuration_method, dbs.allow_run_async, dbs.allow_file_upload, dbs.allow_ctas, dbs.allow_cvas, dbs.allow_dml, dbs.force_ctas_schema, dbs.extra, dbs.encrypted_extra, dbs.impersonate_user, dbs.server_cert, dbs.is_managed_externally, dbs.external_url, dbs.created_by_fk, dbs.changed_by_fk{space}
FROM dbs{space}
WHERE '[' || dbs.database_name || '].(id:' || CAST(dbs.id AS VARCHAR) || ')' IN ('[my_db].(id:42)', '[my_other_db].(id:43)') OR dbs.database_name IN ('my_db', 'my_other_db', 'third_db')"""  # noqa: S608, E501
    )
