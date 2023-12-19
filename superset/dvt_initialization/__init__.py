from superset.extensions import appbuilder
from superset.initialization import SupersetAppInitializer


class DVTAppInitializer(SupersetAppInitializer):
    def init_views(self) -> None:
        # pylint: disable=import-outside-toplevel
        super().init_views()
        from superset.dvt_auth.login import DVTAuthDBView

        appbuilder.add_view(
            DVTAuthDBView,
            href="/login/",
            name="Login",
            category="Security",
            category_icon="fa-cogs",
            icon="fa-group",
        )
