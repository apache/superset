from superset import security_manager


def assert_permission_was_created(case, dashboard):
    view_menu = security_manager.find_view_menu(dashboard.view_name)
    case.assertIsNotNone(view_menu)
    case.assertEqual(len(security_manager.find_permissions_view_menu(view_menu)), 1)


def assert_permission_kept_and_changed(case, updated_dashboard, excepted_view_id):
    view_menu_after_title_changed = security_manager.find_view_menu(
        updated_dashboard.view_name
    )
    case.assertIsNotNone(view_menu_after_title_changed)
    case.assertEqual(view_menu_after_title_changed.id, excepted_view_id)


def assert_permissions_were_deleted(case, deleted_dashboard):
    view_menu = security_manager.find_view_menu(deleted_dashboard.view_name)
    case.assertIsNone(view_menu)


DASHBOARD_PERMISSION_ROLE = "dashboard_permission_role"


def arrange_to_delete_dashboard_test(dashboard):
    permission_name, view_name = dashboard.permission_view_pairs[0]
    pv = security_manager.find_permission_view_menu(permission_name, view_name)
    for i in range(3):
        security_manager.add_permission_role(
            security_manager.add_role("dashboard_permission_role" + str(i)), pv
        )


def clean_after_delete_dashboard_test():
    for i in range(3):
        security_manager.del_role("dashboard_permission_role" + str(i))
