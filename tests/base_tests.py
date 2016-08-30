"""Unit tests for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import os
import unittest

from flask_appbuilder.security.sqla import models as ab_models

import caravel
from caravel import app, db, models, utils, appbuilder

os.environ['CARAVEL_CONFIG'] = 'tests.caravel_test_config'

'''
app.config['TESTING'] = True
app.config['CSRF_ENABLED'] = False
app.config['SECRET_KEY'] = 'thisismyscretkey'
app.config['WTF_CSRF_ENABLED'] = False
app.config['PUBLIC_ROLE_LIKE_GAMMA'] = True
'''
BASE_DIR = app.config.get("BASE_DIR")


class CaravelTestCase(unittest.TestCase):

    def __init__(self, *args, **kwargs):
        super(CaravelTestCase, self).__init__(*args, **kwargs)
        self.client = app.test_client()

        utils.init(caravel)

        admin = appbuilder.sm.find_user('admin')
        if not admin:
            appbuilder.sm.add_user(
                'admin', 'admin', ' user', 'admin@fab.org',
                appbuilder.sm.find_role('Admin'),
                password='general')

        gamma = appbuilder.sm.find_user('gamma')
        if not gamma:
            appbuilder.sm.add_user(
                'gamma', 'gamma', 'user', 'gamma@fab.org',
                appbuilder.sm.find_role('Gamma'),
                password='general')

        alpha = appbuilder.sm.find_user('alpha')
        if not alpha:
            appbuilder.sm.add_user(
                'alpha', 'alpha', 'user', 'alpha@fab.org',
                appbuilder.sm.find_role('Alpha'),
                password='general')

        utils.init(caravel)

    def login(self, username='admin', password='general'):
        resp = self.client.post(
            '/login/',
            data=dict(username=username, password=password),
            follow_redirects=True)
        assert 'Welcome' in resp.data.decode('utf-8')

    def get_query_by_sql(self, sql):
        session = db.create_scoped_session()
        query = session.query(models.Query).filter_by(sql=sql).first()
        session.close()
        return query

    def logout(self):
        self.client.get('/logout/', follow_redirects=True)

    def test_welcome(self):
        self.login()
        resp = self.client.get('/caravel/welcome')
        assert 'Welcome' in resp.data.decode('utf-8')

    def setup_public_access_for_dashboard(self, table_name):
        public_role = appbuilder.sm.find_role('Public')
        perms = db.session.query(ab_models.PermissionView).all()
        for perm in perms:
            if (perm.permission.name == 'datasource_access' and
                    perm.view_menu and table_name in perm.view_menu.name):
                appbuilder.sm.add_permission_role(public_role, perm)

    def revoke_public_access(self, table_name):
        public_role = appbuilder.sm.find_role('Public')
        perms = db.session.query(ab_models.PermissionView).all()
        for perm in perms:
            if (perm.permission.name == 'datasource_access' and
                    perm.view_menu and table_name in perm.view_menu.name):
                appbuilder.sm.del_permission_role(public_role, perm)
