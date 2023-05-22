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
from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import questdb_connect.types as qdbc_types
from flask_babel import gettext as __
from marshmallow import fields, Schema
from questdb_connect.common import remove_public_schema
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.sql.expression import text, TextClause
from sqlalchemy.types import TypeEngine

from superset.db_engine_specs.base import (
    BaseEngineSpec,
    BasicParametersMixin,
    BasicParametersType,
)
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.utils import core as utils
from superset.utils.core import GenericDataType


class QuestDbParametersSchema(Schema):
    username = fields.String(
        description=__("user"),
        dump_default="admin",
        load_default="admin",
    )
    password = fields.String(
        description=__("password"),
        dump_default="quest",
        load_default="quest",
    )
    host = fields.String(
        description=__("host"),
        dump_default="host.docker.internal",
        load_default="host.docker.internal",
    )
    port = fields.Integer(
        description=__("port"),
        dump_default="8812",
        load_default="8812",
    )
    database = fields.String(
        description=__("database"),
        dump_default="main",
        load_default="main",
    )


class QuestDbEngineSpec(BaseEngineSpec, BasicParametersMixin):
    engine = "questdb"
    engine_name = "QuestDB"
    default_driver = "psycopg2"
    encryption_parameters = {"sslmode": "prefer"}
    sqlalchemy_uri_placeholder = "questdb://user:password@host:port/database"
    parameters_schema = QuestDbParametersSchema()
    time_groupby_inline = False
    allows_hidden_cc_in_orderby = True
    time_secondary_columns = True
    try_remove_schema_from_table_name = True
    max_column_name_length = 120
    supports_dynamic_schema = False
    top_keywords: set[str] = set({})
    # https://en.wikipedia.org/wiki/ISO_8601#Durations
    # https://questdb.io/docs/reference/function/date-time/#date_trunc
    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "DATE_TRUNC('second', {col})",
        "PT1M": "DATE_TRUNC('minute', {col})",
        "PT1H": "DATE_TRUNC('hour', {col})",
        "P1D": "DATE_TRUNC('day', {col})",
        "P1W": "DATE_TRUNC('week', {col})",
        "P1M": "DATE_TRUNC('month', {col})",
        "P1Y": "DATE_TRUNC('year', {col})",
        "P3M": "DATE_TRUNC('quarter', {col})",
    }
    column_type_mappings = (
        (
            re.compile("^LONG256", re.IGNORECASE),
            qdbc_types.Long256,
            GenericDataType.STRING,
        ),
        (
            re.compile("^BOOLEAN", re.IGNORECASE),
            qdbc_types.Boolean,
            GenericDataType.BOOLEAN,
        ),
        (
            re.compile("^BYTE", re.IGNORECASE),
            qdbc_types.Byte,
            GenericDataType.NUMERIC,
        ),
        (
            re.compile("^SHORT", re.IGNORECASE),
            qdbc_types.Short,
            GenericDataType.NUMERIC,
        ),
        (re.compile("^INT", re.IGNORECASE), qdbc_types.Int, GenericDataType.NUMERIC),
        (
            re.compile("^LONG", re.IGNORECASE),
            qdbc_types.Long,
            GenericDataType.NUMERIC,
        ),
        (
            re.compile("^FLOAT", re.IGNORECASE),
            qdbc_types.Float,
            GenericDataType.NUMERIC,
        ),
        (
            re.compile("^DOUBLE'", re.IGNORECASE),
            qdbc_types.Double,
            GenericDataType.NUMERIC,
        ),
        (
            re.compile("^SYMBOL", re.IGNORECASE),
            qdbc_types.Symbol,
            GenericDataType.STRING,
        ),
        (
            re.compile("^STRING", re.IGNORECASE),
            qdbc_types.String,
            GenericDataType.STRING,
        ),
        (
            re.compile("^UUID", re.IGNORECASE),
            qdbc_types.UUID,
            GenericDataType.STRING,
        ),
        (
            re.compile("^CHAR", re.IGNORECASE),
            qdbc_types.Char,
            GenericDataType.STRING,
        ),
        (
            re.compile("^TIMESTAMP", re.IGNORECASE),
            qdbc_types.Timestamp,
            GenericDataType.TEMPORAL,
        ),
        (
            re.compile("^DATE", re.IGNORECASE),
            qdbc_types.Date,
            GenericDataType.TEMPORAL,
        ),
        (
            re.compile(r"^GEOHASH\(\d+[b|c]\)", re.IGNORECASE),
            qdbc_types.GeohashLong,
            GenericDataType.STRING,
        ),
    )

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: BasicParametersType,
        encrypted_extra: dict[str, str] | None = None,
    ) -> str:
        host = parameters.get("host")
        port = parameters.get("port")
        username = parameters.get("username")
        password = parameters.get("password")
        database = parameters.get("database")
        return f"questdb://{username}:{password}@{host}:{port}/{database}"

    @classmethod
    def get_default_schema_for_query(
        cls,
        database: Database,
        query: Query,
    ) -> str | None:
        """Return the default schema for a given query."""
        return None

    @classmethod
    def epoch_to_dttm(cls) -> str:
        """SQL expression that converts epoch (seconds) to datetime that can be used
        in a query. The reference column should be denoted as `{col}` in the return
        expression, e.g. "FROM_UNIXTIME({col})"
        :return: SQL Expression
        """
        return "{col} * 1000000"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        """Convert a Python `datetime` object to a SQL expression.
        :param target_type: The target type of expression
        :param dttm: The datetime object
        :return: The SQL expression
        """
        type_u = target_type.upper()
        if type_u == "DATE":
            return f"TO_DATE('{dttm.date().isoformat()}', 'YYYY-MM-DD')"
        if type_u in ("DATETIME", "TIMESTAMP"):
            dttm_formatted = dttm.isoformat(sep="T", timespec="microseconds")
            return f"TO_TIMESTAMP('{dttm_formatted}', 'yyyy-MM-ddTHH:mm:ss.SSSUUUZ')"
        return None

    @classmethod
    def get_datatype(cls, type_code: Any) -> str | None:
        """Change column type code from cursor description to string representation.
        :param type_code: Type code from cursor description
        :return: String representation of type code
        """
        if type_code and isinstance(type_code, str):
            return type_code.upper()
        return str(type_code)

    @classmethod
    def get_column_spec(
        cls,
        native_type: str | None,
        db_extra: dict[str, Any] | None = None,
        source: utils.ColumnTypeSource = utils.ColumnTypeSource.GET_TABLE,
    ) -> utils.ColumnSpec | None:
        """Get generic type related specs regarding a native column type.
        :param native_type: Native database type
        :param db_extra: The database extra object
        :param source: Type coming from the database table or cursor description
        :return: ColumnSpec object
        """
        sqla_type = qdbc_types.resolve_type_from_name(native_type)
        if not sqla_type:
            return BaseEngineSpec.get_column_spec(native_type, db_extra, source)
        name_u = sqla_type.__visit_name__
        generic_type = GenericDataType.STRING
        if name_u == "BOOLEAN":
            generic_type = GenericDataType.BOOLEAN
        elif name_u in ("BYTE", "SHORT", "INT", "LONG", "FLOAT", "DOUBLE"):
            generic_type = GenericDataType.NUMERIC
        elif name_u in ("SYMBOL", "STRING", "CHAR", "LONG256", "UUID"):
            generic_type = GenericDataType.STRING
        elif name_u in ("DATE", "TIMESTAMP"):
            generic_type = GenericDataType.TEMPORAL
        elif "GEOHASH" in name_u and "(" in name_u and ")" in name_u:
            generic_type = GenericDataType.STRING
        return utils.ColumnSpec(
            sqla_type,
            generic_type,
            generic_type == GenericDataType.TEMPORAL,
        )

    @classmethod
    def get_sqla_column_type(
        cls,
        native_type: str | None,
        db_extra: dict[str, Any] | None = None,
        source: utils.ColumnTypeSource = utils.ColumnTypeSource.GET_TABLE,
    ) -> TypeEngine | None:
        """Converts native database type to sqlalchemy column type.
        :param native_type: Native database type
        :param db_extra: The database extra object
        :param source: Type coming from the database table or cursor description
        :return: ColumnSpec object
        """
        return qdbc_types.resolve_type_from_name(native_type).impl

    @classmethod
    def select_star(  # pylint: disable=too-many-arguments
        cls,
        database: Database,
        table_name: str,
        engine: Engine,
        schema: str | None = None,
        limit: int = 100,
        show_cols: bool = False,
        indent: bool = True,
        latest_partition: bool = True,
        cols: list[dict[str, Any]] | None = None,
    ) -> str:
        """Generate a "SELECT * from table_name" query with appropriate limit.
        :param database: Database instance
        :param table_name: Table name, unquoted
        :param engine: SqlAlchemy Engine instance
        :param schema: Schema, unquoted
        :param limit: limit to impose on query
        :param show_cols: Show columns in query; otherwise use "*"
        :param indent: Add indentation to query
        :param latest_partition: Only query the latest partition
        :param cols: Columns to include in query
        :return: SQL query
        """
        return super().select_star(
            database,
            table_name,
            engine,
            None,
            limit,
            show_cols,
            indent,
            latest_partition,
            cols,
        )

    @classmethod
    def get_allow_cost_estimate(cls, extra: dict[str, Any]) -> bool:
        return False

    @classmethod
    def get_view_names(
        cls,
        database: Database,
        inspector: Inspector,
        schema: str | None,
    ) -> set[str]:
        return set()

    @classmethod
    def get_text_clause(cls, clause: str) -> TextClause:
        """
        SQLAlchemy wrapper to ensure text clauses are escaped properly

        :param clause: string clause with potentially unescaped characters
        :return: text clause with escaped characters
        """
        if cls.allows_escaped_colons:
            clause = clause.replace(":", "\\:")
        return text(remove_public_schema(clause))
