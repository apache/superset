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
import logging
import re

from flask import current_app, g
from flask_babel import lazy_gettext as _
from marshmallow import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database
from superset.views.base import get_datasource_exist_error_msg

logger = logging.getLogger(__name__)


def validate_python_date_format(value):
    regex = re.compile(
        r"""
        ^(
            epoch_s|epoch_ms|
            (?P<date>%Y(-%m(-%d)?)?)([\sT](?P<time>%H(:%M(:%S(\.%f)?)?)?))?
        )$
        """,
        re.VERBOSE,
    )
    match = regex.match(value or "")
    if not match:
        raise ValidationError(_("Invalid date/timestamp format"))


def validate_database(value):
    item = (
        current_app.appbuilder.get_session.query(Database)
        .filter_by(id=value)
        .one_or_none()
    )
    if not item:
        g.tmp_database = None
        raise ValidationError(_("Database does not exist"))
    g.tmp_database = item


def validate_table_exists(table: SqlaTable):
    table_name: str = table.table_name
    try:
        table.database.get_table(table_name, schema=table.schema)
    except SQLAlchemyError as e:
        logger.error(f"Got an error {e} validating table: {table_name}")
        raise ValidationError(
            _(
                f"Table [{table_name}] could not be found, "
                "please double check your "
                "database connection, schema, and "
                f"table name, error: {e}"
            ),
            field_names=["table_name"],
        )


def validate_table_uniqueness(table: SqlaTable):
    database_id: int = table.database.id
    table_name: str = table.table_name

    with current_app.appbuilder.get_session.no_autoflush:
        table_query = current_app.appbuilder.get_session.query(SqlaTable).filter(
            SqlaTable.table_name == table_name, SqlaTable.database_id == database_id
        )
        if current_app.appbuilder.get_session.query(table_query.exists()).scalar():
            raise ValidationError(
                get_datasource_exist_error_msg(table_name), field_names=["table_name"]
            )


def validate_table_column_name(column_name: str):
    if not column_name:
        raise ValidationError("Missing data for required field.")
    session = current_app.appbuilder.get_session

    with session.no_autoflush:
        table_query = session.query(TableColumn).filter(
            TableColumn.column_name == column_name
        )
        if session.query(table_query.exists()).scalar():
            raise ValidationError(
                f"Column {column_name} already exists"
            )
