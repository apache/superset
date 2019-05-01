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
"""Unit tests for Superset"""
import json
import unittest

from flask import escape
from sqlalchemy import func

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.models import core as models
from .base_tests import SupersetTestCase


class DashboardTests(SupersetTestCase):

    def __init__(self, *args, **kwargs):
        super(DashboardTests, self).__init__(*args, **kwargs)

    @classmethod
    def setUpClass(cls):
        pass

    def setUp(self):
        pass

    def tearDown(self):
        pass

    def get_mock_positions(self, dash):
        positions = {
            'DASHBOARD_VERSION_KEY': 'v2',
        }
        for i, slc in enumerate(dash.slices):
            id = 'DASHBOARD_CHART_TYPE-{}'.format(i)
            d = {
                'type': 'DASHBOARD_CHART_TYPE',
                'id': id,
                'children': [],
                'meta': {
                    'width': 4,
                    'height': 50,
                    'chartId': slc.id,
                },
            }
            positions[id] = d
        return positions

    def test_dashboard(self):
        self.login(username='admin')
        urls = {}
        for dash in db.session.query(models.Dashboard).all():
            urls[dash.dashboard_title] = dash.url
        for title, url in urls.items():
            assert escape(title) in self.client.get(url).data.decode('utf-8')

    def test_new_dashboard(self):
        self.login(username='admin')
        dash_count_before = db.session.query(func.count(models.Dashboard.id)).first()[0]
        url = '/dashboard/new/'
        resp = self.get_resp(url)
        self.assertIn('[ untitled dashboard ]', resp)
        dash_count_after = db.session.query(func.count(models.Dashboard.id)).first()[0]
        self.assertEquals(dash_count_before + 1, dash_count_after)

    def test_dashboard_modes(self):
        self.login(username='admin')
        dash = (
            db.session.query(models.Dashboard)
            .filter_by(slug='births')
            .first()
        )
        url = dash.url
        if dash.url.find('?') == -1:
            url += '?'
        else:
            url += '&'
        resp = self.get_resp(url + 'edit=true&standalone=true')
        self.assertIn('editMode&#34;: true', resp)
        self.assertIn('standalone_mode&#34;: true', resp)
        self.assertIn('<body class="standalone">', resp)

    def test_save_dash(self, username='admin'):
        self.login(username=username)
        dash = db.session.query(models.Dashboard).filter_by(
            slug='births').first()
        positions = self.get_mock_positions(dash)
        data = {
            'css': '',
            'expanded_slices': {},
            'positions': positions,
            'dashboard_title': dash.dashboard_title,
        }
        url = '/superset/save_dash/{}/'.format(dash.id)
        resp = self.get_resp(url, data=dict(data=json.dumps(data)))
        self.assertIn('SUCCESS', resp)

    def test_save_dash_with_filter(self, username='admin'):
        self.login(username=username)
        dash = db.session.query(models.Dashboard).filter_by(
            slug='world_health').first()

        positions = self.get_mock_positions(dash)
        filters = {str(dash.slices[0].id): {'region': ['North America']}}
        default_filters = json.dumps(filters)
        data = {
            'css': '',
            'expanded_slices': {},
            'positions': positions,
            'dashboard_title': dash.dashboard_title,
            'default_filters': default_filters,
        }

        url = '/superset/save_dash/{}/'.format(dash.id)
        resp = self.get_resp(url, data=dict(data=json.dumps(data)))
        self.assertIn('SUCCESS', resp)

        updatedDash = db.session.query(models.Dashboard).filter_by(
            slug='world_health').first()
        new_url = updatedDash.url
        self.assertIn('region', new_url)

        resp = self.get_resp(new_url)
        self.assertIn('North America', resp)

    def test_save_dash_with_invalid_filters(self, username='admin'):
        self.login(username=username)
        dash = db.session.query(models.Dashboard).filter_by(
            slug='world_health').first()

        # add an invalid filter slice
        positions = self.get_mock_positions(dash)
        filters = {str(99999): {'region': ['North America']}}
        default_filters = json.dumps(filters)
        data = {
            'css': '',
            'expanded_slices': {},
            'positions': positions,
            'dashboard_title': dash.dashboard_title,
            'default_filters': default_filters,
        }

        url = '/superset/save_dash/{}/'.format(dash.id)
        resp = self.get_resp(url, data=dict(data=json.dumps(data)))
        self.assertIn('SUCCESS', resp)

        updatedDash = db.session.query(models.Dashboard).filter_by(
            slug='world_health').first()
        new_url = updatedDash.url
        self.assertNotIn('region', new_url)

    def test_save_dash_with_dashboard_title(self, username='admin'):
        self.login(username=username)
        dash = (
            db.session.query(models.Dashboard)
            .filter_by(slug='births')
            .first()
        )
        origin_title = dash.dashboard_title
        positions = self.get_mock_positions(dash)
        data = {
            'css': '',
            'expanded_slices': {},
            'positions': positions,
            'dashboard_title': 'new title',
        }
        url = '/superset/save_dash/{}/'.format(dash.id)
        self.get_resp(url, data=dict(data=json.dumps(data)))
        updatedDash = (
            db.session.query(models.Dashboard)
            .filter_by(slug='births')
            .first()
        )
        self.assertEqual(updatedDash.dashboard_title, 'new title')
        # bring back dashboard original title
        data['dashboard_title'] = origin_title
        self.get_resp(url, data=dict(data=json.dumps(data)))

    def test_save_dash_with_colors(self, username='admin'):
        self.login(username=username)
        dash = (
            db.session.query(models.Dashboard)
            .filter_by(slug='births')
            .first()
        )
        positions = self.get_mock_positions(dash)
        new_label_colors = {
            'data value': 'random color',
        }
        data = {
            'css': '',
            'expanded_slices': {},
            'positions': positions,
            'dashboard_title': dash.dashboard_title,
            'color_namespace': 'Color Namespace Test',
            'color_scheme': 'Color Scheme Test',
            'label_colors': new_label_colors,

        }
        url = '/superset/save_dash/{}/'.format(dash.id)
        self.get_resp(url, data=dict(data=json.dumps(data)))
        updatedDash = (
            db.session.query(models.Dashboard)
            .filter_by(slug='births')
            .first()
        )
        self.assertIn('color_namespace', updatedDash.json_metadata)
        self.assertIn('color_scheme', updatedDash.json_metadata)
        self.assertIn('label_colors', updatedDash.json_metadata)
        # bring back original dashboard
        del data['color_namespace']
        del data['color_scheme']
        del data['label_colors']
        self.get_resp(url, data=dict(data=json.dumps(data)))

    def test_copy_dash(self, username='admin'):
        self.login(username=username)
        dash = db.session.query(models.Dashboard).filter_by(
            slug='births').first()
        positions = self.get_mock_positions(dash)
        new_label_colors = {
            'data value': 'random color',
        }
        data = {
            'css': '',
            'duplicate_slices': False,
            'expanded_slices': {},
            'positions': positions,
            'dashboard_title': 'Copy Of Births',
            'color_namespace': 'Color Namespace Test',
            'color_scheme': 'Color Scheme Test',
            'label_colors': new_label_colors,
        }

        # Save changes to Births dashboard and retrieve updated dash
        dash_id = dash.id
        url = '/superset/save_dash/{}/'.format(dash_id)
        self.client.post(url, data=dict(data=json.dumps(data)))
        dash = db.session.query(models.Dashboard).filter_by(
            id=dash_id).first()
        orig_json_data = dash.data

        # Verify that copy matches original
        url = '/superset/copy_dash/{}/'.format(dash_id)
        resp = self.get_json_resp(url, data=dict(data=json.dumps(data)))
        self.assertEqual(resp['dashboard_title'], 'Copy Of Births')
        self.assertEqual(resp['position_json'], orig_json_data['position_json'])
        self.assertEqual(resp['metadata'], orig_json_data['metadata'])
        # check every attribute in each dashboard's slices list,
        # exclude modified and changed_on attribute
        for index, slc in enumerate(orig_json_data['slices']):
            for key in slc:
                if key not in ['modified', 'changed_on']:
                    self.assertEqual(slc[key], resp['slices'][index][key])

    def test_add_slices(self, username='admin'):
        self.login(username=username)
        dash = db.session.query(models.Dashboard).filter_by(
            slug='births').first()
        new_slice = db.session.query(models.Slice).filter_by(
            slice_name='Energy Force Layout').first()
        existing_slice = db.session.query(models.Slice).filter_by(
            slice_name='Name Cloud').first()
        data = {
            'slice_ids': [new_slice.data['slice_id'],
                          existing_slice.data['slice_id']],
        }
        url = '/superset/add_slices/{}/'.format(dash.id)
        resp = self.client.post(url, data=dict(data=json.dumps(data)))
        assert 'SLICES ADDED' in resp.data.decode('utf-8')

        dash = db.session.query(models.Dashboard).filter_by(
            slug='births').first()
        new_slice = db.session.query(models.Slice).filter_by(
            slice_name='Energy Force Layout').first()
        assert new_slice in dash.slices
        assert len(set(dash.slices)) == len(dash.slices)

        # cleaning up
        dash = db.session.query(models.Dashboard).filter_by(
            slug='births').first()
        dash.slices = [
            o for o in dash.slices if o.slice_name != 'Energy Force Layout']
        db.session.commit()

    def test_remove_slices(self, username='admin'):
        self.login(username=username)
        dash = db.session.query(models.Dashboard).filter_by(
            slug='births').first()
        origin_slices_length = len(dash.slices)

        positions = self.get_mock_positions(dash)
        # remove one chart
        chart_keys = []
        for key in positions.keys():
            if key.startswith('DASHBOARD_CHART_TYPE'):
                chart_keys.append(key)
        positions.pop(chart_keys[0])

        data = {
            'css': '',
            'expanded_slices': {},
            'positions': positions,
            'dashboard_title': dash.dashboard_title,
        }

        # save dash
        dash_id = dash.id
        url = '/superset/save_dash/{}/'.format(dash_id)
        self.client.post(url, data=dict(data=json.dumps(data)))
        dash = db.session.query(models.Dashboard).filter_by(
            id=dash_id).first()

        # verify slices data
        data = dash.data
        self.assertEqual(len(data['slices']), origin_slices_length - 1)

    def test_public_user_dashboard_access(self):
        table = (
            db.session
            .query(SqlaTable)
            .filter_by(table_name='birth_names')
            .one()
        )
        # Try access before adding appropriate permissions.
        self.revoke_public_access_to_table(table)
        self.logout()

        resp = self.get_resp('/chart/list/')
        self.assertNotIn('birth_names</a>', resp)

        resp = self.get_resp('/dashboard/list/')
        self.assertNotIn('/superset/dashboard/births/', resp)

        self.grant_public_access_to_table(table)

        # Try access after adding appropriate permissions.
        self.assertIn('birth_names', self.get_resp('/chart/list/'))

        resp = self.get_resp('/dashboard/list/')
        self.assertIn('/superset/dashboard/births/', resp)

        self.assertIn('Births', self.get_resp('/superset/dashboard/births/'))

        # Confirm that public doesn't have access to other datasets.
        resp = self.get_resp('/chart/list/')
        self.assertNotIn('wb_health_population</a>', resp)

        resp = self.get_resp('/dashboard/list/')
        self.assertNotIn('/superset/dashboard/world_health/', resp)

    def test_dashboard_with_created_by_can_be_accessed_by_public_users(self):
        self.logout()
        table = (
            db.session
            .query(SqlaTable)
            .filter_by(table_name='birth_names')
            .one()
        )
        self.grant_public_access_to_table(table)

        dash = db.session.query(models.Dashboard).filter_by(
            slug='births').first()
        dash.owners = [security_manager.find_user('admin')]
        dash.created_by = security_manager.find_user('admin')
        db.session.merge(dash)
        db.session.commit()

        assert 'Births' in self.get_resp('/superset/dashboard/births/')

    def test_only_owners_can_save(self):
        dash = (
            db.session
            .query(models.Dashboard)
            .filter_by(slug='births')
            .first()
        )
        dash.owners = []
        db.session.merge(dash)
        db.session.commit()
        self.test_save_dash('admin')

        self.logout()
        self.assertRaises(
            Exception, self.test_save_dash, 'alpha')

        alpha = security_manager.find_user('alpha')

        dash = (
            db.session
            .query(models.Dashboard)
            .filter_by(slug='births')
            .first()
        )
        dash.owners = [alpha]
        db.session.merge(dash)
        db.session.commit()
        self.test_save_dash('alpha')

    def test_owners_can_view_empty_dashboard(self):
        dash = (
            db.session
            .query(models.Dashboard)
            .filter_by(slug='empty_dashboard')
            .first()
        )
        if not dash:
            dash = models.Dashboard()
            dash.dashboard_title = 'Empty Dashboard'
            dash.slug = 'empty_dashboard'
        else:
            dash.slices = []
            dash.owners = []
        db.session.merge(dash)
        db.session.commit()

        gamma_user = security_manager.find_user('gamma')
        self.login(gamma_user.username)

        resp = self.get_resp('/dashboard/list/')
        self.assertNotIn('/superset/dashboard/empty_dashboard/', resp)

        dash = (
            db.session
            .query(models.Dashboard)
            .filter_by(slug='empty_dashboard')
            .first()
        )
        dash.owners = [gamma_user]
        db.session.merge(dash)
        db.session.commit()

        resp = self.get_resp('/dashboard/list/')
        self.assertIn('/superset/dashboard/empty_dashboard/', resp)


if __name__ == '__main__':
    unittest.main()
