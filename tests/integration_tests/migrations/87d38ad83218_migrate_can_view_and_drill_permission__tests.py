from importlib import import_module

from superset import db
from superset.migrations.shared.security_converge import _find_pvm, Permission, PermissionView, ViewMenu
from tests.integration_tests.test_app import app

migration_module = import_module(
    "superset.migrations.versions."
    "2024-02-07_17-13_87d38ad83218_migrate_can_view_and_drill_permission"
)

upgrade = migration_module.do_upgrade
downgrade = migration_module.do_downgrade

def test_migration_upgrade():
    with app.app_context():
        pre_perm = PermissionView(
            permission=Permission(name="can_view_and_drill"),
            view_menu=db.session.query(ViewMenu).filter_by(name="Dashboard").one(),
        )
        db.session.add(pre_perm)
        db.session.commit()

        assert _find_pvm(db.session, "Dashboard", "can_view_and_drill") is not None

        upgrade(db.session)

        assert _find_pvm(db.session, "Dashboard", "can_view_chart_as_table") is not None
        assert _find_pvm(db.session, "Dashboard", "can_view_query") is not None
        assert _find_pvm(db.session, "Dashboard", "can_view_and_drill") is None

def test_migration_downgrade():
    with app.app_context():
        downgrade(db.session)

        assert _find_pvm(db.session, "Dashboard", "can_view_chart_as_table") is None
        assert _find_pvm(db.session, "Dashboard", "can_view_query") is None
        assert _find_pvm(db.session, "Dashboard", "can_view_and_drill") is not None

