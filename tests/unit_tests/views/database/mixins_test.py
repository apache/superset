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

from superset.views.database.mixins import DatabaseMixin


def test_pre_add_update_with_catalog(mocker: MockerFixture) -> None:
    """
    Test the `_pre_add_update` method on a DB with catalog support.
    """
    from superset.models.core import Database

    add_permission_view_menu = mocker.patch(
        "superset.views.database.mixins.security_manager.add_permission_view_menu"
    )

    database = Database(
        database_name="my_db",
        id=42,
        sqlalchemy_uri="postgresql://user:password@host:5432/examples",
    )
    mocker.patch.object(
        database,
        "get_all_catalog_names",
        return_value=["examples", "other"],
    )
    mocker.patch.object(
        database,
        "get_all_schema_names",
        side_effect=[
            ["public", "information_schema"],
            ["secret"],
        ],
    )

    mixin = DatabaseMixin()
    mixin._pre_add_update(database)

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("database_access", "[my_db].(id:42)"),
            mocker.call("catalog_access", "[my_db].[examples]"),
            mocker.call("catalog_access", "[my_db].[other]"),
            mocker.call("schema_access", "[my_db].[examples].[public]"),
            mocker.call("schema_access", "[my_db].[examples].[information_schema]"),
            mocker.call("schema_access", "[my_db].[other].[secret]"),
        ],
        any_order=True,
    )
