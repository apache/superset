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
"""Unit tests for Superset"""
import imp
import json
from typing import Union
from unittest.mock import Mock

import pandas as pd
from flask_appbuilder.security.sqla import models as ab_models
from flask_testing import TestCase

from tests.test_app import app  # isort:skip
from superset import db, security_manager
from superset.connectors.druid.models import DruidCluster, DruidDatasource
from superset.connectors.sqla.models import SqlaTable
from superset.models import core as models
from superset.models.slice import Slice
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.datasource_access_request import DatasourceAccessRequest
from superset.utils.core import get_example_database

FAKE_DB_NAME = "fake_db_100"


class SupersetTestCase(TestCase):

    default_schema_backend_map = {
        "sqlite": "main",
        "mysql": "superset",
        "postgresql": "public",
    }

    def __init__(self, *args, **kwargs):
        super(SupersetTestCase, self).__init__(*args, **kwargs)
        self.maxDiff = None

    def create_app(self):
        return app

    @staticmethod
    def create_user(
        username: str,
        password: str,
        role_name: str,
        first_name: str = "admin",
        last_name: str = "user",
        email: str = "admin@fab.org",
    ) -> Union[ab_models.User, bool]:
        role_admin = security_manager.find_role(role_name)
        return security_manager.add_user(
            username, first_name, last_name, email, role_admin, password
        )

    @staticmethod
    def get_user(username: str) -> ab_models.User:
        user = (
            db.session.query(security_manager.user_model)
            .filter_by(username=username)
            .one_or_none()
        )
        return user

    @classmethod
    def create_druid_test_objects(cls):
        # create druid cluster and druid datasources

        with app.app_context():
            session = db.session
            cluster = (
                session.query(DruidCluster).filter_by(cluster_name="druid_test").first()
            )
            if not cluster:
                cluster = DruidCluster(cluster_name="druid_test")
                session.add(cluster)
                session.commit()

                druid_datasource1 = DruidDatasource(
                    datasource_name="druid_ds_1", cluster=cluster
                )
                session.add(druid_datasource1)
                druid_datasource2 = DruidDatasource(
                    datasource_name="druid_ds_2", cluster=cluster
                )
                session.add(druid_datasource2)
                session.commit()

    def get_table(self, table_id):
        return db.session.query(SqlaTable).filter_by(id=table_id).one()

    @staticmethod
    def is_module_installed(module_name):
        try:
            imp.find_module(module_name)
            return True
        except ImportError:
            return False

    def get_or_create(self, cls, criteria, session, **kwargs):
        obj = session.query(cls).filter_by(**criteria).first()
        if not obj:
            obj = cls(**criteria)
        obj.__dict__.update(**kwargs)
        session.add(obj)
        session.commit()
        return obj

    def login(self, username="admin", password="general"):
        resp = self.get_resp("/login/", data=dict(username=username, password=password))
        self.assertNotIn("User confirmation needed", resp)

    def get_slice(self, slice_name, session):
        slc = session.query(Slice).filter_by(slice_name=slice_name).one()
        session.expunge_all()
        return slc

    def get_table_by_name(self, name):
        return db.session.query(SqlaTable).filter_by(table_name=name).one()

    def get_database_by_id(self, db_id):
        return db.session.query(Database).filter_by(id=db_id).one()

    def get_druid_ds_by_name(self, name):
        return db.session.query(DruidDatasource).filter_by(datasource_name=name).first()

    def get_datasource_mock(self):
        datasource = Mock()
        results = Mock()
        results.query = Mock()
        results.status = Mock()
        results.error_message = None
        results.df = pd.DataFrame()
        datasource.type = "table"
        datasource.query = Mock(return_value=results)
        mock_dttm_col = Mock()
        datasource.get_col = Mock(return_value=mock_dttm_col)
        datasource.query = Mock(return_value=results)
        datasource.database = Mock()
        datasource.database.db_engine_spec = Mock()
        datasource.database.db_engine_spec.mutate_expression_label = lambda x: x
        return datasource

    def get_resp(
        self, url, data=None, follow_redirects=True, raise_on_error=True, json_=None
    ):
        """Shortcut to get the parsed results while following redirects"""
        if data:
            resp = self.client.post(url, data=data, follow_redirects=follow_redirects)
        elif json_:
            resp = self.client.post(url, json=json_, follow_redirects=follow_redirects)
        else:
            resp = self.client.get(url, follow_redirects=follow_redirects)
        if raise_on_error and resp.status_code > 400:
            raise Exception("http request failed with code {}".format(resp.status_code))
        return resp.data.decode("utf-8")

    def get_json_resp(
        self, url, data=None, follow_redirects=True, raise_on_error=True, json_=None
    ):
        """Shortcut to get the parsed results while following redirects"""
        resp = self.get_resp(url, data, follow_redirects, raise_on_error, json_)
        return json.loads(resp)

    def get_access_requests(self, username, ds_type, ds_id):
        DAR = DatasourceAccessRequest
        return (
            db.session.query(DAR)
            .filter(
                DAR.created_by == security_manager.find_user(username=username),
                DAR.datasource_type == ds_type,
                DAR.datasource_id == ds_id,
            )
            .first()
        )

    def logout(self):
        self.client.get("/logout/", follow_redirects=True)

    def grant_public_access_to_table(self, table):
        public_role = security_manager.find_role("Public")
        perms = db.session.query(ab_models.PermissionView).all()
        for perm in perms:
            if (
                perm.permission.name == "datasource_access"
                and perm.view_menu
                and table.perm in perm.view_menu.name
            ):
                security_manager.add_permission_role(public_role, perm)

    def revoke_public_access_to_table(self, table):
        public_role = security_manager.find_role("Public")
        perms = db.session.query(ab_models.PermissionView).all()
        for perm in perms:
            if (
                perm.permission.name == "datasource_access"
                and perm.view_menu
                and table.perm in perm.view_menu.name
            ):
                security_manager.del_permission_role(public_role, perm)

    def _get_database_by_name(self, database_name="main"):
        if database_name == "examples":
            return get_example_database()
        else:
            raise ValueError("Database doesn't exist")

    def run_sql(
        self,
        sql,
        client_id=None,
        user_name=None,
        raise_on_error=False,
        query_limit=None,
        database_name="examples",
        sql_editor_id=None,
    ):
        if user_name:
            self.logout()
            self.login(username=(user_name or "admin"))
        dbid = self._get_database_by_name(database_name).id
        resp = self.get_json_resp(
            "/superset/sql_json/",
            raise_on_error=False,
            json_=dict(
                database_id=dbid,
                sql=sql,
                select_as_create_as=False,
                client_id=client_id,
                queryLimit=query_limit,
                sql_editor_id=sql_editor_id,
            ),
        )
        if raise_on_error and "error" in resp:
            raise Exception("run_sql failed")
        return resp

    def create_fake_db(self):
        self.login(username="admin")
        database_name = FAKE_DB_NAME
        db_id = 100
        extra = """{
            "schemas_allowed_for_csv_upload":
            ["this_schema_is_allowed", "this_schema_is_allowed_too"]
        }"""

        return self.get_or_create(
            cls=models.Database,
            criteria={"database_name": database_name},
            session=db.session,
            sqlalchemy_uri="sqlite://test",
            id=db_id,
            extra=extra,
        )

    def delete_fake_db(self):
        database = (
            db.session.query(Database)
            .filter(Database.database_name == FAKE_DB_NAME)
            .scalar()
        )
        if database:
            db.session.delete(database)

    def validate_sql(
        self,
        sql,
        client_id=None,
        user_name=None,
        raise_on_error=False,
        database_name="examples",
    ):
        if user_name:
            self.logout()
            self.login(username=(user_name if user_name else "admin"))
        dbid = self._get_database_by_name(database_name).id
        resp = self.get_json_resp(
            "/superset/validate_sql_json/",
            raise_on_error=False,
            data=dict(database_id=dbid, sql=sql, client_id=client_id),
        )
        if raise_on_error and "error" in resp:
            raise Exception("validate_sql failed")
        return resp

    def get_dash_by_slug(self, dash_slug):
        sesh = db.session()
        return sesh.query(Dashboard).filter_by(slug=dash_slug).first()
