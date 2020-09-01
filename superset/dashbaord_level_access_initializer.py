import logging

from flask_appbuilder.security.sqla.models import (
    assoc_permissionview_role,
    PermissionView,
    Role,
    ViewMenu,
)

from superset import db, security_manager
from superset.constants import Security as SecurityConsts
from superset.models.dashboard import Dashboard

logger = logging.getLogger(__name__)


class InitDashboardLevelAccessCommand:
    def __init__(self) -> None:
        self.session = db.session

    def run(self) -> None:
        self.__create_all_dashboards_permissions()
        self.__add_all_dashboards_permissions_to_permitted_roles()
        self.__create_permissions_for_current_dashboards()

    def __create_all_dashboards_permissions(self) -> None:
        logger.info("start create_all_dashboards_permissions")
        self.access_all_dashboards_permission_view = security_manager.add_permission_view_menu(
            SecurityConsts.AllDashboard.ACCESS_PERMISSION_NAME,
            SecurityConsts.AllDashboard.VIEW_NAME,
        )
        logger.info("done create_all_dashboards_permissions")

    def __add_all_dashboards_permissions_to_permitted_roles(self) -> None:
        logger.info("start add_all_dashboards_permissions_to_permitted_roles")
        roles = (
            self.session.query(Role)
            .join(assoc_permissionview_role)
            .join(PermissionView)
            .join(ViewMenu)
            .filter(
                ViewMenu.name == SecurityConsts.AllDatasources.VIEW_NAME,
                ViewMenu.name != SecurityConsts.AllDashboard.VIEW_NAME,
            )
            .all()
        )
        for role in roles:
            role.permissions.append(self.access_all_dashboards_permission_view)
            self.session.merge(role)
        self.session.commit()
        logger.info("done add_all_dashboards_permissions_to_permitted_roles")

    def __create_permissions_for_current_dashboards(self) -> None:
        logger.info("start create_permissions_for_current_dashboards")
        dashboards = self.session.query(Dashboard).all()
        for dashboard in dashboards:
            security_manager.add_permission_view_menu(
                SecurityConsts.Dashboard.ACCESS_PERMISSION_NAME, dashboard.view_name
            )
        logger.info("done create_permissions_for_current_dashboards")
