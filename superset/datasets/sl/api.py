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


class DatasetSchemaFilter(BaseFilter):
    name = _("Schema")
    arg_name = "schema"

    def apply(self, query: Query, value: Any) -> Query:
        import sqlalchemy as sa

        breakpoint()
        filter_clause = Dataset.schema == value
        # query.join(Table)

        return query.filter(filter_clause)

        # return query.select_from(sa,join(Dataset, Table)).filter(filter_clause)


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
        "sql",  # "sql",
    ]
    order_columns = ["changed_on_delta_humanized", "schema"]
    search_columns = {"expression", "name", "tables"}
    search_filters = {
        "expression": [DatasetIsPhysicalOrVirtual],
        "name": [DatasetAllTextFilter],
        "tables": [DatasetSchemaFilter],
        # "owners": [DatasetOwnersFilter],
        # "database": [DatasetDatabaseFilter]
    }

    # class DatabaseFilter(BaseFilter):

    #     def apply(self, query: Query, value: Any) -> Query:
    #         if security_manager.can_access_all_databases():
    #             return query
    #         database_perms = security_manager.user_view_menu_names("database_access")
    #         schema_access_databases = self.can_access_databases("schema_access")

    #         datasource_access_databases = self.can_access_databases("datasource_access")
    #         return query.filter()

    # filter_rel_fields = {"database": [["id", DatabaseFilter, lambda: []]]}
    # allowed_rel_fields = {"database", "owners"}
    # search_columns = ["database"]


# get this working end to end with the frontend client
# then comeback and fix the test around it
