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
import re
from typing import Any, Optional
from unittest import mock

import pytest
from flask import g
import prison

from superset import db, security_manager, app  # noqa: F401
from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
from superset.security.guest_token import (
    GuestTokenResourceType,
    GuestUser,
)
from superset.utils import json
from flask_babel import lazy_gettext as _  # noqa: F401
from flask_appbuilder.models.sqla import filters
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_with_slice,  # noqa: F401
    load_energy_table_data,  # noqa: F401
)
from tests.integration_tests.fixtures.unicode_dashboard import (
    UNICODE_TBL_NAME,  # noqa: F401
    load_unicode_dashboard_with_slice,  # noqa: F401
    load_unicode_data,  # noqa: F401
)

from tests.integration_tests.fixtures.users import (
    create_gamma_user_group,  # noqa: F401
)


class TestRowLevelSecurity(SupersetTestCase):
    """
    Testing Row Level Security
    """

    rls_entry = None
    query_obj: dict[str, Any] = dict(  # noqa: C408
        groupby=[],
        metrics=None,
        filter=[],
        is_timeseries=False,
        columns=["value"],
        granularity=None,
        from_dttm=None,
        to_dttm=None,
        extras={},
    )
    NAME_AB_ROLE = "NameAB"
    NAME_Q_ROLE = "NameQ"
    NAMES_A_REGEX = re.compile(r"name like 'A%'")
    NAMES_B_REGEX = re.compile(r"name like 'B%'")
    NAMES_Q_REGEX = re.compile(r"name like 'Q%'")
    BASE_FILTER_REGEX = re.compile(r"gender = 'boy'")

    def setUp(self):
        # Create roles
        self.role_ab = security_manager.add_role(self.NAME_AB_ROLE)
        self.role_q = security_manager.add_role(self.NAME_Q_ROLE)
        gamma_user = security_manager.find_user(username="gamma")
        gamma_user.roles.append(self.role_ab)
        gamma_user.roles.append(self.role_q)
        self.create_user_with_roles("NoRlsRoleUser", ["Gamma"])
        db.session.commit()

        # Create regular RowLevelSecurityFilter (energy_usage, unicode_test)
        self.rls_entry1 = RowLevelSecurityFilter()
        self.rls_entry1.name = "rls_entry1"
        self.rls_entry1.tables.extend(
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name.in_(["energy_usage", "unicode_test"]))
            .all()
        )
        self.rls_entry1.filter_type = "Regular"
        self.rls_entry1.clause = "value > {{ cache_key_wrapper(1) }}"
        self.rls_entry1.group_key = None
        self.rls_entry1.roles.append(security_manager.find_role("Gamma"))
        self.rls_entry1.roles.append(security_manager.find_role("Alpha"))
        db.session.add(self.rls_entry1)

        # Create regular RowLevelSecurityFilter (birth_names name starts with A or B)
        self.rls_entry2 = RowLevelSecurityFilter()
        self.rls_entry2.name = "rls_entry2"
        self.rls_entry2.tables.extend(
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name.in_(["birth_names"]))
            .all()
        )
        self.rls_entry2.filter_type = "Regular"
        self.rls_entry2.clause = "name like 'A%' or name like 'B%'"
        self.rls_entry2.group_key = "name"
        self.rls_entry2.roles.append(security_manager.find_role("NameAB"))
        db.session.add(self.rls_entry2)

        # Create Regular RowLevelSecurityFilter (birth_names name starts with Q)
        self.rls_entry3 = RowLevelSecurityFilter()
        self.rls_entry3.name = "rls_entry3"
        self.rls_entry3.tables.extend(
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name.in_(["birth_names"]))
            .all()
        )
        self.rls_entry3.filter_type = "Regular"
        self.rls_entry3.clause = "name like 'Q%'"
        self.rls_entry3.group_key = "name"
        self.rls_entry3.roles.append(security_manager.find_role("NameQ"))
        db.session.add(self.rls_entry3)

        # Create Base RowLevelSecurityFilter (birth_names boys)
        self.rls_entry4 = RowLevelSecurityFilter()
        self.rls_entry4.name = "rls_entry4"
        self.rls_entry4.tables.extend(
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name.in_(["birth_names"]))
            .all()
        )
        self.rls_entry4.filter_type = "Base"
        self.rls_entry4.clause = "gender = 'boy'"
        self.rls_entry4.group_key = "gender"
        self.rls_entry4.roles.append(security_manager.find_role("Admin"))
        db.session.add(self.rls_entry4)

        db.session.commit()

    def tearDown(self):
        db.session.delete(self.rls_entry1)
        db.session.delete(self.rls_entry2)
        db.session.delete(self.rls_entry3)
        db.session.delete(self.rls_entry4)
        db.session.delete(security_manager.find_role("NameAB"))
        db.session.delete(security_manager.find_role("NameQ"))
        db.session.delete(self.get_user("NoRlsRoleUser"))
        db.session.commit()

    @pytest.fixture
    def create_dataset(self):
        with self.create_app().app_context():
            dataset = SqlaTable(database_id=1, schema=None, table_name="table1")
            db.session.add(dataset)
            db.session.flush()
            db.session.commit()

            yield dataset

            # rollback changes (assuming cascade delete)
            db.session.delete(dataset)
            db.session.commit()

    def _get_test_dataset(self):
        return (
            db.session.query(SqlaTable).filter(SqlaTable.table_name == "table1")
        ).one_or_none()

    @pytest.mark.usefixtures("create_dataset")
    def test_model_view_rls_add_success(self):
        self.login(ADMIN_USERNAME)
        test_dataset = self._get_test_dataset()
        rv = self.client.post(
            "/api/v1/rowlevelsecurity/",
            json={
                "name": "rls1",
                "description": "Some description",
                "filter_type": "Regular",
                "tables": [test_dataset.id],
                "roles": [security_manager.find_role("Alpha").id],
                "group_key": "group_key_1",
                "clause": "client_id=1",
                "groups": [],
            },
        )
        assert rv.status_code == 201
        rls1 = (
            db.session.query(RowLevelSecurityFilter).filter_by(name="rls1")
        ).one_or_none()
        assert rls1 is not None

        # Revert data changes
        db.session.delete(rls1)
        db.session.commit()

    @pytest.mark.usefixtures("create_dataset")
    def test_model_view_rls_add_name_unique(self):
        self.login(ADMIN_USERNAME)
        test_dataset = self._get_test_dataset()
        rv = self.client.post(
            "/api/v1/rowlevelsecurity/",
            json={
                "name": "rls_entry1",
                "description": "Some description",
                "filter_type": "Regular",
                "tables": [test_dataset.id],
                "roles": [security_manager.find_role("Alpha").id],
                "group_key": "group_key_1",
                "clause": "client_id=1",
                "groups": [],
            },
        )
        assert rv.status_code == 422

    @pytest.mark.usefixtures("create_dataset")
    def test_model_view_rls_add_tables_required(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.post(
            "/api/v1/rowlevelsecurity/",
            json={
                "name": "rls1",
                "description": "Some description",
                "filter_type": "Regular",
                "tables": [],
                "roles": [security_manager.find_role("Alpha").id],
                "group_key": "group_key_1",
                "clause": "client_id=1",
                "groups": [],
            },
        )
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert data["message"] == {"tables": ["Shorter than minimum length 1."]}

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_rls_filter_alters_energy_query(self):
        g.user = self.get_user(username="alpha")
        tbl = self.get_table(name="energy_usage")
        sql = tbl.get_query_str(self.query_obj)
        assert tbl.get_extra_cache_keys(self.query_obj) == [1]
        assert "value > 1" in sql

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_rls_filter_doesnt_alter_energy_query(self):
        g.user = self.get_user(username="admin")
        tbl = self.get_table(name="energy_usage")
        sql = tbl.get_query_str(self.query_obj)
        assert tbl.get_extra_cache_keys(self.query_obj) == []
        assert "value > 1" not in sql

    @pytest.mark.usefixtures("load_unicode_dashboard_with_slice")
    def test_multiple_table_filter_alters_another_tables_query(self):
        g.user = self.get_user(username="alpha")
        tbl = self.get_table(name="unicode_test")
        sql = tbl.get_query_str(self.query_obj)
        assert tbl.get_extra_cache_keys(self.query_obj) == [1]
        assert "value > 1" in sql

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_rls_filter_alters_gamma_birth_names_query(self):
        g.user = self.get_user(username="gamma")
        tbl = self.get_table(name="birth_names")
        sql = tbl.get_query_str(self.query_obj)

        # establish that the filters are grouped together correctly with
        # ANDs, ORs and parens in the correct place
        assert (
            "WHERE ((name like 'A%' or name like 'B%') OR (name like 'Q%')) AND (gender = 'boy');"  # noqa: E501
            in sql
        )

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_rls_filter_alters_no_role_user_birth_names_query(self):
        g.user = self.get_user(username="NoRlsRoleUser")
        tbl = self.get_table(name="birth_names")
        sql = tbl.get_query_str(self.query_obj)

        # gamma's filters should not be present query
        assert not self.NAMES_A_REGEX.search(sql)
        assert not self.NAMES_B_REGEX.search(sql)
        assert not self.NAMES_Q_REGEX.search(sql)
        # base query should be present
        assert self.BASE_FILTER_REGEX.search(sql)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_rls_filter_doesnt_alter_admin_birth_names_query(self):
        g.user = self.get_user(username="admin")
        tbl = self.get_table(name="birth_names")
        sql = tbl.get_query_str(self.query_obj)

        # no filters are applied for admin user
        assert not self.NAMES_A_REGEX.search(sql)
        assert not self.NAMES_B_REGEX.search(sql)
        assert not self.NAMES_Q_REGEX.search(sql)
        assert not self.BASE_FILTER_REGEX.search(sql)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_rls_cache_key(self):
        g.user = self.get_user(username="admin")
        tbl = self.get_table(name="birth_names")
        clauses = security_manager.get_rls_cache_key(tbl)
        assert clauses == []

        g.user = self.get_user(username="gamma")
        clauses = security_manager.get_rls_cache_key(tbl)
        assert clauses == [
            "name like 'A%' or name like 'B%'-name",
            "name like 'Q%'-name",
            "gender = 'boy'-gender",
        ]

    @pytest.mark.usefixtures(
        "load_birth_names_dashboard_with_slices", "create_gamma_user_group"
    )
    def test_rls_filter_alters_query_with_direct_group(self):
        """
        Verify that when a user has a direct group a RLS rule
        linked to that group applies.
        """
        g.user = self.get_user("gamma_with_groups")
        tbl = self.get_table(name="birth_names")
        direct_group = g.user.groups[0]

        new_rls = self.create_rls_rule(
            rule_name="rls_direct_group",
            table_names=["birth_names"],
            filter_type="Regular",
            clause="name like 'Direct%'",
            group_key="name",
            role_names=None,
            group_names=[direct_group.name],
        )

        sql = tbl.get_query_str(self.query_obj)
        assert "name like 'Direct%'" in sql

        db.session.delete(new_rls)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_rls_filter_alters_query_with_indirect_group_via_role(self):
        """
        Verify that if a user has no direct group membership
        but it is indirectly linked to a group via one of their roles
        then an RLS rule tied to that group is applied.
        """
        user = self.create_user_with_roles("IndirectUser", ["Gamma"])
        assert not getattr(user, "groups", [])
        # The group has only roles, no direct users
        indirect_group = security_manager.add_group("IndirectGroup", "", "")
        gamma_role = security_manager.find_role("Gamma")
        # Now the user will be part of the group because the role is linked to the group
        indirect_group.roles.append(gamma_role)
        db.session.commit()

        # Create an RLS rule linked to the the group of roles
        new_rls = self.create_rls_rule(
            rule_name="rls_indirect_group",
            table_names=["birth_names"],
            filter_type="Regular",
            clause="name like 'Indirect%'",
            group_key="name",
            role_names=None,
            group_names=[indirect_group.name],
        )

        g.user = user
        tbl = self.get_table(name="birth_names")
        sql = tbl.get_query_str(self.query_obj)
        assert "name like 'Indirect%'" in sql

        db.session.delete(new_rls)
        db.session.delete(indirect_group)
        db.session.delete(user)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_rls_filter_alters_query_with_indirect_role_via_group(self):
        """
        Verify that if an RLS rule is linked to a role that the user does not
        directly have, but that role is assigned to a group the user belongs to
        then the RLS rule is applied.
        """
        indirect_role = security_manager.add_role("IndirectRole")
        db.session.commit()

        group = security_manager.add_group("IndirectRoleGroup", "", "")
        group.roles.append(indirect_role)
        db.session.commit()
        user = self.create_user_with_roles("IndirectRoleUser", ["Gamma"])
        # Now the user will have the role because it is part of the group
        user.groups.append(group)
        db.session.commit()

        # Create an RLS rule linked to the role "IndirectRole"
        new_rls = self.create_rls_rule(
            rule_name="rls_indirect_role",
            table_names=["birth_names"],
            filter_type="Regular",
            clause="name like 'IndirectRole%'",
            group_key="name",
            role_names=[indirect_role.name],
            group_names=None,
        )

        g.user = user
        tbl = self.get_table(name="birth_names")
        sql = tbl.get_query_str(self.query_obj)
        assert "name like 'IndirectRole%'" in sql

        db.session.delete(new_rls)
        db.session.delete(group)
        db.session.delete(indirect_role)
        db.session.delete(user)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_rls_filter_excludes_non_applicable_group_rules(self):
        """
        Verify that an RLS rule linked to a group that the user is not associated with
        (neither directly nor indirectly) does not alter the query.
        """
        user = self.create_user_with_roles("NoGroupUser", ["Gamma"])
        assert not getattr(user, "groups", [])
        g.user = user
        tbl = self.get_table(name="birth_names")

        # RLS linked to a new group that is not linked to the user.
        non_applicable_group = security_manager.add_group("NonApplicableGroup", "", "")
        db.session.commit()

        new_rls = self.create_rls_rule(
            rule_name="rls_non_applicable",
            table_names=["birth_names"],
            filter_type="Regular",
            clause="name like 'NonApplicable%'",
            group_key="name",
            role_names=None,
            group_names=[non_applicable_group.name],
        )

        sql = tbl.get_query_str(self.query_obj)
        assert "name like 'NonApplicable%'" not in sql

        db.session.delete(new_rls)
        db.session.delete(non_applicable_group)
        db.session.delete(user)
        db.session.commit()


class TestRowLevelSecurityCreateAPI(SupersetTestCase):
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_invalid_role_failure(self):
        self.login(ADMIN_USERNAME)
        payload = {
            "name": "rls 1",
            "clause": "1=1",
            "filter_type": "Base",
            "tables": [1],
            "roles": [999999],
            "groups": [],
        }
        rv = self.client.post("/api/v1/rowlevelsecurity/", json=payload)
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
        assert status_code == 422
        assert data["message"] == "[l'Some roles do not exist']"

    def test_invalid_table_failure(self):
        self.login(ADMIN_USERNAME)
        payload = {
            "name": "rls 1",
            "clause": "1=1",
            "filter_type": "Base",
            "tables": [999999],
            "roles": [1],
            "groups": [],
        }
        rv = self.client.post("/api/v1/rowlevelsecurity/", json=payload)
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
        assert status_code == 422
        assert data["message"] == "[l'Datasource does not exist']"

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_invalid_group_failure(self):
        self.login(ADMIN_USERNAME)
        payload = {
            "name": "rls 1",
            "clause": "1=1",
            "filter_type": "Base",
            "tables": [1],
            "roles": [],
            "groups": [999999],
        }
        rv = self.client.post("/api/v1/rowlevelsecurity/", json=payload)
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
        assert status_code == 422
        assert data["message"] == "[l'Some groups do not exist']"

    @pytest.mark.usefixtures(
        "load_birth_names_dashboard_with_slices", "create_gamma_user_group"
    )
    def test_post_success(self):
        table = db.session.query(SqlaTable).first()
        user = security_manager.find_user("gamma_with_groups")
        assert user is not None
        user_group_id = user.groups[0].id
        self.login(ADMIN_USERNAME)
        payload = {
            "name": "rls 1",
            "clause": "1=1",
            "filter_type": "Base",
            "tables": [table.id],
            "roles": [1],
            "groups": [user_group_id],
        }
        rv = self.client.post("/api/v1/rowlevelsecurity/", json=payload)
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))

        assert status_code == 201

        rls = (
            db.session.query(RowLevelSecurityFilter)
            .filter(RowLevelSecurityFilter.id == data["id"])
            .one_or_none()
        )

        assert rls
        assert rls.name == "rls 1"
        assert rls.clause == "1=1"
        assert rls.filter_type == "Base"
        assert rls.tables[0].id == table.id
        assert rls.roles[0].id == 1
        assert rls.groups[0].id == user_group_id

        db.session.delete(rls)
        db.session.commit()


