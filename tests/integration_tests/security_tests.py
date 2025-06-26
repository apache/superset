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
# isort:skip_file
import inspect
import time
import unittest
from collections import namedtuple
from unittest import mock
from unittest.mock import Mock, patch, call, ANY
from typing import Any

import jwt
import prison
import pytest

from flask import current_app, g
from flask_appbuilder.security.sqla.models import Role
from superset.daos.datasource import DatasourceDAO  # noqa: F401
from superset.models.dashboard import Dashboard
from superset import app, appbuilder, db, security_manager, viz
from superset.connectors.sqla.models import SqlaTable
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.core import Database
from superset.models.slice import Slice
from superset.sql.parse import Table
from superset.utils.core import (
    DatasourceType,
    backend,
    get_example_default_schema,
    override_user,
)
from superset.utils import json
from superset.utils.database import get_example_database
from superset.utils.urls import get_url_host

from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import GAMMA_USERNAME
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.fixtures.public_role import (
    public_role_like_gamma,  # noqa: F401
    public_role_like_test_role,  # noqa: F401
)
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)
from tests.integration_tests.fixtures.users import (
    create_gamma_user_group,  # noqa: F401
    create_user_group_with_dar,  # noqa: F401
    create_gamma_user_group_with_dar,  # noqa: F401
)

NEW_SECURITY_CONVERGE_VIEWS = (
    "Annotation",
    "Database",
    "Dataset",
    "Dashboard",
    "CssTemplate",
    "Chart",
    "Query",
    "SavedQuery",
)


def get_perm_tuples(role_name):
    perm_set = set()
    for perm in security_manager.find_role(role_name).permissions:
        perm_set.add((perm.permission.name, perm.view_menu.name))
    return perm_set


SCHEMA_ACCESS_ROLE = "schema_access_role"


def create_schema_perm(view_menu_name: str) -> None:
    permission = "schema_access"
    security_manager.add_permission_view_menu(permission, view_menu_name)
    perm_view = security_manager.find_permission_view_menu(permission, view_menu_name)
    security_manager.add_permission_role(
        security_manager.find_role(SCHEMA_ACCESS_ROLE), perm_view
    )
    return None


def delete_schema_perm(view_menu_name: str) -> None:
    pv = security_manager.find_permission_view_menu("schema_access", "[examples].[2]")
    security_manager.del_permission_role(
        security_manager.find_role(SCHEMA_ACCESS_ROLE), pv
    )
    security_manager.del_permission_view_menu("schema_access", "[examples].[2]")
    return None


