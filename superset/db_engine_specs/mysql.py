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

import contextlib
import logging
import re
from datetime import datetime
from decimal import Decimal
from importlib import import_module
from re import Pattern
from typing import Any, Callable, Optional, TYPE_CHECKING
from urllib import parse

import pandas as pd
import sqlalchemy as sa
from flask_babel import gettext as __
from sqlalchemy import types
from sqlalchemy.dialects.mysql import (
    BIT,
    DECIMAL,
    DOUBLE,
    FLOAT,
    INTEGER,
    LONGTEXT,
    MEDIUMINT,
    MEDIUMTEXT,
    TINYINT,
    TINYTEXT,
)
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import URL
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.util import asbool

from superset.constants import TimeGrain
from superset.db_engine_specs.base import (
    AURORA_DATA_API_KNOWN_INCOMPATIBILITIES,
    BaseEngineSpec,
    BasicParametersMixin,
    DatabaseCategory,
)
from superset.errors import SupersetErrorType
from superset.models.sql_lab import Query
from superset.utils import json
from superset.utils.core import GenericDataType

if TYPE_CHECKING:
    from superset.models.core import Database
    from superset.sql.parse import Table

logger = logging.getLogger(__name__)

# Regular expressions to catch custom errors
CONNECTION_ACCESS_DENIED_REGEX = re.compile(
    "Access denied for user '(?P<username>.*?)'@'(?P<hostname>.*?)'"
)
CONNECTION_INVALID_HOSTNAME_REGEX = re.compile(
    "Unknown MySQL server host '(?P<hostname>.*?)'"
)
CONNECTION_HOST_DOWN_REGEX = re.compile(
    "Can't connect to MySQL server on '(?P<hostname>.*?)'"
)
CONNECTION_UNKNOWN_DATABASE_REGEX = re.compile("Unknown database '(?P<database>.*?)'")

SYNTAX_ERROR_REGEX = re.compile(
    "check the manual that corresponds to your MySQL server "
    "version for the right syntax to use near '(?P<server_error>.*)"
)

MYSQL_SSL_MODE_REQUIRED = "REQUIRED"
MYSQL_SSL_MODE_VERIFY_CA = "VERIFY_CA"
MYSQL_SSL_MODE_VERIFY_IDENTITY = "VERIFY_IDENTITY"
MYSQL_SSL_REQUIRED_MODES = (
    MYSQL_SSL_MODE_REQUIRED,
    MYSQL_SSL_MODE_VERIFY_CA,
    MYSQL_SSL_MODE_VERIFY_IDENTITY,
)


def _mysql_bool_option(options: dict[str, Any], key: str) -> Optional[bool]:
    """Parse a boolean driver option, treating a blank value as unset."""
    value = options.get(key)
    if value is None or value == "":
        return None
    return asbool(value) if isinstance(value, str) else bool(value)


def _require_pymysql_tls(query: dict[str, Any], args: dict[str, Any]) -> None:
    """Keep PyMySQL TLS options native so verification applies to them."""
    pymysql = import_module("pymysql")

    # Older releases silently fall back even with explicit SSL options.
    if pymysql.VERSION[:2] < (1, 2):
        raise ValueError("The MySQL SSL toggle requires PyMySQL >= 1.2")
    # SQLAlchemy folds URL ssl_ca/cert/key into an ssl dictionary,
    # but PyMySQL ignores that dictionary when ssl_verify_cert is set.
    # Keep these as native connect_args so the CA is not discarded.
    for key in ("ssl_ca", "ssl_cert", "ssl_key"):
        if key in query:
            args.setdefault(key, query.pop(key))
    check_hostname = _mysql_bool_option(query, "ssl_check_hostname")
    query.pop("ssl_check_hostname", None)
    if check_hostname is not None:
        verify_identity = _mysql_bool_option(args, "ssl_verify_identity")
        if verify_identity not in (None, check_hostname):
            raise ValueError("MySQL SSL request conflicts with ssl_verify_identity")
        args["ssl_verify_identity"] = check_hostname
    if query.keys() & {"ssl_capath", "ssl_cipher"}:
        raise ValueError("Unsupported PyMySQL SSL option with the SSL toggle")
    if "ssl" in args:
        raise ValueError(
            "Use individual ssl_ca/ssl_cert/ssl_key options with the SSL toggle"
        )


