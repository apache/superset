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
import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Pattern, Set, Tuple, TYPE_CHECKING

from flask_babel import gettext as __
from sqlalchemy.dialects.postgresql import DOUBLE_PRECISION, ENUM, JSON
from sqlalchemy.dialects.postgresql.base import PGInspector
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL
from sqlalchemy.types import Date, DateTime, String

from superset.db_engine_specs.base import BaseEngineSpec, BasicParametersMixin
from superset.errors import SupersetErrorType
from superset.exceptions import SupersetException
from superset.models.sql_lab import Query
from superset.utils import core as utils
from superset.utils.core import GenericDataType

if TYPE_CHECKING:
    from superset.models.core import Database  # pragma: no cover

logger = logging.getLogger()


# Regular expressions to catch custom errors
CONNECTION_INVALID_USERNAME_REGEX = re.compile(
    'role "(?P<username>.*?)" does not exist'
)
CONNECTION_INVALID_PASSWORD_REGEX = re.compile(
    'password authentication failed for user "(?P<username>.*?)"'
)
CONNECTION_INVALID_PASSWORD_NEEDED_REGEX = re.compile("no password supplied")
CONNECTION_INVALID_HOSTNAME_REGEX = re.compile(
    'could not translate host name "(?P<hostname>.*?)" to address: '
    "nodename nor servname provided, or not known"
)
CONNECTION_PORT_CLOSED_REGEX = re.compile(
    r"could not connect to server: Connection refused\s+Is the server "
    r'running on host "(?P<hostname>.*?)" (\(.*?\) )?and accepting\s+TCP/IP '
    r"connections on port (?P<port>.*?)\?"
)
CONNECTION_HOST_DOWN_REGEX = re.compile(
    r"could not connect to server: (?P<reason>.*?)\s+Is the server running on "
    r'host "(?P<hostname>.*?)" (\(.*?\) )?and accepting\s+TCP/IP '
    r"connections on port (?P<port>.*?)\?"
)
CONNECTION_UNKNOWN_DATABASE_REGEX = re.compile(
    'database "(?P<database>.*?)" does not exist'
)
COLUMN_DOES_NOT_EXIST_REGEX = re.compile(
    r'postgresql error: column "(?P<column_name>.+?)" '
    r"does not exist\s+LINE (?P<location>\d+?)"
)

SYNTAX_ERROR_REGEX = re.compile('syntax error at or near "(?P<syntax_error>.*?)"')


def parse_options(connect_args: Dict[str, Any]) -> Dict[str, str]:
    """
    Parse ``options`` from  ``connect_args`` into a dictionary.
    """
    if not isinstance(connect_args.get("options"), str):
        return {}

    tokens = (
        tuple(token.strip() for token in option.strip().split("=", 1))
        for option in re.split(r"-c\s?", connect_args["options"])
        if "=" in option
    )

    return {token[0]: token[1] for token in tokens}


