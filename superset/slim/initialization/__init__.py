from superset.initialization import SupersetAppInitializer
from superset.extensions import (
    appbuilder
)
from flask_babel import gettext as __, lazy_gettext as _
from superset import app

class SlimAppInitializer(SupersetAppInitializer):

    def init_views(self) -> None:
        super().init_views()

        from superset.slim.views.upload.views import UploadModelView

        appbuilder.add_view(
            UploadModelView,
            "UploadMenuItem",
            label=__("Uploads"),
            icon="slim-upload",
            category="",
            category_icon="",
        )
