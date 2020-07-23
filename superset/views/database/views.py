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
import tempfile
from typing import TYPE_CHECKING

from flask import flash, g, redirect
from flask_appbuilder import SimpleFormView
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from werkzeug.wrappers import Response
from wtforms.fields import StringField
from wtforms.validators import ValidationError

import superset.models.core as models
from superset import app, db
from superset.connectors.sqla.models import SqlaTable
from superset.constants import RouteMethod
from superset.exceptions import CertificateException
from superset.sql_parse import Table
from superset.utils import core as utils
from superset.views.base import DeleteMixin, SupersetModelView, YamlExportMixin

from .forms import CsvToDatabaseForm, ExcelToDatabaseForm
from .mixins import DatabaseMixin
from .validators import schema_allows_csv_upload, sqlalchemy_uri_validator

if TYPE_CHECKING:
    from werkzeug.datastructures import FileStorage  # pylint: disable=unused-import

config = app.config
stats_logger = config["STATS_LOGGER"]


def sqlalchemy_uri_form_validator(_: _, field: StringField) -> None:
    """
        Check if user has submitted a valid SQLAlchemy URI
    """

    sqlalchemy_uri_validator(field.data, exception=ValidationError)


def certificate_form_validator(_: _, field: StringField) -> None:
    """
        Check if user has submitted a valid SSL certificate
    """
    if field.data:
        try:
            utils.parse_ssl_cert(field.data)
        except CertificateException as ex:
            raise ValidationError(ex.message)


def upload_stream_write(form_file_field: "FileStorage", path: str) -> None:
    chunk_size = app.config["UPLOAD_CHUNK_SIZE"]
    with open(path, "bw") as file_description:
        while True:
            chunk = form_file_field.stream.read(chunk_size)
            if not chunk:
                break
            file_description.write(chunk)


class DatabaseView(
    DatabaseMixin, SupersetModelView, DeleteMixin, YamlExportMixin
):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(models.Database)
    include_route_methods = RouteMethod.CRUD_SET

    add_template = "superset/models/database/add.html"
    edit_template = "superset/models/database/edit.html"
    validators_columns = {
        "sqlalchemy_uri": [sqlalchemy_uri_form_validator],
        "server_cert": [certificate_form_validator],
    }

    yaml_dict_key = "databases"

    def _delete(self, pk: int) -> None:
        DeleteMixin._delete(self, pk)


