"""Unit tests for Superset"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import csv
import doctest
import json
import io
import random
import unittest

from flask import escape

from superset import db, models, utils, appbuilder, sm, jinja_context, sql_lab
from superset.views import DatabaseView

from .base_tests import SupersetTestCase
import logging


class CoreTests(SupersetTestCase):

    requires_examples = True

    def __init__(self, *args, **kwargs):
        super(CoreTests, self).__init__(*args, **kwargs)

    @classmethod
    def setUpClass(cls):
        cls.table_ids = {tbl.table_name: tbl.id for tbl in (
            db.session
            .query(models.SqlaTable)
            .all()
        )}

    def setUp(self):
        db.session.query(models.Query).delete()
        db.session.query(models.DatasourceAccessRequest).delete()

    def tearDown(self):
        db.session.query(models.Query).delete()

    def test_login(self):
        resp = self.get_resp(
            '/login/',
            data=dict(username='admin', password='general'))
        self.assertIn('Welcome', resp)

        resp = self.get_resp('/logout/', follow_redirects=True)
        self.assertIn('User confirmation needed', resp)

        resp = self.get_resp(
            '/login/',
            data=dict(username='admin', password='wrongPassword'))
        self.assertNotIn('Welcome', resp)
        self.assertIn('User confirmation needed', resp)

    def test_welcome(self):
        self.login()
        resp = self.client.get('/superset/welcome')
        assert 'Welcome' in resp.data.decode('utf-8')

    def test_slice_endpoint(self):
        self.login(username='admin')
        slc = self.get_slice("Girls", db.session)
        resp = self.get_resp('/superset/slice/{}/'.format(slc.id))
        assert 'Time Column' in resp
        assert 'List Roles' in resp

        # Testing overrides
        resp = self.get_resp(
            '/superset/slice/{}/?standalone=true'.format(slc.id))
        assert 'List Roles' not in resp

    def test_slice_json_endpoint(self):
        self.login(username='admin')
        slc = self.get_slice("Girls", db.session)

        json_endpoint = (
            '/superset/explore_json/{}/{}?form_data={}'
            .format(slc.datasource_type, slc.datasource_id, json.dumps(slc.viz.form_data))
        )
        resp = self.get_resp(json_endpoint)
        assert '"Jennifer"' in resp

    def test_slice_csv_endpoint(self):
        self.login(username='admin')
        slc = self.get_slice("Girls", db.session)

        csv_endpoint = (
            '/superset/explore_json/{}/{}?csv=true&form_data={}'
            .format(slc.datasource_type, slc.datasource_id, json.dumps(slc.viz.form_data))
        )
        resp = self.get_resp(csv_endpoint)
        assert 'Jennifer,' in resp

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
        slice_name = "Energy Sankey"
        slice_id = self.get_slice(slice_name, db.session).id
        db.session.commit()
        copy_name = "Test Sankey Save"
        tbl_id = self.table_ids.get('energy_usage')
        new_slice_name = "Test Sankey Overwirte"

        url = (
            "/superset/explore/table/{}/?slice_name={}&"
            "action={}&datasource_name=energy_usage&form_data={}")

        form_data = {
            'viz_type': 'sankey',
            'groupby': 'source',
            'groupby': 'target',
            'metric': 'sum__value',
            'row_limit': 5000,
            'slice_id': slice_id,
        }
        # Changing name and save as a new slice
        resp = self.get_resp(
            url.format(
                tbl_id,
                copy_name,
                'saveas',
                json.dumps(form_data)
            )
        )
        slices = db.session.query(models.Slice) \
            .filter_by(slice_name=copy_name).all()
        assert len(slices) == 1
        new_slice_id = slices[0].id

        form_data = {
            'viz_type': 'sankey',
            'groupby': 'source',
            'groupby': 'target',
            'metric': 'sum__value',
            'row_limit': 5000,
            'slice_id': new_slice_id,
        }
        # Setting the name back to its original name by overwriting new slice
        resp = self.get_resp(
            url.format(
                tbl_id,
                new_slice_name,
                'overwrite',
                json.dumps(form_data)
            )
        )
        slc = db.session.query(models.Slice).filter_by(id=new_slice_id).first()
        assert slc.slice_name == new_slice_name
        db.session.delete(slc)


    def test_filter_endpoint(self):
        self.login(username='admin')
        slice_name = "Energy Sankey"
        slice_id = self.get_slice(slice_name, db.session).id
        db.session.commit()
        tbl_id = self.table_ids.get('energy_usage')
        table = db.session.query(models.SqlaTable).filter(models.SqlaTable.id == tbl_id)
        table.filter_select_enabled = True
        url = (
            "/superset/filter/table/{}/target/?viz_type=sankey&groupby=source"
            "&metric=sum__value&flt_col_0=source&flt_op_0=in&flt_eq_0=&"
            "slice_id={}&datasource_name=energy_usage&"
            "datasource_id=1&datasource_type=table")

        # Changing name
        resp = self.get_resp(url.format(tbl_id, slice_id))
        assert len(resp) > 0
        assert 'Carbon Dioxide' in resp

    def test_slices(self):
        # Testing by hitting the two supported end points for all slices
        self.login(username='admin')
        Slc = models.Slice
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [
                (slc.slice_name, 'slice_url', slc.slice_url),
                (slc.slice_name, 'slice_id_url', slc.slice_id_url),
            ]
        for name, method, url in urls:
            logging.info("[{name}]/[{method}]: {url}".format(**locals()))
            self.client.get(url)

    def test_add_slice(self):
        self.login(username='admin')

        # Click on the + to add a slice
        url = '/tablemodelview/list/'
        resp = self.get_resp(url)

        table = db.session.query(models.SqlaTable).first()
        assert table.name in resp
        assert '/superset/explore/table/{}'.format(table.id) in resp

    def test_slices_V2(self):
        # Add explore-v2-beta role to admin user
        # Test all slice urls as user with with explore-v2-beta role
        sm.add_role('explore-v2-beta')

        appbuilder.sm.add_user(
            'explore_beta', 'explore_beta', ' user', 'explore_beta@airbnb.com',
            appbuilder.sm.find_role('explore-v2-beta'),
            password='general')
        self.login(username='explore_beta', password='general')

        Slc = models.Slice
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [
                (slc.slice_name, 'slice_url', slc.slice_url),
            ]
        for name, method, url in urls:
            print("[{name}]/[{method}]: {url}".format(**locals()))
            response = self.client.get(url)

    def test_dashboard(self):
        self.login(username='admin')
        urls = {}
        for dash in db.session.query(models.Dashboard).all():
            urls[dash.dashboard_title] = dash.url
        for title, url in urls.items():
            assert escape(title) in self.client.get(url).data.decode('utf-8')

    def test_doctests(self):
        modules = [utils, models, sql_lab]
        for mod in modules:
            failed, tests = doctest.testmod(mod)
            if failed:
                raise Exception("Failed a doctest")

    def test_misc(self):
        assert self.get_resp('/health') == "OK"
        assert self.get_resp('/ping') == "OK"

    def test_testconn(self):
        database = self.get_main_database(db.session)

        # validate that the endpoint works with the password-masked sqlalchemy uri
        data = json.dumps({
            'uri': database.safe_sqlalchemy_uri(),
            'name': 'main'
        })
        response = self.client.post('/superset/testconn', data=data, content_type='application/json')
        assert response.status_code == 200

        # validate that the endpoint works with the decrypted sqlalchemy uri
        data = json.dumps({
            'uri': database.sqlalchemy_uri_decrypted,
            'name': 'main'
        })
        response = self.client.post('/superset/testconn', data=data, content_type='application/json')
        assert response.status_code == 200

    def test_databaseview_edit(self, username='admin'):
        # validate that sending a password-masked uri does not over-write the decrypted uri
        self.login(username=username)
        database = self.get_main_database(db.session)
        sqlalchemy_uri_decrypted = database.sqlalchemy_uri_decrypted
        url = 'databaseview/edit/{}'.format(database.id)
        data = {k: database.__getattribute__(k) for k in DatabaseView.add_columns}
        data['sqlalchemy_uri'] = database.safe_sqlalchemy_uri()
        self.client.post(url, data=data)
        database = self.get_main_database(db.session)
        self.assertEqual(sqlalchemy_uri_decrypted, database.sqlalchemy_uri_decrypted)

    def test_warm_up_cache(self):
        slc = self.get_slice("Girls", db.session)
        data = self.get_json_resp(
            '/superset/warm_up_cache?slice_id={}'.format(slc.id))

        assert data == [{'slice_id': slc.id, 'slice_name': slc.slice_name}]

        data = self.get_json_resp(
            '/superset/warm_up_cache?table_name=energy_usage&db_name=main')
        assert len(data) == 3

    def test_shortner(self):
        self.login(username='admin')
        data = (
            "//superset/explore/table/1/?viz_type=sankey&groupby=source&"
            "groupby=target&metric=sum__value&row_limit=5000&where=&having=&"
            "flt_col_0=source&flt_op_0=in&flt_eq_0=&slice_id=78&slice_name="
            "Energy+Sankey&collapsed_fieldsets=&action=&datasource_name="
            "energy_usage&datasource_id=1&datasource_type=table&"
            "previous_viz_type=sankey"
        )
        resp = self.client.post('/r/shortner/', data=data)
        assert '/r/' in resp.data.decode('utf-8')

    def test_kv(self):
        self.logout()
        self.login(username='admin')

        try:
            resp = self.client.post('/kv/store/', data=dict())
        except Exception as e:
            self.assertRaises(TypeError)

        value = json.dumps({'data': 'this is a test'})
        resp = self.client.post('/kv/store/', data=dict(data=value))
        self.assertEqual(resp.status_code, 200)
        kv = db.session.query(models.KeyValue).first()
        kv_value = kv.value
        self.assertEqual(json.loads(value), json.loads(kv_value))

        resp = self.client.get('/kv/{}/'.format(kv.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(json.loads(value),
            json.loads(resp.data.decode('utf-8')))

        try:
            resp = self.client.get('/kv/10001/')
        except Exception as e:
            self.assertRaises(TypeError)

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
        url = '/superset/save_dash/{}/'.format(dash.id)
        resp = self.client.post(url, data=dict(data=json.dumps(data)))
        assert "SUCCESS" in resp.data.decode('utf-8')

    def test_copy_dash(self, username='admin'):
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
            'dashboard_title': 'Copy Of Births',
        }

        # Save changes to Births dashboard and retrieve updated dash
        dash_id = dash.id
        url = '/superset/save_dash/{}/'.format(dash_id)
        self.client.post(url, data=dict(data=json.dumps(data)))
        dash = db.session.query(models.Dashboard).filter_by(
            id=dash_id).first()
        orig_json_data = json.loads(dash.json_data)

        # Verify that copy matches original
        url = '/superset/copy_dash/{}/'.format(dash_id)
        resp = self.get_json_resp(url, data=dict(data=json.dumps(data)))
        self.assertEqual(resp['dashboard_title'], 'Copy Of Births')
        self.assertEqual(resp['position_json'], orig_json_data['position_json'])
        self.assertEqual(resp['metadata'], orig_json_data['metadata'])
        self.assertEqual(resp['slices'], orig_json_data['slices'])

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
        url = '/superset/add_slices/{}/'.format(dash.id)
        resp = self.client.post(url, data=dict(data=json.dumps(data)))
        assert "SLICES ADDED" in resp.data.decode('utf-8')

        dash = db.session.query(models.Dashboard).filter_by(
            slug="births").first()
        new_slice = db.session.query(models.Slice).filter_by(
            slice_name="Mapbox Long/Lat").first()
        assert new_slice in dash.slices
        assert len(set(dash.slices)) == len(dash.slices)

        # cleaning up
        dash = db.session.query(models.Dashboard).filter_by(
            slug="births").first()
        dash.slices = [
            o for o in dash.slices if o.slice_name != "Mapbox Long/Lat"]
        db.session.commit()

    def test_gamma(self):
        self.login(username='gamma')
        assert "List Slice" in self.get_resp('/slicemodelview/list/')
        assert "List Dashboard" in self.get_resp('/dashboardmodelview/list/')

    def test_csv_endpoint(self):
        self.login('admin')
        sql = """
            SELECT first_name, last_name
            FROM ab_user
            WHERE first_name='admin'
        """
        client_id = "{}".format(random.getrandbits(64))[:10]
        self.run_sql(sql, client_id, raise_on_error=True)

        resp = self.get_resp('/superset/csv/{}'.format(client_id))
        data = csv.reader(io.StringIO(resp))
        expected_data = csv.reader(
            io.StringIO("first_name,last_name\nadmin, user\n"))

        self.assertEqual(list(expected_data), list(data))
        self.logout()

    def test_public_user_dashboard_access(self):
        table = (
            db.session
            .query(models.SqlaTable)
            .filter_by(table_name='birth_names')
            .one()
        )
        # Try access before adding appropriate permissions.
        self.revoke_public_access_to_table(table)
        self.logout()

        resp = self.get_resp('/slicemodelview/list/')
        self.assertNotIn('birth_names</a>', resp)

        resp = self.get_resp('/dashboardmodelview/list/')
        self.assertNotIn('/superset/dashboard/births/', resp)

        self.grant_public_access_to_table(table)

        # Try access after adding appropriate permissions.
        self.assertIn('birth_names', self.get_resp('/slicemodelview/list/'))

        resp = self.get_resp('/dashboardmodelview/list/')
        self.assertIn("/superset/dashboard/births/", resp)

        self.assertIn('Births', self.get_resp('/superset/dashboard/births/'))

        # Confirm that public doesn't have access to other datasets.
        resp = self.get_resp('/slicemodelview/list/')
        self.assertNotIn('wb_health_population</a>', resp)

        resp = self.get_resp('/dashboardmodelview/list/')
        self.assertNotIn("/superset/dashboard/world_health/", resp)

    def test_dashboard_with_created_by_can_be_accessed_by_public_users(self):
        self.logout()
        table = (
            db.session
            .query(models.SqlaTable)
            .filter_by(table_name='birth_names')
            .one()
        )
        self.grant_public_access_to_table(table)

        dash = db.session.query(models.Dashboard).filter_by(dashboard_title="Births").first()
        dash.owners = [appbuilder.sm.find_user('admin')]
        dash.created_by = appbuilder.sm.find_user('admin')
        db.session.merge(dash)
        db.session.commit()

        assert 'Births' in self.get_resp('/superset/dashboard/births/')

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

    def test_extra_table_metadata(self):
        self.login('admin')
        dbid = self.get_main_database(db.session).id
        self.get_json_resp(
            '/superset/extra_table_metadata/{dbid}/'
            'ab_permission_view/panoramix/'.format(**locals()))

    def test_process_template(self):
        maindb = self.get_main_database(db.session)
        sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
        tp = jinja_context.get_template_processor(database=maindb)
        rendered = tp.process_template(sql)
        self.assertEqual("SELECT '2017-01-01T00:00:00'", rendered)

    def test_templated_sql_json(self):
        self.login('admin')
        sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}' as test"
        data = self.run_sql(sql, "fdaklj3ws")
        self.assertEqual(data['data'][0]['test'], "2017-01-01T00:00:00")

    def test_table_metadata(self):
        maindb = self.get_main_database(db.session)
        backend = maindb.backend
        data = self.get_json_resp(
            "/superset/table/{}/ab_user/null/".format(maindb.id))
        self.assertEqual(data['name'], 'ab_user')
        assert len(data['columns']) > 5
        assert data.get('selectStar').startswith('SELECT')

        # Engine specific tests
        if backend in ('mysql', 'postgresql'):
            self.assertEqual(data.get('primaryKey').get('type'), 'pk')
            self.assertEqual(
                data.get('primaryKey').get('column_names')[0], 'id')
            self.assertEqual(len(data.get('foreignKeys')), 2)
            if backend == 'mysql':
                self.assertEqual(len(data.get('indexes')), 7)
            elif backend == 'postgresql':
                self.assertEqual(len(data.get('indexes')), 5)

    def test_fetch_datasource_metadata(self):
        self.login(username='admin')
        url = (
            '/superset/fetch_datasource_metadata?'
            + 'datasourceKey=1__table'
        )
        resp = self.get_json_resp(url)
        keys = [
            'name', 'filterable_cols', 'gb_cols', 'type', 'all_cols',
            'order_by_choices', 'metrics_combo', 'granularity_sqla',
            'time_grain_sqla', 'id',
        ]
        for k in keys:
            self.assertIn(k, resp.keys())

    def test_user_profile(self):
        self.login(username='admin')
        slc = self.get_slice("Girls", db.session)

        # Setting some faves
        url = '/superset/favstar/Slice/{}/select/'.format(slc.id)
        resp = self.get_json_resp(url)
        self.assertEqual(resp['count'], 1)

        dash = (
            db.session
            .query(models.Dashboard)
            .filter_by(slug="births")
            .first()
        )
        url = '/superset/favstar/Dashboard/{}/select/'.format(dash.id)
        resp = self.get_json_resp(url)
        self.assertEqual(resp['count'], 1)

        userid = appbuilder.sm.find_user('admin').id
        resp = self.get_resp('/superset/profile/admin/')
        self.assertIn('"app"', resp)
        data = self.get_json_resp('/superset/recent_activity/{}/'.format(userid))
        self.assertNotIn('message', data)
        data = self.get_json_resp('/superset/created_slices/{}/'.format(userid))
        self.assertNotIn('message', data)
        data = self.get_json_resp('/superset/created_dashboards/{}/'.format(userid))
        self.assertNotIn('message', data)
        data = self.get_json_resp('/superset/fave_slices/{}/'.format(userid))
        self.assertNotIn('message', data)
        data = self.get_json_resp('/superset/fave_dashboards/{}/'.format(userid))
        self.assertNotIn('message', data)


if __name__ == '__main__':
    unittest.main()

