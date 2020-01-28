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
from typing import Dict, List

from flask import current_app, g
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from marshmallow import fields, post_load, validates_schema, ValidationError
from marshmallow.validate import Length
from sqlalchemy.exc import SQLAlchemyError

from superset.connectors.sqla.models import SqlaTable
from superset.constants import RouteMethod
from superset.models.core import Database
from superset.views.base import DatasourceFilter, get_datasource_exist_error_msg
from superset.views.base_api import BaseOwnedModelRestApi
from superset.views.base_schemas import BaseOwnedSchema, validate_owner

logger = logging.getLogger(__name__)


def validate_database(value):
    item = (
        current_app.appbuilder.get_session.query(Database)
        .filter_by(id=value)
        .one_or_none()
    )
    if not item:
        g.tmp_database = None
        raise ValidationError(_("Database does not exist"))
    # Database exists save it on g to save further db round trips
    g.tmp_database = item


def validate_table_exists(data: Dict):
    if "table_name" not in data:
        return
    table_name: str = data["table_name"]
    try:
        if g.tmp_database:
            g.tmp_database.get_table(table_name, schema=data.get("schema", ""))
    except SQLAlchemyError as e:
        logger.exception(f"Got an error {e} validating table: {table_name}")
        raise ValidationError(
            _(
                f"Table [{table_name}] could not be found, "
                "please double check your "
                "database connection, schema, and "
                f"table name, error: {e}"
            )
        )


def validate_table_uniqueness(data: Dict):
    if not ("database" in data and "table_name" in data):
        return
    database_name: str = data["database"]
    table_name: str = data["table_name"]

    with current_app.appbuilder.get_session.no_autoflush:
        table_query = current_app.appbuilder.get_session.query(SqlaTable).filter(
            SqlaTable.table_name == table_name, SqlaTable.database_id == database_name
        )
        if current_app.appbuilder.get_session.query(table_query.exists()).scalar():
            raise ValidationError(get_datasource_exist_error_msg(table_name))


class TablePostSchema(BaseOwnedSchema):
    __class_model__ = SqlaTable

    database = fields.Integer(validate=validate_database)
    schema = fields.String()
    table_name = fields.String(required=True, validate=Length(1, 250))
    owners = fields.List(fields.Integer(validate=validate_owner))

    @validates_schema
    def validate_schema(self, data: Dict):  # pylint: disable=no-self-use
        validate_table_uniqueness(data)
        validate_table_exists(data)

    @post_load
    def make_object(self, data: Dict, discard: List[str] = None) -> SqlaTable:
        instance = super().make_object(data, discard=["database"])
        instance.database = g.tmp_database
        return instance


class TablePutSchema(BaseOwnedSchema):
    __class_model__ = SqlaTable

    table_name = fields.String(allow_none=True, validate=Length(1, 250))
    sql = fields.String(allow_none=True)
    filter_select_enabled = fields.Boolean(allow_none=True)
    fetch_values_predicate = fields.String(allow_none=True, validate=Length(0, 1000))
    schema = fields.String(allow_none=True, validate=Length(1, 255))
    description = fields.String(allow_none=True)
    main_dttm_col = fields.String(allow_none=True)
    offset = fields.Integer(allow_none=True)
    default_endpoint = fields.String(allow_none=True)
    cache_timeout = fields.Integer(allow_none=True)
    is_sqllab_view = fields.Boolean(allow_none=True)
    template_params = fields.String(allow_none=True)
    owners = fields.List(fields.Integer(validate=validate_owner))

    @validates_schema
    def validate_schema(self, data: Dict):  # pylint: disable=no-self-use
        validate_table_exists(data)


class TableRestApi(BaseOwnedModelRestApi):
    datamodel = SQLAInterface(SqlaTable)
    base_filters = [["id", DatasourceFilter, lambda: []]]

    resource_name = "table"
    allow_browser_login = True

    class_permission_name = "TableModelView"
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {RouteMethod.RELATED}

    list_columns = [
        "database_name",
        "changed_by.username",
        "changed_on",
        "table_name",
        "schema",
    ]
    show_columns = [
        "database.database_name",
        "database.id",
        "table_name",
        "sql",
        "filter_select_enabled",
        "fetch_values_predicate",
        "schema",
        "description",
        "main_dttm_col",
        "offset",
        "default_endpoint",
        "cache_timeout",
        "is_sqllab_view",
        "template_params",
        "owners.id",
        "owners.username",
    ]
    add_model_schema = TablePostSchema()
    edit_model_schema = TablePutSchema()
    add_columns = ["database", "schema", "table_name", "owners"]
    edit_columns = [
        "table_name",
        "sql",
        "filter_select_enabled",
        "fetch_values_predicate",
        "schema",
        "description",
        "main_dttm_col",
        "offset",
        "default_endpoint",
        "cache_timeout",
        "is_sqllab_view",
        "template_params",
        "owners",
    ]