class CsvToDatabaseView(SimpleFormView):
    form = CsvToDatabaseForm
    form_template = "superset/form_view/csv_to_database_view/edit.html"
    form_title = _("CSV to Database configuration")
    add_columns = ["database", "schema", "table_name"]

    def form_get(self, form: CsvToDatabaseForm) -> None:
        form.sep.data = ","
        form.header.data = 0
        form.mangle_dupe_cols.data = True
        form.skipinitialspace.data = False
        form.skip_blank_lines.data = True
        form.infer_datetime_format.data = True
        form.decimal.data = "."
        form.if_exists.data = "fail"

    def form_post(self, form: CsvToDatabaseForm) -> Response:
        database = form.con.data
        csv_table = Table(table=form.name.data, schema=form.schema.data)

        if not schema_allows_csv_upload(database, csv_table.schema):
            message = _(
                'Database "%(database_name)s" schema "%(schema_name)s" '
                "is not allowed for csv uploads. Please contact your Superset Admin.",
                database_name=database.database_name,
                schema_name=csv_table.schema,
            )
            flash(message, "danger")
            return redirect("/csvtodatabaseview/form")

        if "." in csv_table.table and csv_table.schema:
            message = _(
                "You cannot specify a namespace both in the name of the table: "
                '"%(csv_table.table)s" and in the schema field: '
                '"%(csv_table.schema)s". Please remove one',
                table=csv_table.table,
                schema=csv_table.schema,
            )
            flash(message, "danger")
            return redirect("/csvtodatabaseview/form")

        uploaded_tmp_file_path = tempfile.NamedTemporaryFile(
            dir=app.config["UPLOAD_FOLDER"],
            suffix=os.path.splitext(form.csv_file.data.filename)[1].lower(),
            delete=False,
        ).name

        try:
            utils.ensure_path_exists(config["UPLOAD_FOLDER"])
            upload_stream_write(form.csv_file.data, uploaded_tmp_file_path)

            con = form.data.get("con")
            database = (
                db.session.query(models.Database).filter_by(id=con.data.get("id")).one()
            )

            # More can be found here:
            # https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.read_csv.html
            csv_to_df_kwargs = {
                "sep": form.sep.data,
                "header": form.header.data if form.header.data else 0,
                "index_col": form.index_col.data,
                "mangle_dupe_cols": form.mangle_dupe_cols.data,
                "skipinitialspace": form.skipinitialspace.data,
                "skiprows": form.skiprows.data,
                "nrows": form.nrows.data,
                "skip_blank_lines": form.skip_blank_lines.data,
                "parse_dates": form.parse_dates.data,
                "infer_datetime_format": form.infer_datetime_format.data,
                "chunksize": 1000,
            }
            if form.null_values.data:
                csv_to_df_kwargs["na_values"] = form.null_values.data
                csv_to_df_kwargs["keep_default_na"] = False

            # More can be found here:
            # https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.DataFrame.to_sql.html
            df_to_sql_kwargs = {
                "name": csv_table.table,
                "if_exists": form.if_exists.data,
                "index": form.index.data,
                "index_label": form.index_label.data,
                "chunksize": 1000,
            }
            database.db_engine_spec.create_table_from_csv(
                uploaded_tmp_file_path,
                csv_table,
                database,
                csv_to_df_kwargs,
                df_to_sql_kwargs,
            )

            # Connect table to the database that should be used for exploration.
            # E.g. if hive was used to upload a csv, presto will be a better option
            # to explore the table.
            expore_database = database
            explore_database_id = database.explore_database_id
            if explore_database_id:
                expore_database = (
                    db.session.query(models.Database)
                    .filter_by(id=explore_database_id)
                    .one_or_none()
                    or database
                )

            sqla_table = (
                db.session.query(SqlaTable)
                .filter_by(
                    table_name=csv_table.table,
                    schema=csv_table.schema,
                    database_id=expore_database.id,
                )
                .one_or_none()
            )

            if sqla_table:
                sqla_table.fetch_metadata()
            if not sqla_table:
                sqla_table = SqlaTable(table_name=csv_table.table)
                sqla_table.database = expore_database
                sqla_table.database_id = database.id
                sqla_table.user_id = g.user.id
                sqla_table.schema = csv_table.schema
                sqla_table.fetch_metadata()
                db.session.add(sqla_table)
            db.session.commit()
        except Exception as ex:  # pylint: disable=broad-except
            db.session.rollback()
            try:
                os.remove(uploaded_tmp_file_path)
            except OSError:
                pass
            message = _(
                'Unable to upload CSV file "%(filename)s" to table '
                '"%(table_name)s" in database "%(db_name)s". '
                "Error message: %(error_msg)s",
                filename=form.csv_file.data.filename,
                table_name=form.name.data,
                db_name=database.database_name,
                error_msg=str(ex),
            )

            flash(message, "danger")
            stats_logger.incr("failed_csv_upload")
            return redirect("/csvtodatabaseview/form")

        os.remove(uploaded_tmp_file_path)
        # Go back to welcome page / splash screen
        message = _(
            'CSV file "%(csv_filename)s" uploaded to table "%(table_name)s" in '
            'database "%(db_name)s"',
            csv_filename=form.csv_file.data.filename,
            table_name=str(csv_table),
            db_name=sqla_table.database.database_name,
        )
        flash(message, "info")
        stats_logger.incr("successful_csv_upload")
        return redirect("/tablemodelview/list/")


