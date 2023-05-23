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
from typing import Any, Dict, List, Optional, Pattern, Tuple, Type
from urllib import parse

from flask_babel import gettext as __
from sqlalchemy import Integer, Numeric, types
from sqlalchemy.engine import Inspector
from sqlalchemy.engine.result import Row as ResultRow
from sqlalchemy.engine.url import URL
from sqlalchemy.sql.type_api import TypeEngine

from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.errors import SupersetErrorType
from superset.utils.core import GenericDataType

# Regular expressions to catch custom errors
CONNECTION_ACCESS_DENIED_REGEX = re.compile(
    "Access denied for user '(?P<username>.*?)'"
)
CONNECTION_UNKNOWN_DATABASE_REGEX = re.compile("Unknown database '(?P<database>.*?)'")

logger = logging.getLogger(__name__)


class TINYINT(Integer):  # pylint: disable=no-init
    __visit_name__ = "TINYINT"


class DOUBLE(Numeric):  # pylint: disable=no-init
    __visit_name__ = "DOUBLE"


class ARRAY(TypeEngine):  # pylint: disable=no-init
    __visit_name__ = "ARRAY"

    @property
    def python_type(self) -> Optional[Type[List[Any]]]:
        return list


class MAP(TypeEngine):  # pylint: disable=no-init
    __visit_name__ = "MAP"

    @property
    def python_type(self) -> Optional[Type[Dict[Any, Any]]]:
        return dict


class STRUCT(TypeEngine):  # pylint: disable=no-init
    __visit_name__ = "STRUCT"

    @property
    def python_type(self) -> Optional[Type[Any]]:
        return None


class StarRocksEngineSpec(MySQLEngineSpec):
    engine = "starrocks"
    engine_name = "StarRocks"

    default_driver = "starrocks"
    sqlalchemy_uri_placeholder = (
        "starrocks://user:password@host:port/catalog.db[?key=value&key=value...]"
    )

    column_type_mappings = (  # type: ignore
        (
            re.compile(r"^tinyint", re.IGNORECASE),
            TINYINT(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^decimal.*", re.IGNORECASE),
            types.DECIMAL(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^double", re.IGNORECASE),
            DOUBLE(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^varchar(\((\d+)\))*$", re.IGNORECASE),
            types.VARCHAR(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^char(\((\d+)\))*$", re.IGNORECASE),
            types.CHAR(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^binary.*", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (re.compile(r"^array.*", re.IGNORECASE), ARRAY(), GenericDataType.STRING),
        (re.compile(r"^map.*", re.IGNORECASE), MAP(), GenericDataType.STRING),
        (re.compile(r"^struct.*", re.IGNORECASE), STRUCT(), GenericDataType.STRING),
    )

    custom_errors: Dict[Pattern[str], Tuple[str, SupersetErrorType, Dict[str, Any]]] = {
        CONNECTION_ACCESS_DENIED_REGEX: (
            __('Either the username "%(username)s" or the password is incorrect.'),
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            {"invalid": ["username", "password"]},
        ),
        CONNECTION_UNKNOWN_DATABASE_REGEX: (
            __('Unable to connect to database "%(database)s".'),
            SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
            {"invalid": ["database"]},
        ),
    }

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: Dict[str, Any],
        catalog: Optional[str] = None,
        schema: Optional[str] = None,
    ) -> Tuple[URL, Dict[str, Any]]:
        database = uri.database
        if schema and database:
            schema = parse.quote(schema, safe="")
            if "." in database:
                database = database.split(".")[0] + "." + schema
            else:
                database += "." + schema
            uri = uri.set(database=database)

        return uri, connect_args

    @classmethod
    def get_columns(
        cls, inspector: Inspector, table_name: str, schema: Optional[str]
    ) -> List[Dict[str, Any]]:
        columns = cls._show_columns(inspector, table_name, schema)
        result: List[Dict[str, Any]] = []
        for column in columns:
            column_spec = cls.get_column_spec(column.Type)
            column_type = column_spec.sqla_type if column_spec else None
            if column_type is None:
                column_type = types.String()
                logger.info(
                    "Did not recognize starrocks type %s of column %s",
                    str(column.Type),
                    str(column.Field),
                )
            column_info = cls._create_column_info(column.Field, column_type)
            column_info["nullable"] = getattr(column, "Null", True)
            column_info["default"] = None
            result.append(column_info)
        return result

    @classmethod
    def _show_columns(
        cls, inspector: Inspector, table_name: str, schema: Optional[str]
    ) -> List[ResultRow]:
        """
        Show starrocks column names
        :param inspector: object that performs database schema inspection
        :param table_name: table name
        :param schema: schema name
        :return: list of column objects
        """
        quote = inspector.engine.dialect.identifier_preparer.quote_identifier
        full_table = quote(table_name)
        if schema:
            full_table = "{}.{}".format(quote(schema), full_table)
        return inspector.bind.execute(f"SHOW COLUMNS FROM {full_table}").fetchall()

    @classmethod
    def _create_column_info(
        cls, name: str, data_type: types.TypeEngine
    ) -> Dict[str, Any]:
        """
        Create column info object
        :param name: column name
        :param data_type: column data type
        :return: column info object
        """
        return {"name": name, "type": f"{data_type}"}

    @classmethod
    def get_schema_from_engine_params(
        cls,
        sqlalchemy_uri: URL,
        connect_args: Dict[str, Any],
    ) -> Optional[str]:
        """
        Return the configured schema.

        For StarRocks the SQLAlchemy URI looks like this:

            starrocks://localhost:9030/catalog.schema

        """
        database = sqlalchemy_uri.database.strip("/")

        if "." not in database:
            return None

        return parse.unquote(database.split(".")[1])
