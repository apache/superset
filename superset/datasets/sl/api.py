from typing import Any, Set

from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from sqlalchemy import or_

from superset import security_manager
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.datasets.filters import (
    DatasetIsNullOrEmptyFilter,
    DatasetIsPhysicalOrVirtual,
)
from superset.datasets.models import Dataset
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.tables.models import Table
from superset.views.base import BaseFilter, DatasourceFilter
from superset.views.base_api import BaseSupersetModelRestApi, RelatedFieldFilter


class DatasetAllTextFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("All Text")
    arg_name = "dataset_all_text"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(
            or_(
                Dataset.name.ilike(ilike_value),
                Dataset.expression.ilike((ilike_value)),
            )
        )


# example risom: (filters:!((col:tables,opr:schema,value:public)),order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)
class DatasetSchemaFilter(BaseFilter):
    name = _("Schema")
    arg_name = "schema"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        filter_clause = Table.schema == str(value)
        return query.join(Table, filter_clause)


class DatasetDatabaseFilter(BaseFilter):
    name = _("Database")
    arg_name = "db"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        filter_clause = Table.database_id == int(value)
        return query.join(Table, filter_clause)


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
        # "owners": [DatasetOwnersFilter],
    }
