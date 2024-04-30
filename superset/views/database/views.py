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
import zipfile
from typing import Any, TYPE_CHECKING

import pandas as pd
from flask import flash, g, redirect
from flask_appbuilder import expose, SimpleFormView
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
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

from .forms import ColumnarToDatabaseForm
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


class DatabaseView(DatabaseMixin, SupersetModelView, DeleteMixin, YamlExportMixin):  # pylint: disable=too-many-ancestors
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


class CustomFormView(SimpleFormView):
    """
    View for presenting your own forms
    Inherit from this view to provide some base
    processing for your customized form views.

    Notice that this class inherits from BaseView
    so all properties from the parent class can be overridden also.

    Implement form_get and form_post to implement
    your form pre-processing and post-processing
    """

    @expose("/form", methods=("GET",))
    @has_access
    def this_form_get(self) -> Any:
        self._init_vars()
        form = self.form.refresh()
        self.form_get(form)
        self.update_redirect()
        return self.render_template(
            self.form_template,
            title=self.form_title,
            form=form,
            appbuilder=self.appbuilder,
        )

    @expose("/form", methods=("POST",))
    @has_access
    def this_form_post(self) -> Any:
        self._init_vars()
        form = self.form.refresh()
        if form.validate_on_submit():
            response = self.form_post(form)  # pylint: disable=assignment-from-no-return
            if not response:
                return redirect(self.get_redirect())
            return response
        return self.render_template(
            self.form_template,
            title=self.form_title,
            form=form,
            appbuilder=self.appbuilder,
        )


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
        database = form.database.data
        columnar_table = Table(table=form.name.data, schema=form.schema.data)
        files = form.columnar_file.data
        file_type = {file.filename.split(".")[-1] for file in files}

        if file_type == {"zip"}:
            zipfile_ob = zipfile.ZipFile(  # pylint: disable=consider-using-with
                form.columnar_file.data[0]
            )
            file_type = {filename.split(".")[-1] for filename in zipfile_ob.namelist()}
            files = [
                # pylint: disable=consider-using-with
                io.BytesIO((zipfile_ob.open(filename).read(), filename)[0])
                for filename in zipfile_ob.namelist()
            ]

        if len(file_type) > 1:
            message = _(
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
            message = _(
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
                .filter_by(id=form.data.get("database").data.get("id"))
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
            explore_database = database
            explore_database_id = database.explore_database_id
            if explore_database_id:
                explore_database = (
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
                    database_id=explore_database.id,
                )
                .one_or_none()
            )

            if sqla_table:
                sqla_table.fetch_metadata()
            if not sqla_table:
                sqla_table = SqlaTable(table_name=columnar_table.table)
                sqla_table.database = explore_database
                sqla_table.database_id = database.id
                sqla_table.owners = [g.user]
                sqla_table.schema = columnar_table.schema
                sqla_table.fetch_metadata()
                db.session.add(sqla_table)
            db.session.commit()
        except Exception as ex:  # pylint: disable=broad-except
            db.session.rollback()
            message = _(
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
        message = _(
            'Columnar file "%(columnar_filename)s" uploaded to table "%(table_name)s" '
            'in database "%(db_name)s"',
            columnar_filename=[file.filename for file in form.columnar_file.data],
            table_name=str(columnar_table),
            db_name=sqla_table.database.database_name,
        )
        flash(message, "info")
        event_logger.log_with_context(
            action="successful_columnar_upload",
            database=form.database.data.name,
            schema=form.schema.data,
            table=form.name.data,
        )
        return redirect("/tablemodelview/list/")
