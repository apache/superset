from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.slim.models.upload import UploadModel
from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.views.base import SupersetModelView

from . import UploadMixin


class UploadModelView(  # pylint: disable=too-many-ancestors
    UploadMixin,
    SupersetModelView,
):
    datamodel = SQLAInterface(UploadModel)
    include_route_methods = {RouteMethod.LIST, RouteMethod.SHOW}
    class_permission_name = "Upload"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP
