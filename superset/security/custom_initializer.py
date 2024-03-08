from superset.app import SupersetAppInitializer
from superset.extensions import appbuilder
from superset.security import SupersetSecurityManager


class MySupsersetAppInitializer(SupersetAppInitializer):
    def init_views(self) -> None:
        # Adds api for roles
        appbuilder.add_api(SupersetSecurityManager.role_api)

        # Uncomment if you want as well to add api for permissions, users, ect.

        appbuilder.add_api(SupersetSecurityManager.permission_api)
        appbuilder.add_api(SupersetSecurityManager.user_api)
        appbuilder.add_api(SupersetSecurityManager.view_menu_api)
        appbuilder.add_api(SupersetSecurityManager.permission_view_menu_api)

        super().init_views()
