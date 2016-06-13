"""Unit tests for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime
import doctest
import json
import imp
import os
import unittest
from mock import Mock, patch

from flask import escape
from flask_appbuilder.security.sqla import models as ab_models

import caravel
from caravel import app, db, models, utils, appbuilder
from caravel.models import DruidCluster

os.environ['CARAVEL_CONFIG'] = 'tests.caravel_test_config'

app.config['TESTING'] = True
app.config['CSRF_ENABLED'] = False
app.config['SECRET_KEY'] = 'thisismyscretkey'
app.config['WTF_CSRF_ENABLED'] = False
app.config['PUBLIC_ROLE_LIKE_GAMMA'] = True
BASE_DIR = app.config.get("BASE_DIR")
cli = imp.load_source('cli', BASE_DIR + "/bin/caravel")


class CaravelTestCase(unittest.TestCase):

    def __init__(self, *args, **kwargs):
        super(CaravelTestCase, self).__init__(*args, **kwargs)
        self.client = app.test_client()

        utils.init(caravel)

        admin = appbuilder.sm.find_user('admin')
        if not admin:
            appbuilder.sm.add_user(
                'admin', 'admin',' user', 'admin@fab.org',
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
            if (    perm.permission.name == 'datasource_access' and
                    perm.view_menu and table_name in perm.view_menu.name):
                appbuilder.sm.add_permission_role(public_role, perm)

    def revoke_public_access(self, table_name):
        public_role = appbuilder.sm.find_role('Public')
        perms = db.session.query(ab_models.PermissionView).all()
        for perm in perms:
            if (    perm.permission.name == 'datasource_access' and
                    perm.view_menu and table_name in perm.view_menu.name):
                appbuilder.sm.del_permission_role(public_role, perm)


class CoreTests(CaravelTestCase):

    def __init__(self, *args, **kwargs):
        # Load examples first, so that we setup proper permission-view relations
        # for all example data sources.
        super(CoreTests, self).__init__(*args, **kwargs)

    @classmethod
    def setUpClass(cls):
        cli.load_examples(load_test_data=True)
        utils.init(caravel)
        cls.table_ids = {tbl.table_name: tbl.id  for tbl in (
            db.session
            .query(models.SqlaTable)
            .all()
        )}

    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_save_slice(self):
        self.login(username='admin')

        slc = (
            db.session.query(models.Slice.id)
            .filter_by(slice_name="Energy Sankey")
            .first())
        slice_id = slc.id

        copy_name = "Test Sankey Save"
        tbl_id = self.table_ids.get('energy_usage')
        url = "/caravel/explore/table/{}/?viz_type=sankey&groupby=source&groupby=target&metric=sum__value&row_limit=5000&where=&having=&flt_col_0=source&flt_op_0=in&flt_eq_0=&slice_id={}&slice_name={}&collapsed_fieldsets=&action={}&datasource_name=energy_usage&datasource_id=1&datasource_type=table&previous_viz_type=sankey"

        db.session.commit()
        resp = self.client.get(
            url.format(tbl_id, slice_id, copy_name, 'save'),
            follow_redirects=True)
        assert copy_name in resp.data.decode('utf-8')
        resp = self.client.get(
            url.format(tbl_id, slice_id, copy_name, 'overwrite'),
            follow_redirects=True)
        assert 'Energy' in resp.data.decode('utf-8')

    def test_slices(self):
        # Testing by running all the examples
        self.login(username='admin')
        Slc = models.Slice
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [
                (slc.slice_name, 'slice_url',  slc.slice_url),
                (slc.slice_name, 'json_endpoint', slc.viz.json_endpoint),
                (slc.slice_name, 'csv_endpoint', slc.viz.csv_endpoint),
            ]
        for name, method, url in urls:
            print("[{name}]/[{method}]: {url}".format(**locals()))
            self.client.get(url)

    def test_dashboard(self):
        self.login(username='admin')
        urls = {}
        for dash in db.session.query(models.Dashboard).all():
            urls[dash.dashboard_title] = dash.url
        for title, url in urls.items():
            assert escape(title) in self.client.get(url).data.decode('utf-8')

    def test_doctests(self):
        modules = [utils]
        for mod in modules:
            failed, tests = doctest.testmod(mod)
            if failed:
                raise Exception("Failed a doctest")

    def test_misc(self):
        assert self.client.get('/health').data.decode('utf-8') == "OK"
        assert self.client.get('/ping').data.decode('utf-8') == "OK"

    def test_shortner(self):
        self.login(username='admin')
        data = "//caravel/explore/table/1/?viz_type=sankey&groupby=source&groupby=target&metric=sum__value&row_limit=5000&where=&having=&flt_col_0=source&flt_op_0=in&flt_eq_0=&slice_id=78&slice_name=Energy+Sankey&collapsed_fieldsets=&action=&datasource_name=energy_usage&datasource_id=1&datasource_type=table&previous_viz_type=sankey"
        resp = self.client.post('/r/shortner/', data=data)
        assert '/r/' in resp.data.decode('utf-8')

    def test_save_dash(self, username='admin'):
        self.login(username=username)
        dash = db.session.query(models.Dashboard).filter_by(slug="births").first()
        positions = []
        for i, slc in enumerate(dash.slices):
            d = {
                'col': 0,
                'row': i * 4,
                'size_x': 4,
                'size_y': 4,
                'slice_id': '{}'.format(slc.id)}
            positions.append(d)
        data = {
            'css': '',
            'expanded_slices': {},
            'positions': positions,
        }
        url = '/caravel/save_dash/{}/'.format(dash.id)
        resp = self.client.post(url, data=dict(data=json.dumps(data)))
        assert "SUCCESS" in resp.data.decode('utf-8')

    def test_gamma(self):
        self.login(username='gamma')
        resp = self.client.get('/slicemodelview/list/')
        assert "List Slice" in resp.data.decode('utf-8')

        resp = self.client.get('/dashboardmodelview/list/')
        assert "List Dashboard" in resp.data.decode('utf-8')

    def test_public_user_dashboard_access(self):
        # Try access before adding appropriate permissions.
        self.revoke_public_access('birth_names')
        self.logout()

        resp = self.client.get('/slicemodelview/list/')
        data = resp.data.decode('utf-8')

        assert 'birth_names</a>' not in data

        resp = self.client.get('/dashboardmodelview/list/')
        data = resp.data.decode('utf-8')
        assert '/caravel/dashboard/births/' not in data

        self.setup_public_access_for_dashboard('birth_names')

        # Try access after adding appropriate permissions.
        resp = self.client.get('/slicemodelview/list/')
        data = resp.data.decode('utf-8')
        assert 'birth_names' in data

        resp = self.client.get('/dashboardmodelview/list/')
        data = resp.data.decode('utf-8')
        assert "/caravel/dashboard/births/" in data

        resp = self.client.get('/caravel/dashboard/births/')
        data = resp.data.decode('utf-8')
        assert 'Births' in data

        # Confirm that public doesn't have access to other datasets.
        resp = self.client.get('/dashboardmodelview/list/')
        data = resp.data.decode('utf-8')
        assert "/caravel/dashboard/world_health/" not in data


    def test_only_owners_can_save(self):
        dash = (
            db.session
            .query(models.Dashboard)
            .filter_by(slug="births")
            .first()
        )
        dash.owners = []
        db.session.merge(dash)
        db.session.commit()
        self.test_save_dash('admin')

        self.logout()
        self.assertRaises(
            utils.CaravelSecurityException, self.test_save_dash, 'alpha')

        alpha = appbuilder.sm.find_user('alpha')

        dash = (
            db.session
            .query(models.Dashboard)
            .filter_by(slug="births")
            .first()
        )
        dash.owners = [alpha]
        db.session.merge(dash)
        db.session.commit()
        self.test_save_dash('alpha')

SEGMENT_METADATA = [{
  "id": "some_id",
  "intervals": [ "2013-05-13T00:00:00.000Z/2013-05-14T00:00:00.000Z" ],
  "columns": {
    "__time": {
        "type": "LONG", "hasMultipleValues": False,
        "size": 407240380, "cardinality": None, "errorMessage": None },
    "dim1": {
        "type": "STRING", "hasMultipleValues": False,
        "size": 100000, "cardinality": 1944, "errorMessage": None },
    "dim2": {
        "type": "STRING", "hasMultipleValues": True,
        "size": 100000, "cardinality": 1504, "errorMessage": None },
    "metric1": {
        "type": "FLOAT", "hasMultipleValues": False,
        "size": 100000, "cardinality": None, "errorMessage": None }
  },
  "aggregators": {
    "metric1": {
        "type": "longSum",
        "name": "metric1",
        "fieldName": "metric1" }
  },
  "size": 300000,
  "numRows": 5000000
}]

GB_RESULT_SET = [
  {
    "version": "v1",
    "timestamp": "2012-01-01T00:00:00.000Z",
    "event": {
      "name": 'Canada',
      "sum__num": 12345678,
    }
  },
  {
    "version": "v1",
    "timestamp": "2012-01-01T00:00:00.000Z",
    "event": {
      "name": 'USA',
      "sum__num": 12345678 / 2,
    }
  },
]


class DruidTests(CaravelTestCase):

    """Testing interactions with Druid"""

    def __init__(self, *args, **kwargs):
        super(DruidTests, self).__init__(*args, **kwargs)

    @patch('caravel.models.PyDruid')
    def test_client(self, PyDruid):
        self.login(username='admin')
        instance = PyDruid.return_value
        instance.time_boundary.return_value = [
            {'result': {'maxTime': '2016-01-01'}}]
        instance.segment_metadata.return_value = SEGMENT_METADATA

        cluster = (
            db.session
            .query(DruidCluster)
            .filter_by(cluster_name='test_cluster')
            .first()
        )
        if cluster:
            db.session.delete(cluster)
        db.session.commit()

        cluster = DruidCluster(
            cluster_name='test_cluster',
            coordinator_host='localhost',
            coordinator_port=7979,
            broker_host='localhost',
            broker_port=7980,
            metadata_last_refreshed=datetime.now())

        db.session.add(cluster)
        cluster.get_datasources = Mock(return_value=['test_datasource'])
        cluster.refresh_datasources()
        datasource_id = cluster.datasources[0].id
        db.session.commit()

        resp = self.client.get('/caravel/explore/druid/{}/'.format(datasource_id))
        assert "[test_cluster].[test_datasource]" in resp.data.decode('utf-8')

        nres = [
            list(v['event'].items()) + [('timestamp', v['timestamp'])]
            for v in GB_RESULT_SET]
        nres = [dict(v) for v in nres]
        import pandas as pd
        df = pd.DataFrame(nres)
        instance.export_pandas.return_value = df
        instance.query_dict = {}
        instance.query_builder.last_query.query_dict = {}
        resp = self.client.get('/caravel/explore/druid/1/?viz_type=table&granularity=one+day&druid_time_origin=&since=7+days+ago&until=now&row_limit=5000&include_search=false&metrics=count&groupby=name&flt_col_0=dim1&flt_op_0=in&flt_eq_0=&slice_id=&slice_name=&collapsed_fieldsets=&action=&datasource_name=test_datasource&datasource_id=1&datasource_type=druid&previous_viz_type=table&json=true&force=true')
        assert "Canada" in resp.data.decode('utf-8')


if __name__ == '__main__':
    unittest.main()
