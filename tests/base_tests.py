# -*- coding: utf-8 -*-
"""Unit tests for Superset"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
import logging
import os
import unittest

from flask_appbuilder.security.sqla import models as ab_models
from mock import Mock
import pandas as pd

from superset import app, cli, db, security_manager
from superset.connectors.druid.models import DruidCluster, DruidDatasource
from superset.connectors.sqla.models import SqlaTable
from superset.models import core as models
from .utils import get_main_database


BASE_DIR = app.config.get('BASE_DIR')


class SupersetTestCase(unittest.TestCase):
    requires_examples = False
    examples_loaded = False

    def __init__(self, *args, **kwargs):
        if (
            self.requires_examples and
            not os.environ.get('examples_loaded')
        ):
            logging.info('Loading examples')
            cli.load_examples_run(load_test_data=True)
            logging.info('Done loading examples')
            security_manager.sync_role_definitions()
            os.environ['examples_loaded'] = '1'
        else:
            security_manager.sync_role_definitions()
        super(SupersetTestCase, self).__init__(*args, **kwargs)
        self.client = app.test_client()
        self.maxDiff = None

        cli.load_test_users_run()
        # create druid cluster and druid datasources
        session = db.session
        cluster = (
            session.query(DruidCluster)
            .filter_by(cluster_name='druid_test')
            .first()
        )
        if not cluster:
            cluster = DruidCluster(cluster_name='druid_test')
            session.add(cluster)
            session.commit()

            druid_datasource1 = DruidDatasource(
                datasource_name='druid_ds_1',
                cluster_name='druid_test',
            )
            session.add(druid_datasource1)
            druid_datasource2 = DruidDatasource(
                datasource_name='druid_ds_2',
                cluster_name='druid_test',
            )
            session.add(druid_datasource2)
            session.commit()

    def get_table(self, table_id):
        return (
            db.session
            .query(SqlaTable)
            .filter_by(id=table_id)
            .one()
        )

    def get_or_create(self, cls, criteria, session):
        obj = session.query(cls).filter_by(**criteria).first()
        if not obj:
            obj = cls(**criteria)
        return obj

    def login(self, username='admin', password='general'):
        resp = self.get_resp(
            '/login/',
            data=dict(username=username, password=password))
        self.assertNotIn('User confirmation needed', resp)

    def get_slice(self, slice_name, session):
        slc = (
            session.query(models.Slice)
            .filter_by(slice_name=slice_name)
            .one()
        )
        session.expunge_all()
        return slc

    def get_table_by_name(self, name):
        return db.session.query(SqlaTable).filter_by(table_name=name).one()

    def get_druid_ds_by_name(self, name):
        return db.session.query(DruidDatasource).filter_by(
            datasource_name=name).first()

    def get_datasource_mock(self):
        datasource = Mock()
        results = Mock()
        results.query = Mock()
        results.status = Mock()
        results.error_message = None
        results.df = pd.DataFrame()
        datasource.type = 'table'
        datasource.query = Mock(return_value=results)
        mock_dttm_col = Mock()
        datasource.get_col = Mock(return_value=mock_dttm_col)
        datasource.query = Mock(return_value=results)
        datasource.database = Mock()
        datasource.database.db_engine_spec = Mock()
        datasource.database.db_engine_spec.mutate_expression_label = lambda x: x
        return datasource

    def get_resp(
            self, url, data=None, follow_redirects=True, raise_on_error=True):
        """Shortcut to get the parsed results while following redirects"""
        if data:
            resp = self.client.post(
                url, data=data, follow_redirects=follow_redirects)
        else:
            resp = self.client.get(url, follow_redirects=follow_redirects)
        if raise_on_error and resp.status_code > 400:
            raise Exception(
                'http request failed with code {}'.format(resp.status_code))
        return resp.data.decode('utf-8')

    def get_json_resp(
            self, url, data=None, follow_redirects=True, raise_on_error=True):
        """Shortcut to get the parsed results while following redirects"""
        resp = self.get_resp(url, data, follow_redirects, raise_on_error)
        return json.loads(resp)

    def get_access_requests(self, username, ds_type, ds_id):
        DAR = models.DatasourceAccessRequest
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
        self.client.get('/logout/', follow_redirects=True)

    def grant_public_access_to_table(self, table):
        public_role = security_manager.find_role('Public')
        perms = db.session.query(ab_models.PermissionView).all()
        for perm in perms:
            if (perm.permission.name == 'datasource_access' and
                    perm.view_menu and table.perm in perm.view_menu.name):
                security_manager.add_permission_role(public_role, perm)

    def revoke_public_access_to_table(self, table):
        public_role = security_manager.find_role('Public')
        perms = db.session.query(ab_models.PermissionView).all()
        for perm in perms:
            if (perm.permission.name == 'datasource_access' and
                    perm.view_menu and table.perm in perm.view_menu.name):
                security_manager.del_permission_role(public_role, perm)

    def run_sql(self, sql, client_id, user_name=None, raise_on_error=False):
        if user_name:
            self.logout()
            self.login(username=(user_name if user_name else 'admin'))
        dbid = get_main_database(db.session).id
        resp = self.get_json_resp(
            '/superset/sql_json/',
            raise_on_error=False,
            data=dict(database_id=dbid, sql=sql, select_as_create_as=False,
                      client_id=client_id),
        )
        if raise_on_error and 'error' in resp:
            raise Exception('run_sql failed')
        return resp
