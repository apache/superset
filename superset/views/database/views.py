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
import io
import os
import tempfile
import zipfile
from typing import TYPE_CHECKING

import pandas as pd
from flask import flash, g, redirect
from flask_appbuilder import expose, SimpleFormView
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import gettext as __, lazy_gettext as _
from werkzeug.wrappers import Response
from wtforms.fields import StringField
from wtforms.validators import ValidationError

import superset.models.core as models
from superset import app, db
from superset.connectors.sqla.models import SqlaTable
from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.exceptions import CertificateException
from superset.extensions import event_logger
from superset.sql_parse import Table
from superset.superset_typing import FlaskResponse
from superset.utils import core as utils
from superset.views.base import DeleteMixin, SupersetModelView, YamlExportMixin

from .forms import ColumnarToDatabaseForm, CsvToDatabaseForm, ExcelToDatabaseForm
from .mixins import DatabaseMixin
from .validators import schema_allows_file_upload, sqlalchemy_uri_validator

if TYPE_CHECKING:
    from werkzeug.datastructures import FileStorage

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
            raise ValidationError(ex.message) from ex


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

    class_permission_name = "Database"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

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

    @expose("/list/")
    @has_access
    def list(self) -> FlaskResponse:
        return super().render_app_template()


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

        if not schema_allows_file_upload(database, csv_table.schema):
            message = __(
                'Database "%(database_name)s" schema "%(schema_name)s" '
                "is not allowed for csv uploads. Please contact your Superset Admin.",
                database_name=database.database_name,
                schema_name=csv_table.schema,
            )
            flash(message, "danger")
            return redirect("/csvtodatabaseview/form")

        try:
            df = pd.concat(
                pd.read_csv(
                    chunksize=1000,
                    encoding="utf-8",
                    filepath_or_buffer=form.csv_file.data,
                    header=form.header.data if form.header.data else 0,
                    index_col=form.index_col.data,
                    infer_datetime_format=form.infer_datetime_format.data,
                    iterator=True,
                    keep_default_na=not form.null_values.data,
                    mangle_dupe_cols=form.mangle_dupe_cols.data,
                    usecols=form.usecols.data if form.usecols.data else None,
                    na_values=form.null_values.data if form.null_values.data else None,
                    nrows=form.nrows.data,
                    parse_dates=form.parse_dates.data,
                    sep=form.sep.data,
                    skip_blank_lines=form.skip_blank_lines.data,
                    skipinitialspace=form.skipinitialspace.data,
                    skiprows=form.skiprows.data,
                )
            )

            database = (
                db.session.query(models.Database)
                .filter_by(id=form.data.get("con").data.get("id"))
                .one()
            )

            database.db_engine_spec.df_to_sql(
                database,
                csv_table,
                df,
                to_sql_kwargs={
                    "chunksize": 1000,
                    "if_exists": form.if_exists.data,
                    "index": form.index.data,
                    "index_label": form.index_label.data,
                },
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
                sqla_table.owners = [g.user]
                sqla_table.schema = csv_table.schema
                sqla_table.fetch_metadata()
                db.session.add(sqla_table)
            db.session.commit()
        except Exception as ex:  # pylint: disable=broad-except
            db.session.rollback()
            message = __(
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

        # Go back to welcome page / splash screen
        message = __(
            'CSV file "%(csv_filename)s" uploaded to table "%(table_name)s" in '
            'database "%(db_name)s"',
            csv_filename=form.csv_file.data.filename,
            table_name=str(csv_table),
            db_name=sqla_table.database.database_name,
        )
        flash(message, "info")
        event_logger.log_with_context(
            action="successful_csv_upload",
            database=form.con.data.name,
            schema=form.schema.data,
            table=form.name.data,
        )
        return redirect("/tablemodelview/list/")


class ExcelToDatabaseView(SimpleFormView):
    form = ExcelToDatabaseForm
    form_template = "superset/form_view/excel_to_database_view/edit.html"
    form_title = _("Excel to Database configuration")
    add_columns = ["database", "schema", "table_name"]

    def form_get(self, form: ExcelToDatabaseForm) -> None:
        form.header.data = 0
        form.mangle_dupe_cols.data = True
        form.decimal.data = "."
        form.if_exists.data = "fail"
        form.sheet_name.data = ""

    def form_post(self, form: ExcelToDatabaseForm) -> Response:
        database = form.con.data
        excel_table = Table(table=form.name.data, schema=form.schema.data)

        if not schema_allows_file_upload(database, excel_table.schema):
            message = __(
                'Database "%(database_name)s" schema "%(schema_name)s" '
                "is not allowed for excel uploads. Please contact your Superset Admin.",
                database_name=database.database_name,
                schema_name=excel_table.schema,
            )
            flash(message, "danger")
            return redirect("/exceltodatabaseview/form")

        uploaded_tmp_file_path = (
            tempfile.NamedTemporaryFile(  # pylint: disable=consider-using-with
                dir=app.config["UPLOAD_FOLDER"],
                suffix=os.path.splitext(form.excel_file.data.filename)[1].lower(),
                delete=False,
            ).name
        )

        try:
            utils.ensure_path_exists(config["UPLOAD_FOLDER"])
            upload_stream_write(form.excel_file.data, uploaded_tmp_file_path)

            df = pd.read_excel(
                header=form.header.data if form.header.data else 0,
                index_col=form.index_col.data,
                io=form.excel_file.data,
                keep_default_na=not form.null_values.data,
                mangle_dupe_cols=form.mangle_dupe_cols.data,
                na_values=form.null_values.data if form.null_values.data else None,
                parse_dates=form.parse_dates.data,
                skiprows=form.skiprows.data,
                sheet_name=form.sheet_name.data if form.sheet_name.data else 0,
            )

            database = (
                db.session.query(models.Database)
                .filter_by(id=form.data.get("con").data.get("id"))
                .one()
            )

            database.db_engine_spec.df_to_sql(
                database,
                excel_table,
                df,
                to_sql_kwargs={
                    "chunksize": 1000,
                    "if_exists": form.if_exists.data,
                    "index": form.index.data,
                    "index_label": form.index_label.data,
                },
            )

            # Connect table to the database that should be used for exploration.
            # E.g. if hive was used to upload a excel, presto will be a better option
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
                sqla_table.owners = [g.user]
                sqla_table.schema = excel_table.schema
                sqla_table.fetch_metadata()
                db.session.add(sqla_table)
            db.session.commit()
        except Exception as ex:  # pylint: disable=broad-except
            db.session.rollback()
            message = __(
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

        # Go back to welcome page / splash screen
        message = __(
            'Excel file "%(excel_filename)s" uploaded to table "%(table_name)s" in '
            'database "%(db_name)s"',
            excel_filename=form.excel_file.data.filename,
            table_name=str(excel_table),
            db_name=sqla_table.database.database_name,
        )
        flash(message, "info")
        event_logger.log_with_context(
            action="successful_excel_upload",
            database=form.con.data.name,
            schema=form.schema.data,
            table=form.name.data,
        )
        return redirect("/tablemodelview/list/")


class ColumnarToDatabaseView(SimpleFormView):
    form = ColumnarToDatabaseForm
    form_template = "superset/form_view/columnar_to_database_view/edit.html"
    form_title = _("Columnar to Database configuration")
    add_columns = ["database", "schema", "table_name"]

    def form_get(self, form: ColumnarToDatabaseForm) -> None:
        form.if_exists.data = "fail"

    def form_post(  # pylint: disable=too-many-locals
        self, form: ColumnarToDatabaseForm
    ) -> Response:
        database = form.con.data
        columnar_table = Table(table=form.name.data, schema=form.schema.data)
        files = form.columnar_file.data
        file_type = {file.filename.split(".")[-1] for file in files}

        if file_type == {"zip"}:
            zipfile_ob = zipfile.ZipFile(  # pylint: disable=consider-using-with
                form.columnar_file.data[0]
            )  # pylint: disable=consider-using-with
            file_type = {filename.split(".")[-1] for filename in zipfile_ob.namelist()}
            files = [
                io.BytesIO((zipfile_ob.open(filename).read(), filename)[0])
                for filename in zipfile_ob.namelist()
            ]

        if len(file_type) > 1:
            message = __(
                "Multiple file extensions are not allowed for columnar uploads."
                " Please make sure all files are of the same extension.",
            )
            flash(message, "danger")
            return redirect("/columnartodatabaseview/form")

        read = pd.read_parquet
        kwargs = {
            "columns": form.usecols.data if form.usecols.data else None,
        }

        if not schema_allows_file_upload(database, columnar_table.schema):
            message = __(
                'Database "%(database_name)s" schema "%(schema_name)s" '
                "is not allowed for columnar uploads. "
                "Please contact your Superset Admin.",
                database_name=database.database_name,
                schema_name=columnar_table.schema,
            )
            flash(message, "danger")
            return redirect("/columnartodatabaseview/form")

        try:
            chunks = [read(file, **kwargs) for file in files]
            df = pd.concat(chunks)

            database = (
                db.session.query(models.Database)
                .filter_by(id=form.data.get("con").data.get("id"))
                .one()
            )

            database.db_engine_spec.df_to_sql(
                database,
                columnar_table,
                df,
                to_sql_kwargs={
                    "chunksize": 1000,
                    "if_exists": form.if_exists.data,
                    "index": form.index.data,
                    "index_label": form.index_label.data,
                },
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
                    table_name=columnar_table.table,
                    schema=columnar_table.schema,
                    database_id=expore_database.id,
                )
                .one_or_none()
            )

            if sqla_table:
                sqla_table.fetch_metadata()
            if not sqla_table:
                sqla_table = SqlaTable(table_name=columnar_table.table)
                sqla_table.database = expore_database
                sqla_table.database_id = database.id
                sqla_table.owners = [g.user]
                sqla_table.schema = columnar_table.schema
                sqla_table.fetch_metadata()
                db.session.add(sqla_table)
            db.session.commit()
        except Exception as ex:  # pylint: disable=broad-except
            db.session.rollback()
            message = __(
                'Unable to upload Columnar file "%(filename)s" to table '
                '"%(table_name)s" in database "%(db_name)s". '
                "Error message: %(error_msg)s",
                filename=[file.filename for file in form.columnar_file.data],
                table_name=form.name.data,
                db_name=database.database_name,
                error_msg=str(ex),
            )

            flash(message, "danger")
            stats_logger.incr("failed_columnar_upload")
            return redirect("/columnartodatabaseview/form")

        # Go back to welcome page / splash screen
        message = __(
            'Columnar file "%(columnar_filename)s" uploaded to table "%(table_name)s" '
            'in database "%(db_name)s"',
            columnar_filename=[file.filename for file in form.columnar_file.data],
            table_name=str(columnar_table),
            db_name=sqla_table.database.database_name,
        )
        flash(message, "info")
        event_logger.log_with_context(
            action="successful_columnar_upload",
            database=form.con.data.name,
            schema=form.schema.data,
            table=form.name.data,
        )
        return redirect("/tablemodelview/list/")
