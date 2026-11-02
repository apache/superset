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
from re import Pattern
from typing import Any, Callable, Optional
from urllib import parse

from flask_babel import gettext as __, lazy_gettext as _
from sqlalchemy import Float, Integer, Numeric, String, TEXT, text, types
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.type_api import TypeEngine

from superset.constants import TimeGrain
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import BasicParametersType, DatabaseCategory
from superset.db_engine_specs.mysql import (
    MYSQL_SSL_MODE_REQUIRED,
    MYSQL_SSL_MODE_VERIFY_CA,
    MYSQL_SSL_MODE_VERIFY_IDENTITY,
    MySQLEngineSpec,
    require_mysql_tls,
)
from superset.errors import SupersetErrorType
from superset.models.core import Database
from superset.utils.core import GenericDataType

DEFAULT_CATALOG = "internal"
DEFAULT_SCHEMA = "information_schema"

# Regular expressions to catch custom errors
CONNECTION_ACCESS_DENIED_REGEX = re.compile(
    "Access denied for user '(?P<username>.*?)'"
)
# The client library (libmysqlclient or MariaDB Connector/C) words these; the
# MariaDB one omits the server name ("Can't connect to server on ...").
CONNECTION_INVALID_HOSTNAME_REGEX = re.compile(
    "Unknown (?:MySQL |Doris )?server host '(?P<hostname>.*?)'"
)
CONNECTION_UNKNOWN_DATABASE_REGEX = re.compile("Unknown database '(?P<database>.*?)'")
CONNECTION_HOST_DOWN_REGEX = re.compile(
    "Can't connect to (?:MySQL |Doris )?server on '(?P<hostname>.*?)'"
)
SYNTAX_ERROR_REGEX = re.compile(
    "check the manual that corresponds to your MySQL server "
    "version for the right syntax to use near '(?P<server_error>.*)"
)
# Doris' own parser: "mismatched input 'SELEC' expecting ..."
DORIS_SYNTAX_ERROR_REGEX = re.compile(
    r"(?:mismatched input|extraneous input|no viable alternative at input)"
    r" '(?P<server_error>.*?)'"
)
TABLE_DOES_NOT_EXIST_REGEX = re.compile(r"Table \[(?P<table_name>.*?)\] does not exist")
SCHEMA_DOES_NOT_EXIST_REGEX = re.compile(
    r"Database \[(?P<schema_name>.*?)\] does not exist"
)
COLUMN_DOES_NOT_EXIST_REGEX = re.compile("Unknown column '(?P<column_name>.*?)'")

logger = logging.getLogger(__name__)


class TINYINT(Integer):
    __visit_name__ = "TINYINT"


class LARGEINT(Integer):
    __visit_name__ = "LARGEINT"


class DOUBLE(Float):
    __visit_name__ = "DOUBLE"


class HLL(Numeric):
    __visit_name__ = "HLL"


class BITMAP(Numeric):
    __visit_name__ = "BITMAP"


class QuantileState(Numeric):
    __visit_name__ = "QUANTILE_STATE"


class AggState(Numeric):
    __visit_name__ = "AGG_STATE"


class ARRAY(TypeEngine):
    __visit_name__ = "ARRAY"

    @property
    def python_type(self) -> Optional[type[list[Any]]]:
        return list


class MAP(TypeEngine):
    __visit_name__ = "MAP"

    @property
    def python_type(self) -> Optional[type[dict[Any, Any]]]:
        return dict


class STRUCT(TypeEngine):
    __visit_name__ = "STRUCT"

    @property
    def python_type(self) -> Optional[type[Any]]:
        return None


