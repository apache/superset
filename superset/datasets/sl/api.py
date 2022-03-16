from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.datasets.models import Dataset
from superset.views.base import DatasourceFilter
from superset.views.base_api import BaseSupersetModelRestApi


class SLDatasetRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Dataset)
    # todo(hugh): this should be a DatasetFilter instead of Datsource
    #  base_filters = [["id", DatasourceFilter, lambda: []]]

    resource_name = "sl_dataset"
    allow_browser_login = True
    class_permission_name = "Dataset"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