class ExcelToDatabaseView(SimpleFormView):
    form = ExcelToDatabaseForm
    form_template = "superset/form_view/excel_to_database_view/edit.html"
    form_title = _("Excel to Database configuration")
    add_columns = ["database", "schema", "table_name"]

    def form_get(self, form: ExcelToDatabaseForm) -> None:
        form.header.data = 0
        form.mangle_dupe_cols.data = True
        form.skipinitialspace.data = False
        form.decimal.data = "."
        form.if_exists.data = "fail"
        form.sheet_name = None

    def form_post(self, form: ExcelToDatabaseForm) -> Response:
        database = form.con.data
        excel_table = Table(table=form.name.data, schema=form.schema.data)

        if not schema_allows_csv_upload(database, excel_table.schema):
            message = _(
                'Database "%(database_name)s" schema "%(schema_name)s" '
                "is not allowed for excel uploads. Please contact your Superset Admin.",
                database_name=database.database_name,
                schema_name=excel_table.schema,
            )
            flash(message, "danger")
            return redirect("/exceltodatabaseview/form")

        if "." in excel_table.table and excel_table.schema:
            message = _(
                "You cannot specify a namespace both in the name of the table: "
                '"%(excel_table.table)s" and in the schema field: '
                '"%(excel_table.schema)s". Please remove one',
                table=excel_table.table,
                schema=excel_table.schema,
            )
            flash(message, "danger")
            return redirect("/exceltodatabaseview/form")

        uploaded_tmp_file_path = tempfile.NamedTemporaryFile(
            dir=app.config["UPLOAD_FOLDER"],
            suffix=os.path.splitext(form.excel_file.data.filename)[1].lower(),
            delete=False,
        ).name

        try:
            utils.ensure_path_exists(config["UPLOAD_FOLDER"])
            upload_stream_write(form.excel_file.data, uploaded_tmp_file_path)

            con = form.data.get("con")
            database = (
                db.session.query(models.Database).filter_by(id=con.data.get("id")).one()
            )
            excel_to_df_kwargs = {
                "header": form.header.data if form.header.data else 0,
                "index_col": form.index_col.data,
                "mangle_dupe_cols": form.mangle_dupe_cols.data,
                "skipinitialspace": form.skipinitialspace.data,
                "skiprows": form.skiprows.data,
                "nrows": form.nrows.data,
                "sheet_name": form.sheet_name.data,
                "chunksize": 1000,
            }
            df_to_sql_kwargs = {
                "name": excel_table.table,
                "if_exists": form.if_exists.data,
                "index": form.index.data,
                "index_label": form.index_label.data,
                "chunksize": 1000,
            }
            database.db_engine_spec.create_table_from_excel(
                uploaded_tmp_file_path,
                excel_table,
                database,
                excel_to_df_kwargs,
                df_to_sql_kwargs,
            )

            # Connect table to the database that should be used for exploration.
            # E.g. if hive was used to upload a excel, presto will be a better option
            # to explore the table.
            expore_database = database
            explore_database_id = database.get_extra().get("explore_database_id", None)
            if explore_database_id:
                expore_database = (
                    db.session.query(models.Database)
                    .filter_by(id=explore_database_id)
                    .one_or_none()
                    or database
                )

            sqla_table = (
                db.session.query(SqlaTable)
                .filter_by(
                    table_name=excel_table.table,
                    schema=excel_table.schema,
                    database_id=expore_database.id,
                )
                .one_or_none()
            )

            if sqla_table:
                sqla_table.fetch_metadata()
            if not sqla_table:
                sqla_table = SqlaTable(table_name=excel_table.table)
                sqla_table.database = expore_database
                sqla_table.database_id = database.id
                sqla_table.user_id = g.user.id
                sqla_table.schema = excel_table.schema
                sqla_table.fetch_metadata()
                db.session.add(sqla_table)
            db.session.commit()
        except Exception as ex:  # pylint: disable=broad-except
            db.session.rollback()
            try:
                os.remove(uploaded_tmp_file_path)
            except OSError:
                pass
            message = _(
                'Unable to upload Excel file "%(filename)s" to table '
                '"%(table_name)s" in database "%(db_name)s". '
                "Error message: %(error_msg)s",
                filename=form.excel_file.data.filename,
                table_name=form.name.data,
                db_name=database.database_name,
                error_msg=str(ex),
            )

            flash(message, "danger")
            stats_logger.incr("failed_excel_upload")
            return redirect("/exceltodatabaseview/form")

        os.remove(uploaded_tmp_file_path)
        # Go back to welcome page / splash screen
        message = _(
            'CSV file "%(excel_filename)s" uploaded to table "%(table_name)s" in '
            'database "%(db_name)s"',
            excel_filename=form.excel_file.data.filename,
            table_name=str(excel_table),
            db_name=sqla_table.database.database_name,
        )
        flash(message, "info")
        stats_logger.incr("successful_excel_upload")
        return redirect("/tablemodelview/list/")
