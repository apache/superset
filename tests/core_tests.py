"""Unit tests for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime
import csv
import doctest
import imp
import json
import io
import unittest


from flask import escape
from flask_appbuilder.security.sqla import models as ab_models

import caravel
from caravel import app, db, models, utils, appbuilder, sm
from caravel.models import DruidDatasource

from .base_tests import CaravelTestCase

BASE_DIR = app.config.get("BASE_DIR")
cli = imp.load_source('cli', BASE_DIR + "/bin/caravel")


class CoreTests(CaravelTestCase):

    def __init__(self, *args, **kwargs):
        # Load examples first, so that we setup proper permission-view
        # relations for all example data sources.
        super(CoreTests, self).__init__(*args, **kwargs)

    @classmethod
    def setUpClass(cls):
        cli.load_examples(load_test_data=True)
        utils.init(caravel)
        cls.table_ids = {tbl.table_name: tbl.id for tbl in (
            db.session
            .query(models.SqlaTable)
            .all()
        )}

    def setUp(self):
        db.session.query(models.Query).delete()


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
        url = (
            "/caravel/explore/table/{}/?viz_type=sankey&groupby=source&"
            "groupby=target&metric=sum__value&row_limit=5000&where=&having=&"
            "flt_col_0=source&flt_op_0=in&flt_eq_0=&slice_id={}&slice_name={}&"
            "collapsed_fieldsets=&action={}&datasource_name=energy_usage&"
            "datasource_id=1&datasource_type=table&previous_viz_type=sankey")

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
        # Testing by hitting the two supported end points for all slices
        self.login(username='admin')
        Slc = models.Slice
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [
                (slc.slice_name, 'slice_url', slc.slice_url),
                (slc.slice_name, 'json_endpoint', slc.viz.json_endpoint),
                (slc.slice_name, 'csv_endpoint', slc.viz.csv_endpoint),
                (slc.slice_name, 'slice_id_url',
                    "/caravel/{slc.datasource_type}/{slc.datasource_id}/{slc.id}/".format(slc=slc)),
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
        modules = [utils, models]
        for mod in modules:
            failed, tests = doctest.testmod(mod)
            if failed:
                raise Exception("Failed a doctest")

    def test_misc(self):
        assert self.client.get('/health').data.decode('utf-8') == "OK"
        assert self.client.get('/ping').data.decode('utf-8') == "OK"

    def test_shortner(self):
        self.login(username='admin')
        data = (
            "//caravel/explore/table/1/?viz_type=sankey&groupby=source&"
            "groupby=target&metric=sum__value&row_limit=5000&where=&having=&"
            "flt_col_0=source&flt_op_0=in&flt_eq_0=&slice_id=78&slice_name="
            "Energy+Sankey&collapsed_fieldsets=&action=&datasource_name="
            "energy_usage&datasource_id=1&datasource_type=table&"
            "previous_viz_type=sankey")
        resp = self.client.post('/r/shortner/', data=data)
        assert '/r/' in resp.data.decode('utf-8')

    def test_save_dash(self, username='admin'):
        self.login(username=username)
        dash = db.session.query(models.Dashboard).filter_by(
            slug="births").first()
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

    def test_add_slices(self, username='admin'):
        self.login(username=username)
        dash = db.session.query(models.Dashboard).filter_by(
            slug="births").first()
        new_slice = db.session.query(models.Slice).filter_by(
            slice_name="Mapbox Long/Lat").first()
        existing_slice = db.session.query(models.Slice).filter_by(
            slice_name="Name Cloud").first()
        data = {
            "slice_ids": [new_slice.data["slice_id"],
                          existing_slice.data["slice_id"]]
        }
        url = '/caravel/add_slices/{}/'.format(dash.id)
        resp = self.client.post(url, data=dict(data=json.dumps(data)))
        assert "SLICES ADDED" in resp.data.decode('utf-8')

        dash = db.session.query(models.Dashboard).filter_by(
            slug="births").first()
        new_slice = db.session.query(models.Slice).filter_by(
            slice_name="Mapbox Long/Lat").first()
        assert new_slice in dash.slices
        assert len(set(dash.slices)) == len(dash.slices)

    def test_add_slice_redirect_to_sqla(self, username='admin'):
        self.login(username=username)
        url = '/slicemodelview/add'
        resp = self.client.get(url, follow_redirects=True)
        assert (
            "Click on a table link to create a Slice" in
            resp.data.decode('utf-8')
        )

    def test_add_slice_redirect_to_druid(self, username='admin'):
        datasource = DruidDatasource(
            datasource_name="datasource_name",
        )
        db.session.add(datasource)
        db.session.commit()

        self.login(username=username)
        url = '/slicemodelview/add'
        resp = self.client.get(url, follow_redirects=True)
        assert (
            "Click on a datasource link to create a Slice"
            in resp.data.decode('utf-8')
        )

        db.session.delete(datasource)
        db.session.commit()

    def test_gamma(self):
        self.login(username='gamma')
        resp = self.client.get('/slicemodelview/list/')
        assert "List Slice" in resp.data.decode('utf-8')

        resp = self.client.get('/dashboardmodelview/list/')
        assert "List Dashboard" in resp.data.decode('utf-8')

    def run_sql(self, sql, user_name, client_id='not_used'):
        self.login(username=user_name)
        dbid = (
            db.session.query(models.Database)
            .filter_by(database_name='main')
            .first().id
        )
        resp = self.client.post(
            '/caravel/sql_json/',
            data=dict(database_id=dbid, sql=sql, select_as_create_as=False, client_id=client_id),
        )
        self.logout()
        return json.loads(resp.data.decode('utf-8'))

    def test_sql_json(self):
        data = self.run_sql('SELECT * FROM ab_user', 'admin')
        assert len(data['data']) > 0

        data = self.run_sql('SELECT * FROM unexistant_table', 'admin')
        assert len(data['error']) > 0

    def test_sql_json_has_access(self):
        main_db = (
            db.session.query(models.Database).filter_by(database_name="main").first()
        )
        utils.merge_perm(sm, 'database_access', main_db.perm)
        db.session.commit()
        main_db_permission_view = (
            db.session.query(ab_models.PermissionView)
            .join(ab_models.ViewMenu)
            .filter(ab_models.ViewMenu.name == '[main].(id:1)')
            .first()
        )
        astronaut = sm.add_role("Astronaut")
        sm.add_permission_role(astronaut, main_db_permission_view)
        # Astronaut role is Gamma + main db permissions
        for gamma_perm in sm.find_role('Gamma').permissions:
            sm.add_permission_role(astronaut, gamma_perm)

        gagarin = appbuilder.sm.find_user('gagarin')
        if not gagarin:
            appbuilder.sm.add_user(
                'gagarin', 'Iurii', 'Gagarin', 'gagarin@cosmos.ussr',
                appbuilder.sm.find_role('Astronaut'),
                password='general')
        data = self.run_sql('SELECT * FROM ab_user', 'gagarin')
        db.session.query(models.Query).delete()
        db.session.commit()
        assert len(data['data']) > 0

    def test_csv_endpoint(self):
        sql = "SELECT first_name, last_name FROM ab_user " \
              "where first_name='admin'"
        self.run_sql(sql, 'admin')

        query1_id = self.get_query_by_sql(sql).id
        self.login('admin')
        resp = self.client.get('/caravel/csv/{}'.format(query1_id))
        data = csv.reader(io.StringIO(resp.data.decode('utf-8')))
        expected_data = csv.reader(io.StringIO(
            "first_name,last_name\nadmin, user\n"))

        self.assertEqual(list(expected_data), list(data))
        self.logout()

    def test_queries_endpoint(self):
        resp = self.client.get('/caravel/queries/{}'.format(0))
        self.assertEquals(403, resp.status_code)

        self.login('admin')
        resp = self.client.get('/caravel/queries/{}'.format(0))
        data = json.loads(resp.data.decode('utf-8'))
        self.assertEquals(0, len(data))
        self.logout()

        self.run_sql("SELECT * FROM ab_user", 'admin', client_id='client_id_1')
        self.run_sql("SELECT * FROM ab_user1", 'admin', client_id='client_id_2')
        self.login('admin')
        resp = self.client.get('/caravel/queries/{}'.format(0))
        data = json.loads(resp.data.decode('utf-8'))
        self.assertEquals(2, len(data))

        query = db.session.query(models.Query).filter_by(
            sql='SELECT * FROM ab_user').first()
        query.changed_on = utils.EPOCH
        db.session.commit()

        resp = self.client.get('/caravel/queries/{}'.format(123456000))
        data = json.loads(resp.data.decode('utf-8'))
        self.assertEquals(1, len(data))

        self.logout()
        resp = self.client.get('/caravel/queries/{}'.format(0))
        self.assertEquals(403, resp.status_code)

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
        resp = self.client.get('/slicemodelview/list/')
        data = resp.data.decode('utf-8')
        assert 'wb_health_population</a>' not in data

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
            AssertionError, self.test_save_dash, 'alpha')

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


if __name__ == '__main__':
    unittest.main()