class TestRolePermission(SupersetTestCase):
    """Testing export role permissions."""

    def setUp(self):
        schema = get_example_default_schema()
        security_manager.add_role(SCHEMA_ACCESS_ROLE)
        db.session.commit()

        ds = (
            db.session.query(SqlaTable)
            .filter_by(table_name="wb_health_population", schema=schema)
            .first()
        )
        ds.schema = "temp_schema"
        ds.schema_perm = ds.get_schema_perm()

        ds_slices = (
            db.session.query(Slice)
            .filter_by(datasource_type=DatasourceType.TABLE)
            .filter_by(datasource_id=ds.id)
            .all()
        )
        for s in ds_slices:
            s.schema_perm = ds.schema_perm
        create_schema_perm("[examples].[temp_schema]")
        gamma_user = security_manager.find_user(username="gamma")
        gamma_user.roles.append(security_manager.find_role(SCHEMA_ACCESS_ROLE))
        db.session.commit()

    def tearDown(self):
        ds = (
            db.session.query(SqlaTable)
            .filter_by(table_name="wb_health_population", schema="temp_schema")
            .first()
        )
        schema_perm = ds.schema_perm
        ds.schema = get_example_default_schema()
        ds.schema_perm = None
        ds_slices = (
            db.session.query(Slice)
            .filter_by(datasource_type=DatasourceType.TABLE)
            .filter_by(datasource_id=ds.id)
            .all()
        )
        for s in ds_slices:
            s.schema_perm = None

        delete_schema_perm(schema_perm)
        db.session.delete(security_manager.find_role(SCHEMA_ACCESS_ROLE))
        db.session.commit()
        super().tearDown()

    def test_after_insert_dataset(self):
        security_manager.on_view_menu_after_insert = Mock()
        security_manager.on_permission_view_after_insert = Mock()

        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)

        table = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_perm_table",
            database=tmp_db1,
        )
        db.session.add(table)
        db.session.commit()

        table = db.session.query(SqlaTable).filter_by(table_name="tmp_perm_table").one()
        assert table.perm == f"[tmp_db1].[tmp_perm_table](id:{table.id})"

        pvm_dataset = security_manager.find_permission_view_menu(
            "datasource_access", table.perm
        )
        pvm_schema = security_manager.find_permission_view_menu(
            "schema_access", table.schema_perm
        )

        # Assert dataset permission is created and local perms are ok
        assert pvm_dataset is not None
        assert table.perm == f"[tmp_db1].[tmp_perm_table](id:{table.id})"
        assert table.schema_perm == "[tmp_db1].[tmp_schema]"
        assert pvm_schema is not None

        # assert on permission hooks
        call_args = security_manager.on_permission_view_after_insert.call_args
        assert call_args.args[2].id == pvm_schema.id

        security_manager.on_permission_view_after_insert.assert_has_calls(
            [
                call(ANY, ANY, ANY),
                call(ANY, ANY, ANY),
            ]
        )

        # Cleanup
        db.session.delete(table)
        db.session.delete(tmp_db1)
        db.session.commit()

    def test_after_insert_dataset_rollback(self):
        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.commit()

        table = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_table",
            database=tmp_db1,
        )
        db.session.add(table)
        db.session.flush()

        pvm_dataset = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db1].[tmp_table](id:{table.id})"
        )
        assert pvm_dataset is not None
        table_id = table.id
        db.session.rollback()

        table = (
            db.session.query(SqlaTable).filter_by(table_name="tmp_table").one_or_none()
        )
        assert table is None
        pvm_dataset = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db1].[tmp_table](id:{table_id})"
        )
        assert pvm_dataset is None

        db.session.delete(tmp_db1)
        db.session.commit()

    def test_after_insert_dataset_table_none(self):
        table = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_perm_table",
            # Setting database_id instead of database will skip permission creation
            database_id=get_example_database().id,
        )
        db.session.add(table)
        db.session.commit()

        stored_table = (
            db.session.query(SqlaTable).filter_by(table_name="tmp_perm_table").one()
        )
        # Assert permission is created
        assert (
            security_manager.find_permission_view_menu(
                "datasource_access", stored_table.perm
            )
            is not None
        )
        # Assert no bogus permission is created
        assert (
            security_manager.find_permission_view_menu(
                "datasource_access", f"[None].[tmp_perm_table](id:{stored_table.id})"
            )
            is None
        )

        # Cleanup
        db.session.delete(table)
        db.session.commit()

    def test_after_insert_database(self):
        security_manager.on_permission_view_after_insert = Mock()

        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)

        tmp_db1 = db.session.query(Database).filter_by(database_name="tmp_db1").one()
        assert tmp_db1.perm == f"[tmp_db1].(id:{tmp_db1.id})"
        tmp_db1_pvm = security_manager.find_permission_view_menu(
            "database_access", tmp_db1.perm
        )
        assert tmp_db1_pvm is not None

        # Assert the hook is called
        security_manager.on_permission_view_after_insert.assert_has_calls(
            [
                call(ANY, ANY, ANY),
            ]
        )
        call_args = security_manager.on_permission_view_after_insert.call_args
        assert call_args.args[2].id == tmp_db1_pvm.id
        db.session.delete(tmp_db1)
        db.session.commit()

    def test_after_insert_database_rollback(self):
        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.flush()

        pvm_database = security_manager.find_permission_view_menu(
            "database_access", f"[tmp_db1].(id:{tmp_db1.id})"
        )
        assert pvm_database is not None
        db.session.rollback()

        pvm_database = security_manager.find_permission_view_menu(
            "database_access", f"[tmp_db1](id:{tmp_db1.id})"
        )
        assert pvm_database is None

    def test_after_update_database__perm_database_access(self):
        security_manager.on_view_menu_after_update = Mock()

        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.commit()
        tmp_db1 = db.session.query(Database).filter_by(database_name="tmp_db1").one()

        assert (
            security_manager.find_permission_view_menu("database_access", tmp_db1.perm)
            is not None
        )

        tmp_db1.database_name = "tmp_db2"
        db.session.commit()

        # Assert that the old permission was updated
        assert (
            security_manager.find_permission_view_menu(
                "database_access", f"[tmp_db1].(id:{tmp_db1.id})"
            )
            is None
        )
        # Assert that the db permission was updated
        assert (
            security_manager.find_permission_view_menu(
                "database_access", f"[tmp_db2].(id:{tmp_db1.id})"
            )
            is not None
        )

        # Assert the hook is called
        tmp_db1_view_menu = security_manager.find_view_menu(
            f"[tmp_db2].(id:{tmp_db1.id})"
        )
        security_manager.on_view_menu_after_update.assert_has_calls(
            [
                call(ANY, ANY, tmp_db1_view_menu),
            ]
        )

        db.session.delete(tmp_db1)
        db.session.commit()

    def test_after_update_database_rollback(self):
        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.commit()
        tmp_db1 = db.session.query(Database).filter_by(database_name="tmp_db1").one()

        assert (
            security_manager.find_permission_view_menu("database_access", tmp_db1.perm)
            is not None
        )

        tmp_db1.database_name = "tmp_db2"
        db.session.flush()

        # Assert that the old permission was updated
        assert (
            security_manager.find_permission_view_menu(
                "database_access", f"[tmp_db1].(id:{tmp_db1.id})"
            )
            is None
        )
        # Assert that the db permission was updated
        assert (
            security_manager.find_permission_view_menu(
                "database_access", f"[tmp_db2].(id:{tmp_db1.id})"
            )
            is not None
        )

        db.session.rollback()
        assert (
            security_manager.find_permission_view_menu(
                "database_access", f"[tmp_db1].(id:{tmp_db1.id})"
            )
            is not None
        )
        # Assert that the db permission was updated
        assert (
            security_manager.find_permission_view_menu(
                "database_access", f"[tmp_db2].(id:{tmp_db1.id})"
            )
            is None
        )

        db.session.delete(tmp_db1)
        db.session.commit()

    def test_after_update_database__perm_database_access_exists(self):
        security_manager.on_permission_view_after_delete = Mock()

        # Add a bogus existing permission before the change

        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.commit()
        tmp_db1 = db.session.query(Database).filter_by(database_name="tmp_db1").one()
        security_manager.add_permission_view_menu(
            "database_access", f"[tmp_db2].(id:{tmp_db1.id})"
        )

        assert (
            security_manager.find_permission_view_menu("database_access", tmp_db1.perm)
            is not None
        )

        tmp_db1.database_name = "tmp_db2"
        db.session.commit()

        # Assert that the old permission was updated
        assert (
            security_manager.find_permission_view_menu(
                "database_access", f"[tmp_db1].(id:{tmp_db1.id})"
            )
            is None
        )
        # Assert that the db permission was updated
        assert (
            security_manager.find_permission_view_menu(
                "database_access", f"[tmp_db2].(id:{tmp_db1.id})"
            )
            is not None
        )

        security_manager.on_permission_view_after_delete.assert_has_calls(
            [
                call(ANY, ANY, ANY),
            ]
        )

        db.session.delete(tmp_db1)
        db.session.commit()

    def test_after_update_database__perm_datasource_access(self):
        security_manager.on_view_menu_after_update = Mock()

        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.commit()

        table1 = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_table1",
            database=tmp_db1,
        )
        db.session.add(table1)
        table2 = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_table2",
            database=tmp_db1,
        )
        db.session.add(table2)
        db.session.commit()
        slice1 = Slice(
            datasource_id=table1.id,
            datasource_type=DatasourceType.TABLE,
            datasource_name="tmp_table1",
            slice_name="tmp_slice1",
        )
        db.session.add(slice1)
        db.session.commit()
        slice1 = db.session.query(Slice).filter_by(slice_name="tmp_slice1").one()
        table1 = db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()
        table2 = db.session.query(SqlaTable).filter_by(table_name="tmp_table2").one()

        # assert initial perms
        assert (
            security_manager.find_permission_view_menu(
                "datasource_access", f"[tmp_db1].[tmp_table1](id:{table1.id})"
            )
            is not None
        )
        assert (
            security_manager.find_permission_view_menu(
                "datasource_access", f"[tmp_db1].[tmp_table2](id:{table2.id})"
            )
            is not None
        )
        assert slice1.perm == f"[tmp_db1].[tmp_table1](id:{table1.id})"
        assert table1.perm == f"[tmp_db1].[tmp_table1](id:{table1.id})"
        assert table2.perm == f"[tmp_db1].[tmp_table2](id:{table2.id})"

        # Refresh and update the database name
        tmp_db1 = db.session.query(Database).filter_by(database_name="tmp_db1").one()
        tmp_db1.database_name = "tmp_db2"
        db.session.commit()

        # Assert that the old permissions were updated
        assert (
            security_manager.find_permission_view_menu(
                "datasource_access", f"[tmp_db1].[tmp_table1](id:{table1.id})"
            )
            is None
        )
        assert (
            security_manager.find_permission_view_menu(
                "datasource_access", f"[tmp_db1].[tmp_table2](id:{table2.id})"
            )
            is None
        )

        # Assert that the db permission was updated
        assert (
            security_manager.find_permission_view_menu(
                "datasource_access", f"[tmp_db2].[tmp_table1](id:{table1.id})"
            )
            is not None
        )
        assert (
            security_manager.find_permission_view_menu(
                "datasource_access", f"[tmp_db2].[tmp_table2](id:{table2.id})"
            )
            is not None
        )
        assert slice1.perm == f"[tmp_db2].[tmp_table1](id:{table1.id})"
        assert table1.perm == f"[tmp_db2].[tmp_table1](id:{table1.id})"
        assert table2.perm == f"[tmp_db2].[tmp_table2](id:{table2.id})"

        # Assert hooks are called
        tmp_db1_view_menu = security_manager.find_view_menu(
            f"[tmp_db2].(id:{tmp_db1.id})"
        )
        table1_view_menu = security_manager.find_view_menu(
            f"[tmp_db2].[tmp_table1](id:{table1.id})"
        )
        table2_view_menu = security_manager.find_view_menu(
            f"[tmp_db2].[tmp_table2](id:{table2.id})"
        )
        security_manager.on_view_menu_after_update.assert_has_calls(
            [
                call(ANY, ANY, tmp_db1_view_menu),
                call(ANY, ANY, table1_view_menu),
                call(ANY, ANY, table2_view_menu),
            ]
        )

        db.session.delete(slice1)
        db.session.delete(table1)
        db.session.delete(table2)
        db.session.delete(tmp_db1)
        db.session.commit()

    def test_after_delete_database(self):
        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.commit()
        tmp_db1 = db.session.query(Database).filter_by(database_name="tmp_db1").one()

        database_pvm = security_manager.find_permission_view_menu(
            "database_access", tmp_db1.perm
        )
        assert database_pvm is not None
        role1 = Role(name="tmp_role1")
        role1.permissions.append(database_pvm)
        db.session.add(role1)
        db.session.commit()

        db.session.delete(tmp_db1)
        db.session.commit()

        # Assert that PVM is removed from Role
        role1 = security_manager.find_role("tmp_role1")
        assert role1.permissions == []

        # Assert that the old permission was updated
        assert (
            security_manager.find_permission_view_menu(
                "database_access", f"[tmp_db1].(id:{tmp_db1.id})"
            )
            is None
        )

        # Cleanup
        db.session.delete(role1)
        db.session.commit()

    def test_after_delete_database_rollback(self):
        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.commit()
        tmp_db1 = db.session.query(Database).filter_by(database_name="tmp_db1").one()

        database_pvm = security_manager.find_permission_view_menu(
            "database_access", tmp_db1.perm
        )
        assert database_pvm is not None
        role1 = Role(name="tmp_role1")
        role1.permissions.append(database_pvm)
        db.session.add(role1)
        db.session.commit()

        db.session.delete(tmp_db1)
        db.session.flush()

        role1 = security_manager.find_role("tmp_role1")
        assert role1.permissions == []

        assert (
            security_manager.find_permission_view_menu(
                "database_access", f"[tmp_db1].(id:{tmp_db1.id})"
            )
            is None
        )

        db.session.rollback()

        # Test a rollback reverts everything
        database_pvm = security_manager.find_permission_view_menu(
            "database_access", f"[tmp_db1].(id:{tmp_db1.id})"
        )

        role1 = security_manager.find_role("tmp_role1")
        assert role1.permissions == [database_pvm]

        # Cleanup
        db.session.delete(role1)
        db.session.delete(tmp_db1)
        db.session.commit()

    def test_after_delete_dataset(self):
        security_manager.on_permission_view_after_delete = Mock()

        tmp_db = Database(database_name="tmp_db", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db)
        db.session.commit()

        table1 = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_table1",
            database=tmp_db,
        )
        db.session.add(table1)
        db.session.commit()

        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is not None

        role1 = Role(name="tmp_role1")
        role1.permissions.append(table1_pvm)
        db.session.add(role1)
        db.session.commit()

        # refresh
        table1 = db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()

        # Test delete
        db.session.delete(table1)
        db.session.commit()

        role1 = security_manager.find_role("tmp_role1")
        assert role1.permissions == []

        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is None
        table1_view_menu = security_manager.find_view_menu(
            f"[tmp_db].[tmp_table1](id:{table1.id})"
        )
        assert table1_view_menu is None

        # Assert the hook is called
        security_manager.on_permission_view_after_delete.assert_has_calls(
            [
                call(ANY, ANY, ANY),
            ]
        )

        # cleanup
        db.session.delete(role1)
        db.session.delete(tmp_db)
        db.session.commit()

    def test_after_delete_dataset_rollback(self):
        tmp_db = Database(database_name="tmp_db", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db)
        db.session.commit()

        table1 = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_table1",
            database=tmp_db,
        )
        db.session.add(table1)
        db.session.commit()

        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is not None

        role1 = Role(name="tmp_role1")
        role1.permissions.append(table1_pvm)
        db.session.add(role1)
        db.session.commit()

        # refresh
        table1 = db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()

        # Test delete, permissions are correctly deleted
        db.session.delete(table1)
        db.session.flush()

        role1 = security_manager.find_role("tmp_role1")
        assert role1.permissions == []

        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is None

        # Test rollback, permissions exist everything is correctly rollback
        db.session.rollback()
        role1 = security_manager.find_role("tmp_role1")
        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is not None
        assert role1.permissions == [table1_pvm]

        # cleanup
        db.session.delete(table1)
        db.session.delete(role1)
        db.session.delete(tmp_db)
        db.session.commit()

    def test_after_update_dataset__name_changes(self):
        security_manager.on_view_menu_after_update = Mock()

        tmp_db = Database(database_name="tmp_db", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db)
        db.session.commit()

        table1 = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_table1",
            database=tmp_db,
        )
        db.session.add(table1)
        db.session.commit()

        slice1 = Slice(
            datasource_id=table1.id,
            datasource_type=DatasourceType.TABLE,
            datasource_name="tmp_table1",
            slice_name="tmp_slice1",
        )
        db.session.add(slice1)
        db.session.commit()

        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is not None

        # refresh
        table1 = db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()
        # Test update
        table1.table_name = "tmp_table1_changed"
        db.session.commit()

        # Test old permission does not exist
        old_table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db].[tmp_table1](id:{table1.id})"
        )
        assert old_table1_pvm is None

        # Test new permission exist
        new_table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db].[tmp_table1_changed](id:{table1.id})"
        )
        assert new_table1_pvm is not None

        # test dataset permission changed
        changed_table1 = (
            db.session.query(SqlaTable).filter_by(table_name="tmp_table1_changed").one()
        )
        assert changed_table1.perm == f"[tmp_db].[tmp_table1_changed](id:{table1.id})"

        # Test Chart permission changed
        slice1 = db.session.query(Slice).filter_by(slice_name="tmp_slice1").one()
        assert slice1.perm == f"[tmp_db].[tmp_table1_changed](id:{table1.id})"

        # Assert hook is called
        view_menu_dataset = security_manager.find_view_menu(
            f"[tmp_db].[tmp_table1_changed](id:{table1.id})"
        )
        security_manager.on_view_menu_after_update.assert_has_calls(
            [
                call(ANY, ANY, view_menu_dataset),
            ]
        )
        # cleanup
        db.session.delete(slice1)
        db.session.delete(table1)
        db.session.delete(tmp_db)
        db.session.commit()

    def test_after_update_dataset_rollback(self):
        tmp_db = Database(database_name="tmp_db", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db)
        db.session.commit()

        table1 = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_table1",
            database=tmp_db,
        )
        db.session.add(table1)
        db.session.commit()

        slice1 = Slice(
            datasource_id=table1.id,
            datasource_type=DatasourceType.TABLE,
            datasource_name="tmp_table1",
            slice_name="tmp_slice1",
        )
        db.session.add(slice1)
        db.session.commit()

        # refresh
        table1 = db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()
        # Test update
        table1.table_name = "tmp_table1_changed"
        db.session.flush()

        # Test old permission does not exist
        old_table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db].[tmp_table1](id:{table1.id})"
        )
        assert old_table1_pvm is None

        # Test new permission exist
        new_table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db].[tmp_table1_changed](id:{table1.id})"
        )
        assert new_table1_pvm is not None

        # Test rollback
        db.session.rollback()

        old_table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db].[tmp_table1](id:{table1.id})"
        )
        assert old_table1_pvm is not None

        # cleanup
        db.session.delete(slice1)
        db.session.delete(table1)
        db.session.delete(tmp_db)
        db.session.commit()

    def test_after_update_dataset__db_changes(self):
        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        tmp_db2 = Database(database_name="tmp_db2", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.add(tmp_db2)
        db.session.commit()

        table1 = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_table1",
            database=tmp_db1,
        )
        db.session.add(table1)
        db.session.commit()

        slice1 = Slice(
            datasource_id=table1.id,
            datasource_type=DatasourceType.TABLE,
            datasource_name="tmp_table1",
            slice_name="tmp_slice1",
        )
        db.session.add(slice1)
        db.session.commit()

        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db1].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is not None

        # refresh
        table1 = db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()
        # Test update
        table1.database = tmp_db2
        db.session.commit()

        # Test old permission does not exist
        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db1].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is None

        # Test new permission exist
        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db2].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is not None

        # test dataset permission and schema permission changed
        changed_table1 = (
            db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()
        )
        assert changed_table1.perm == f"[tmp_db2].[tmp_table1](id:{table1.id})"
        assert changed_table1.schema_perm == "[tmp_db2].[tmp_schema]"  # noqa: F541

        # Test Chart permission changed
        slice1 = db.session.query(Slice).filter_by(slice_name="tmp_slice1").one()
        assert slice1.perm == f"[tmp_db2].[tmp_table1](id:{table1.id})"
        assert slice1.schema_perm == f"[tmp_db2].[tmp_schema]"  # noqa: F541

        # cleanup
        db.session.delete(slice1)
        db.session.delete(table1)
        db.session.delete(tmp_db1)
        db.session.delete(tmp_db2)
        db.session.commit()

    def test_after_update_dataset__schema_changes(self):
        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.commit()

        table1 = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_table1",
            database=tmp_db1,
        )
        db.session.add(table1)
        db.session.commit()

        slice1 = Slice(
            datasource_id=table1.id,
            datasource_type=DatasourceType.TABLE,
            datasource_name="tmp_table1",
            slice_name="tmp_slice1",
        )
        db.session.add(slice1)
        db.session.commit()

        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db1].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is not None

        # refresh
        table1 = db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()
        # Test update
        table1.schema = "tmp_schema_changed"
        db.session.commit()

        # Test permission still exists
        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db1].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is not None

        # test dataset schema permission changed
        changed_table1 = (
            db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()
        )
        assert changed_table1.perm == f"[tmp_db1].[tmp_table1](id:{table1.id})"
        assert changed_table1.schema_perm == "[tmp_db1].[tmp_schema_changed]"  # noqa: F541

        # Test Chart schema permission changed
        slice1 = db.session.query(Slice).filter_by(slice_name="tmp_slice1").one()
        assert slice1.perm == f"[tmp_db1].[tmp_table1](id:{table1.id})"
        assert slice1.schema_perm == "[tmp_db1].[tmp_schema_changed]"  # noqa: F541

        # cleanup
        db.session.delete(slice1)
        db.session.delete(table1)
        db.session.delete(tmp_db1)
        db.session.commit()

    def test_after_update_dataset__schema_none(self):
        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.commit()

        table1 = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_table1",
            database=tmp_db1,
        )
        db.session.add(table1)
        db.session.commit()

        slice1 = Slice(
            datasource_id=table1.id,
            datasource_type=DatasourceType.TABLE,
            datasource_name="tmp_table1",
            slice_name="tmp_slice1",
        )
        db.session.add(slice1)
        db.session.commit()

        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db1].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is not None

        # refresh
        table1 = db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()
        # Test update
        table1.schema = None
        db.session.commit()

        # refresh
        table1 = db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()

        assert table1.perm == f"[tmp_db1].[tmp_table1](id:{table1.id})"
        assert table1.schema_perm is None

        # cleanup
        db.session.delete(slice1)
        db.session.delete(table1)
        db.session.delete(tmp_db1)
        db.session.commit()

    def test_after_update_dataset__name_db_changes(self):
        tmp_db1 = Database(database_name="tmp_db1", sqlalchemy_uri="sqlite://")
        tmp_db2 = Database(database_name="tmp_db2", sqlalchemy_uri="sqlite://")
        db.session.add(tmp_db1)
        db.session.add(tmp_db2)
        db.session.commit()

        table1 = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_table1",
            database=tmp_db1,
        )
        db.session.add(table1)
        db.session.commit()

        slice1 = Slice(
            datasource_id=table1.id,
            datasource_type=DatasourceType.TABLE,
            datasource_name="tmp_table1",
            slice_name="tmp_slice1",
        )
        db.session.add(slice1)
        db.session.commit()

        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db1].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is not None

        # refresh
        table1 = db.session.query(SqlaTable).filter_by(table_name="tmp_table1").one()
        # Test update
        table1.table_name = "tmp_table1_changed"
        table1.database = tmp_db2
        db.session.commit()

        # Test old permission does not exist
        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db1].[tmp_table1](id:{table1.id})"
        )
        assert table1_pvm is None

        # Test new permission exist
        table1_pvm = security_manager.find_permission_view_menu(
            "datasource_access", f"[tmp_db2].[tmp_table1_changed](id:{table1.id})"
        )
        assert table1_pvm is not None

        # test dataset permission and schema permission changed
        changed_table1 = (
            db.session.query(SqlaTable).filter_by(table_name="tmp_table1_changed").one()
        )
        assert changed_table1.perm == f"[tmp_db2].[tmp_table1_changed](id:{table1.id})"
        assert changed_table1.schema_perm == "[tmp_db2].[tmp_schema]"  # noqa: F541

        # Test Chart permission changed
        slice1 = db.session.query(Slice).filter_by(slice_name="tmp_slice1").one()
        assert slice1.perm == f"[tmp_db2].[tmp_table1_changed](id:{table1.id})"
        assert slice1.schema_perm == f"[tmp_db2].[tmp_schema]"  # noqa: F541

        # cleanup
        db.session.delete(slice1)
        db.session.delete(table1)
        db.session.delete(tmp_db1)
        db.session.delete(tmp_db2)
        db.session.commit()

    def test_hybrid_perm_database(self):
        database = Database(database_name="tmp_database3", sqlalchemy_uri="sqlite://")

        db.session.add(database)

        id_ = (
            db.session.query(Database.id)
            .filter_by(database_name="tmp_database3")
            .scalar()
        )

        record = (
            db.session.query(Database)
            .filter_by(perm=f"[tmp_database3].(id:{id_})")
            .one()
        )

        assert record.get_perm() == record.perm
        assert record.id == id_
        assert record.database_name == "tmp_database3"
        db.session.delete(database)
        db.session.commit()

    def test_set_perm_slice(self):
        database = Database(database_name="tmp_database", sqlalchemy_uri="sqlite://")
        table = SqlaTable(table_name="tmp_perm_table", database=database)
        db.session.add(database)
        db.session.add(table)
        db.session.commit()

        # no schema permission
        slice = Slice(
            datasource_id=table.id,
            datasource_type=DatasourceType.TABLE,
            datasource_name="tmp_perm_table",
            slice_name="slice_name",
        )
        db.session.add(slice)
        db.session.commit()

        slice = db.session.query(Slice).filter_by(slice_name="slice_name").one()
        assert slice.perm == table.perm
        assert slice.perm == f"[tmp_database].[tmp_perm_table](id:{table.id})"
        assert slice.schema_perm == table.schema_perm
        assert slice.schema_perm is None

        table.schema = "tmp_perm_schema"
        table.table_name = "tmp_perm_table_v2"
        db.session.commit()
        table = (
            db.session.query(SqlaTable).filter_by(table_name="tmp_perm_table_v2").one()
        )
        assert slice.perm == table.perm
        assert slice.perm == f"[tmp_database].[tmp_perm_table_v2](id:{table.id})"
        assert table.perm == f"[tmp_database].[tmp_perm_table_v2](id:{table.id})"
        assert slice.schema_perm == table.schema_perm
        assert slice.schema_perm == "[tmp_database].[tmp_perm_schema]"

        db.session.delete(slice)
        db.session.delete(table)
        db.session.delete(database)

        db.session.commit()

    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    def test_schemas_accessible_by_user_admin(self, mock_sm_g, mock_g):
        mock_g.user = mock_sm_g.user = security_manager.find_user("admin")
        with self.client.application.test_request_context():
            database = get_example_database()
            schemas = security_manager.get_schemas_accessible_by_user(
                database, None, {"1", "2", "3"}
            )
            assert schemas == {"1", "2", "3"}  # no changes

    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    def test_schemas_accessible_by_user_schema_access(self, mock_sm_g, mock_g):
        # User has schema access to the schema 1
        create_schema_perm("[examples].[1]")
        mock_g.user = mock_sm_g.user = security_manager.find_user("gamma")
        with self.client.application.test_request_context():
            database = get_example_database()
            schemas = security_manager.get_schemas_accessible_by_user(
                database, None, {"1", "2", "3"}
            )
            # temp_schema is not passed in the params
            assert schemas == {"1"}
        delete_schema_perm("[examples].[1]")

    def test_schemas_accessible_by_user_datasource_access(self):
        # User has schema access to the datasource temp_schema.wb_health_population in examples DB.  # noqa: E501
        database = get_example_database()
        with self.client.application.test_request_context():
            with override_user(security_manager.find_user("gamma")):
                schemas = security_manager.get_schemas_accessible_by_user(
                    database, None, {"temp_schema", "2", "3"}
                )
                assert schemas == {"temp_schema"}

    def test_schemas_accessible_by_user_datasource_and_schema_access(self):
        # User has schema access to the datasource temp_schema.wb_health_population in examples DB.  # noqa: E501
        create_schema_perm("[examples].[2]")
        with self.client.application.test_request_context():
            database = get_example_database()
            with override_user(security_manager.find_user("gamma")):
                schemas = security_manager.get_schemas_accessible_by_user(
                    database, None, {"temp_schema", "2", "3"}
                )
                assert schemas == {"temp_schema", "2"}
                vm = security_manager.find_permission_view_menu(
                    "schema_access", "[examples].[2]"
                )
                assert vm is not None
                delete_schema_perm("[examples].[2]")

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_gamma_user_schema_access_to_dashboards(self):
        dash = db.session.query(Dashboard).filter_by(slug="world_health").first()
        dash.published = True
        db.session.commit()

        self.login(GAMMA_USERNAME)
        data = str(self.client.get("api/v1/dashboard/").data)
        assert "/superset/dashboard/world_health/" in data
        assert "/superset/dashboard/births/" not in data

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_public_sync_role_data_perms(self):
        """
        Security: Tests if the sync role method preserves data access permissions
        if they already exist on a public role.
        Also check that non data access permissions are removed
        """
        table = db.session.query(SqlaTable).filter_by(table_name="birth_names").one()
        self.grant_public_access_to_table(table)
        public_role = security_manager.get_public_role()
        unwanted_pvm = security_manager.find_permission_view_menu(
            "menu_access", "Security"
        )
        public_role.permissions.append(unwanted_pvm)
        db.session.commit()

        security_manager.sync_role_definitions()
        public_role = security_manager.get_public_role()
        public_role_resource_names = [
            permission.view_menu.name for permission in public_role.permissions
        ]

        assert table.get_perm() in public_role_resource_names
        assert "Security" not in public_role_resource_names

        # Cleanup
        self.revoke_public_access_to_table(table)

    @pytest.mark.usefixtures("public_role_like_test_role")
    def test_public_sync_role_builtin_perms(self):
        """
        Security: Tests public role creation based on a builtin role
        """
        public_role = security_manager.get_public_role()
        public_role_resource_names = [
            [permission.view_menu.name, permission.permission.name]
            for permission in public_role.permissions
        ]
        for pvm in current_app.config["FAB_ROLES"]["TestRole"]:
            assert pvm in public_role_resource_names

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_sqllab_gamma_user_schema_access_to_sqllab(self):
        example_db = (
            db.session.query(Database).filter_by(database_name="examples").one()
        )
        example_db.expose_in_sqllab = True
        db.session.commit()

        arguments = {
            "keys": ["none"],
            "columns": ["expose_in_sqllab"],
            "filters": [{"col": "expose_in_sqllab", "opr": "eq", "value": True}],
            "order_columns": "database_name",
            "order_direction": "asc",
            "page": 0,
            "page_size": -1,
        }
        NEW_FLASK_GET_SQL_DBS_REQUEST = f"/api/v1/database/?q={prison.dumps(arguments)}"  # noqa: N806
        self.login(GAMMA_USERNAME)
        databases_json = self.client.get(NEW_FLASK_GET_SQL_DBS_REQUEST).json
        assert databases_json["count"] == 1

    def assert_can_read(self, view_menu, permissions_set):
        if view_menu in NEW_SECURITY_CONVERGE_VIEWS:
            assert ("can_read", view_menu) in permissions_set
        else:
            assert ("can_list", view_menu) in permissions_set

    def assert_can_write(self, view_menu, permissions_set):
        if view_menu in NEW_SECURITY_CONVERGE_VIEWS:
            assert ("can_write", view_menu) in permissions_set
        else:
            assert ("can_add", view_menu) in permissions_set
            assert ("can_delete", view_menu) in permissions_set
            assert ("can_edit", view_menu) in permissions_set

    def assert_cannot_write(self, view_menu, permissions_set):
        if view_menu in NEW_SECURITY_CONVERGE_VIEWS:
            assert ("can_write", view_menu) not in permissions_set
        else:
            assert ("can_add", view_menu) not in permissions_set
            assert ("can_delete", view_menu) not in permissions_set
            assert ("can_edit", view_menu) not in permissions_set
            assert ("can_save", view_menu) not in permissions_set

    def assert_can_all(self, view_menu, permissions_set):
        self.assert_can_read(view_menu, permissions_set)
        self.assert_can_write(view_menu, permissions_set)

    def assert_can_menu(self, view_menu, permissions_set):
        assert ("menu_access", view_menu) in permissions_set

    def assert_cannot_menu(self, view_menu, permissions_set):
        assert ("menu_access", view_menu) not in permissions_set

    def assert_cannot_gamma(self, perm_set):
        self.assert_cannot_write("Annotation", perm_set)
        self.assert_cannot_write("CssTemplate", perm_set)
        self.assert_cannot_menu("SQL Lab", perm_set)
        self.assert_cannot_menu("CSS Templates", perm_set)
        self.assert_cannot_menu("Annotation Layers", perm_set)
        self.assert_cannot_menu("Manage", perm_set)
        self.assert_cannot_menu("Queries", perm_set)
        self.assert_cannot_menu("Import dashboards", perm_set)
        self.assert_cannot_menu("Upload a CSV", perm_set)
        self.assert_cannot_menu("ReportSchedule", perm_set)
        self.assert_cannot_menu("Alerts & Report", perm_set)
        assert ("can_upload", "Database") not in perm_set

    def assert_can_gamma(self, perm_set):
        self.assert_can_read("Dataset", perm_set)

        # make sure that user can create slices and dashboards
        self.assert_can_all("Dashboard", perm_set)
        self.assert_can_all("Chart", perm_set)
        assert ("can_csv", "Superset") in perm_set
        assert ("can_dashboard", "Superset") in perm_set
        assert ("can_explore", "Superset") in perm_set
        assert ("can_share_chart", "Superset") in perm_set
        assert ("can_share_dashboard", "Superset") in perm_set
        assert ("can_explore_json", "Superset") in perm_set
        assert ("can_explore_json", "Superset") in perm_set
        assert ("can_userinfo", "UserDBModelView") in perm_set
        assert ("can_view_chart_as_table", "Dashboard") in perm_set
        assert ("can_view_query", "Dashboard") in perm_set
        self.assert_can_menu("Databases", perm_set)
        self.assert_can_menu("Datasets", perm_set)
        self.assert_can_menu("Data", perm_set)
        self.assert_can_menu("Charts", perm_set)
        self.assert_can_menu("Dashboards", perm_set)

    def assert_can_alpha(self, perm_set):
        self.assert_can_all("Annotation", perm_set)
        self.assert_can_all("CssTemplate", perm_set)
        self.assert_can_all("Dataset", perm_set)
        self.assert_can_read("Database", perm_set)
        assert ("can_upload", "Database") in perm_set
        self.assert_can_menu("Manage", perm_set)
        self.assert_can_menu("Annotation Layers", perm_set)
        self.assert_can_menu("CSS Templates", perm_set)
        assert ("all_datasource_access", "all_datasource_access") in perm_set

    def assert_cannot_alpha(self, perm_set):
        self.assert_cannot_write("Queries", perm_set)
        self.assert_cannot_write("RoleModelView", perm_set)
        self.assert_cannot_write("UserDBModelView", perm_set)
        self.assert_cannot_write("Database", perm_set)

    def assert_can_admin(self, perm_set):
        self.assert_can_all("Database", perm_set)
        self.assert_can_all("RoleModelView", perm_set)
        self.assert_can_all("UserDBModelView", perm_set)
        assert ("all_database_access", "all_database_access") in perm_set
        self.assert_can_menu("Security", perm_set)
        self.assert_can_menu("List Users", perm_set)
        self.assert_can_menu("List Roles", perm_set)

    def test_is_admin_only(self):
        assert not security_manager._is_admin_only(
            security_manager.find_permission_view_menu("can_read", "Dataset")
        )
        assert not security_manager._is_admin_only(
            security_manager.find_permission_view_menu(
                "all_datasource_access", "all_datasource_access"
            )
        )

        log_permissions = ["can_read"]
        for log_permission in log_permissions:
            assert security_manager._is_admin_only(
                security_manager.find_permission_view_menu(log_permission, "Log")
            )

        assert security_manager._is_admin_only(
            security_manager.find_permission_view_menu("can_edit", "UserDBModelView")
        )

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_is_alpha_only(self):
        assert not security_manager._is_alpha_only(
            security_manager.find_permission_view_menu("can_read", "Dataset")
        )

        assert security_manager._is_alpha_only(
            security_manager.find_permission_view_menu("can_write", "Dataset")
        )
        assert security_manager._is_alpha_only(
            security_manager.find_permission_view_menu(
                "all_datasource_access", "all_datasource_access"
            )
        )
        assert security_manager._is_alpha_only(
            security_manager.find_permission_view_menu(
                "all_database_access", "all_database_access"
            )
        )

    def test_is_gamma_pvm(self):
        assert security_manager._is_gamma_pvm(
            security_manager.find_permission_view_menu("can_read", "Dataset")
        )

    def test_gamma_permissions_basic(self):
        self.assert_can_gamma(get_perm_tuples("Gamma"))
        self.assert_cannot_alpha(get_perm_tuples("Gamma"))
        self.assert_cannot_gamma(get_perm_tuples("Gamma"))

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_public_permissions_basic(self):
        self.assert_can_gamma(get_perm_tuples("Public"))

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_alpha_permissions(self):
        alpha_perm_tuples = get_perm_tuples("Alpha")
        self.assert_can_gamma(alpha_perm_tuples)
        self.assert_can_alpha(alpha_perm_tuples)
        self.assert_cannot_alpha(alpha_perm_tuples)
        assert ("can_this_form_get", "UserInfoEditView") not in alpha_perm_tuples
        assert ("can_this_form_post", "UserInfoEditView") not in alpha_perm_tuples

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_admin_permissions(self):
        if backend() == "hive":
            return

        self.assert_can_gamma(get_perm_tuples("Admin"))
        self.assert_can_alpha(get_perm_tuples("Admin"))
        self.assert_can_admin(get_perm_tuples("Admin"))

    def test_sql_lab_permissions(self):
        sql_lab_set = get_perm_tuples("sql_lab")
        assert sql_lab_set == {
            ("can_activate", "TabStateView"),
            ("can_csv", "Superset"),
            ("can_delete_query", "TabStateView"),
            ("can_delete", "TabStateView"),
            ("can_execute_sql_query", "SQLLab"),
            ("can_export", "SavedQuery"),
            ("can_export_csv", "SQLLab"),
            ("can_get", "TabStateView"),
            ("can_get_results", "SQLLab"),
            ("can_migrate_query", "TabStateView"),
            ("can_sqllab", "Superset"),
            ("can_sqllab_history", "Superset"),
            ("can_put", "TabStateView"),
            ("can_post", "TabStateView"),
            ("can_write", "SavedQuery"),
            ("can_read", "Query"),
            ("can_read", "Database"),
            ("can_read", "SQLLab"),
            ("can_read", "SavedQuery"),
            ("menu_access", "Query Search"),
            ("menu_access", "Saved Queries"),
            ("menu_access", "SQL Editor"),
            ("menu_access", "SQL Lab"),
            ("can_read", "SqlLabPermalinkRestApi"),
            ("can_write", "SqlLabPermalinkRestApi"),
        }

        self.assert_cannot_alpha(sql_lab_set)

    def test_gamma_permissions(self):
        gamma_perm_set = set()
        for perm in security_manager.find_role("Gamma").permissions:
            gamma_perm_set.add((perm.permission.name, perm.view_menu.name))

        # check read only perms

        # make sure that user can create slices and dashboards
        self.assert_can_all("Dashboard", gamma_perm_set)
        self.assert_can_read("Dataset", gamma_perm_set)

        # make sure that user can create slices and dashboards
        self.assert_can_all("Chart", gamma_perm_set)

        self.assert_cannot_write("UserDBModelView", gamma_perm_set)
        self.assert_cannot_write("RoleModelView", gamma_perm_set)

        assert ("can_csv", "Superset") in gamma_perm_set
        assert ("can_dashboard", "Superset") in gamma_perm_set
        assert ("can_explore", "Superset") in gamma_perm_set
        assert ("can_share_chart", "Superset") in gamma_perm_set
        assert ("can_share_dashboard", "Superset") in gamma_perm_set
        assert ("can_explore_json", "Superset") in gamma_perm_set
        assert ("can_userinfo", "UserDBModelView") in gamma_perm_set
        assert ("can_view_chart_as_table", "Dashboard") in gamma_perm_set
        assert ("can_view_query", "Dashboard") in gamma_perm_set

    def test_views_are_secured(self):
        """Preventing the addition of unsecured views without has_access decorator"""
        # These FAB views are secured in their body as opposed to by decorators
        method_allowlist = ("action", "action_post")
        # List of redirect & other benign views
        views_allowlist = [
            ["MyIndexView", "index"],
            ["UtilView", "back"],
            ["LocaleView", "index"],
            ["AuthDBView", "login"],
            ["AuthDBView", "logout"],
            ["CurrentUserRestApi", "get_me"],
            ["CurrentUserRestApi", "update_me"],
            ["CurrentUserRestApi", "get_my_roles"],
            ["UserRestApi", "avatar"],
            # TODO (embedded) remove Dashboard:embedded after uuids have been shipped
            ["Dashboard", "embedded"],
            ["EmbeddedView", "embedded"],
            ["R", "index"],
            ["Superset", "log"],
            ["Superset", "theme"],
            ["Superset", "welcome"],
            ["SecurityApi", "login"],
            ["SecurityApi", "refresh"],
            ["SupersetIndexView", "index"],
            ["SupersetIndexView", "patch_flask_locale"],
            ["DatabaseRestApi", "oauth2"],
            ["SupersetAuthView", "login"],
            ["SupersetAuthView", "logout"],
            ["SupersetRegisterUserView", "register"],
            ["SupersetRegisterUserView", "activation"],
        ]
        unsecured_views = []
        for view_class in appbuilder.baseviews:
            class_name = view_class.__class__.__name__
            for name, value in inspect.getmembers(
                view_class, predicate=inspect.ismethod
            ):
                if (
                    name not in method_allowlist
                    and [class_name, name] not in views_allowlist
                    and hasattr(value, "_urls")
                    and not hasattr(value, "_permission_name")
                ):
                    unsecured_views.append((class_name, name))
        if unsecured_views:
            view_str = "\n".join([str(v) for v in unsecured_views])
            raise Exception(f"Some views are not secured:\n{view_str}")


