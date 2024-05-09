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

from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.migrations.shared.catalogs import (
    downgrade_catalog_perms,
    upgrade_catalog_perms,
)
from superset.migrations.shared.security_converge import ViewMenu


def test_upgrade_catalog_perms(mocker: MockerFixture, session: Session) -> None:
    """
    Test the `upgrade_catalog_perms` function.

    The function is called when catalogs are introduced into a new DB engine spec. When
    that happens, we need to update the `catalog` attribute so it points to the default
    catalog, instead of being `NULL`. We also need to update `schema_perms` to include
    the default catalog.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query, SavedQuery, TableSchema, TabState

    engine = session.get_bind()
    Database.metadata.create_all(engine)

    mocker.patch("superset.migrations.shared.catalogs.op")
    db = mocker.patch("superset.migrations.shared.catalogs.db")
    db.Session.return_value = session

    mocker.patch.object(
        Database,
        "get_all_schema_names",
        return_value=["public", "information_schema"],
    )

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="postgresql://localhost/db",
    )
    dataset = SqlaTable(
        table_name="my_table",
        database=database,
        catalog=None,
        schema="public",
        schema_perm="[my_db].[public]",
    )
    session.add(dataset)
    session.commit()

    chart = Slice(
        slice_name="my_chart",
        datasource_type="table",
        datasource_id=dataset.id,
    )
    query = Query(
        client_id="foo",
        database=database,
        catalog=None,
        schema="public",
    )
    saved_query = SavedQuery(
        database=database,
        sql="SELECT * FROM public.t",
        catalog=None,
        schema="public",
    )
    tab_state = TabState(
        database=database,
        catalog=None,
        schema="public",
    )
    table_schema = TableSchema(
        database=database,
        catalog=None,
        schema="public",
    )
    session.add_all([chart, query, saved_query, tab_state, table_schema])
    session.commit()

    # before migration
    assert dataset.catalog is None
    assert query.catalog is None
    assert saved_query.catalog is None
    assert tab_state.catalog is None
    assert table_schema.catalog is None
    assert dataset.schema_perm == "[my_db].[public]"
    assert chart.schema_perm == "[my_db].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[public]",),
    ]

    upgrade_catalog_perms()

    # after migration
    assert dataset.catalog == "db"
    assert query.catalog == "db"
    assert saved_query.catalog == "db"
    assert tab_state.catalog == "db"
    assert table_schema.catalog == "db"
    assert dataset.schema_perm == "[my_db].[db].[public]"
    assert chart.schema_perm == "[my_db].[db].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[db].[public]",),
        ("[my_db].[db]",),
    ]

    downgrade_catalog_perms()

    # revert
    assert dataset.catalog is None
    assert query.catalog is None
    assert saved_query.catalog is None
    assert tab_state.catalog is None
    assert table_schema.catalog is None
    assert dataset.schema_perm == "[my_db].[public]"
    assert chart.schema_perm == "[my_db].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[public]",),
        ("[my_db].[db]",),
    ]