class TestRowLevelSecurityUpdateAPI(SupersetTestCase):
    def test_invalid_id_failure(self):
        self.login(ADMIN_USERNAME)
        payload = {
            "name": "rls 1",
            "clause": "1=1",
            "filter_type": "Base",
            "tables": [1],
            "roles": [1],
            "groups": [],
        }
        rv = self.client.put("/api/v1/rowlevelsecurity/99999999", json=payload)
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
        assert status_code == 404
        assert data["message"] == "Not found"

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_invalid_role_failure(self):
        table = db.session.query(SqlaTable).first()

        rls = RowLevelSecurityFilter(
            name="rls test invalid role",
            clause="1=1",
            filter_type="Regular",
            tables=[table],
        )
        db.session.add(rls)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        payload = {
            "roles": [999999],
        }
        rv = self.client.put(f"/api/v1/rowlevelsecurity/{rls.id}", json=payload)
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
        assert status_code == 422
        assert data["message"] == "[l'Some roles do not exist']"

        db.session.delete(rls)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_invalid_table_failure(self):
        table = db.session.query(SqlaTable).first()

        rls = RowLevelSecurityFilter(
            name="rls test invalid role",
            clause="1=1",
            filter_type="Regular",
            tables=[table],
        )
        db.session.add(rls)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        payload = {
            "name": "rls 1",
            "clause": "1=1",
            "filter_type": "Base",
            "tables": [999999],
            "roles": [1],
        }
        rv = self.client.put(f"/api/v1/rowlevelsecurity/{rls.id}", json=payload)
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
        assert status_code == 422
        assert data["message"] == "[l'Datasource does not exist']"

        db.session.delete(rls)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_invalid_group_failure(self):
        table = db.session.query(SqlaTable).first()

        rls = RowLevelSecurityFilter(
            name="rls test invalid group",
            clause="1=1",
            filter_type="Regular",
            tables=[table],
        )
        db.session.add(rls)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        payload = {
            "groups": [999999],
        }
        rv = self.client.put(f"/api/v1/rowlevelsecurity/{rls.id}", json=payload)
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
        assert status_code == 422
        assert data["message"] == "[l'Some groups do not exist']"

        db.session.delete(rls)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @pytest.mark.usefixtures("create_gamma_user_group")
    def test_put_success(self):
        tables = db.session.query(SqlaTable).limit(2).all()
        roles = db.session.query(security_manager.role_model).limit(2).all()
        user = security_manager.find_user("gamma_with_groups")
        assert user is not None
        user_group_id = user.groups[0].id

        rls = RowLevelSecurityFilter(
            name="rls 1",
            clause="1=1",
            filter_type="Regular",
            tables=[tables[0]],
            roles=[roles[0]],
        )
        db.session.add(rls)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        payload = {
            "name": "rls put success",
            "clause": "2=2",
            "filter_type": "Base",
            "tables": [tables[1].id],
            "roles": [roles[1].id],
            "groups": [user_group_id],
        }
        rv = self.client.put(f"/api/v1/rowlevelsecurity/{rls.id}", json=payload)
        status_code, _data = rv.status_code, json.loads(rv.data.decode("utf-8"))  # noqa: F841

        assert status_code == 201

        rls = (
            db.session.query(RowLevelSecurityFilter)
            .filter(RowLevelSecurityFilter.id == rls.id)
            .one_or_none()
        )

        assert rls.name == "rls put success"
        assert rls.clause == "2=2"
        assert rls.filter_type == "Base"
        assert rls.tables[0].id == tables[1].id
        assert rls.roles[0].id == roles[1].id
        assert rls.groups[0].id == user_group_id

        db.session.delete(rls)
        db.session.commit()


