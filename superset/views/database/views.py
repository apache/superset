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
import json
import os

from flask import flash, redirect
from flask_appbuilder import SimpleFormView
from flask_appbuilder.forms import DynamicForm
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename
from wtforms.fields import StringField
from wtforms.validators import ValidationError

from superset import app, appbuilder, db, security_manager
from superset.connectors.sqla.models import SqlaTable
import superset.models.core as models
from superset.utils import core as utils
from superset.views.base import DeleteMixin, SupersetModelView, YamlExportMixin
from . import DatabaseMixin, sqlalchemy_uri_validator
from .forms import CsvToDatabaseForm, QuickCsvToDatabaseForm


config = app.config
stats_logger = config.get("STATS_LOGGER")


def sqlalchemy_uri_form_validator(form: DynamicForm, field: StringField) -> None:
    """
        Check if user has submitted a valid SQLAlchemy URI
    """
    sqlalchemy_uri_validator(field.data, exception=ValidationError)


class DatabaseView(
    DatabaseMixin, SupersetModelView, DeleteMixin, YamlExportMixin
):  # noqa
    datamodel = SQLAInterface(models.Database)

    add_template = "superset/models/database/add.html"
    edit_template = "superset/models/database/edit.html"
    validators_columns = {"sqlalchemy_uri": [sqlalchemy_uri_form_validator]}

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


class BaseCsvToDatabaseView(SimpleFormView):
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

    def flash_schema_message_and_redirect(self, url, database, schema_name):
        message = _(
            'Database "{0}" Schema "{1}" is not allowed for csv uploads. '
            "Please contact Superset Admin".format(database.database_name, schema_name)
        )
        flash(message, "danger")
        return redirect(url)

    # TODO can be inlined when old upload is replaced with a react version as well
    def createdatabase(self, csv_filename):
        dbname = csv_filename[:-4]
        cwd = os.getcwd()
        dbpath = cwd + "/" + dbname + ".db"
        if os.path.isfile(dbpath):
            message = _(
                "Database file for {0} already exists, please choose a different name".format(
                    dbname
                )
            )
            flash(message, "danger")
            # propagate the exception
            raise Exception
        dview = DatabaseView()
        try:
            # Create Database and set the necessary attributes
            # TODO SQL Injection possible with add?
            item = dview.datamodel.obj()
            item.database_name = dbname
            item.sqlalchemy_uri = "sqlite:////" + dbpath
            item.allow_csv_upload = True
            item.perm = dbname
            db.session.add(item)
            return item
        except Exception as e:
            try:
                # TODO catch possible deletion error?
                db.session.delete(item)
                os.remove(dbpath)
            except OSError:
                pass
            message = (
                "Database name {} already exists. Please pick another".format(dbname)
                if isinstance(e, IntegrityError)
                else str(e)
            )
            flash(message, "danger")
            stats_logger.incr("failed_csv_upload")
            raise Exception


# TODO register as REST endpoint