class PostgresBaseEngineSpec(BaseEngineSpec):
    """Abstract class for Postgres 'like' databases"""

    engine = ""
    engine_name = "PostgreSQL"

    supports_dynamic_schema = True
    supports_catalog = True

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "DATE_TRUNC('second', {col})",
        "PT1M": "DATE_TRUNC('minute', {col})",
        "PT1H": "DATE_TRUNC('hour', {col})",
        "P1D": "DATE_TRUNC('day', {col})",
        "P1W": "DATE_TRUNC('week', {col})",
        "P1M": "DATE_TRUNC('month', {col})",
        "P3M": "DATE_TRUNC('quarter', {col})",
        "P1Y": "DATE_TRUNC('year', {col})",
    }

    custom_errors: Dict[Pattern[str], Tuple[str, SupersetErrorType, Dict[str, Any]]] = {
        CONNECTION_INVALID_USERNAME_REGEX: (
            __('The username "%(username)s" does not exist.'),
            SupersetErrorType.CONNECTION_INVALID_USERNAME_ERROR,
            {"invalid": ["username"]},
        ),
        CONNECTION_INVALID_PASSWORD_REGEX: (
            __('The password provided for username "%(username)s" is incorrect.'),
            SupersetErrorType.CONNECTION_INVALID_PASSWORD_ERROR,
            {"invalid": ["username", "password"]},
        ),
        CONNECTION_INVALID_PASSWORD_NEEDED_REGEX: (
            __("Please re-enter the password."),
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            {"invalid": ["password"]},
        ),
        CONNECTION_INVALID_HOSTNAME_REGEX: (
            __('The hostname "%(hostname)s" cannot be resolved.'),
            SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
            {"invalid": ["host"]},
        ),
        CONNECTION_PORT_CLOSED_REGEX: (
            __('Port %(port)s on hostname "%(hostname)s" refused the connection.'),
            SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
            {"invalid": ["host", "port"]},
        ),
        CONNECTION_HOST_DOWN_REGEX: (
            __(
                'The host "%(hostname)s" might be down, and can\'t be '
                "reached on port %(port)s."
            ),
            SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
            {"invalid": ["host", "port"]},
        ),
        CONNECTION_UNKNOWN_DATABASE_REGEX: (
            __('Unable to connect to database "%(database)s".'),
            SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
            {"invalid": ["database"]},
        ),
        COLUMN_DOES_NOT_EXIST_REGEX: (
            __(
                'We can\'t seem to resolve the column "%(column_name)s" at '
                "line %(location)s.",
            ),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
        SYNTAX_ERROR_REGEX: (
            __(
                "Please check your query for syntax errors at or "
                'near "%(syntax_error)s". Then, try running your query again.'
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
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
        if not schema:
            return uri, connect_args

        options = parse_options(connect_args)
        options["search_path"] = schema
        connect_args["options"] = " ".join(
            f"-c{key}={value}" for key, value in options.items()
        )

        return uri, connect_args

    @classmethod
    def get_schema_from_engine_params(
        cls,
        sqlalchemy_uri: URL,
        connect_args: Dict[str, Any],
    ) -> Optional[str]:
        """
        Return the configured schema.

        While Postgres doesn't support connecting directly to a given schema, it allows
        users to specify a "search path" that is used to resolve non-qualified table
        names; this can be specified in the database ``connect_args``.

        One important detail is that the search path can be a comma separated list of
        schemas. While this is supported by the SQLAlchemy dialect, it shouldn't be used
        in Superset because it breaks schema-level permissions, since it's impossible
        to determine the schema for a non-qualified table in a query. In cases like
        that we raise an exception.
        """
        options = parse_options(connect_args)
        if search_path := options.get("search_path"):
            schemas = search_path.split(",")
            if len(schemas) > 1:
                raise Exception(
                    "Multiple schemas are configured in the search path, which means "
                    "Superset is unable to determine the schema of unqualified table "
                    "names and enforce permissions."
                )
            return schemas[0]

        return None

    @classmethod
    def fetch_data(
        cls, cursor: Any, limit: Optional[int] = None
    ) -> List[Tuple[Any, ...]]:
        if not cursor.description:
            return []
        return super().fetch_data(cursor, limit)

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "(timestamp 'epoch' + {col} * interval '1 second')"


class PostgresEngineSpec(PostgresBaseEngineSpec, BasicParametersMixin):
    engine = "postgresql"
    engine_aliases = {"postgres"}

    default_driver = "psycopg2"
    sqlalchemy_uri_placeholder = (
        "postgresql://user:password@host:port/dbname[?key=value&key=value...]"
    )
    # https://www.postgresql.org/docs/9.1/libpq-ssl.html#LIBQ-SSL-CERTIFICATES
    encryption_parameters = {"sslmode": "require"}

    max_column_name_length = 63
    try_remove_schema_from_table_name = False

    column_type_mappings = (
        (
            re.compile(r"^double precision", re.IGNORECASE),
            DOUBLE_PRECISION(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^array.*", re.IGNORECASE),
            String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^json.*", re.IGNORECASE),
            JSON(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^enum.*", re.IGNORECASE),
            ENUM(),
            GenericDataType.STRING,
        ),
    )

    @classmethod
    def get_allow_cost_estimate(cls, extra: Dict[str, Any]) -> bool:
        return True

    @classmethod
    def estimate_statement_cost(cls, statement: str, cursor: Any) -> Dict[str, Any]:
        sql = f"EXPLAIN {statement}"
        cursor.execute(sql)

        result = cursor.fetchone()[0]
        match = re.search(r"cost=([\d\.]+)\.\.([\d\.]+)", result)
        if match:
            return {
                "Start-up cost": float(match.group(1)),
                "Total cost": float(match.group(2)),
            }

        return {}

    @classmethod
    def query_cost_formatter(
        cls, raw_cost: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        return [{k: str(v) for k, v in row.items()} for row in raw_cost]

    @classmethod
    def get_catalog_names(
        cls,
        database: "Database",
        inspector: Inspector,
    ) -> List[str]:
        """
        Return all catalogs.

        In Postgres, a catalog is called a "database".
        """
        return sorted(
            catalog
            for (catalog,) in inspector.bind.execute(
                """
SELECT datname FROM pg_database
WHERE datistemplate = false;
            """
            )
        )

    @classmethod
    def get_table_names(
        cls, database: "Database", inspector: PGInspector, schema: Optional[str]
    ) -> Set[str]:
        """Need to consider foreign tables for PostgreSQL"""
        return set(inspector.get_table_names(schema)) | set(
            inspector.get_foreign_table_names(schema)
        )

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, Date):
            return f"TO_DATE('{dttm.date().isoformat()}', 'YYYY-MM-DD')"
        if isinstance(sqla_type, DateTime):
            dttm_formatted = dttm.isoformat(sep=" ", timespec="microseconds")
            return f"""TO_TIMESTAMP('{dttm_formatted}', 'YYYY-MM-DD HH24:MI:SS.US')"""
        return None

    @staticmethod
    def get_extra_params(database: "Database") -> Dict[str, Any]:
        """
        For Postgres, the path to a SSL certificate is placed in `connect_args`.

        :param database: database instance from which to extract extras
        :raises CertificateException: If certificate is not valid/unparseable
        :raises SupersetException: If database extra json payload is unparseable
        """
        try:
            extra = json.loads(database.extra or "{}")
        except json.JSONDecodeError as ex:
            raise SupersetException("Unable to parse database extras") from ex

        if database.server_cert:
            engine_params = extra.get("engine_params", {})
            connect_args = engine_params.get("connect_args", {})
            connect_args["sslmode"] = connect_args.get("sslmode", "verify-full")
            path = utils.create_ssl_cert_file(database.server_cert)
            connect_args["sslrootcert"] = path
            engine_params["connect_args"] = connect_args
            extra["engine_params"] = engine_params
        return extra

    @classmethod
    def get_datatype(cls, type_code: Any) -> Optional[str]:
        # pylint: disable=import-outside-toplevel
        from psycopg2.extensions import binary_types, string_types

        types = binary_types.copy()
        types.update(string_types)
        if type_code in types:
            return types[type_code].name
        return None

    @classmethod
    def get_cancel_query_id(cls, cursor: Any, query: Query) -> Optional[str]:
        """
        Get Postgres PID that will be used to cancel all other running
        queries in the same session.

        :param cursor: Cursor instance in which the query will be executed
        :param query: Query instance
        :return: Postgres PID
        """
        cursor.execute("SELECT pg_backend_pid()")
        row = cursor.fetchone()
        return row[0]

    @classmethod
    def cancel_query(cls, cursor: Any, query: Query, cancel_query_id: str) -> bool:
        """
        Cancel query in the underlying database.

        :param cursor: New cursor instance to the db of the query
        :param query: Query instance
        :param cancel_query_id: Postgres PID
        :return: True if query cancelled successfully, False otherwise
        """
        try:
            cursor.execute(
                "SELECT pg_terminate_backend(pid) "
                "FROM pg_stat_activity "
                f"WHERE pid='{cancel_query_id}'"
            )
        except Exception:  # pylint: disable=broad-except
            return False

        return True