class TestRowLevelSecurityDeleteAPI(SupersetTestCase):
    def test_invalid_id_failure(self):
        self.login(ADMIN_USERNAME)

        ids_to_delete = prison.dumps([10000, 10001, 100002])
        rv = self.client.delete(f"/api/v1/rowlevelsecurity/?q={ids_to_delete}")
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))

        assert status_code == 404
        assert data["message"] == "Not found"

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_bulk_delete_success(self):
        tables = db.session.query(SqlaTable).limit(2).all()
        roles = db.session.query(security_manager.role_model).limit(2).all()

        rls_1 = RowLevelSecurityFilter(
            name="rls 1",
            clause="1=1",
            filter_type="Regular",
            tables=[tables[0]],
            roles=[roles[0]],
        )
        rls_2 = RowLevelSecurityFilter(
            name="rls 2",
            clause="2=2",
            filter_type="Base",
            tables=[tables[1]],
            roles=[roles[1]],
        )
        db.session.add_all([rls_1, rls_2])
        db.session.commit()

        self.login(ADMIN_USERNAME)

        ids_to_delete = prison.dumps([rls_1.id, rls_2.id])
        rv = self.client.delete(f"/api/v1/rowlevelsecurity/?q={ids_to_delete}")
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))

        assert status_code == 200
        assert data["message"] == "Deleted 2 rules"