class TestSecurityManager(SupersetTestCase):
    """
    Testing the Security Manager.
    """

    @patch("superset.security.SupersetSecurityManager.raise_for_access")
    def test_can_access_datasource(self, mock_raise_for_access):
        datasource = self.get_datasource_mock()

        mock_raise_for_access.return_value = None
        assert security_manager.can_access_datasource(datasource=datasource)

        mock_raise_for_access.side_effect = SupersetSecurityException(
            SupersetError(
                "dummy",
                SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                ErrorLevel.ERROR,
            )
        )

        assert not security_manager.can_access_datasource(datasource=datasource)

    @patch("superset.security.SupersetSecurityManager.raise_for_access")
    def test_can_access_table(self, mock_raise_for_access):
        database = get_example_database()
        table = Table("bar", "foo")

        mock_raise_for_access.return_value = None
        assert security_manager.can_access_table(database, table)

        mock_raise_for_access.side_effect = SupersetSecurityException(
            SupersetError(
                "dummy", SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR, ErrorLevel.ERROR
            )
        )

        assert not security_manager.can_access_table(database, table)

    @patch("superset.security.SupersetSecurityManager.is_owner")
    @patch("superset.security.SupersetSecurityManager.can_access")
    @patch("superset.security.SupersetSecurityManager.can_access_schema")
    def test_raise_for_access_datasource(
        self, mock_can_access_schema, mock_can_access, mock_is_owner
    ):
        datasource = self.get_datasource_mock()

        mock_can_access_schema.return_value = True
        security_manager.raise_for_access(datasource=datasource)

        mock_can_access.return_value = False
        mock_can_access_schema.return_value = False
        mock_is_owner.return_value = False

        with self.assertRaises(SupersetSecurityException):  # noqa: PT027
            security_manager.raise_for_access(datasource=datasource)

    @patch("superset.security.SupersetSecurityManager.is_owner")
    @patch("superset.security.SupersetSecurityManager.can_access")
    def test_raise_for_access_query(self, mock_can_access, mock_is_owner):
        query = Mock(
            database=get_example_database(),
            schema="bar",
            sql="SELECT * FROM foo",
            catalog=None,
        )

        mock_can_access.return_value = True
        security_manager.raise_for_access(query=query)

        mock_can_access.return_value = False
        mock_is_owner.return_value = False

        with self.assertRaises(SupersetSecurityException):  # noqa: PT027
            security_manager.raise_for_access(query=query)

    def test_raise_for_access_sql_fails(self):
        with override_user(security_manager.find_user("gamma")):
            with self.assertRaises(SupersetSecurityException):  # noqa: PT027
                security_manager.raise_for_access(
                    database=get_example_database(),
                    schema="bar",
                    sql="SELECT * FROM foo",
                )

    @patch("superset.security.SupersetSecurityManager.is_owner")
    @patch("superset.security.SupersetSecurityManager.can_access")
    def test_raise_for_access_sql(self, mock_can_access, mock_is_owner):
        mock_can_access.return_value = True
        mock_is_owner.return_value = True
        with override_user(security_manager.find_user("gamma")):
            security_manager.raise_for_access(
                database=get_example_database(), schema="bar", sql="SELECT * FROM foo"
            )

    @patch("superset.security.SupersetSecurityManager.is_owner")
    @patch("superset.security.SupersetSecurityManager.can_access")
    @patch("superset.security.SupersetSecurityManager.can_access_schema")
    def test_raise_for_access_query_context(
        self, mock_can_access_schema, mock_can_access, mock_is_owner
    ):
        query_context = Mock(datasource=self.get_datasource_mock(), form_data={})

        mock_can_access_schema.return_value = True
        security_manager.raise_for_access(query_context=query_context)

        mock_can_access.return_value = False
        mock_can_access_schema.return_value = False
        mock_is_owner.return_value = False
        with override_user(security_manager.find_user("gamma")):
            with self.assertRaises(SupersetSecurityException):  # noqa: PT027
                security_manager.raise_for_access(query_context=query_context)

    @patch("superset.security.SupersetSecurityManager.can_access")
    def test_raise_for_access_table(self, mock_can_access):
        database = get_example_database()
        table = Table("bar", "foo")

        mock_can_access.return_value = True
        security_manager.raise_for_access(database=database, table=table)

        mock_can_access.return_value = False

        with self.assertRaises(SupersetSecurityException):  # noqa: PT027
            security_manager.raise_for_access(database=database, table=table)

    @patch("superset.security.SupersetSecurityManager.is_owner")
    @patch("superset.security.SupersetSecurityManager.can_access")
    @patch("superset.security.SupersetSecurityManager.can_access_schema")
    def test_raise_for_access_viz(
        self, mock_can_access_schema, mock_can_access, mock_is_owner
    ):
        test_viz = viz.TimeTableViz(self.get_datasource_mock(), form_data={})

        mock_can_access_schema.return_value = True
        security_manager.raise_for_access(viz=test_viz)

        mock_can_access.return_value = False
        mock_can_access_schema.return_value = False
        mock_is_owner.return_value = False
        with override_user(security_manager.find_user("gamma")):
            with self.assertRaises(SupersetSecurityException):  # noqa: PT027
                security_manager.raise_for_access(viz=test_viz)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @with_feature_flags(DASHBOARD_RBAC=True)
    @patch("superset.security.SupersetSecurityManager.is_owner")
    @patch("superset.security.SupersetSecurityManager.can_access")
    @patch("superset.security.SupersetSecurityManager.can_access_schema")
    def test_raise_for_access_rbac(
        self,
        mock_can_access_schema,
        mock_can_access,
        mock_is_owner,
    ):
        births = self.get_dash_by_slug("births")
        girls = self.get_slice("Girls")
        birth_names = girls.datasource

        world_health = self.get_dash_by_slug("world_health")
        treemap = self.get_slice("Treemap")

        births.json_metadata = json.dumps(
            {
                "native_filter_configuration": [
                    {
                        "id": "NATIVE_FILTER-ABCDEFGH",
                        "targets": [{"datasetId": birth_names.id}],
                    },
                    {
                        "id": "NATIVE_FILTER-IJKLMNOP",
                        "targets": [{"datasetId": treemap.id}],
                    },
                ]
            }
        )

        mock_is_owner.return_value = False
        mock_can_access.return_value = False
        mock_can_access_schema.return_value = False
        with override_user(security_manager.find_user("gamma")):
            for kwarg in ["query_context", "viz"]:
                births.roles = []

                # No dashboard roles.
                with self.assertRaises(SupersetSecurityException):  # noqa: PT027
                    security_manager.raise_for_access(
                        **{
                            kwarg: Mock(
                                datasource=birth_names,
                                form_data={
                                    "dashboardId": births.id,
                                    "slice_id": girls.id,
                                },
                            )
                        }
                    )

                births.roles = [self.get_role("Gamma")]

                # Undefined dashboard.
                with self.assertRaises(SupersetSecurityException):  # noqa: PT027
                    security_manager.raise_for_access(
                        **{
                            kwarg: Mock(
                                datasource=birth_names,
                                form_data={},
                            )
                        }
                    )

                # Undefined dashboard chart.
                with self.assertRaises(SupersetSecurityException):  # noqa: PT027
                    security_manager.raise_for_access(
                        **{
                            kwarg: Mock(
                                datasource=birth_names,
                                form_data={"dashboardId": births.id},
                            )
                        }
                    )

                # Ill-defined dashboard chart.
                with self.assertRaises(SupersetSecurityException):  # noqa: PT027
                    security_manager.raise_for_access(
                        **{
                            kwarg: Mock(
                                datasource=birth_names,
                                form_data={
                                    "dashboardId": births.id,
                                    "slice_id": treemap.id,
                                },
                            )
                        }
                    )

                # Dashboard chart not associated with said datasource.
                with self.assertRaises(SupersetSecurityException):  # noqa: PT027
                    security_manager.raise_for_access(
                        **{
                            kwarg: Mock(
                                datasource=birth_names,
                                form_data={
                                    "dashboardId": world_health.id,
                                    "slice_id": treemap.id,
                                },
                            )
                        }
                    )

                # Dashboard chart associated with said datasource.
                security_manager.raise_for_access(
                    **{
                        kwarg: Mock(
                            datasource=birth_names,
                            form_data={
                                "dashboardId": births.id,
                                "slice_id": girls.id,
                            },
                        )
                    }
                )

                # Ill-defined native filter.
                with self.assertRaises(SupersetSecurityException):  # noqa: PT027
                    security_manager.raise_for_access(
                        **{
                            kwarg: Mock(
                                datasource=birth_names,
                                form_data={
                                    "dashboardId": births.id,
                                    "type": "NATIVE_FILTER",
                                },
                            )
                        }
                    )

                # Native filter not associated with said datasource.
                with self.assertRaises(SupersetSecurityException):  # noqa: PT027
                    security_manager.raise_for_access(
                        **{
                            kwarg: Mock(
                                datasource=birth_names,
                                form_data={
                                    "dashboardId": births.id,
                                    "native_filter_id": "NATIVE_FILTER-IJKLMNOP",
                                    "type": "NATIVE_FILTER",
                                },
                            )
                        }
                    )

                # Native filter associated with said datasource.
                security_manager.raise_for_access(
                    **{
                        kwarg: Mock(
                            datasource=birth_names,
                            form_data={
                                "dashboardId": births.id,
                                "native_filter_id": "NATIVE_FILTER-ABCDEFGH",
                                "type": "NATIVE_FILTER",
                            },
                        )
                    }
                )

    def test_get_admin_user_roles(self):
        admin = security_manager.find_user("admin")
        with override_user(admin):
            roles = security_manager.get_user_roles()
            assert admin.roles == roles

    def test_get_gamma_user_roles(self):
        admin = security_manager.find_user("gamma")
        with override_user(admin):
            roles = security_manager.get_user_roles()
            assert admin.roles == roles

    @pytest.mark.usefixtures("create_gamma_user_group")
    def test_get_user_roles_with_groups(self):
        user = security_manager.find_user("gamma_with_groups")
        with override_user(user):
            roles = security_manager.get_user_roles()
            assert user.groups[0].roles == roles

    @pytest.mark.usefixtures("create_gamma_user_group_with_dar")
    def test_get_user_roles_with_groups_dar(self):
        user = security_manager.find_user("gamma_with_groups")
        with override_user(user):
            role_names = [role.name for role in security_manager.get_user_roles()]
            assert "Gamma" in role_names
            assert "dar" in role_names
            assert len(role_names) == 2

    @pytest.mark.usefixtures("create_user_group_with_dar")
    def test_user_view_menu_names_with_groups_dar(self):
        user = security_manager.find_user("gamma_with_groups")
        with override_user(user):
            assert security_manager.user_view_menu_names("datasource_access") == {
                "[examples].[birth_names](id:1)]"
            }

    @pytest.mark.usefixtures("create_gamma_user_group_with_dar")
    def test_gamma_user_view_menu_names_with_groups_dar(self):
        user = security_manager.find_user("gamma_with_groups")
        with override_user(user):
            # assert pvm for dar role
            assert security_manager.user_view_menu_names("datasource_access") == {
                "[examples].[birth_names](id:1)]"
            }
            # assert pvm for gamma role
            assert security_manager.user_view_menu_names("can_external_metadata") == {
                "Datasource"
            }
            assert security_manager.user_view_menu_names("can_recent_activity") == {
                "Log"
            }

    def test_get_anonymous_roles(self):
        with override_user(security_manager.get_anonymous_user()):
            roles = security_manager.get_user_roles()
            assert [security_manager.get_public_role()] == roles

    def test_all_database_access(self):
        gamma_user = security_manager.find_user(username="gamma")
        g.user = gamma_user

        # Double checking that gamma users can't access all databases
        assert not security_manager.can_access_all_databases()
        assert not security_manager.can_access_datasource(self.get_datasource_mock())

        all_db_pvm = ("all_database_access", "all_database_access")

        with self.temporary_user(gamma_user, extra_pvms=[all_db_pvm]):
            assert security_manager.can_access_all_databases()
            assert security_manager.can_access_datasource(self.get_datasource_mock())


