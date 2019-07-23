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
# pylint: disable=C,R,W
import os

from flask import flash, redirect
from flask_appbuilder import SimpleFormView
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename

from superset import app, appbuilder, security_manager
from superset.connectors.sqla.models import SqlaTable
import superset.models.core as models
from superset.utils import core as utils
from superset.views.base import DeleteMixin, SupersetModelView, YamlExportMixin
from . import DatabaseMixin
from .forms import CsvToDatabaseForm


config = app.config
stats_logger = config.get("STATS_LOGGER")


class DatabaseView(
    DatabaseMixin, SupersetModelView, DeleteMixin, YamlExportMixin
):  # noqa
    datamodel = SQLAInterface(models.Database)

    add_template = "superset/models/database/add.html"
    edit_template = "superset/models/database/edit.html"

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


class CsvToDatabaseView(SimpleFormView):
    form = CsvToDatabaseForm
    form_template = "superset/form_view/csv_to_database_view/edit.html"
    form_title = _("CSV to Database configuration")
    add_columns = ["database", "schema", "table_name"]

    def form_get(self, form):
        form.sep.data = ","
        form.header.data = 0
        form.mangle_dupe_cols.data = True
        form.skipinitialspace.data = False
        form.skip_blank_lines.data = True
        form.infer_datetime_format.data = True
        form.decimal.data = "."
        form.if_exists.data = "fail"

    def form_post(self, form):
        database = form.con.data
        schema_name = form.schema.data or ""

        if not self.is_schema_allowed(database, schema_name):
            message = _(
                'Database "{0}" Schema "{1}" is not allowed for csv uploads. '
                "Please contact Superset Admin".format(
                    database.database_name, schema_name
                )
            )
            flash(message, "danger")
            return redirect("/csvtodatabaseview/form")

        csv_file = form.csv_file.data
        form.csv_file.data.filename = secure_filename(form.csv_file.data.filename)
        csv_filename = form.csv_file.data.filename
        path = os.path.join(config["UPLOAD_FOLDER"], csv_filename)
        try:
            utils.ensure_path_exists(config["UPLOAD_FOLDER"])
            csv_file.save(path)
            table = SqlaTable(table_name=form.name.data)
            table.database = form.data.get("con")
            table.database_id = table.database.id
            table.database.db_engine_spec.create_table_from_csv(form, table)
        except Exception as e:
            try:
                os.remove(path)
            except OSError:
                pass
            message = (
                "Table name {} already exists. Please pick another".format(
                    form.name.data
                )
                if isinstance(e, IntegrityError)
                else str(e)
            )
            flash(message, "danger")
            stats_logger.incr("failed_csv_upload")
            return redirect("/csvtodatabaseview/form")

        os.remove(path)
        # Go back to welcome page / splash screen
        db_name = table.database.database_name
        message = _(
            'CSV file "{0}" uploaded to table "{1}" in '
            'database "{2}"'.format(csv_filename, form.name.data, db_name)
        )
        flash(message, "info")
        stats_logger.incr("successful_csv_upload")
        return redirect("/tablemodelview/list/")

    def is_schema_allowed(self, database, schema):
        if not database.allow_csv_upload:
            return False
        schemas = database.get_schema_access_for_csv_upload()
        if schemas:
            return schema in schemas
        return (
            security_manager.database_access(database)
            or security_manager.all_datasource_access()
        )


appbuilder.add_view_no_menu(CsvToDatabaseView)


class DatabaseTablesAsync(DatabaseView):
    list_columns = ["id", "all_table_names_in_database", "all_schema_names"]


appbuilder.add_view_no_menu(DatabaseTablesAsync)


class DatabaseAsync(DatabaseView):
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