class TestRowLevelSecurityWithRelatedAPI(SupersetTestCase):
    @pytest.mark.usefixtures("load_birth_names_data")
    @pytest.mark.usefixtures("load_energy_table_data")
    def test_rls_tables_related_api(self):
        self.login(ADMIN_USERNAME)

        params = prison.dumps({"page": 0, "page_size": 100})

        rv = self.client.get(f"/api/v1/rowlevelsecurity/related/tables?q={params}")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]

        db_tables = db.session.query(SqlaTable).all()

        db_table_names = {t.name for t in db_tables}
        received_tables = {table["text"] for table in result}

        assert data["count"] == len(db_tables)
        assert len(result) == len(db_tables)
        assert db_table_names == received_tables

    def test_rls_roles_related_api(self):
        self.login(ADMIN_USERNAME)
        params = prison.dumps({"page": 0, "page_size": 100})

        rv = self.client.get(f"/api/v1/rowlevelsecurity/related/roles?q={params}")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]

        db_role_names = {r.name for r in security_manager.get_all_roles()}
        received_roles = {role["text"] for role in result}

        assert data["count"] == len(db_role_names)
        assert len(result) == len(db_role_names)
        assert db_role_names == received_roles

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch(
        "superset.row_level_security.api.RLSRestApi.base_related_field_filters",
        {"tables": [["table_name", filters.FilterStartsWith, "birth"]]},
    )
    def test_table_related_filter(self):
        self.login(ADMIN_USERNAME)

        params = prison.dumps({"page": 0, "page_size": 10})

        rv = self.client.get(f"/api/v1/rowlevelsecurity/related/tables?q={params}")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]
        received_tables = {table["text"].split(".")[-1] for table in result}

        assert data["count"] == 1
        assert len(result) == 1
        assert {"birth_names"} == received_tables

    def test_get_all_related_roles_with_with_extra_filters(self):
        """
        API: Test get filter related roles with extra related query filters
        """
        self.login(ADMIN_USERNAME)

        def _base_filter(query):
            return query.filter_by(name="Alpha")

        with mock.patch.dict(
            "superset.views.filters.current_app.config",
            {"EXTRA_RELATED_QUERY_FILTERS": {"role": _base_filter}},
        ):
            rv = self.client.get("/api/v1/rowlevelsecurity/related/roles")  # noqa: F541
            assert rv.status_code == 200
            response = json.loads(rv.data.decode("utf-8"))
            response_roles = [result["text"] for result in response["result"]]
            assert response_roles == ["Alpha"]

    @pytest.mark.usefixtures("load_birth_names_data")
    @pytest.mark.usefixtures("create_gamma_user_group")
    def test_rls_groups_related_api(self):
        self.login(ADMIN_USERNAME)
        params = prison.dumps({"page": 0, "page_size": 100})

        rv = self.client.get(f"/api/v1/rowlevelsecurity/related/groups?q={params}")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]

        user = security_manager.find_user("gamma_with_groups")
        assert user is not None
        user_group_id = user.groups[0].id

        assert data["count"] == 1
        assert result[0]["text"] == "group1"
        assert result[0]["value"] == user_group_id


