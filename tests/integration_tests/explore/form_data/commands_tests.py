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

from unittest.mock import patch

import pytest
from flask import current_app

from superset import db, security_manager
from superset.commands.exceptions import DatasourceTypeInvalidError
from superset.commands.explore.form_data.create import CreateFormDataCommand
from superset.commands.explore.form_data.delete import DeleteFormDataCommand
from superset.commands.explore.form_data.get import GetFormDataCommand
from superset.commands.explore.form_data.parameters import CommandParameters
from superset.commands.explore.form_data.update import UpdateFormDataCommand
from superset.common.db_query_status import QueryStatus
from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice
from superset.models.sql_lab import Query
from superset.utils import json
from superset.utils.core import (
    DatasourceType,
    get_example_default_schema,
    override_user,
)
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase

# Mirrors the SCHEMA_ACCESS_ROLE pattern in tests/integration_tests/security_tests.py:
# a role granting only schema_access on one schema, no all_datasource_access and no
# per-table datasource_access.
FORM_DATA_SCHEMA_ACCESS_ROLE = "form_data_schema_access_role"


def _grant_schema_access(view_menu_name: str) -> bool:
    """
    Grants ``FORM_DATA_SCHEMA_ACCESS_ROLE`` schema_access on the given view
    menu. Returns whether this call created the underlying permission-view
    (as opposed to one that already existed, e.g. granted to some other
    role by an earlier test), so the caller's teardown knows whether it's
    safe to delete it without affecting other schema-access tests.
    """
    permission = "schema_access"
    created_permission_view = (
        security_manager.find_permission_view_menu(permission, view_menu_name) is None
    )
    security_manager.add_permission_view_menu(permission, view_menu_name)
    perm_view = security_manager.find_permission_view_menu(permission, view_menu_name)
    security_manager.add_permission_role(
        security_manager.find_role(FORM_DATA_SCHEMA_ACCESS_ROLE), perm_view
    )
    return created_permission_view


def _revoke_schema_access(view_menu_name: str, delete_permission_view: bool) -> None:
    pv = security_manager.find_permission_view_menu("schema_access", view_menu_name)
    security_manager.del_permission_role(
        security_manager.find_role(FORM_DATA_SCHEMA_ACCESS_ROLE), pv
    )
    # Only remove the permission-view menu itself if this fixture created
    # it; it may have pre-dated this test (e.g. granted to another role),
    # and other schema-access tests shouldn't become order-dependent on
    # this teardown.
    if delete_permission_view:
        security_manager.del_permission_view_menu("schema_access", view_menu_name)