class TestDatasources(SupersetTestCase):
    @patch("superset.security.SupersetSecurityManager.can_access_database")
    @patch("superset.security.SupersetSecurityManager.get_session")
    def test_get_user_datasources_admin(
        self, mock_get_session, mock_can_access_database
    ):
        Datasource = namedtuple("Datasource", ["database", "schema", "name"])
        mock_can_access_database.return_value = True
        mock_get_session.query.return_value.filter.return_value.all.return_value = []

        with mock.patch.object(
            SqlaTable, "get_all_datasources"
        ) as mock_get_all_datasources:
            mock_get_all_datasources.return_value = [
                Datasource("database1", "schema1", "table1"),
                Datasource("database1", "schema1", "table2"),
                Datasource("database2", None, "table1"),
            ]
            with override_user(security_manager.find_user("admin")):
                datasources = security_manager.get_user_datasources()
                assert sorted(datasources) == [
                    Datasource("database1", "schema1", "table1"),
                    Datasource("database1", "schema1", "table2"),
                    Datasource("database2", None, "table1"),
                ]

    @patch("superset.security.SupersetSecurityManager.can_access_database")
    @patch("superset.security.SupersetSecurityManager.get_session")
    def test_get_user_datasources_gamma(
        self, mock_get_session, mock_can_access_database
    ):
        Datasource = namedtuple("Datasource", ["database", "schema", "name"])
        mock_can_access_database.return_value = False
        mock_get_session.query.return_value.filter.return_value.all.return_value = []

        with mock.patch.object(
            SqlaTable, "get_all_datasources"
        ) as mock_get_all_datasources:
            mock_get_all_datasources.return_value = [
                Datasource("database1", "schema1", "table1"),
                Datasource("database1", "schema1", "table2"),
                Datasource("database2", None, "table1"),
            ]
            with override_user(security_manager.find_user("gamma")):
                datasources = security_manager.get_user_datasources()
                assert datasources == []

    @patch("superset.security.SupersetSecurityManager.can_access_database")
    @patch("superset.security.SupersetSecurityManager.get_session")
    def test_get_user_datasources_gamma_with_schema(
        self, mock_get_session, mock_can_access_database
    ):
        Datasource = namedtuple("Datasource", ["database", "schema", "name"])
        mock_can_access_database.return_value = False

        mock_get_session.query.return_value.filter.return_value.all.return_value = [
            Datasource("database1", "schema1", "table1"),
            Datasource("database1", "schema1", "table2"),
        ]

        with mock.patch.object(
            SqlaTable, "get_all_datasources"
        ) as mock_get_all_datasources:
            mock_get_all_datasources.return_value = [
                Datasource("database1", "schema1", "table1"),
                Datasource("database1", "schema1", "table2"),
                Datasource("database2", None, "table1"),
            ]
            with override_user(security_manager.find_user("gamma")):
                datasources = security_manager.get_user_datasources()
                assert sorted(datasources) == [
                    Datasource("database1", "schema1", "table1"),
                    Datasource("database1", "schema1", "table2"),
                ]


