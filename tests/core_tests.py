"""Unit tests for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import csv
import doctest
import imp
import json
import io
import random
import unittest


from flask import escape
from flask_appbuilder.security.sqla import models as ab_models

import caravel
from caravel import app, db, models, utils, appbuilder, sm
from caravel.source_registry import SourceRegistry
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
        db.session.query(models.DatasourceAccessRequest).delete()

    def tearDown(self):
        pass

    def test_admin_only_permissions(self):
        def assert_admin_permission_in(role_name, assert_func):
            role = sm.find_role(role_name)
            permissions = [p.permission.name for p in role.permissions]
            assert_func('can_sync_druid_source', permissions)
            assert_func('can_approve', permissions)

        assert_admin_permission_in('Admin', self.assertIn)
        assert_admin_permission_in('Alpha', self.assertNotIn)
        assert_admin_permission_in('Gamma', self.assertNotIn)

    def test_admin_only_menu_views(self):
        def assert_admin_view_menus_in(role_name, assert_func):
            role = sm.find_role(role_name)
            view_menus = [p.view_menu.name for p in role.permissions]
            assert_func('ResetPasswordView', view_menus)
            assert_func('RoleModelView', view_menus)
            assert_func('Security', view_menus)
            assert_func('UserDBModelView', view_menus)
            assert_func('SQL Lab',
                        view_menus)
            assert_func('AccessRequestsModelView', view_menus)

        assert_admin_view_menus_in('Admin', self.assertIn)
        assert_admin_view_menus_in('Alpha', self.assertNotIn)
        assert_admin_view_menus_in('Gamma', self.assertNotIn)

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

    def test_testconn(self):
        database = (
            db.session
            .query(models.Database)
            .filter_by(database_name='main')
            .first()
        )

        # validate that the endpoint works with the password-masked sqlalchemy uri
        data = json.dumps({
            'uri': database.safe_sqlalchemy_uri(),
            'name': 'main'
        })
        response = self.client.post('/caravel/testconn', data=data, content_type='application/json')
        assert response.status_code == 200

        # validate that the endpoint works with the decrypted sqlalchemy uri
        data = json.dumps({
            'uri': database.sqlalchemy_uri_decrypted,
            'name': 'main'
        })
        response = self.client.post('/caravel/testconn', data=data, content_type='application/json')
        assert response.status_code == 200


    def test_warm_up_cache(self):
        slice = db.session.query(models.Slice).first()
        resp = self.client.get(
            '/caravel/warm_up_cache?slice_id={}'.format(slice.id),
            follow_redirects=True)
        data = json.loads(resp.data.decode('utf-8'))
        assert data == [{'slice_id': slice.id, 'slice_name': slice.slice_name}]

        resp = self.client.get(
            '/caravel/warm_up_cache?table_name=energy_usage&db_name=main',
            follow_redirects=True)
        data = json.loads(resp.data.decode('utf-8'))
        assert len(data) == 3

    def test_shortner(self):
        self.login(username='admin')
        data = (
            "//caravel/explore/table/1/?viz_type=sankey&groupby=source&"
            "groupby=target&metric=sum__value&row_limit=5000&where=&having=&"
            "flt_col_0=source&flt_op_0=in&flt_eq_0=&slice_id=78&slice_name="
            "Energy+Sankey&collapsed_fieldsets=&action=&datasource_name="
            "energy_usage&datasource_id=1&datasource_type=table&"
            "previous_viz_type=sankey"
        )
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

    def test_approve(self):
        session = db.session
        sm.add_role('table_role')
        self.login('admin')

        def prepare_request(ds_type, ds_name, role):
            ds_class = SourceRegistry.sources[ds_type]
            # TODO: generalize datasource names
            if ds_type == 'table':
                ds = session.query(ds_class).filter(
                    ds_class.table_name == ds_name).first()
            else:
                ds = session.query(ds_class).filter(
                    ds_class.datasource_name == ds_name).first()
            ds_perm_view = sm.find_permission_view_menu(
                'datasource_access', ds.perm)
            sm.add_permission_role(sm.find_role(role), ds_perm_view)
            access_request = models.DatasourceAccessRequest(
                datasource_id=ds.id,
                datasource_type=ds_type,
                created_by_fk=sm.find_user(username='gamma').id,
            )
            session.add(access_request)
            session.commit()
            return access_request

        EXTEND_ROLE_REQUEST = (
            '/caravel/approve?datasource_type={}&datasource_id={}&'
            'created_by={}&role_to_extend={}')
        GRANT_ROLE_REQUEST = (
            '/caravel/approve?datasource_type={}&datasource_id={}&'
            'created_by={}&role_to_grant={}')

        # Case 1. Grant new role to the user.

        access_request1 = prepare_request(
            'table', 'unicode_test', 'table_role')
        ds_1_id = access_request1.datasource_id
        self.client.get(GRANT_ROLE_REQUEST.format(
            'table', ds_1_id, 'gamma', 'table_role'))
        access_requests = self.get_access_requests('gamma', 'table', ds_1_id)
        # request was removed
        self.assertFalse(access_requests)
        # user was granted table_role
        user_roles = [r.name for r in sm.find_user('gamma').roles]
        self.assertIn('table_role', user_roles)

        # Case 2. Extend the role to have access to the table

        access_request2 = prepare_request('table', 'long_lat', 'table_role')
        ds_2_id = access_request2.datasource_id
        long_lat_perm = access_request2.datasource.perm

        self.client.get(EXTEND_ROLE_REQUEST.format(
            'table', access_request2.datasource_id, 'gamma', 'table_role'))
        access_requests = self.get_access_requests('gamma', 'table', ds_2_id)
        # request was removed
        self.assertFalse(access_requests)
        # table_role was extended to grant access to the long_lat table/
        table_role = sm.find_role('table_role')
        perm_view = sm.find_permission_view_menu(
            'datasource_access', long_lat_perm)
        self.assertIn(perm_view, table_role.permissions)

        # Case 3. Grant new role to the user to access the druid datasource.

        sm.add_role('druid_role')
        access_request3 = prepare_request('druid', 'druid_ds_1', 'druid_role')
        self.client.get(GRANT_ROLE_REQUEST.format(
            'druid', access_request3.datasource_id, 'gamma', 'druid_role'))

        # user was granted table_role
        user_roles = [r.name for r in sm.find_user('gamma').roles]
        self.assertIn('druid_role', user_roles)

        # Case 4. Extend the role to have access to the druid datasource

        access_request4 = prepare_request('druid', 'druid_ds_2', 'druid_role')
        druid_ds_2_perm = access_request4.datasource.perm

        self.client.get(EXTEND_ROLE_REQUEST.format(
            'druid', access_request4.datasource_id, 'gamma', 'druid_role'))
        # druid_role was extended to grant access to the druid_access_ds_2
        druid_role = sm.find_role('druid_role')
        perm_view = sm.find_permission_view_menu(
            'datasource_access', druid_ds_2_perm)
        self.assertIn(perm_view, druid_role.permissions)

        # cleanup
        gamma_user = sm.find_user(username='gamma')
        gamma_user.roles.remove(sm.find_role('druid_role'))
        gamma_user.roles.remove(sm.find_role('table_role'))
        session.delete(sm.find_role('druid_role'))
        session.delete(sm.find_role('table_role'))
        session.commit()

    def test_request_access(self):
        session = db.session
        self.login(username='gamma')
        gamma_user = sm.find_user(username='gamma')
        sm.add_role('dummy_role')
        gamma_user.roles.append(sm.find_role('dummy_role'))
        session.commit()

        ACCESS_REQUEST = (
            '/caravel/request_access?datasource_type={}&datasource_id={}')
        ROLE_EXTEND_LINK = (
            '<a href="/caravel/approve?datasource_type={}&datasource_id={}&'
            'created_by={}&role_to_extend={}">Extend {} Role</a>')
        ROLE_GRANT_LINK = (
            '<a href="/caravel/approve?datasource_type={}&datasource_id={}&'
            'created_by={}&role_to_grant={}">Grant {} Role</a>')

        # Case 1. Request table access, there are no roles have this table.

        table1 = session.query(models.SqlaTable).filter_by(
            table_name='random_time_series').first()
        table_1_id = table1.id

        # request access to the table
        self.client.get(ACCESS_REQUEST.format('table', table_1_id))

        access_request1 = self.get_access_requests(
            'gamma', 'table', table_1_id)[0]
        approve_link_1 = ROLE_EXTEND_LINK.format(
            'table', table_1_id, 'gamma', 'dummy_role', 'dummy_role')
        self.assertEqual(
            access_request1.user_roles,
            '<ul><li>Gamma Role</li><li>{}</li></ul>'.format(approve_link_1))
        self.assertEqual(access_request1.roles_with_datasource, '<ul></ul>')

        # Case 2. Duplicate request.

        self.client.get(ACCESS_REQUEST.format('table', table_1_id))
        access_requests_2 = self.get_access_requests(
            'gamma', 'table', table_1_id)
        self.assertEqual(len(access_requests_2), 1)

        # Case 3. Request access, roles exist that contains the table.

        # add table to the existing roles
        table3 = session.query(models.SqlaTable).filter_by(
            table_name='energy_usage').first()
        table_3_id = table3.id
        table3_perm = table3.perm

        sm.add_role('energy_usage_role')
        alpha_role = sm.find_role('Alpha')
        sm.add_permission_role(
            alpha_role,
            sm.find_permission_view_menu('datasource_access', table3_perm))
        sm.add_permission_role(
            sm.find_role("energy_usage_role"),
            sm.find_permission_view_menu('datasource_access', table3_perm))
        session.commit()

        self.client.get(ACCESS_REQUEST.format('table', table_3_id))

        access_request3 = self.get_access_requests(
            'gamma', 'table', table_3_id)[0]
        approve_link_3 = ROLE_GRANT_LINK.format(
            'table', table_3_id, 'gamma', 'energy_usage_role',
            'energy_usage_role')
        self.assertEqual(access_request3.roles_with_datasource,
                         '<ul><li>{}</li></ul>'.format(approve_link_3))

        # Case 4. Request druid access, there are no roles have this table.
        druid_ds_4 = session.query(models.DruidDatasource).filter_by(
            datasource_name='druid_ds_1').first()
        druid_ds_4_id = druid_ds_4.id

        # request access to the table
        self.client.get(ACCESS_REQUEST.format('druid', druid_ds_4_id))
        access_request4 = self.get_access_requests(
            'gamma', 'druid', druid_ds_4_id)[0]
        approve_link_4 = ROLE_EXTEND_LINK.format(
            'druid', druid_ds_4_id, 'gamma', 'dummy_role', 'dummy_role')
        self.assertEqual(
            access_request4.user_roles,
            '<ul><li>Gamma Role</li><li>{}</li></ul>'.format(approve_link_4))

        self.assertEqual(
            access_request4.roles_with_datasource,
            '<ul></ul>'.format(access_request4.id))

        # Case 5. Roles exist that contains the druid datasource.
        # add druid ds to the existing roles
        druid_ds_5 = session.query(models.DruidDatasource).filter_by(
            datasource_name='druid_ds_2').first()
        druid_ds_5_id = druid_ds_5.id
        druid_ds_5_perm = druid_ds_5.perm

        druid_ds_2_role = sm.add_role('druid_ds_2_role')
        admin_role = sm.find_role('Admin')
        sm.add_permission_role(
            admin_role,
            sm.find_permission_view_menu('datasource_access', druid_ds_5_perm))
        sm.add_permission_role(
            druid_ds_2_role,
            sm.find_permission_view_menu('datasource_access', druid_ds_5_perm))
        session.commit()

        self.client.get(ACCESS_REQUEST.format('druid', druid_ds_5_id))
        access_request5 = self.get_access_requests(
            'gamma', 'druid', druid_ds_5_id)[0]
        approve_link_5 = ROLE_GRANT_LINK.format(
            'druid', druid_ds_5_id, 'gamma', 'druid_ds_2_role',
            'druid_ds_2_role')

        self.assertEqual(access_request5.roles_with_datasource,
                         '<ul><li>{}</li></ul>'.format(approve_link_5))

        # cleanup
        gamma_user = sm.find_user(username='gamma')
        gamma_user.roles.remove(sm.find_role('dummy_role'))
        session.commit()

    def test_druid_sync_from_config(self):
        self.login()
        cluster = models.DruidCluster(cluster_name="new_druid")
        db.session.add(cluster)
        db.session.commit()

        cfg = {
            "user": "admin",
            "cluster": "new_druid",
            "config": {
                "name": "test_click",
                "dimensions": ["affiliate_id", "campaign", "first_seen"],
                "metrics_spec": [{"type": "count", "name": "count"},
                                 {"type": "sum", "name": "sum"}],
                "batch_ingestion": {
                    "sql": "SELECT * FROM clicks WHERE d='{{ ds }}'",
                    "ts_column": "d",
                    "sources": [{
                        "table": "clicks",
                        "partition": "d='{{ ds }}'"
                    }]
                }
            }
        }
        resp = self.client.post('/caravel/sync_druid/', data=json.dumps(cfg))

        druid_ds = db.session.query(DruidDatasource).filter_by(
            datasource_name="test_click").first()
        assert set([c.column_name for c in druid_ds.columns]) == set(
            ["affiliate_id", "campaign", "first_seen"])
        assert set([m.metric_name for m in druid_ds.metrics]) == set(
            ["count", "sum"])
        assert resp.status_code == 201

        # datasource exists, not changes required
        resp = self.client.post('/caravel/sync_druid/', data=json.dumps(cfg))
        druid_ds = db.session.query(DruidDatasource).filter_by(
            datasource_name="test_click").first()
        assert set([c.column_name for c in druid_ds.columns]) == set(
            ["affiliate_id", "campaign", "first_seen"])
        assert set([m.metric_name for m in druid_ds.metrics]) == set(
            ["count", "sum"])
        assert resp.status_code == 201

        # datasource exists, add new metrics and dimentions
        cfg = {
            "user": "admin",
            "cluster": "new_druid",
            "config": {
                "name": "test_click",
                "dimensions": ["affiliate_id", "second_seen"],
                "metrics_spec": [
                    {"type": "bla", "name": "sum"},
                    {"type": "unique", "name": "unique"}
                ],
            }
        }
        resp = self.client.post('/caravel/sync_druid/', data=json.dumps(cfg))
        druid_ds = db.session.query(DruidDatasource).filter_by(
            datasource_name="test_click").first()
        # columns and metrics are not deleted if config is changed as
        # user could define his own dimensions / metrics and want to keep them
        assert set([c.column_name for c in druid_ds.columns]) == set(
            ["affiliate_id", "campaign", "first_seen", "second_seen"])
        assert set([m.metric_name for m in druid_ds.metrics]) == set(
            ["count", "sum", "unique"])
        # metric type will not be overridden, sum stays instead of bla
        assert set([m.metric_type for m in druid_ds.metrics]) == set(
            ["longSum", "sum", "unique"])
        assert resp.status_code == 201

    def test_filter_druid_datasource(self):
        gamma_ds = DruidDatasource(
            datasource_name="datasource_for_gamma",
        )
        db.session.add(gamma_ds)
        no_gamma_ds = DruidDatasource(
            datasource_name="datasource_not_for_gamma",
        )
        db.session.add(no_gamma_ds)
        db.session.commit()
        utils.merge_perm(sm, 'datasource_access', gamma_ds.perm)
        utils.merge_perm(sm, 'datasource_access', no_gamma_ds.perm)
        db.session.commit()

        gamma_ds_permission_view = (
            db.session.query(ab_models.PermissionView)
            .join(ab_models.ViewMenu)
            .filter(ab_models.ViewMenu.name == gamma_ds.perm)
            .first()
        )
        sm.add_permission_role(sm.find_role('Gamma'), gamma_ds_permission_view)

        self.login(username='gamma')
        url = '/druiddatasourcemodelview/list/'
        resp = self.client.get(url, follow_redirects=True)
        assert 'datasource_for_gamma' in resp.data.decode('utf-8')
        assert 'datasource_not_for_gamma' not in resp.data.decode('utf-8')

    def test_add_filter(self, username='admin'):
        # navigate to energy_usage slice with "Electricity,heat" in filter values
        data = (
            "/caravel/explore/table/1/?viz_type=table&groupby=source&metric=count&flt_col_1=source&flt_op_1=in&flt_eq_1=%27Electricity%2Cheat%27"
            "&userid=1&datasource_name=energy_usage&datasource_id=1&datasource_type=tablerdo_save=saveas")
        resp = self.client.get(
            data,
            follow_redirects=True)
        assert ("source" in resp.data.decode('utf-8'))

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
        sql = """
            SELECT first_name, last_name
            FROM ab_user
            WHERE first_name='admin'
        """
        client_id = "{}".format(random.getrandbits(64))[:10]
        self.run_sql(sql, 'admin', client_id)

        self.login('admin')
        resp = self.client.get('/caravel/csv/{}'.format(client_id))
        data = csv.reader(io.StringIO(resp.data.decode('utf-8')))
        expected_data = csv.reader(
            io.StringIO("first_name,last_name\nadmin, user\n"))

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

    def test_search_query_endpoint(self):
        userId = 'userId=null'
        databaseId = 'databaseId=null'
        searchText = 'searchText=null'
        status = 'status=success'
        params = [userId, databaseId, searchText, status]
        resp = self.client.get('/caravel/search_queries?'+'&'.join(params))
        self.assertEquals(200, resp.status_code)

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
