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
from datetime import datetime
from typing import Any, Optional
from urllib import parse

from flask import current_app as app
from sqlalchemy import types
from sqlalchemy.engine import URL

from superset.constants import TimeGrain
from superset.db_engine_specs.base import (
    BaseEngineSpec,
    BasicParametersMixin,
    ColumnTypeMapping,
    LimitMethod,
)
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.utils.core import GenericDataType

logger = logging.getLogger(__name__)


class SingleStoreSpec(BasicParametersMixin, BaseEngineSpec):
    engine_name = "SingleStore"

    engine = "singlestoredb"
    drivers = {"singlestoredb": "SingleStore Python client"}
    default_driver = "singlestoredb"

    limit_method = LimitMethod.FORCE_LIMIT
    allows_joins = True
    allows_subqueries = True
    allows_alias_in_select = True
    allows_alias_in_orderby = True
    time_groupby_inline = False
    allows_alias_to_source_column = True
    allows_hidden_orderby_agg = True
    allows_hidden_cc_in_orderby = False
    allows_cte_in_subquery = True
    allow_limit_clause = True
    max_column_name_length = 256
    allows_sql_comments = True
    allows_escaped_colons = True
    supports_file_upload = True
    supports_dynamic_schema = True
    disable_ssh_tunneling = False

    sqlalchemy_uri_placeholder = (
        "singlestoredb://{username}:{password}@{host}:{port}/{database}"
    )

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_TRUNC('second', {col})",
        TimeGrain.MINUTE: "DATE_TRUNC('minute', {col})",
        TimeGrain.HOUR: "DATE_TRUNC('hour', {col})",
        TimeGrain.DAY: "DATE_TRUNC('day', {col})",
        TimeGrain.WEEK: "DATE_TRUNC('week', {col})",
        TimeGrain.MONTH: "DATE_TRUNC('month', {col})",
        TimeGrain.QUARTER: "DATE_TRUNC('quarter', {col})",
        TimeGrain.YEAR: "DATE_TRUNC('year', {col})",
    }

    column_type_mappings: tuple[ColumnTypeMapping, ...] = (
        (
            re.compile(r"^tinyint", re.IGNORECASE),
            types.SmallInteger(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^mediumint", re.IGNORECASE),
            types.Integer(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^year", re.IGNORECASE),
            types.Integer(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^bit", re.IGNORECASE),
            types.LargeBinary(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^(var)?binary", re.IGNORECASE),
            types.LargeBinary(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^(tiny|medium|long)?blob", re.IGNORECASE),
            types.LargeBinary(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^json", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^bson", re.IGNORECASE),
            types.LargeBinary(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^geographypoint", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^geography", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^vector", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^enum", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^set", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
    )

    @classmethod
    def get_function_names(
        cls,
        database: Database,
    ) -> list[str]:
        """
        Get a list of function names that are able to be called on the database.
        Used for SQL Lab autocomplete.

        :param database: The database to get functions for
        :return: A list of function names usable in the database
        """

        functions: set[str] = {
            "ABS",
            "ACOS",
            "ADDTIME",
            "AES_DECRYPT",
            "AES_ENCRYPT",
            "AGGREGATOR_ID",
            "ANY_VALUE",
            "APPROX_COUNT_DISTINCT",
            "APPROX_COUNT_DISTINCT_ACCUMULATE",
            "APPROX_COUNT_DISTINCT_COMBINE",
            "APPROX_COUNT_DISTINCT_ESTIMATE",
            "APPROX_GEOGRAPHY_INTERSECTS",
            "APPROX_PERCENTILE",
            "ASCII",
            "ASIN",
            "ATAN",
            "ATAN2",
            "AVG",
            "BETWEEN",
            "NOT",
            "BIN",
            "BIN_TO_UUID",
            "BINARY",
            "BIT_AND",
            "BIT_COUNT",
            "BIT_OR",
            "BIT_XOR",
            "BM25",
            "BSON_ARRAY_CONTAINS_BSON",
            "BSON_ARRAY_PUSH",
            "BSON_ARRAY_SLICE",
            "BSON_BUILD_ARRAY",
            "BSON_BUILD_OBJECT",
            "BSON_COMPARE",
            "BSON_EXTRACT_BIGINT",
            "BSON_EXTRACT_BOOL",
            "BSON_EXTRACT_BSON",
            "BSON_EXTRACT_DATETIME",
            "BSON_EXTRACT_DOUBLE",
            "BSON_EXTRACT_STRING",
            "BSON_GET_TYPE",
            "BSON_INCLUDE_MASK",
            "BSON_EXCLUDE_MASK",
            "BSON_LENGTH",
            "BSON_MATCH_ANY",
            "BSON_MATCH_ANY_EXISTS",
            "BSON_MERGE",
            "BSON_NORMALIZE",
            "BSON_NORMALIZE_ASC",
            "BSON_NORMALIZE_DESC",
            "BSON_NORMALIZE_NO_ARRAYBSON_SET_BSON",
            "BSON_UNWIND",
            "CASE",
            "CEIL",
            "CHAR",
            "CHARACTER_LENGTH",
            "CHARSET",
            "COALESCE",
            "CONCAT",
            "CONCAT_WS",
            "CONNECTION_ID",
            "CONV",
            "CAST",
            "CONVERT",
            "CONVERT_TZ",
            "COS",
            "COT",
            "COUNT",
            "CRC32",
            "CURRENT_DATE",
            "CURDATE",
            "CURRENT_TIME",
            "CURTIME",
            "CURRENT_TIMESTAMP",
            "DATABASE",
            "DATE",
            "DATE_ADD",
            "DATE_FORMAT",
            "DATE_SUB",
            "DATE_TRUNC",
            "DATEDIFF",
            "DAY",
            "DAYNAME",
            "DAYOFWEEK",
            "DAYOFYEAR",
            "DECODE",
            "DEGREES",
            "DENSE_RANK",
            "DOT_PRODUCT",
            "ELT",
            "ESTIMATED_QUERY_LEAF_MEMORY",
            "ESTIMATED_QUERY_RUNTIME",
            "EUCLIDEAN_DISTANCE",
            "EXP",
            "EXTRACT",
            "FIELD",
            "FIRST",
            "FIRST_VALUE",
            "FLOOR",
            "FORMAT",
            "FOUND_ROWS",
            "FROM_BASE64",
            "FROM_DAYS",
            "FROM_UNIXTIME",
            "GEOGRAPHY_AREA",
            "GEOGRAPHY_CONTAINS",
            "GEOGRAPHY_DISTANCE",
            "GEOGRAPHY_INTERSECTS",
            "GEOGRAPHY_LATITUDE",
            "GEOGRAPHY_LENGTH",
            "GEOGRAPHY_LONGITUDE",
            "GEOGRAPHY_POINT",
            "GEOGRAPHY_WITHIN_DISTANCE",
            "GET_FORMAT",
            "GREATEST",
            "GROUP_CONCAT",
            "HEX",
            "HIGHLIGHT",
            "HOUR",
            "IF",
            "IN",
            "INET_ATON",
            "INET_NTOA",
            "INET6_ATON",
            "INET6_NTOA",
            "INITCAP",
            "INSTR",
            "IS_BSON_NULL",
            "IS_UUID",
            "ISNULL",
            "ISNUMERIC",
            "JSON_AGG",
            "JSON_ARRAY_CONTAINS_DOUBLE",
            "JSON_ARRAY_CONTAINS_STRING",
            "JSON_ARRAY_CONTAINS_JSON",
            "JSON_ARRAY_PACK",
            "JSON_ARRAY_PUSH_DOUBLE",
            "JSON_ARRAY_PUSH_STRING",
            "JSON_ARRAY_PUSH_JSON",
            "JSON_ARRAY_UNPACK",
            "JSON_BUILD_ARRAY",
            "JSON_BUILD_OBJECT",
            "JSON_DELETE_KEY",
            "JSON_EXTRACT_DOUBLE",
            "JSON_EXTRACT_STRING",
            "JSON_EXTRACT_JSON",
            "JSON_EXTRACT_BIGINT",
            "JSON_GET_TYPE",
            "JSON_KEYS",
            "JSON_LENGTH",
            "JSON_MATCH_ANY",
            "JSON_MERGE_PATCH",
            "JSON_PRETTY",
            "JSON_SET_DOUBLE",
            "JSON_SET_STRING",
            "JSON_SET_JSON",
            "JSON_SPLICE_DOUBLE",
            "JSON_SPLICE_STRING",
            "JSON_SPLICE_JSON",
            "JSON_TO_ARRAY",
            "LAG",
            "LAST",
            "LAST_DAY",
            "LAST_INSERT_ID",
            "LAST_VALUE",
            "LCASE",
            "LEAD",
            "LEAST",
            "LEFT",
            "LENGTH",
            "LIKE",
            "LN",
            "LOCALTIMESTAMP",
            "LOCATE",
            "LOG",
            "LOG10",
            "LOG2",
            "LPAD",
            "LTRIM",
            "MATCH",
            "MAX",
            "MD5",
            "MEDIAN",
            "MICROSECOND",
            "MIN",
            "MINUTE",
            "MOD",
            "MONTH",
            "MONTHNAME",
            "MONTHS_BETWEEN",
            "NOPARAM",
            "NOW",
            "NTH_VALUE",
            "NTILE",
            "NULLIF",
            "NVL",
            "IFNULL",
            "PERCENT_RANK",
            "PERCENTILE_CONT",
            "PERCENTILE_DISC",
            "PI",
            "POW",
            "QUARTER",
            "QUOTE",
            "RADIANS",
            "RAND",
            "RANK",
            "REDUCE",
            "REGEXP_INSTR",
            "REGEXP_MATCH",
            "REGEXP_REPLACE",
            "REGEXP_SUBSTR",
            "REPLACE",
            "REVERSE",
            "RIGHT",
            "RLIKE",
            "REGEXP",
            "ROUND",
            "ROW_COUNT",
            "ROW_NUMBER",
            "RPAD",
            "RTRIM",
            "SCALAR_VECTOR_MUL",
            "SEC_TO_TIME",
            "SECOND",
            "SECRET",
            "SET",
            "SHA1",
            "SHA2",
            "SIGMOID",
            "SIGN",
            "SIN",
            "SLEEP",
            "SPLIT",
            "SQRT",
            "STD",
            "STDDEV",
            "STDDEV_POP",
            "STDDEV_SAMP",
            "STR_TO_DATE",
            "strcmp",
            "STRING_BYTES",
            "SUBSTRING",
            "SUBSTRING_INDEX",
            "SUM",
            "SYS_GUID",
            "UUID",
            "TAN",
            "TIME",
            "TIME_BUCKET",
            "TIME_FORMAT",
            "TIME_TO_SEC",
            "TIMEDIFF",
            "TIMESTAMP",
            "TIMESTAMPADD",
            "TIMESTAMPDIFF",
            "TO_BASE64",
            "TO_CHAR",
            "TO_DATE",
            "TO_DAYS",
            "TO_JSON",
            "TO_NUMBER",
            "TO_SECONDS",
            "TO_TIMESTAMP",
            "TRIM",
            "TRUNC",
            "TRUNCATE",
            "UCASE",
            "UNHEX",
            "UNIX_TIMESTAMP",
            "USER",
            "UTC_DATE",
            "UTC_TIME",
            "UTC_TIMESTAMP",
            "UUID_TO_BIN",
            "VARIANCE",
            "VAR_SAMP",
            "VECTOR_ADD",
            "VECTOR_ELEMENTS_SUM",
            "VECTOR_KTH_ELEMENT",
            "VECTOR_MUL",
            "VECTOR_NUM_ELEMENTS",
            "VECTOR_SORT",
            "VECTOR_SUB",
            "VECTOR_SUBVECTOR",
            "VECTOR_SUM",
            "WEEK",
            "WEEKDAY",
            "YEAR",
        }

        if (database_name := cls.get_default_schema(database, None)) is not None:
            df = database.get_df(
                f"SHOW FUNCTIONS IN `{database_name.replace('`', '``')}`"
            )

            functions.update(df.iloc[:, 0].tolist())

        return list(functions)

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if isinstance(sqla_type, types.TIMESTAMP):
            return f"""('{dttm.isoformat(sep=" ", timespec="microseconds")}' :> TIMESTAMP(6))"""  # noqa: E501
        if isinstance(sqla_type, types.DateTime):
            return f"""CAST('{dttm.isoformat(sep=" ", timespec="microseconds")}' AS DATETIME(6))"""  # noqa: E501
        if isinstance(sqla_type, types.Time):
            return f"""CAST('{dttm.strftime("%H:%M:%S.%f")}' AS TIME(6))"""

        return None

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: Optional[str] = None,
        schema: Optional[str] = None,
    ) -> tuple[URL, dict[str, Any]]:
        if schema:
            uri = uri.set(database=parse.quote(schema, safe=""))

        connect_args.setdefault(
            "conn_attrs",
            {
                "_connector_name": "SingleStore Superset Database Engine",
                "_connector_version": app.config.get("VERSION_STRING", "dev"),
                "_product_version": app.config.get("VERSION_STRING", "dev"),
            },
        )
        return uri, connect_args

    @classmethod
    def get_schema_from_engine_params(
        cls,
        sqlalchemy_uri: URL,
        connect_args: dict[str, Any],
    ) -> Optional[str]:
        """
        Return the configured schema.

        A MySQL database is a SQLAlchemy schema.
        """
        return parse.unquote(sqlalchemy_uri.database)

    @classmethod
    def get_cancel_query_id(cls, cursor: Any, query: Query) -> Optional[str]:
        """
        Get SingleStore connection ID and aggregator ID that will be used to cancel all
        other running queries in the same connection.

        :param cursor: Cursor instance in which the query will be executed
        :param query: Query instance
        :return: SingleStore connection ID and aggregator ID
        """
        cursor.execute("SELECT CONNECTION_ID(), AGGREGATOR_ID()")
        row = cursor.fetchone()
        return " ".join(str(item) for item in row)

    @classmethod
    def cancel_query(cls, cursor: Any, query: Query, cancel_query_id: str) -> bool:
        """
        Cancel query in the underlying database.

        :param cursor: New cursor instance to the db of the query
        :param query: Query instance
        :param cancel_query_id: SingleStore connection ID and aggregator ID
        :return: True if query cancelled successfully, False otherwise
        """
        try:
            cursor.execute(f"KILL CONNECTION {cancel_query_id}")
        except Exception:  # pylint: disable=broad-except
            return False

        return True
