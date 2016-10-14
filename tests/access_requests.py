"""Unit tests for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import unittest

from caravel import db, models, sm
from caravel.source_registry import SourceRegistry

from .base_tests import CaravelTestCase


class RequestAccessTests(CaravelTestCase):

    requires_examples = True

    def test_approve(self):
        session = db.session
        TEST_ROLE_NAME = 'table_role'
        sm.add_role(TEST_ROLE_NAME)
        self.login('admin')

        def create_access_request(ds_type, ds_name, role_name):
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
            sm.add_permission_role(sm.find_role(role_name), ds_perm_view)
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

        access_request1 = create_access_request(
            'table', 'unicode_test', TEST_ROLE_NAME)
        ds_1_id = access_request1.datasource_id
        self.get_resp(GRANT_ROLE_REQUEST.format(
            'table', ds_1_id, 'gamma', TEST_ROLE_NAME))

        access_requests = self.get_access_requests('gamma', 'table', ds_1_id)
        # request was removed
        self.assertFalse(access_requests)
        # user was granted table_role
        user_roles = [r.name for r in sm.find_user('gamma').roles]
        self.assertIn(TEST_ROLE_NAME, user_roles)

        # Case 2. Extend the role to have access to the table

        access_request2 = create_access_request('table', 'long_lat', TEST_ROLE_NAME)
        ds_2_id = access_request2.datasource_id
        long_lat_perm = access_request2.datasource.perm

        self.client.get(EXTEND_ROLE_REQUEST.format(
            'table', access_request2.datasource_id, 'gamma', TEST_ROLE_NAME))
        access_requests = self.get_access_requests('gamma', 'table', ds_2_id)
        # request was removed
        self.assertFalse(access_requests)
        # table_role was extended to grant access to the long_lat table/
        perm_view = sm.find_permission_view_menu(
            'datasource_access', long_lat_perm)
        TEST_ROLE = sm.find_role(TEST_ROLE_NAME)
        self.assertIn(perm_view, TEST_ROLE.permissions)

        # Case 3. Grant new role to the user to access the druid datasource.

        sm.add_role('druid_role')
        access_request3 = create_access_request('druid', 'druid_ds_1', 'druid_role')
        self.get_resp(GRANT_ROLE_REQUEST.format(
            'druid', access_request3.datasource_id, 'gamma', 'druid_role'))

        # user was granted table_role
        user_roles = [r.name for r in sm.find_user('gamma').roles]
        self.assertIn('druid_role', user_roles)

        # Case 4. Extend the role to have access to the druid datasource

        access_request4 = create_access_request('druid', 'druid_ds_2', 'druid_role')
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
        gamma_user.roles.remove(sm.find_role(TEST_ROLE_NAME))
        session.delete(sm.find_role('druid_role'))
        session.delete(sm.find_role(TEST_ROLE_NAME))
        session.commit()

    def test_request_access(self):
        session = db.session
        self.login(username='gamma')
        gamma_user = sm.find_user(username='gamma')
        sm.add_role('dummy_role')
        gamma_user.roles.append(sm.find_role('dummy_role'))
        session.commit()

        ACCESS_REQUEST = (
            '/caravel/request_access?'
            'datasource_type={}&'
            'datasource_id={}&'
            'action={}&')
        ROLE_EXTEND_LINK = (
            '<a href="/caravel/approve?datasource_type={}&datasource_id={}&'
            'created_by={}&role_to_extend={}">Extend {} Role</a>')
        ROLE_GRANT_LINK = (
            '<a href="/caravel/approve?datasource_type={}&datasource_id={}&'
            'created_by={}&role_to_grant={}">Grant {} Role</a>')

        # Request table access, there are no roles have this table.

        table1 = session.query(models.SqlaTable).filter_by(
            table_name='random_time_series').first()
        table_1_id = table1.id

        # request access to the table
        resp = self.get_resp(
            ACCESS_REQUEST.format('table', table_1_id, 'go'))
        assert "Access was requested" in resp
        access_request1 = self.get_access_requests('gamma', 'table', table_1_id)
        assert access_request1 is not None

        # Request access, roles exist that contains the table.
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

        self.get_resp(
            ACCESS_REQUEST.format('table', table_3_id, 'go'))
        access_request3 = self.get_access_requests('gamma', 'table', table_3_id)
        approve_link_3 = ROLE_GRANT_LINK.format(
            'table', table_3_id, 'gamma', 'energy_usage_role',
            'energy_usage_role')
        self.assertEqual(access_request3.roles_with_datasource,
                         '<ul><li>{}</li></ul>'.format(approve_link_3))

        # Request druid access, there are no roles have this table.
        druid_ds_4 = session.query(models.DruidDatasource).filter_by(
            datasource_name='druid_ds_1').first()
        druid_ds_4_id = druid_ds_4.id

        # request access to the table
        self.get_resp(ACCESS_REQUEST.format('druid', druid_ds_4_id, 'go'))
        access_request4 = self.get_access_requests('gamma', 'druid', druid_ds_4_id)

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

        self.get_resp(ACCESS_REQUEST.format('druid', druid_ds_5_id, 'go'))
        access_request5 = self.get_access_requests(
            'gamma', 'druid', druid_ds_5_id)
        approve_link_5 = ROLE_GRANT_LINK.format(
            'druid', druid_ds_5_id, 'gamma', 'druid_ds_2_role',
            'druid_ds_2_role')
        self.assertEqual(access_request5.roles_with_datasource,
                         '<ul><li>{}</li></ul>'.format(approve_link_5))

        # cleanup
        gamma_user = sm.find_user(username='gamma')
        gamma_user.roles.remove(sm.find_role('dummy_role'))
        session.commit()


if __name__ == '__main__':
    unittest.main()
