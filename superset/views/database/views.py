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
from wtforms.fields import StringField
from wtforms.validators import ValidationError

import superset.models.core as models
from superset import app, db
from superset.connectors.sqla.models import SqlaTable
from superset.constants import RouteMethod
from superset.exceptions import CertificateException
from superset.utils import core as utils
from superset.views.base import DeleteMixin, SupersetModelView, YamlExportMixin

from .forms import CsvToDatabaseForm
from .mixins import DatabaseMixin
from .validators import schema_allows_csv_upload, sqlalchemy_uri_validator

if TYPE_CHECKING:
    from werkzeug.datastructures import FileStorage  # pylint: disable=unused-import

config = app.config
stats_logger = config["STATS_LOGGER"]


def sqlalchemy_uri_form_validator(_, field: StringField) -> None:
    """
        Check if user has submitted a valid SQLAlchemy URI
    """
    sqlalchemy_uri_validator(field.data, exception=ValidationError)


def certificate_form_validator(_, field: StringField) -> None:
    """
        Check if user has submitted a valid SSL certificate
    """
    if field.data:
        try:
            utils.parse_ssl_cert(field.data)
        except CertificateException as ex:
            raise ValidationError(ex.message)


def upload_stream_write(form_file_field: "FileStorage", path: str):
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

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)


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

        if not schema_allows_csv_upload(database, schema_name):
            message = _(
                'Database "%(database_name)s" schema "%(schema_name)s" '
                "is not allowed for csv uploads. Please contact your Superset Admin.",
                database_name=database.database_name,
                schema_name=schema_name,
            )
            flash(message, "danger")
            return redirect("/csvtodatabaseview/form")

        csv_filename = form.csv_file.data.filename
        extension = os.path.splitext(csv_filename)[1].lower()
        path = tempfile.NamedTemporaryFile(
            dir=app.config["UPLOAD_FOLDER"], suffix=extension, delete=False
        ).name
        form.csv_file.data.filename = path

        try:
            utils.ensure_path_exists(config["UPLOAD_FOLDER"])
            upload_stream_write(form.csv_file.data, path)
            table_name = form.name.data

            con = form.data.get("con")
            database = (
                db.session.query(models.Database).filter_by(id=con.data.get("id")).one()
            )
            database.db_engine_spec.create_table_from_csv(form, database)
            table = (
                db.session.query(SqlaTable)
                .filter_by(
                    table_name=table_name,
                    schema=form.schema.data,
                    database_id=database.id,
                )
                .one_or_none()
            )
            if table:
                table.fetch_metadata()
            if not table:
                table = SqlaTable(table_name=table_name)
                table.database = database
                table.database_id = database.id
                table.user_id = g.user.id
                table.schema = form.schema.data
                table.fetch_metadata()
                db.session.add(table)
            db.session.commit()
        except Exception as e:  # pylint: disable=broad-except
            db.session.rollback()
            try:
                os.remove(path)
            except OSError:
                pass
            message = _(
                'Unable to upload CSV file "%(filename)s" to table '
                '"%(table_name)s" in database "%(db_name)s". '
                "Error message: %(error_msg)s",
                filename=csv_filename,
                table_name=form.name.data,
                db_name=database.database_name,
                error_msg=str(e),
            )

            flash(message, "danger")
            stats_logger.incr("failed_csv_upload")
            return redirect("/csvtodatabaseview/form")

        os.remove(path)
        # Go back to welcome page / splash screen
        message = _(
            'CSV file "%(csv_filename)s" uploaded to table "%(table_name)s" in '
            'database "%(db_name)s"',
            csv_filename=csv_filename,
            table_name=form.name.data,
            db_name=table.database.database_name,
        )
        flash(message, "info")
        stats_logger.incr("successful_csv_upload")
        return redirect("/tablemodelview/list/")