def _reject_mysql_ssl_disabled(query: dict[str, Any], args: dict[str, Any]) -> None:
    """Fail on a true ssl_disabled and drop values that do not disable TLS."""
    # Drivers test ssl_disabled for truthiness, so a URL string such as
    # "false" would disable TLS. Parse it here and drop non-disabling values.
    for source in (query, args):
        if _mysql_bool_option(source, "ssl_disabled"):
            raise ValueError("MySQL SSL request conflicts with ssl_disabled")
        source.pop("ssl_disabled", None)


def _require_mysql_verified_tls(
    driver: str, query: dict[str, Any], args: dict[str, Any]
) -> None:
    """Use required verification on drivers without an encryption-only mode."""
    _reject_mysql_ssl_disabled(query, args)
    # Connector/Python has no REQUIRED mode: certificate verification is
    # necessary to prevent its opportunistic fallback to cleartext.
    if _mysql_bool_option({**query, **args}, "ssl_verify_cert") is False:
        raise ValueError("MySQL SSL request requires ssl_verify_cert")
    if driver == "pymysql":
        _require_pymysql_tls(query, args)
    args["ssl_verify_cert"] = True


def _mysqlclient_ssl_mode(options: dict[str, Any]) -> str:
    """Select fail-closed TLS semantics for the linked client library."""
    # mysqlclient maps REQUIRED to opportunistic TLS with MariaDB
    # Connector/C. Verification modes fail closed on both client libraries.
    mode = options.get("ssl_mode", MYSQL_SSL_MODE_REQUIRED)
    if mode not in MYSQL_SSL_REQUIRED_MODES:
        raise ValueError("MySQL SSL request conflicts with ssl_mode")
    if mode == MYSQL_SSL_MODE_REQUIRED:
        client_info = import_module("MySQLdb").get_client_info()
        # Only recognized Oracle clients have fail-closed REQUIRED semantics.
        # MariaDB Connector/C (3.x) and unknown clients require verification.
        if not re.match(r"^(?:5\.7|8\.\d+|9\.\d+)\.", client_info):
            mode = MYSQL_SSL_MODE_VERIFY_CA
    return mode


def _require_mysqlclient_tls(query: dict[str, Any], args: dict[str, Any]) -> None:
    """Select an ssl_mode that fails closed with the linked client library."""
    _reject_mysql_ssl_disabled(query, args)
    args["ssl_mode"] = _mysqlclient_ssl_mode({**query, **args})


def _require_mariadb_connector_tls(
    options: dict[str, Any], args: dict[str, Any]
) -> None:
    """Keep MariaDB Connector/Python's fail-closed ssl flag and verify."""
    if _mysql_bool_option(options, "ssl_verify_cert") is False:
        raise ValueError("MySQL SSL request requires ssl_verify_cert")
    args["ssl"] = True
    args["ssl_verify_cert"] = True


def _mysql_ssl_requested(value: Any) -> bool:
    """Parse scalar requests; leave native SSL dictionaries to the driver."""
    if isinstance(value, (str, bool, int)):
        return asbool(value)
    if value is not None and not isinstance(value, dict):
        raise ValueError("Invalid MySQL ssl option")
    return False