class FakeRequest:
    headers: Any = {}
    form: Any = {}


class TestGuestTokens(SupersetTestCase):
    def create_guest_token(self):
        user = {"username": "test_guest"}
        resources = [{"some": "resource"}]
        rls = [{"dataset": 1, "clause": "access = 1"}]
        return security_manager.create_guest_access_token(user, resources, rls)

    @patch("superset.security.SupersetSecurityManager._get_current_epoch_time")
    def test_create_guest_access_token(self, get_time_mock):
        now = time.time()
        get_time_mock.return_value = now  # so we know what it should =

        user = {"username": "test_guest"}
        resources = [{"some": "resource"}]
        rls = [{"dataset": 1, "clause": "access = 1"}]
        token = security_manager.create_guest_access_token(user, resources, rls)
        aud = get_url_host()
        # unfortunately we cannot mock time in the jwt lib
        decoded_token = jwt.decode(
            token,
            self.app.config["GUEST_TOKEN_JWT_SECRET"],
            algorithms=[self.app.config["GUEST_TOKEN_JWT_ALGO"]],
            audience=aud,
        )

        assert user == decoded_token["user"]
        assert resources == decoded_token["resources"]
        assert now == decoded_token["iat"]
        assert aud == decoded_token["aud"]
        assert "guest" == decoded_token["type"]
        assert (
            now + self.app.config["GUEST_TOKEN_JWT_EXP_SECONDS"] == decoded_token["exp"]
        )

    def test_get_guest_user(self):
        token = self.create_guest_token()
        fake_request = FakeRequest()
        fake_request.headers[current_app.config["GUEST_TOKEN_HEADER_NAME"]] = token

        guest_user = security_manager.get_guest_user_from_request(fake_request)

        assert guest_user is not None
        assert "test_guest" == guest_user.username

    def create_guest_token_with_attributes(self):
        user = {
            "username": "test_guest_with_attrs",
            "first_name": "Test",
            "last_name": "Guest",
            "attributes": {
                "department": "Engineering",
                "region": "US",
                "role": "developer",
                "team": "data-platform"
            }
        }
        resources = [{"some": "resource"}]
        rls = [{"dataset": 1, "clause": "access = 1"}]
        return security_manager.create_guest_access_token(user, resources, rls)

    def test_create_guest_access_token_with_attributes(self):
        """Test creating guest access token with user attributes."""
        user_with_attributes = {
            "username": "test_guest_attrs",
            "first_name": "Test",
            "last_name": "Guest",
            "attributes": {
                "department": "Engineering",
                "region": "US",
                "clearance_level": "standard",
                "projects": ["analytics", "ml-platform"],
                "team_lead": True
            }
        }
        resources = [{"type": "dashboard", "id": "test-dashboard"}]
        rls = [{"dataset": 1, "clause": "id = 1"}]
        
        token = security_manager.create_guest_access_token(user_with_attributes, resources, rls)
        
        # Decode and verify the token contains attributes
        aud = get_url_host()
        decoded_token = jwt.decode(
            token,
            self.app.config["GUEST_TOKEN_JWT_SECRET"],
            algorithms=[self.app.config["GUEST_TOKEN_JWT_ALGO"]],
            audience=aud,
        )
        
        assert "user" in decoded_token
        user = decoded_token["user"]
        assert "attributes" in user
        assert user["attributes"]["department"] == "Engineering"
        assert user["attributes"]["region"] == "US"
        assert user["attributes"]["clearance_level"] == "standard"
        assert user["attributes"]["projects"] == ["analytics", "ml-platform"]
        assert user["attributes"]["team_lead"] is True

    def test_get_guest_user_with_attributes(self):
        """Test that guest user properly retains attributes from token."""
        token = self.create_guest_token_with_attributes()
        fake_request = FakeRequest()
        fake_request.headers[current_app.config["GUEST_TOKEN_HEADER_NAME"]] = token

        guest_user = security_manager.get_guest_user_from_request(fake_request)

        assert guest_user is not None
        assert "test_guest_with_attrs" == guest_user.username
        
        # Verify attributes are accessible through guest_token
        assert hasattr(guest_user, 'guest_token')
        token_user = guest_user.guest_token["user"]
        assert "attributes" in token_user
        assert token_user["attributes"]["department"] == "Engineering"
        assert token_user["attributes"]["region"] == "US"
        assert token_user["attributes"]["role"] == "developer"
        assert token_user["attributes"]["team"] == "data-platform"

    def test_create_guest_access_token_without_attributes(self):
        """Test creating guest access token without user attributes (backward compatibility)."""
        user_without_attributes = {
            "username": "test_guest_no_attrs",
            "first_name": "Test",
            "last_name": "Guest"
        }
        resources = [{"type": "dashboard", "id": "test-dashboard"}]
        rls = [{"dataset": 1, "clause": "id = 1"}]
        
        token = security_manager.create_guest_access_token(user_without_attributes, resources, rls)
        
        # Decode and verify the token works without attributes
        aud = get_url_host()
        decoded_token = jwt.decode(
            token,
            self.app.config["GUEST_TOKEN_JWT_SECRET"],
            algorithms=[self.app.config["GUEST_TOKEN_JWT_ALGO"]],
            audience=aud,
        )
        
        assert "user" in decoded_token
        user = decoded_token["user"]
        assert "attributes" not in user
        assert user["username"] == "test_guest_no_attrs"

    def test_create_guest_access_token_with_empty_attributes(self):
        """Test creating guest access token with empty attributes."""
        user_with_empty_attributes = {
            "username": "test_guest_empty_attrs",
            "first_name": "Test",
            "last_name": "Guest",
            "attributes": {}
        }
        resources = [{"type": "dashboard", "id": "test-dashboard"}]
        rls = [{"dataset": 1, "clause": "id = 1"}]
        
        token = security_manager.create_guest_access_token(user_with_empty_attributes, resources, rls)
        
        # Decode and verify the token contains empty attributes
        aud = get_url_host()
        decoded_token = jwt.decode(
            token,
            self.app.config["GUEST_TOKEN_JWT_SECRET"],
            algorithms=[self.app.config["GUEST_TOKEN_JWT_ALGO"]],
            audience=aud,
        )
        
        assert "user" in decoded_token
        user = decoded_token["user"]
        assert "attributes" in user
        assert user["attributes"] == {}

    def test_create_guest_access_token_with_null_attributes(self):
        """Test creating guest access token with null attributes."""
        user_with_null_attributes = {
            "username": "test_guest_null_attrs",
            "first_name": "Test",
            "last_name": "Guest",
            "attributes": None
        }
        resources = [{"type": "dashboard", "id": "test-dashboard"}]
        rls = [{"dataset": 1, "clause": "id = 1"}]
        
        token = security_manager.create_guest_access_token(user_with_null_attributes, resources, rls)
        
        # Decode and verify the token contains null attributes
        aud = get_url_host()
        decoded_token = jwt.decode(
            token,
            self.app.config["GUEST_TOKEN_JWT_SECRET"],
            algorithms=[self.app.config["GUEST_TOKEN_JWT_ALGO"]],
            audience=aud,
        )
        
        assert "user" in decoded_token
        user = decoded_token["user"]
        assert "attributes" in user
        assert user["attributes"] is None

    def test_get_guest_user_with_request_form(self):
        token = self.create_guest_token()
        fake_request = FakeRequest()
        fake_request.headers[current_app.config["GUEST_TOKEN_HEADER_NAME"]] = None
        fake_request.form["guest_token"] = token

        guest_user = security_manager.get_guest_user_from_request(fake_request)

        assert guest_user is not None
        assert "test_guest" == guest_user.username

    @patch("superset.security.SupersetSecurityManager._get_current_epoch_time")
    def test_get_guest_user_expired_token(self, get_time_mock):
        # make a just-expired token
        get_time_mock.return_value = (
            time.time() - (self.app.config["GUEST_TOKEN_JWT_EXP_SECONDS"] * 1000) - 1
        )
        token = self.create_guest_token()
        fake_request = FakeRequest()
        fake_request.headers[current_app.config["GUEST_TOKEN_HEADER_NAME"]] = token

        guest_user = security_manager.get_guest_user_from_request(fake_request)

        assert guest_user is None

    def test_get_guest_user_no_user(self):
        user = None
        resources = [{"type": "dashboard", "id": 1}]
        rls = {}
        token = security_manager.create_guest_access_token(user, resources, rls)
        fake_request = FakeRequest()
        fake_request.headers[current_app.config["GUEST_TOKEN_HEADER_NAME"]] = token
        guest_user = security_manager.get_guest_user_from_request(fake_request)

        assert guest_user is None
        self.assertRaisesRegex(ValueError, "Guest token does not contain a user claim")  # noqa: PT027

    def test_get_guest_user_no_resource(self):
        user = {"username": "test_guest"}
        resources = []
        rls = {}
        token = security_manager.create_guest_access_token(user, resources, rls)
        fake_request = FakeRequest()
        fake_request.headers[current_app.config["GUEST_TOKEN_HEADER_NAME"]] = token
        security_manager.get_guest_user_from_request(fake_request)

        self.assertRaisesRegex(  # noqa: PT027
            ValueError, "Guest token does not contain a resources claim"
        )

    def test_get_guest_user_not_guest_type(self):
        now = time.time()
        user = {"username": "test_guest"}
        resources = [{"some": "resource"}]
        aud = get_url_host()

        claims = {
            "user": user,
            "resources": resources,
            "rls_rules": [],
            # standard jwt claims:
            "aud": aud,
            "iat": now,  # issued at
            "type": "not_guest",
        }
        token = jwt.encode(
            claims,
            self.app.config["GUEST_TOKEN_JWT_SECRET"],
            algorithm=self.app.config["GUEST_TOKEN_JWT_ALGO"],
        )
        fake_request = FakeRequest()
        fake_request.headers[current_app.config["GUEST_TOKEN_HEADER_NAME"]] = token
        guest_user = security_manager.get_guest_user_from_request(fake_request)

        assert guest_user is None
        self.assertRaisesRegex(ValueError, "This is not a guest token.")  # noqa: PT027

    def test_get_guest_user_bad_audience(self):
        now = time.time()
        user = {"username": "test_guest"}
        resources = [{"some": "resource"}]
        aud = get_url_host()  # noqa: F841

        claims = {
            "user": user,
            "resources": resources,
            "rls_rules": [],
            # standard jwt claims:
            "aud": "bad_audience",
            "iat": now,  # issued at
            "type": "guest",
        }
        token = jwt.encode(
            claims,
            self.app.config["GUEST_TOKEN_JWT_SECRET"],
            algorithm=self.app.config["GUEST_TOKEN_JWT_ALGO"],
        )
        fake_request = FakeRequest()
        fake_request.headers[current_app.config["GUEST_TOKEN_HEADER_NAME"]] = token
        guest_user = security_manager.get_guest_user_from_request(fake_request)

        self.assertRaisesRegex(jwt.exceptions.InvalidAudienceError, "Invalid audience")  # noqa: PT027
        assert guest_user is None

    @patch("superset.security.SupersetSecurityManager._get_current_epoch_time")
    def test_create_guest_access_token_callable_audience(self, get_time_mock):
        now = time.time()
        get_time_mock.return_value = now
        app.config["GUEST_TOKEN_JWT_AUDIENCE"] = Mock(return_value="cool_code")

        user = {"username": "test_guest"}
        resources = [{"some": "resource"}]
        rls = [{"dataset": 1, "clause": "access = 1"}]
        token = security_manager.create_guest_access_token(user, resources, rls)

        decoded_token = jwt.decode(
            token,
            self.app.config["GUEST_TOKEN_JWT_SECRET"],
            algorithms=[self.app.config["GUEST_TOKEN_JWT_ALGO"]],
            audience="cool_code",
        )
        app.config["GUEST_TOKEN_JWT_AUDIENCE"].assert_called_once()
        assert "cool_code" == decoded_token["aud"]
        assert "guest" == decoded_token["type"]
        app.config["GUEST_TOKEN_JWT_AUDIENCE"] = None