class AddCsvEndpoint(BaseCsvToDatabaseView):
    __dbpath = ""
    __path = ""

    def check_and_save_csv(csv_file, csv_filename):
        __path = os.path.join(config["UPLOAD_FOLDER"], csv_filename)
        try:
            utils.ensure_path_exists(config["UPLOAD_FOLDER"])
            csv_file.save(__path)
        except Exception:
            os.remove(__path)

    def createtable(self, formdata, database, database_id):
        try:
            table = SqlaTable(table_name=formdata["tableName"])
            table.database = database
            table.database_id = table.database.id
            table.database.db_engine_spec.json_create_table_from_csv(formdata, table)
            return table
        except Exception as e:
            try:
                # TODO Decide whether to remove Database and db file as well here
                if database_id == -1:
                    os.remove(self.__dbpath)
                    db.session.remove(database)
                os.remove(self.__path)
            except OSError:
                pass
            message = (
                "Table name {} already exists. Please pick another".format(
                    formdata["tableName"]
                )
                if isinstance(e, IntegrityError)
                else str(e)
            )
            flash(message, "danger")
            stats_logger.incr("failed_csv_upload")
            return redirect("/quickcsvtodatabaseview/form")

    def getdatabasebyid(database_id):

        dbs = db.session.query(models.Database).filter_by(Id=database_id).all()
        if len(dbs) != 1:
            message = _(
                "Database inconsistency, several possible databases found, please contact your administrator "
                "(several Databases with the matching ID found"
            )
            flash(message, "danger")
            return redirect("/quickcsvtodatabaseview/form")
        return dbs[0]

    def createdatabase(self, db_name):
        __dbpath = os.getcwd() + "/" + db_name + ".db"
        if os.path.isfile(__dbpath):
            message = _(
                "Database file for {0} already exists, please choose a different name".format(
                    db_name
                )
            )
            flash(message, "danger")
            # propagate the exception
            raise Exception
        dview = DatabaseView()
        try:
            # Create Database and set the necessary attributes
            # TODO SQL Injection possible with add?
            item = dview.datamodel.obj()
            item.database_name = db_name
            item.sqlalchemy_uri = "sqlite:////" + __dbpath
            item.allow_csv_upload = True
            item.perm = db_name
            db.session.add(item)
            return item
        except Exception as e:
            try:
                # TODO catch possible deletion error?
                db.session.delete(item)
                os.remove(__dbpath)
            except OSError:
                pass
            message = (
                "Database name {} already exists. Please pick another".format(db_name)
                if isinstance(e, IntegrityError)
                else str(e)
            )
            flash(message, "danger")
            stats_logger.incr("failed_csv_upload")
            raise Exception

    def post(self, csv_file, json_data):
        formdata = json.load(json_data)
        database_id = formdata["database_id"]
        # check for possible SQL-injection, filter_by does not sanitize the input therefore we have to check
        # this beforehand

        if not database_id.isdigit():
            message = _(
                "possible tampering detected, non-numeral character in database-id"
            )
            flash(message, "danger")
            return redirect("/quickcsvtodatabaseview/form")
        schema_name = formdata["schema"] if "schema" in formdata else ""
        # TODO create unique filename if secure_filename() returns an empty name
        csv_filename = secure_filename(csv_file.filename)
        if len(csv_filename) == 0:
            message = _("Filename is not allowed")
            flash(message, "danger")
            return redirect("/quickcsvtodatabaseview/form")
        if database_id != -1:
            database = self.getdatabasebyid(database_id)
            if not self.is_schema_allowed(database, schema_name):
                self.flash_schema_message_and_redirect(
                    "/quickcsvtodatabaseview/form", database, schema_name
                )
        else:
            try:
                db_name = secure_filename(["db_name"])

                database = self.createdatabase(db_name)
            except Exception:
                return redirect("/quickcsvtodatabaseview/form")
        self.check_and_save_csv(csv_file, csv_filename)
        table = self.createtable(self, formdata, database, database_id)
        os.remove(self.__path)
        # Go back to welcome page / splash screen
        db_name = table.database.database_name
        message = _(
            'CSV file "{0}" uploaded to table "{1}" in '
            'database "{2}"'.format(csv_filename, formdata["tableName"], db_name)
        )
        flash(message, "info")
        stats_logger.incr("successful_csv_upload")
        return redirect("/tablemodelview/list/")


class CsvToDatabaseView(BaseCsvToDatabaseView):
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
            self.flash_schema_message_and_redirect(
                "/csvtodatabaseview/form", database, schema_name
            )

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


appbuilder.add_view_no_menu(CsvToDatabaseView)


def create_connection(engine):
    # TODO call the add API with default values, propagate Exceptions

    pass


class QuickCsvToDatabaseView(BaseCsvToDatabaseView):
    form = QuickCsvToDatabaseForm
    form_template = "superset/form_view/quick_csv_to_database_view/quick_edit.html"
    form_title = _("Quick CSV to Database configuration")
    add_columns = ["database", "schema", "table_name"]

    def form_get(self, form):
        form.sep.data = ","
        form.header.data = 0
        form.decimal.data = "."
        form.if_exists.data = "fail"

    def form_post(self, form):
        # NOTE when debugging, this fails due to Sqlite3 ProgrammingError,
        # objects created in different thread cannot be used
        # TODO Test if Exception handling works
        database = form.con.data
        schema_name = ""
        if not database.id == -1 and not self.is_schema_allowed(database, schema_name):
            self.flash_schema_message_and_redirect(
                "/quickcsvtodatabaseview/form", database, schema_name
            )
        csv_file = form.csv_file.data
        form.csv_file.data.filename = secure_filename(form.csv_file.data.filename)
        csv_filename = form.csv_file.data.filename
        path = os.path.join(config["UPLOAD_FOLDER"], csv_filename)
        # to here
        if database.id == -1:
            try:
                database = self.createdatabase(csv_filename)
            except Exception:
                return redirect("/quickcsvtodatabaseview/form")
        try:
            form.con.data = database
            utils.ensure_path_exists(config["UPLOAD_FOLDER"])
            csv_file.save(path)
            table = SqlaTable(table_name=form.name.data)
            table.database = form.data.get("con")  # form.con.data
            table.database_id = table.database.id
            table.database.db_engine_spec.alt_create_table_from_csv(form, table)
        except Exception as e:
            try:
                # TODO Decide whether to remove Database and Database file as well here
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
            return redirect("/quickcsvtodatabaseview/form")

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


appbuilder.add_view_no_menu(QuickCsvToDatabaseView)


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
