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
"""Contains the logic to create cohesive forms on the explore view"""

from flask_appbuilder.fields import QuerySelectField
from flask_appbuilder.fieldwidgets import BS3TextFieldWidget
from flask_appbuilder.forms import DynamicForm
from flask_babel import lazy_gettext as _
from flask_wtf.file import FileAllowed
from wtforms import BooleanField, MultipleFileField, SelectField, StringField
from wtforms.validators import DataRequired, Optional, Regexp

from superset import app, db, security_manager
from superset.forms import JsonListField
from superset.models.core import Database

config = app.config


class UploadToDatabaseForm(DynamicForm):
    @staticmethod
    def file_allowed_dbs() -> list[Database]:
        file_enabled_dbs = (
            db.session.query(Database).filter_by(allow_file_upload=True).all()
        )
        return [
            file_enabled_db
            for file_enabled_db in file_enabled_dbs
            if UploadToDatabaseForm.at_least_one_schema_is_allowed(file_enabled_db)
            and UploadToDatabaseForm.is_engine_allowed_to_file_upl(file_enabled_db)
        ]

    @staticmethod
    def at_least_one_schema_is_allowed(database: Database) -> bool:
        """
        If the user has access to the database or all datasource
            1. if schemas_allowed_for_file_upload is empty
                a) if database does not support schema
                    user is able to upload csv without specifying schema name
                b) if database supports schema
                    user is able to upload csv to any schema
            2. if schemas_allowed_for_file_upload is not empty
                a) if database does not support schema
                    This situation is impossible and upload will fail
                b) if database supports schema
                    user is able to upload to schema in schemas_allowed_for_file_upload
        elif the user does not access to the database or all datasource
            1. if schemas_allowed_for_file_upload is empty
                a) if database does not support schema
                    user is unable to upload csv
                b) if database supports schema
                    user is unable to upload csv
            2. if schemas_allowed_for_file_upload is not empty
                a) if database does not support schema
                    This situation is impossible and user is unable to upload csv
                b) if database supports schema
                    user is able to upload to schema in schemas_allowed_for_file_upload
        """
        if security_manager.can_access_database(database):
            return True
        schemas = database.get_schema_access_for_file_upload()
        if schemas and security_manager.get_schemas_accessible_by_user(
            database, schemas, False
        ):
            return True
        return False

    @staticmethod
    def is_engine_allowed_to_file_upl(database: Database) -> bool:
        """
        This method is mainly used for existing Gsheets and Clickhouse DBs
        that have allow_file_upload set as True but they are no longer valid
        DBs for file uploading.
        New GSheets and Clickhouse DBs won't have the option to set
        allow_file_upload set as True.
        """
        if database.db_engine_spec.supports_file_upload:
            return True
        return False


class ColumnarToDatabaseForm(UploadToDatabaseForm):
    name = StringField(
        _("Table Name"),
        description=_("Name of table to be created from columnar data."),
        validators=[
            DataRequired(),
            Regexp(r"^[^\.]+$", message=_("Table name cannot contain a schema")),
        ],
        widget=BS3TextFieldWidget(),
    )
    columnar_file = MultipleFileField(
        _("Columnar File"),
        description=_("Select a Columnar file to be uploaded to a database."),
        validators=[
            DataRequired(),
            FileAllowed(
                config["ALLOWED_EXTENSIONS"].intersection(
                    config["COLUMNAR_EXTENSIONS"]
                ),
                _(
                    "Only the following file extensions are allowed: "
                    "%(allowed_extensions)s",
                    allowed_extensions=", ".join(
                        config["ALLOWED_EXTENSIONS"].intersection(
                            config["COLUMNAR_EXTENSIONS"]
                        )
                    ),
                ),
            ),
        ],
    )

    database = QuerySelectField(
        _("Database"),
        query_func=UploadToDatabaseForm.file_allowed_dbs,
        get_pk_func=lambda a: a.id,
        get_label=lambda a: a.database_name,
    )
    schema = StringField(
        _("Schema"),
        description=_("Specify a schema (if database flavor supports this)."),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
    )
    if_exists = SelectField(
        _("Table Exists"),
        description=_(
            "If table exists do one of the following: "
            "Fail (do nothing), Replace (drop and recreate table) "
            "or Append (insert data)."
        ),
        choices=[
            ("fail", _("Fail")),
            ("replace", _("Replace")),
            ("append", _("Append")),
        ],
        validators=[DataRequired()],
    )
    usecols = JsonListField(
        _("Use Columns"),
        default=None,
        description=_(
            "Json list of the column names that should be read. "
            "If not None, only these columns will be read from the file."
        ),
        validators=[Optional()],
    )
    index = BooleanField(
        _("Dataframe Index"), description=_("Write dataframe index as a column.")
    )
    index_label = StringField(
        _("Column Label(s)"),
        description=_(
            "Column label for index column(s). If None is given "
            "and Dataframe Index is True, Index Names are used."
        ),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
    )
