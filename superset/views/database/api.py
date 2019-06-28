from flask_appbuilder import ModelRestApi
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset import appbuilder
import superset.models.core as models

from .views import DatabaseView


class DatabaseAsyncApi(ModelRestApi):
    class_permission_name = 'DatabaseAsync'
    resource_name = 'database'
    allow_browser_login = True
    datamodel = SQLAInterface(models.Database)

    list_columns = [
        "id",
        "database_name",
        "expose_in_sqllab",
        "allow_ctas",
        "force_ctas_schema",
        "allow_run_async",
        "allow_dml",
        "allow_multi_schema_metadata_fetch",
        "allow_csv_upload",
        "allows_subquery",
        "backend",
    ]
    add_columns = DatabaseView.add_columns
    edit_columns = DatabaseView.edit_columns
    show_columns = DatabaseView.show_columns
    description_columns = DatabaseView.description_columns
    base_order = DatabaseView.order_columns
    label_columns = DatabaseView.label_columns


appbuilder.add_api(DatabaseAsyncApi)
