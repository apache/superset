from superset import security, sm

from .base_tests import SupersetTestCase


def get_perm_tuples(role_name):
    perm_set = set()
    for perm in sm.find_role(role_name).permissions:
        perm_set.add((perm.permission.name, perm.view_menu.name))
    return perm_set


class RolePermissionTests(SupersetTestCase):
    """Testing export import functionality for dashboards"""

    def __init__(self, *args, **kwargs):
        super(RolePermissionTests, self).__init__(*args, **kwargs)

    def assert_can_read(self, view_menu, permissions_set):
        self.assertIn(('can_show', view_menu), permissions_set)
        self.assertIn(('can_list', view_menu), permissions_set)

    def assert_can_write(self, view_menu, permissions_set):
        self.assertIn(('can_add', view_menu), permissions_set)
        self.assertIn(('can_download', view_menu), permissions_set)
        self.assertIn(('can_delete', view_menu), permissions_set)
        self.assertIn(('can_edit', view_menu), permissions_set)

    def assert_cannot_write(self, view_menu, permissions_set):
        self.assertNotIn(('can_add', view_menu), permissions_set)
        self.assertNotIn(('can_download', view_menu), permissions_set)
        self.assertNotIn(('can_delete', view_menu), permissions_set)
        self.assertNotIn(('can_edit', view_menu), permissions_set)
        self.assertNotIn(('can_save', view_menu), permissions_set)

    def assert_can_all(self, view_menu, permissions_set):
        self.assert_can_read(view_menu, permissions_set)
        self.assert_can_write(view_menu, permissions_set)

    def assert_cannot_gamma(self, perm_set):
        self.assert_cannot_write('DruidColumnInlineView', perm_set)

    def assert_can_gamma(self, perm_set):
        self.assert_can_read('DatabaseAsync', perm_set)
        self.assert_can_read('TableModelView', perm_set)

        # make sure that user can create slices and dashboards
        self.assert_can_all('SliceModelView', perm_set)
        self.assert_can_all('DashboardModelView', perm_set)

        self.assertIn(('can_add_slices', 'Superset'), perm_set)
        self.assertIn(('can_copy_dash', 'Superset'), perm_set)
        self.assertIn(('can_activity_per_day', 'Superset'), perm_set)
        self.assertIn(('can_created_dashboards', 'Superset'), perm_set)
        self.assertIn(('can_created_slices', 'Superset'), perm_set)
        self.assertIn(('can_csv', 'Superset'), perm_set)
        self.assertIn(('can_dashboard', 'Superset'), perm_set)
        self.assertIn(('can_explore', 'Superset'), perm_set)
        self.assertIn(('can_explore_json', 'Superset'), perm_set)
        self.assertIn(('can_fave_dashboards', 'Superset'), perm_set)
        self.assertIn(('can_fave_slices', 'Superset'), perm_set)
        self.assertIn(('can_save_dash', 'Superset'), perm_set)
        self.assertIn(('can_slice', 'Superset'), perm_set)
        self.assertIn(('can_explore', 'Superset'), perm_set)
        self.assertIn(('can_explore_json', 'Superset'), perm_set)
        self.assertIn(('can_queries', 'Superset'), perm_set)

    def assert_can_alpha(self, perm_set):
        self.assert_can_all('SqlMetricInlineView', perm_set)
        self.assert_can_all('TableColumnInlineView', perm_set)
        self.assert_can_all('TableModelView', perm_set)
        self.assert_can_all('DruidColumnInlineView', perm_set)
        self.assert_can_all('DruidDatasourceModelView', perm_set)
        self.assert_can_all('DruidMetricInlineView', perm_set)

        self.assertIn(
            ('all_datasource_access', 'all_datasource_access'), perm_set)
        self.assertIn(('muldelete', 'DruidDatasourceModelView'), perm_set)

    def assert_cannot_alpha(self, perm_set):
        self.assert_cannot_write('AccessRequestsModelView', perm_set)
        self.assert_cannot_write('Queries', perm_set)
        self.assert_cannot_write('RoleModelView', perm_set)
        self.assert_cannot_write('UserDBModelView', perm_set)

    def assert_can_admin(self, perm_set):
        self.assert_can_all('DatabaseAsync', perm_set)
        self.assert_can_all('DatabaseView', perm_set)
        self.assert_can_all('DruidClusterModelView', perm_set)
        self.assert_can_all('AccessRequestsModelView', perm_set)
        self.assert_can_all('RoleModelView', perm_set)
        self.assert_can_all('UserDBModelView', perm_set)

        self.assertIn(('all_database_access', 'all_database_access'), perm_set)
        self.assertIn(('can_override_role_permissions', 'Superset'), perm_set)
        self.assertIn(('can_sync_druid_source', 'Superset'), perm_set)
        self.assertIn(('can_override_role_permissions', 'Superset'), perm_set)
        self.assertIn(('can_approve', 'Superset'), perm_set)
        self.assertIn(('can_update_role', 'Superset'), perm_set)

    def test_is_admin_only(self):
        self.assertFalse(security.is_admin_only(
            sm.find_permission_view_menu('can_show', 'TableModelView')))
        self.assertFalse(security.is_admin_only(
            sm.find_permission_view_menu(
                'all_datasource_access', 'all_datasource_access')))

        self.assertTrue(security.is_admin_only(
            sm.find_permission_view_menu('can_delete', 'DatabaseView')))
        self.assertTrue(security.is_admin_only(
            sm.find_permission_view_menu(
                'can_show', 'AccessRequestsModelView')))
        self.assertTrue(security.is_admin_only(
            sm.find_permission_view_menu(
                'can_edit', 'UserDBModelView')))
        self.assertTrue(security.is_admin_only(
            sm.find_permission_view_menu(
                'can_approve', 'Superset')))
        self.assertTrue(security.is_admin_only(
            sm.find_permission_view_menu(
                'all_database_access', 'all_database_access')))

    def test_is_alpha_only(self):
        self.assertFalse(security.is_alpha_only(
            sm.find_permission_view_menu('can_show', 'TableModelView')))

        self.assertTrue(security.is_alpha_only(
            sm.find_permission_view_menu('muldelete', 'TableModelView')))
        self.assertTrue(security.is_alpha_only(
            sm.find_permission_view_menu(
                'all_datasource_access', 'all_datasource_access')))
        self.assertTrue(security.is_alpha_only(
            sm.find_permission_view_menu('can_edit', 'SqlMetricInlineView')))
        self.assertTrue(security.is_alpha_only(
            sm.find_permission_view_menu(
                'can_delete', 'DruidMetricInlineView')))

    def test_is_gamma_pvm(self):
        self.assertTrue(security.is_gamma_pvm(
            sm.find_permission_view_menu('can_show', 'TableModelView')))

    def test_gamma_permissions(self):
        self.assert_can_gamma(get_perm_tuples('Gamma'))
        self.assert_cannot_gamma(get_perm_tuples('Gamma'))
        self.assert_cannot_alpha(get_perm_tuples('Alpha'))

    def test_alpha_permissions(self):
        self.assert_can_gamma(get_perm_tuples('Alpha'))
        self.assert_can_alpha(get_perm_tuples('Alpha'))
        self.assert_cannot_alpha(get_perm_tuples('Alpha'))

    def test_admin_permissions(self):
        self.assert_can_gamma(get_perm_tuples('Admin'))
        self.assert_can_alpha(get_perm_tuples('Admin'))
        self.assert_can_admin(get_perm_tuples('Admin'))

    def test_sql_lab_permissions(self):
        sql_lab_set = get_perm_tuples('sql_lab')
        self.assertIn(('can_sql_json', 'Superset'), sql_lab_set)
        self.assertIn(('can_csv', 'Superset'), sql_lab_set)
        self.assertIn(('can_search_queries', 'Superset'), sql_lab_set)

        self.assert_cannot_gamma(sql_lab_set)
        self.assert_cannot_alpha(sql_lab_set)

    def test_granter_permissions(self):
        granter_set = get_perm_tuples('granter')
        self.assertIn(('can_override_role_permissions', 'Superset'), granter_set)
        self.assertIn(('can_approve', 'Superset'), granter_set)

        self.assert_cannot_gamma(granter_set)
        self.assert_cannot_alpha(granter_set)

