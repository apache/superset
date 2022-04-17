from typing import Any, Set

from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.datasets.filters import (
    DatasetAllTextFilter,
    DatasetDatabaseFilter,
    DatasetIsPhysicalOrVirtual,
    DatasetSchemaFilter,
)
from superset.datasets.models import Dataset
from superset.views.base_api import BaseSupersetModelRestApi


class SLDatasetRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Dataset)
    # todo(hugh): this should be a DatasetFilter instead of Datsource (security)
    #  base_filters = [["id", DatasourceFilter, lambda: []]]

    resource_name = "datasets"
    allow_browser_login = True
    class_permission_name = "Dataset"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    list_columns = [
        "changed_by",
        "changed_by_name",
        "changed_by_url",
        "changed_on_delta_humanized",
        "database",
        "datasource_type",
        "default_endpoint",
        "description",
        "explore_url",
        "extra",
        "id",
        "kind",
        "owners",
        "schema",
        "sql",
    ]
    order_columns = ["changed_on_delta_humanized", "schema"]
    search_columns = {"expression", "name", "tables"}
    search_filters = {
        "expression": [DatasetIsPhysicalOrVirtual],
        "name": [DatasetAllTextFilter],
        "tables": [DatasetSchemaFilter, DatasetDatabaseFilter],
    }