class TestCreateFormDataCommand(SupersetTestCase):
    @pytest.fixture
    def create_dataset(self):
        with self.create_app().app_context():
            dataset = SqlaTable(
                table_name="dummy_sql_table",
                database=get_example_database(),
                schema=get_example_default_schema(),
                sql="select 123 as intcol, 'abc' as strcol",
            )
            db.session.add(dataset)
            db.session.commit()

            yield dataset

            # rollback
            db.session.delete(dataset)
            db.session.commit()

    @pytest.fixture
    def create_slice(self):
        with self.create_app().app_context():
            dataset = (
                db.session.query(SqlaTable)
                .filter_by(table_name="dummy_sql_table")
                .first()
            )
            slice = Slice(
                datasource_id=dataset.id,
                datasource_type=DatasourceType.TABLE,
                datasource_name="tmp_perm_table",
                slice_name="slice_name",
            )

            db.session.add(slice)
            db.session.commit()

            yield slice

            # rollback
            db.session.delete(slice)
            db.session.commit()

    @pytest.fixture
    def create_query(self):
        with self.create_app().app_context():
            query = Query(
                sql="select 1 as foo;",
                client_id="sldkfjlk",
                database=get_example_database(),
            )

            db.session.add(query)
            db.session.commit()

            yield query

            # rollback
            db.session.delete(query)
            db.session.commit()

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice")
    def test_create_form_data_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        command = CreateFormDataCommand(args)

        assert isinstance(command.run(), str)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_create_form_data_command_invalid_type(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        current_app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type="InvalidType",
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        with pytest.raises(DatasourceTypeInvalidError) as exc:
            CreateFormDataCommand(create_args).run()

        assert "Datasource type is invalid" in str(exc.value)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_create_form_data_command_type_as_string(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        current_app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type="table",
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        command = CreateFormDataCommand(create_args)

        assert isinstance(command.run(), str)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice")
    def test_get_form_data_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        current_app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        key = CreateFormDataCommand(create_args).run()

        key_args = CommandParameters(key=key)
        get_command = GetFormDataCommand(key_args)
        cache_data = json.loads(get_command.run())

        assert cache_data.get("datasource") == datasource

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_update_form_data_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        current_app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        query = db.session.query(Query).filter_by(sql="select 1 as foo;").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        key = CreateFormDataCommand(create_args).run()

        query_datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        update_args = CommandParameters(
            datasource_id=query.id,
            datasource_type=DatasourceType.QUERY,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": query_datasource}),
            key=key,
        )

        update_command = UpdateFormDataCommand(update_args)
        new_key = update_command.run()

        # it should return a key
        assert isinstance(new_key, str)
        # the updated key returned should be different from the old one
        assert new_key != key

        key_args = CommandParameters(key=key)
        get_command = GetFormDataCommand(key_args)

        cache_data = json.loads(get_command.run())

        assert cache_data.get("datasource") == query_datasource

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_update_form_data_command_same_form_data(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        current_app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        key = CreateFormDataCommand(create_args).run()

        update_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
            key=key,
        )

        update_command = UpdateFormDataCommand(update_args)
        new_key = update_command.run()

        # it should return a key
        assert isinstance(new_key, str)

        # the updated key returned should be the same as the old one
        assert new_key == key

        key_args = CommandParameters(key=key)
        get_command = GetFormDataCommand(key_args)

        cache_data = json.loads(get_command.run())

        assert cache_data.get("datasource") == datasource

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_delete_form_data_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        current_app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        key = CreateFormDataCommand(create_args).run()

        delete_args = CommandParameters(
            key=key,
        )

        delete_command = DeleteFormDataCommand(delete_args)
        response = delete_command.run()

        assert response is True  # noqa: E712

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_delete_form_data_command_key_expired(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        current_app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        delete_args = CommandParameters(
            key="some_expired_key",
        )

        delete_command = DeleteFormDataCommand(delete_args)
        response = delete_command.run()

        assert response is False  # noqa: E712

    def test_create_form_data_command_schema_access_no_all_datasource_access(self):
        """
        Regression for #39296: a user who has schema_access on the schema a
        SQL Lab query ran in (but neither all_datasource_access nor
        datasource_access on a specific registered dataset, since an ad-hoc
        query result is never registered as one) should still be able to
        jump straight from SQL Lab to "Create Chart" -- i.e.
        CreateFormDataCommand.run() with datasource_type=QUERY should not be
        blocked purely for lacking all_datasource_access, as long as the
        query's schema is one they're granted schema_access on.

        This exercises the same non-strict (force_dataset_match=False)
        fallthrough in SupersetSecurityManager.raise_for_access that
        test_raise_for_access_force_dataset_match_denies_schema_only (in
        security_tests.py) exercises for the strict SQL Lab path -- here we
        confirm the *non*-strict Explore/"Create Chart" path grants access on
        schema_access alone, without needing a registered dataset at all.
        """
        schema = get_example_default_schema()
        database = get_example_database()
        # raise_for_access qualifies the query's tables against the
        # database's default catalog (e.g. the Postgres database name),
        # so the granted schema_access permission must be built the same
        # way -- get_schema_perm() falls back to the plain [db].[schema]
        # form when the backend (e.g. sqlite, mysql) doesn't support
        # catalogs at all.
        view_menu_name = security_manager.get_schema_perm(
            database.database_name, database.get_default_catalog(), schema
        )

        security_manager.add_role(FORM_DATA_SCHEMA_ACCESS_ROLE)
        db.session.commit()
        created_permission_view = _grant_schema_access(view_menu_name)
        gamma_user = security_manager.find_user(username="gamma")
        gamma_user.roles.append(
            security_manager.find_role(FORM_DATA_SCHEMA_ACCESS_ROLE)
        )
        db.session.commit()

        query = Query(
            sql="SELECT * FROM wb_health_population",
            client_id="fd_sch_acc1",
            database=database,
            schema=schema,
            user_id=gamma_user.id,
        )
        db.session.add(query)
        db.session.commit()

        try:
            with override_user(gamma_user):
                # Sanity check: gamma should NOT have all_datasource_access,
                # or this test wouldn't be exercising the reported gap.
                assert not security_manager.can_access_all_datasources()

                args = CommandParameters(
                    datasource_id=query.id,
                    datasource_type=DatasourceType.QUERY,
                    chart_id=None,
                    tab_id=1,
                    form_data=json.dumps(
                        {"datasource": f"{query.id}__{DatasourceType.QUERY}"}
                    ),
                )
                # Should NOT raise: schema_access on the query's schema is
                # sufficient for the non-strict Explore access check, even
                # without all_datasource_access or a registered dataset.
                key = CreateFormDataCommand(args).run()
                assert isinstance(key, str)
        finally:
            db.session.delete(query)
            gamma_user.roles.remove(
                security_manager.find_role(FORM_DATA_SCHEMA_ACCESS_ROLE)
            )
            db.session.commit()
            _revoke_schema_access(view_menu_name, created_permission_view)
            db.session.delete(security_manager.find_role(FORM_DATA_SCHEMA_ACCESS_ROLE))
            db.session.commit()

    def test_create_form_data_command_query_author_no_all_datasource_access(self):
        """
        Regression for #39296 (the fix, not just the confirming test): a
        user with no all_datasource_access and no catalog/schema/
        datasource_access grant covering the table their SQL Lab query
        touches should still be able to jump straight from SQL Lab to
        "Create Chart" for that exact query, as long as they authored it.

        SupersetSecurityManager.raise_for_access grants a bypass to a SQL
        Lab query's own author, mirroring the ownership bypass already
        granted to dataset owners via is_editor -- unlike
        test_create_form_data_command_schema_access_no_all_datasource_access
        above, this user has no schema_access grant of any kind; authorship
        alone is what lets this through.
        """
        schema = get_example_default_schema()
        database = get_example_database()
        gamma_user = security_manager.find_user(username="gamma")

        query = Query(
            sql="SELECT * FROM wb_health_population",
            client_id="fd_auth_ac1",
            database=database,
            schema=schema,
            user_id=gamma_user.id,
            # The authorship bypass only covers a query that actually
            # succeeded -- see raise_for_access in
            # superset/security/manager.py.
            status=QueryStatus.SUCCESS,
        )
        db.session.add(query)
        db.session.commit()

        try:
            with override_user(gamma_user):
                # Sanity check: gamma should have neither all_datasource_access
                # nor a schema_access grant covering this query's schema, or
                # this test wouldn't be exercising the authorship bypass.
                assert not security_manager.can_access_all_datasources()
                view_menu_name = security_manager.get_schema_perm(
                    database.database_name, database.get_default_catalog(), schema
                )
                assert not security_manager.can_access("schema_access", view_menu_name)

                args = CommandParameters(
                    datasource_id=query.id,
                    datasource_type=DatasourceType.QUERY,
                    chart_id=None,
                    tab_id=1,
                    form_data=json.dumps(
                        {"datasource": f"{query.id}__{DatasourceType.QUERY}"}
                    ),
                )
                # Should NOT raise: gamma authored this exact query, which
                # is sufficient on its own, without any schema- or
                # dataset-level grant.
                key = CreateFormDataCommand(args).run()
                assert isinstance(key, str)
        finally:
            db.session.delete(query)
            db.session.commit()
