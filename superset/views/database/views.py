# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import os

from flask import flash, g, redirect
from flask_appbuilder import SimpleFormView
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as __, lazy_gettext as _
from werkzeug.utils import secure_filename
from wtforms.fields import StringField
from wtforms.validators import ValidationError

import superset.models.core as models
from superset import app, appbuilder, db
from superset.connectors.sqla.models import SqlaTable
from superset.utils import core as utils
from superset.views.base import DeleteMixin, SupersetModelView, YamlExportMixin

from .mixins import DatabaseMixin
from .validators import schema_allows_csv_upload, sqlalchemy_uri_validator

config = app.config
stats_logger = config["STATS_LOGGER"]


def sqlalchemy_uri_form_validator(_, field: StringField) -> None:
    """
        Check if user has submitted a valid SQLAlchemy URI
    """
    sqlalchemy_uri_validator(field.data, exception=ValidationError)


class DatabaseView(
    DatabaseMixin, SupersetModelView, DeleteMixin, YamlExportMixin
):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(models.Database)

    add_template = "superset/models/database/add.html"
    edit_template = "superset/models/database/edit.html"
    validators_columns = {"sqlalchemy_uri": [sqlalchemy_uri_form_validator]}

    yaml_dict_key = "databases"

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)


appbuilder.add_link(
    "Import Dashboards",
    label=__("Import Dashboards"),
    href="/superset/import_dashboards",
    icon="fa-cloud-upload",
    category="Manage",
    category_label=__("Manage"),
    category_icon="fa-wrench",
)


appbuilder.add_view(
    DatabaseView,
    "Databases",
    label=__("Databases"),
    icon="fa-database",
    category="Sources",
    category_label=__("Sources"),
    category_icon="fa-database",
)


class DatabaseTablesAsync(DatabaseView):
    list_columns = ["id", "all_table_names_in_database", "all_schema_names"]


appbuilder.add_view_no_menu(DatabaseTablesAsync)


class DatabaseAsync(DatabaseView):  # pylint: disable=too-many-ancestors
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


appbuilder.add_view_no_menu(DatabaseAsync)