RLS_ALICE_REGEX = re.compile(r"name = 'Alice'")
RLS_GENDER_REGEX = re.compile(r"AND \([\s\n]*gender = 'girl'[\s\n]*\)")


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
class GuestTokenRowLevelSecurityTests(SupersetTestCase):
    query_obj: dict[str, Any] = dict(  # noqa: C408
        groupby=[],
        metrics=None,
        filter=[],
        is_timeseries=False,
        columns=["value"],
        granularity=None,
        from_dttm=None,
        to_dttm=None,
        extras={},
    )

    def default_rls_rule(self):
        return {
            "dataset": self.get_table(name="birth_names").id,
            "clause": "name = 'Alice'",
        }

    def guest_user_with_rls(self, rules: Optional[list[Any]] = None) -> GuestUser:
        if rules is None:
            rules = [self.default_rls_rule()]
        return security_manager.get_guest_user_from_token(
            {
                "user": {},
                "resources": [
                    {
                        "type": GuestTokenResourceType.DASHBOARD,
                        "id": "06383667-3e02-4e5e-843f-44e9c5896b6c",
                    }
                ],
                "rls_rules": rules,
                "iat": 10,
                "exp": 20,
            }
        )

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_rls_filter_alters_query(self):
        g.user = self.guest_user_with_rls()
        tbl = self.get_table(name="birth_names")
        sql = tbl.get_query_str(self.query_obj)

        assert re.search(RLS_ALICE_REGEX, sql)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_rls_filter_does_not_alter_unrelated_query(self):
        g.user = self.guest_user_with_rls(
            rules=[
                {
                    "dataset": self.get_table(name="birth_names").id + 1,
                    "clause": "name = 'Alice'",
                }
            ]
        )
        tbl = self.get_table(name="birth_names")
        sql = tbl.get_query_str(self.query_obj)

        assert not re.search(RLS_ALICE_REGEX, sql)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_multiple_rls_filters_are_unionized(self):
        g.user = self.guest_user_with_rls(
            rules=[
                self.default_rls_rule(),
                {
                    "dataset": self.get_table(name="birth_names").id,
                    "clause": "gender = 'girl'",
                },
            ]
        )
        tbl = self.get_table(name="birth_names")
        sql = tbl.get_query_str(self.query_obj)

        assert re.search(RLS_ALICE_REGEX, sql)
        assert re.search(RLS_GENDER_REGEX, sql)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_rls_filter_for_all_datasets(self):
        births = self.get_table(name="birth_names")
        energy = self.get_table(name="energy_usage")
        guest = self.guest_user_with_rls(rules=[{"clause": "name = 'Alice'"}])
        guest.resources.append({type: "dashboard", id: energy.id})
        g.user = guest
        births_sql = births.get_query_str(self.query_obj)
        energy_sql = energy.get_query_str(self.query_obj)

        assert re.search(RLS_ALICE_REGEX, births_sql)
        assert re.search(RLS_ALICE_REGEX, energy_sql)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_dataset_id_can_be_string(self):
        dataset = self.get_table(name="birth_names")
        str_id = str(dataset.id)
        g.user = self.guest_user_with_rls(
            rules=[{"dataset": str_id, "clause": "name = 'Alice'"}]
        )
        sql = dataset.get_query_str(self.query_obj)

        assert re.search(RLS_ALICE_REGEX, sql)