def require_mysql_tls(
    uri: URL, connect_args: dict[str, Any], driver: Optional[str] = None
) -> tuple[URL, dict[str, Any]]:
    """Require TLS for ``ssl`` or ``ssl_mode`` requests without weakening them.

    Options are selected by DBAPI driver, so any MySQL-protocol dialect can use
    this. Pass ``driver`` when the URL's dialect is not importable or does not
    report the underlying MySQL driver.
    """
    query = dict(uri.query)
    args = dict(connect_args)
    # A true URL request cannot be cancelled by an advanced connect argument.
    requested = _mysql_ssl_requested(query.get("ssl"))
    requested = _mysql_ssl_requested(args.get("ssl")) or requested
    # A saved ssl_mode that already requires TLS is a request in its own right,
    # so REQUIRED goes through the same fail-closed normalization.
    requested = requested or any(
        options.get("ssl_mode") in MYSQL_SSL_REQUIRED_MODES for options in (query, args)
    )
    if not requested:
        return uri, connect_args

    for options in (query, args):
        if isinstance(options.get("ssl"), (str, bool, int)):
            options.pop("ssl")
    driver = driver or uri.get_driver_name()
    options = {**query, **args}
    if driver == "mysqldb":
        _require_mysqlclient_tls(query, args)
    elif driver in ("mysqlconnector", "pymysql"):
        _require_mysql_verified_tls(driver, query, args)
    elif driver == "mariadbconnector":
        _require_mariadb_connector_tls(options, args)
    elif driver == "auroradataapi":
        # The Data API is only reachable over HTTPS and takes no ssl argument.
        pass
    else:
        raise ValueError("Unsupported driver for the MySQL SSL toggle")
    return uri.set(query=query), args


# Engines whose connections are passed through ``require_mysql_tls``. Other
# MySQL-protocol specs opt in by listing their engine here, or by calling the
# function from their own ``adjust_engine_params``.
MYSQL_TLS_ENGINES = frozenset({"mysql", "mariadb"})