class DorisEngineSpec(MySQLEngineSpec):
    engine = "pydoris"
    engine_aliases = {"doris"}
    engine_name = "Apache Doris"
    max_column_name_length = 64
    # pydoris registers its dialect (a ``MySQLDialect_mysqldb`` subclass) as
    # ``doris`` and ``pydoris``, so the installed driver is ``mysqldb``. The
    # connection form is only offered when ``default_driver`` is installed.
    default_driver = "mysqldb"
    sqlalchemy_uri_placeholder = (
        "doris://user:password@host:port/catalog.db[?key=value&key=value...]"
    )
    # mysqlclient receives URI query values as strings, and neither ``ssl=0`` nor
    # ``ssl=1`` enables TLS. ``VERIFY_CA`` requires TLS rather than falling back to
    # cleartext, as ``REQUIRED`` can with MariaDB Connector/C. With MariaDB
    # Connector/C, mysqlclient maps ``VERIFY_CA`` to
    # ``MYSQL_OPT_SSL_VERIFY_SERVER_CERT``, which also verifies the hostname: the
    # switch needs ``ssl_ca=<path>`` in the connection's additional parameters and
    # a server certificate matching the host. A Doris FE on its default
    # self-signed certificate fails closed once the switch is on.
    encryption_parameters = {"ssl_mode": MYSQL_SSL_MODE_VERIFY_CA}
    supports_dynamic_schema = True
    supports_catalog = supports_dynamic_catalog = True
    # while technically supported by Doris, this generates invalid table identifiers
    supports_cross_catalog_queries = False

    # `MySQLEngineSpec._extended_aggregations` (STDDEV_SAMP/VAR_SAMP) is verified
    # against real MySQL behavior, not Doris's OLAP query engine; disable it here
    # until someone confirms the same expressions against a live Doris instance.
    _extended_aggregations: dict[str, Callable[[ColumnElement], ColumnElement]] = {}

    _time_grain_expressions = {
        **MySQLEngineSpec._time_grain_expressions,
        # Doris rejects MySQL's ``+ INTERVAL n QUARTER``
        TimeGrain.QUARTER: "MAKEDATE(YEAR({col}), 1) "
        "+ INTERVAL (QUARTER({col}) - 1) * 3 MONTH",
    }

    metadata = {
        "description": (
            "Apache Doris is a high-performance real-time analytical database."
        ),
        "logo": "doris.png",
        "homepage_url": "https://doris.apache.org/",
        "categories": [
            DatabaseCategory.APACHE_PROJECTS,
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["pydoris"],
        "connection_string": (
            "doris://{username}:{password}@{host}:{port}/{catalog}.{database}"
        ),
        "default_port": 9030,
        "notes": (
            "The SSL switch sets ssl_mode=VERIFY_CA. With MariaDB Connector/C, "
            "which mysqlclient uses in the Superset image, this also verifies the "
            "server hostname. Add ssl_ca=<path to the CA certificate> in Additional "
            "parameters and use a Doris FE certificate that matches the host. A "
            "Doris FE on its default self-signed certificate fails to connect once "
            "the switch is on."
        ),
        "parameters": {
            "username": "User name",
            "password": "Password",
            "host": "Doris FE Host",
            "port": "Doris FE port",
            "catalog": "Catalog name",
            "database": "Database name",
        },
    }

    column_type_mappings = (  # type: ignore
        (
            re.compile(r"^tinyint", re.IGNORECASE),
            TINYINT(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^largeint", re.IGNORECASE),
            LARGEINT(),
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
            re.compile(r"^json.*", re.IGNORECASE),
            types.JSON(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^binary.*", re.IGNORECASE),
            types.BINARY(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^quantile_state", re.IGNORECASE),
            QuantileState(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^agg_state.*", re.IGNORECASE),
            AggState(),
            GenericDataType.STRING,
        ),
        (re.compile(r"^hll", re.IGNORECASE), HLL(), GenericDataType.STRING),
        (
            re.compile(r"^bitmap", re.IGNORECASE),
            BITMAP(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^array.*", re.IGNORECASE),
            ARRAY(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^map.*", re.IGNORECASE),
            MAP(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^struct.*", re.IGNORECASE),
            STRUCT(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^datetime.*", re.IGNORECASE),
            types.DATETIME(),
            GenericDataType.TEMPORAL,
        ),
        (
            re.compile(r"^date.*", re.IGNORECASE),
            types.DATE(),
            GenericDataType.TEMPORAL,
        ),
        (
            re.compile(r"^text.*", re.IGNORECASE),
            TEXT(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^string.*", re.IGNORECASE),
            String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^variant", re.IGNORECASE),
            types.JSON(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^ipv[46]$", re.IGNORECASE),
            String(),
            GenericDataType.STRING,
        ),
        # MySQL protocol type names, as reported for SQL Lab result columns
        # (NEWDECIMAL, TINY, SHORT, BLOB, ...)
        *MySQLEngineSpec.column_type_mappings,
    )

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        CONNECTION_ACCESS_DENIED_REGEX: (
            __('Either the username "%(username)s" or the password is incorrect.'),
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            {"invalid": ["username", "password"]},
        ),
        CONNECTION_INVALID_HOSTNAME_REGEX: (
            __('Unknown Doris server host "%(hostname)s".'),
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
        DORIS_SYNTAX_ERROR_REGEX: (
            _(
                'Please check your query for syntax errors near "%(server_error)s". '
                "Then, try running your query again."
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
        TABLE_DOES_NOT_EXIST_REGEX: (
            _('The table "%(table_name)s" does not exist.'),
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            {},
        ),
        SCHEMA_DOES_NOT_EXIST_REGEX: (
            _('The schema "%(schema_name)s" does not exist.'),
            SupersetErrorType.SCHEMA_DOES_NOT_EXIST_ERROR,
            {},
        ),
        COLUMN_DOES_NOT_EXIST_REGEX: (
            _('We can\'t seem to resolve the column "%(column_name)s".'),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
    }

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: BasicParametersType,
        encrypted_extra: Optional[dict[str, str]] = None,
    ) -> str:
        """Build a Doris URI while preserving explicit hostname verification."""
        uri = make_url_safe(super().build_sqlalchemy_uri(parameters, encrypted_extra))
        if (
            parameters.get("query", {}).get("ssl_mode")
            == MYSQL_SSL_MODE_VERIFY_IDENTITY
        ):
            uri = uri.update_query_dict({"ssl_mode": MYSQL_SSL_MODE_VERIFY_IDENTITY})
        # ``engine+default_driver`` would be ``pydoris+mysqldb``, which no
        # SQLAlchemy entry point provides. ``pydoris`` is registered, and keeps
        # the URL backend equal to ``engine`` so the edit modal finds the form.
        return uri.set(drivername=cls.engine).render_as_string(hide_password=False)

    @classmethod
    def get_parameters_from_uri(
        cls, uri: str, encrypted_extra: Optional[dict[str, Any]] = None
    ) -> BasicParametersType:
        """Recognize legacy TLS requests without losing hostname verification."""
        url = make_url_safe(uri)
        if url.query.get("ssl_mode") == MYSQL_SSL_MODE_REQUIRED:
            url = url.update_query_dict(cls.encryption_parameters)
        parameters = super().get_parameters_from_uri(
            url.render_as_string(hide_password=False), encrypted_extra
        )
        if url.query.get("ssl_mode") == MYSQL_SSL_MODE_VERIFY_IDENTITY:
            parameters["encryption"] = True
        return parameters

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: Optional[str] = None,
        schema: Optional[str] = None,
    ) -> tuple[URL, dict[str, Any]]:
        if not uri.database:
            raise ValueError("Doris requires a database to be specified in the URI.")
        elif "." not in uri.database:
            current_catalog, current_schema = None, uri.database
        else:
            current_catalog, current_schema = uri.database.split(".", 1)

        # and possibly override them
        catalog = catalog or current_catalog
        schema = schema or current_schema

        database = ".".join(part for part in (catalog, schema) if part)
        uri = uri.set(database=database)

        # pydoris is a mysqlclient dialect, whatever scheme the URI uses.
        return require_mysql_tls(uri, connect_args, driver="mysqldb")

    @classmethod
    def get_default_catalog(cls, database: Database) -> str:
        """
        Return the default catalog.
        """
        # first check the URI to see if a default catalog is set
        if database.url_object.database and "." in database.url_object.database:
            return database.url_object.database.split(".")[0]

        # if not, iterate over existing catalogs and find the current one
        with database.get_sqla_engine() as engine:
            with engine.connect() as conn:
                for catalog in conn.execute(text("SHOW CATALOGS")):
                    if catalog.IsCurrent:
                        return catalog.CatalogName

        # fallback to "internal"
        return DEFAULT_CATALOG

    @classmethod
    def get_catalog_names(
        cls,
        database: Database,
        inspector: Inspector,
    ) -> set[str]:
        """
        Get all catalogs.
        For Doris, the SHOW CATALOGS command returns multiple columns:
        CatalogId, CatalogName, Type, IsCurrent, CreateTime, LastUpdateTime, Comment
        We need to extract just the CatalogName column.
        """
        with inspector.engine.connect() as conn:
            result = conn.execute(text("SHOW CATALOGS"))
            return {row.CatalogName for row in result}

    @classmethod
    def get_schema_from_engine_params(
        cls,
        sqlalchemy_uri: URL,
        connect_args: dict[str, Any],
    ) -> Optional[str]:
        """
        Return the configured schema.

        For doris the SQLAlchemy URI looks like this:

            doris://localhost:9030/catalog.database

        """
        if not sqlalchemy_uri.database:
            return None

        schema = sqlalchemy_uri.database.split(".")[-1].strip("/")
        return parse.unquote(schema)
