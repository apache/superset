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
from sqlalchemy import create_engine

from superset.utils.filters import get_dataset_access_filters


def test_get_dataset_access_filters(mocker: MockerFixture) -> None:
    """
    Test the `get_dataset_access_filters` function.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.extensions import security_manager

    mocker.patch.object(
        security_manager,
        "get_accessible_databases",
        return_value=[1, 3],
    )
    mocker.patch.object(
        security_manager,
        "user_view_menu_names",
        side_effect=[
            {"[db].[catalog1].[schema1].[table1](id:1)"},
            {"[db].[catalog1].[schema2]"},
            {"[db].[catalog2]"},
        ],
    )

    clause = get_dataset_access_filters(SqlaTable)
    engine = create_engine("sqlite://")
    compiled_query = clause.compile(engine, compile_kwargs={"literal_binds": True})
    assert str(compiled_query) == (
        "dbs.id IN (1, 3) "
        "OR tables.perm IN ('[db].[catalog1].[schema1].[table1](id:1)') "
        "OR tables.catalog_perm IN ('[db].[catalog2]') OR "
        "tables.schema_perm IN ('[db].[catalog1].[schema2]')"
    )