class MySQLEngineSpec(BasicParametersMixin, BaseEngineSpec):
    engine = "mysql"
    engine_name = "MySQL"
    max_column_name_length = 64

    # MySQL/MariaDB quote identifiers with backticks rather than ANSI double quotes.
    identifier_quote_start: str = "`"
    identifier_quote_end: str = "`"

    default_driver = "mysqldb"
    sqlalchemy_uri_placeholder = (
        "mysql://user:password@host:port/dbname[?key=value&key=value...]"
    )
    encryption_parameters = {"ssl": "1"}

    supports_dynamic_schema = True
    supports_multivalues_insert = True

    # Verified against a live mysql:8.0 instance, including under GROUP BY ...
    # WITH ROLLUP. `STDDEV_SAMP`/`VAR_SAMP` are native, correct sample
    # statistics. MEDIAN is deliberately absent: MySQL has neither a `MEDIAN`
    # function nor `PERCENTILE_CONT` (confirmed: both error). Its `VARIANCE()`
    # function is population variance, not sample variance, so it is not a
    # valid stand-in for VAR_SAMP either.
    # Inherited by MariaDB (a MySQL fork implementing the same aggregate
    # functions) and by Aurora MySQL / its Data API variant (AWS's wire- and
    # SQL-compatible managed MySQL) -- unlike CockroachDB/Greenplum/HANA
    # relative to Postgres, none of these run a materially different query
    # engine, so no separate reset is needed.
    _extended_aggregations: dict[str, Callable[[ColumnElement], ColumnElement]] = {
        "STDDEV_SAMP": sa.func.stddev_samp,
        "VAR_SAMP": sa.func.var_samp,
    }

    metadata = {
        "description": "MySQL is a popular open-source relational database.",
        "logo": "mysql.png",
        "homepage_url": "https://www.mysql.com/",
        "categories": [
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["mysqlclient"],
        "connection_string": "mysql://{username}:{password}@{host}/{database}",
        "default_port": 3306,
        "notes": (
            "The SSL toggle (or ssl=1 in the URI) requires TLS, as does a saved "
            "ssl_mode of REQUIRED or stronger. With mysqlclient, "
            "Oracle libmysqlclient 5.7/8.x/9.x uses ssl_mode=REQUIRED; MariaDB "
            "Connector/C and unrecognized client versions use VERIFY_CA to prevent "
            "cleartext fallback. Explicit VERIFY_CA and VERIFY_IDENTITY are retained. "
            "Existing saved connections with the toggle on are affected at upgrade, "
            "without a feature flag. Verification can fail for self-signed/default "
            "server certificates or missing trust roots. MySQL does not use the "
            "connection form's Root certificate field (server_cert). Set ssl_ca to a "
            "trusted CA file path available on every web and worker node, for example "
            "in the URI (?ssl=1&ssl_ca=/path/to/ca.pem). "
            "Connector/Python and PyMySQL enable ssl_verify_cert=True. PyMySQL "
            "requires version 1.2 or newer; use individual ssl_ca, ssl_cert and "
            "ssl_key options instead of a nested ssl dictionary with the toggle. "
            "Options that disable TLS (ssl_mode=DISABLED, ssl_disabled=True) or "
            "required verification are rejected. "
            "Standard Aurora MySQL connections intentionally follow the same rules, "
            "including IAM connections. For certificate verification, install the "
            "Amazon RDS CA bundle on every web and worker node and set ssl_ca to that "
            "file. IAM authentication does not supply a CA. The Aurora Data API uses "
            "HTTPS and needs no MySQL TLS arguments. "
            "SSH tunnels rewrite the connection host to the local bind address "
            "(typically 127.0.0.1). MariaDB Connector/C also checks hostname identity "
            "with VERIFY_CA, so a certificate for the remote database hostname will "
            "fail. For SSH-only transport, turn off the SSL toggle and remove ssl=1; "
            "this removes the TLS guarantee on the SSH endpoint-to-database leg. If "
            "end-to-end TLS is required, use a driver/native TLS configuration "
            "compatible with the tunnel and validate it separately. "
            "Operators using native TLS settings can turn off the toggle, remove "
            "ssl=1 and configure extra.engine_params.connect_args (for example a "
            "driver-supported native ssl dictionary). Superset passes those settings "
            "through without enforcing TLS; ensure the chosen driver configuration "
            "does not silently fall back to cleartext. "
            "Connections using the separate MariaDB engine (mariadb:// URIs) get "
            "the same handling; with MariaDB Connector/Python the toggle keeps "
            "ssl=True and enables ssl_verify_cert=True. Other MySQL-compatible "
            "engines such as OceanBase and StarRocks keep their existing SSL "
            "handling."
        ),
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "host": "localhost, 127.0.0.1, IP address, or hostname",
            "database": "Database name",
        },
        "host_examples": [
            {"platform": "Localhost", "host": "localhost or 127.0.0.1"},
            {"platform": "Docker on Linux", "host": "172.18.0.1"},
            {"platform": "Docker on macOS", "host": "docker.for.mac.host.internal"},
            {"platform": "On-premise", "host": "IP address or hostname"},
        ],
        "drivers": [
            {
                "name": "mysqlclient",
                "pypi_package": "mysqlclient",
                "connection_string": (
                    "mysql://{username}:{password}@{host}/{database}"
                ),
                "is_recommended": True,
                "notes": (
                    "Recommended driver. May fail with caching_sha2_password auth."
                ),
            },
            {
                "name": "mysql-connector-python",
                "pypi_package": "mysql-connector-python",
                "connection_string": (
                    "mysql+mysqlconnector://{username}:{password}@{host}/{database}"
                ),
                "is_recommended": False,
                "notes": (
                    "Required for newer MySQL databases using "
                    "caching_sha2_password authentication."
                ),
            },
        ],
        "compatible_databases": [
            {
                "name": "MariaDB",
                "description": (
                    "MariaDB is a community-developed fork of MySQL, "
                    "fully compatible with MySQL."
                ),
                "logo": "mariadb.png",
                "homepage_url": "https://mariadb.org/",
                "pypi_packages": ["mysqlclient"],
                "connection_string": (
                    "mysql://{username}:{password}@{host}:{port}/{database}"
                ),
                "categories": [DatabaseCategory.OPEN_SOURCE],
            },
            {
                "name": "Amazon Aurora MySQL",
                "description": (
                    "Amazon Aurora MySQL is a fully managed, MySQL-compatible "
                    "relational database with up to 5x the throughput of "
                    "standard MySQL."
                ),
                "logo": "aws-aurora.jpg",
                "homepage_url": "https://aws.amazon.com/rds/aurora/",
                "pypi_packages": ["sqlalchemy-aurora-data-api"],
                "connection_string": (
                    "mysql+auroradataapi://{aws_access_id}:{aws_secret_access_key}@/"
                    "{database_name}?aurora_cluster_arn={aurora_cluster_arn}&"
                    "secret_arn={secret_arn}&region_name={region_name}"
                ),
                "parameters": {
                    "aws_access_id": "AWS Access Key ID",
                    "aws_secret_access_key": "AWS Secret Access Key",
                    "database_name": "Database name",
                    "aurora_cluster_arn": "Aurora cluster ARN",
                    "secret_arn": "Secrets Manager ARN for credentials",
                    "region_name": "AWS region (e.g., us-east-1)",
                },
                "notes": (
                    "Uses the Data API for serverless access. "
                    "Standard MySQL connections also work with mysqlclient."
                ),
                "categories": [
                    DatabaseCategory.CLOUD_AWS,
                    DatabaseCategory.HOSTED_OPEN_SOURCE,
                ],
                "known_incompatibilities": AURORA_DATA_API_KNOWN_INCOMPATIBILITIES,
            },
        ],
    }

    column_type_mappings = (
        (
            re.compile(r"^int.*", re.IGNORECASE),
            INTEGER(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^tinyint", re.IGNORECASE),
            TINYINT(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^mediumint", re.IGNORECASE),
            MEDIUMINT(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^decimal", re.IGNORECASE),
            DECIMAL(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^float", re.IGNORECASE),
            FLOAT(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^double", re.IGNORECASE),
            DOUBLE(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^bit", re.IGNORECASE),
            BIT(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^tinytext", re.IGNORECASE),
            TINYTEXT(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^mediumtext", re.IGNORECASE),
            MEDIUMTEXT(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^longtext", re.IGNORECASE),
            LONGTEXT(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^var_string", re.IGNORECASE),
            types.VARCHAR(),
            GenericDataType.STRING,
        ),
        # wire-protocol FIELD_TYPE names emitted by `get_datatype`, seen on
        # SQL Lab and virtual dataset columns instead of DDL type names
        (
            re.compile(r"^newdecimal", re.IGNORECASE),
            DECIMAL(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^tiny$", re.IGNORECASE),
            TINYINT(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^short$", re.IGNORECASE),
            types.SmallInteger(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^(blob|text)$", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^year$", re.IGNORECASE),
            types.Integer(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^enum\b", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^set\b", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
    )
    column_type_mutators: dict[types.TypeEngine, Callable[[Any], Any]] = {
        DECIMAL: lambda val: Decimal(val) if isinstance(val, str) else val
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_FORMAT({col}, '%Y-%m-%d %H:%i:%s')",
        TimeGrain.MINUTE: "DATE_FORMAT({col}, '%Y-%m-%d %H:%i:00')",
        TimeGrain.HOUR: "DATE_FORMAT({col}, '%Y-%m-%d %H:00:00')",
        TimeGrain.DAY: "DATE({col})",
        TimeGrain.WEEK: "DATE(DATE_SUB({col}, INTERVAL DAYOFWEEK({col}) - 1 DAY))",
        TimeGrain.MONTH: "DATE(DATE_SUB({col}, INTERVAL DAYOFMONTH({col}) - 1 DAY))",
        TimeGrain.QUARTER: "MAKEDATE(YEAR({col}), 1) "
        "+ INTERVAL QUARTER({col}) QUARTER - INTERVAL 1 QUARTER",
        TimeGrain.YEAR: "DATE(DATE_SUB({col}, INTERVAL DAYOFYEAR({col}) - 1 DAY))",
        TimeGrain.WEEK_STARTING_MONDAY: "DATE(DATE_SUB({col}, "
        "INTERVAL DAYOFWEEK(DATE_SUB({col}, "
        "INTERVAL 1 DAY)) - 1 DAY))",
    }

    type_code_map: dict[int, str] = {}  # loaded from get_datatype only if needed

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        CONNECTION_ACCESS_DENIED_REGEX: (
            __('Either the username "%(username)s" or the password is incorrect.'),
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            {"invalid": ["username", "password"]},
        ),
        CONNECTION_INVALID_HOSTNAME_REGEX: (
            __('Unknown MySQL server host "%(hostname)s".'),
            SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
            {"invalid": ["host"]},
        ),
        CONNECTION_HOST_DOWN_REGEX: (
            __('The host "%(hostname)s" might be down and can\'t be reached.'),
            SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
            {"invalid": ["host", "port"]},
        ),
        CONNECTION_UNKNOWN_DATABASE_REGEX: (
            __('Unable to connect to database "%(database)s".'),
            SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
            {"invalid": ["database"]},
        ),
        SYNTAX_ERROR_REGEX: (
            __(
                'Please check your query for syntax errors near "%(server_error)s". '
                "Then, try running your query again."
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
    }
    disallow_uri_query_params = {
        "mysqldb": {"local_infile"},
        "mysqlconnector": {"allow_local_infile"},
    }
    enforce_uri_query_params = {
        "mysqldb": {"local_infile": 0},
        "mysqlconnector": {"allow_local_infile": 0},
    }

    # Sensitive fields that should be masked in encrypted_extra.
    # This follows the pattern used by other engine specs (bigquery, snowflake, etc.)
    # that specify exact paths rather than using the base class's catch-all "$.*".
    encrypted_extra_sensitive_fields = {
        "$.aws_iam.external_id": "AWS IAM External ID",
        "$.aws_iam.role_arn": "AWS IAM Role ARN",
    }

    @staticmethod
    def update_params_from_encrypted_extra(
        database: Database,
        params: dict[str, Any],
    ) -> None:
        """
        Extract sensitive parameters from encrypted_extra.

        Handles AWS IAM authentication if configured, then merges any
        remaining encrypted_extra keys into params.
        """
        if not database.encrypted_extra:
            return

        try:
            encrypted_extra = json.loads(database.encrypted_extra)
        except json.JSONDecodeError as ex:
            logger.error(ex, exc_info=True)
            raise

        # Handle AWS IAM auth: pop the key so it doesn't reach create_engine()
        iam_config = encrypted_extra.pop("aws_iam", None)
        if iam_config and iam_config.get("enabled"):
            from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

            AWSIAMAuthMixin._apply_iam_authentication(
                database,
                params,
                iam_config,
                # MySQL drivers (mysqlclient) use 'ssl' dict, not 'ssl_mode'.
                # SSL is typically configured via the database's extra settings,
                # so we pass empty ssl_args here to avoid driver compatibility issues.
                ssl_args={},
                default_port=3306,
            )

        # Standard behavior: merge remaining keys into params
        if encrypted_extra:
            params.update(encrypted_extra)

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"STR_TO_DATE('{dttm.date().isoformat()}', '%Y-%m-%d')"
        if isinstance(sqla_type, types.DateTime):
            datetime_formatted = dttm.isoformat(sep=" ", timespec="microseconds")
            return f"""STR_TO_DATE('{datetime_formatted}', '%Y-%m-%d %H:%i:%s.%f')"""
        return None

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: Optional[str] = None,
        schema: Optional[str] = None,
    ) -> tuple[URL, dict[str, Any]]:
        uri, new_connect_args = super().adjust_engine_params(
            uri,
            connect_args,
            catalog,
            schema,
        )

        if schema:
            uri = uri.set(database=parse.quote(schema, safe=""))

        if cls.engine in MYSQL_TLS_ENGINES:
            return require_mysql_tls(uri, new_connect_args)
        return uri, new_connect_args

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
    def get_datatype(cls, type_code: Any) -> Optional[str]:
        datatype = type_code
        if isinstance(type_code, int):
            if not cls.type_code_map:
                # only import and store if needed at least once
                # pylint: disable=import-outside-toplevel
                try:
                    import MySQLdb

                    ft = MySQLdb.constants.FIELD_TYPE
                except ImportError:
                    try:
                        import pymysql  # type: ignore[import-untyped]

                        ft = pymysql.constants.FIELD_TYPE
                    except ImportError:
                        from mysql.connector.constants import FieldType

                        ft = FieldType
                cls.type_code_map = {
                    getattr(ft, k): k for k in dir(ft) if not k.startswith("_")
                }
            datatype = cls.type_code_map.get(type_code)
        if datatype and isinstance(datatype, str) and datatype:
            return datatype
        return None

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @classmethod
    def _extract_error_message(cls, ex: Exception) -> str:
        """Extract error message for queries"""
        message = str(ex)
        with contextlib.suppress(AttributeError, KeyError):
            if isinstance(ex.args, tuple) and len(ex.args) > 1:
                message = ex.args[1]
        return message

    @classmethod
    def get_cancel_query_id(cls, cursor: Any, query: Query) -> Optional[str]:
        """
        Get MySQL connection ID that will be used to cancel all other running
        queries in the same connection.

        :param cursor: Cursor instance in which the query will be executed
        :param query: Query instance
        :return: MySQL Connection ID
        """
        cursor.execute("SELECT CONNECTION_ID()")
        row = cursor.fetchone()
        return row[0]

    @classmethod
    def cancel_query(cls, cursor: Any, query: Query, cancel_query_id: str) -> bool:
        """
        Cancel query in the underlying database.

        :param cursor: New cursor instance to the db of the query
        :param query: Query instance
        :param cancel_query_id: MySQL Connection ID
        :return: True if query cancelled successfully, False otherwise
        """
        # Validate cancel_query_id to prevent SQL injection
        # MySQL CONNECTION_ID() returns an unsigned integer
        if not cls.validate_cancel_query_id(cancel_query_id, r"^\d+$"):
            return False

        try:
            cursor.execute(f"KILL CONNECTION {cancel_query_id}")
        except Exception:  # pylint: disable=broad-except
            return False

        return True

    @classmethod
    def _requires_primary_key(cls, engine: Engine) -> bool:
        """
        Check whether the connected MySQL server rejects ``CREATE TABLE``
        statements that do not declare a primary key
        (``sql_require_primary_key = ON``, MySQL error 3750).

        The variable was introduced in MySQL 8.0.13 and is absent from older
        MySQL releases and from the MySQL-compatible engines that subclass
        this spec (MariaDB, Doris, StarRocks, OceanBase), where querying it
        errors out. Those servers do not enforce the requirement, so treat an
        unreadable variable as "not required" rather than failing the upload.
        """
        try:
            with engine.connect() as conn:
                return bool(
                    conn.exec_driver_sql(
                        "SELECT @@session.sql_require_primary_key"
                    ).scalar()
                )
        except Exception:  # pylint: disable=broad-except
            logger.debug(
                "Unable to read @@session.sql_require_primary_key; "
                "assuming a primary key is not required",
                exc_info=True,
            )
            return False

    @classmethod
    def df_to_sql(
        cls,
        database: Database,
        table: Table,
        df: pd.DataFrame,
        to_sql_kwargs: dict[str, Any],
    ) -> None:
        """
        Upload a DataFrame to MySQL.

        When the target table is being created and the server requires a
        primary key (``sql_require_primary_key = ON``), the plain
        ``pandas.DataFrame.to_sql`` call used by the base implementation
        generates a ``CREATE TABLE`` without one, which MySQL rejects with
        error 3750. Since MySQL rejects the bare ``CREATE TABLE`` itself,
        the primary key has to be declared as part of that first statement;
        it cannot be added afterwards with an ``ALTER TABLE``.

        :param database: The database to upload the data to
        :param table: The table to upload the data to
        :param df: The dataframe with data to be uploaded
        :param to_sql_kwargs: The kwargs to be passed to
            pandas.DataFrame.to_sql
        """
        with cls.get_engine(
            database,
            catalog=table.catalog,
            schema=table.schema,
        ) as engine:
            creating_table = to_sql_kwargs.get("if_exists", "fail") != "append"
            if creating_table and cls._requires_primary_key(engine):
                index = to_sql_kwargs.get("index", True)
                index_label = to_sql_kwargs.get("index_label")
                # Column names are compared case-insensitively in MySQL, so
                # an existing "ID" column collides with a lowercase "id" one
                # even though Python sees them as different strings.
                existing_columns = {col.lower() for col in df.columns}
                index_name = index_label or df.index.name or "index"
                # A column promoted to PRIMARY KEY must reject duplicate and
                # NULL values and must not collide with an existing column;
                # the DataFrame index has none of those guaranteed (a
                # CSV/Excel upload can point the "Dataframe index" option at
                # a column that repeats, is missing values, or shares a name
                # with a real column), so only promote it when it actually
                # qualifies. Otherwise fall back to the synthesized key
                # below, and make sure the real index is not also written
                # out as an extra column.
                promote_index = (
                    bool(index)
                    and df.index.is_unique
                    and not df.index.hasnans
                    and index_name.lower() not in existing_columns
                )
                if promote_index:
                    primary_key = index_name
                else:
                    if index:
                        logger.warning(
                            "Dropping the DataFrame index instead of "
                            "promoting it to PRIMARY KEY: %s",
                            f"its name {index_name!r} collides with an existing column"
                            if index_name.lower() in existing_columns
                            else "it is not unique or contains missing values",
                        )
                    df = df.copy()
                    primary_key = "id"
                    while primary_key.lower() in existing_columns:
                        primary_key = f"_{primary_key}"
                    df.insert(0, primary_key, range(1, len(df) + 1))

                with pd.io.sql.SQLDatabase(engine, need_transaction=True) as pandas_db:
                    pandas_table = pd.io.sql.SQLTable(
                        table.table,
                        pandas_db,
                        frame=df,
                        index=promote_index,
                        if_exists=to_sql_kwargs.get("if_exists", "fail"),
                        index_label=index_label,
                        schema=table.schema,
                        keys=[primary_key],
                    )
                    # pandas declares the key via a table-level
                    # PrimaryKeyConstraint (never Column(primary_key=True)),
                    # but SQLAlchemy's MySQL DDL compiler still treats a lone
                    # integer primary-key column as AUTO_INCREMENT by
                    # default. The values here are explicit (the promoted
                    # index, or the 1..n range synthesized above), not
                    # DB-generated, and pandas' default RangeIndex starts at
                    # 0 -- inserting 0 into an AUTO_INCREMENT column asks
                    # MySQL to generate a value instead of storing 0
                    # literally, colliding with the row whose key is 1.
                    pk_columns = list(pandas_table.table.primary_key.columns)
                    if len(pk_columns) == 1:
                        pk_columns[0].autoincrement = False
                    # MySQL caps identifiers at 64 chars; pandas names the
                    # constraint f"{table_name}_pk", which overflows for a
                    # long table name. MySQL renames PRIMARY KEY constraints
                    # to "PRIMARY" internally regardless of the name given in
                    # DDL, so any short fixed name is safe here.
                    pandas_table.table.primary_key.name = "pk"
                    pandas_table.create()
                    pandas_table.insert(
                        chunksize=to_sql_kwargs.get("chunksize"),
                        # matches the multi-row INSERT the base implementation
                        # asks pandas for on dialects that support it
                        method="multi"
                        if (
                            engine.dialect.supports_multivalues_insert
                            or cls.supports_multivalues_insert
                        )
                        else None,
                    )
                return

        super().df_to_sql(database, table, df, to_sql_kwargs)
