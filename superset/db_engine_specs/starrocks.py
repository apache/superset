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
from typing import Any
from urllib import parse

from flask_babel import gettext as __
from sqlalchemy import Float, Integer, Numeric, types
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL
from sqlalchemy.sql.type_api import TypeEngine

from superset.db_engine_specs.base import DatabaseCategory
from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.errors import SupersetErrorType
from superset.models.core import Database
from superset.utils.core import GenericDataType

DEFAULT_CATALOG = "default_catalog"

# Regular expressions to catch custom errors
CONNECTION_ACCESS_DENIED_REGEX = re.compile(
    "Access denied for user '(?P<username>.*?)'"
)
CONNECTION_UNKNOWN_DATABASE_REGEX = re.compile("Unknown database '(?P<database>.*?)'")

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


class PERCENTILE(Numeric):
    __visit_name__ = "PERCENTILE"


class ARRAY(TypeEngine):
    __visit_name__ = "ARRAY"

    @property
    def python_type(self) -> type[list[Any]] | None:
        return list


class MAP(TypeEngine):
    __visit_name__ = "MAP"

    @property
    def python_type(self) -> type[dict[Any, Any]] | None:
        return dict


class STRUCT(TypeEngine):
    __visit_name__ = "STRUCT"

    @property
    def python_type(self) -> type[Any] | None:
        return None


class StarRocksEngineSpec(MySQLEngineSpec):
    engine = "starrocks"
    engine_name = "StarRocks"

    default_driver = "starrocks"
    sqlalchemy_uri_placeholder = "starrocks://user:password@host:port[/catalog.db]"
    supports_dynamic_schema = True
    supports_catalog = supports_dynamic_catalog = supports_cross_catalog_queries = True

    metadata = {
        "description": (
            "StarRocks is a high-performance analytical database "
            "for real-time analytics."
        ),
        "logo": "starrocks.png",
        "homepage_url": "https://www.starrocks.io/",
        "categories": [
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["starrocks"],
        "connection_string": (
            "starrocks://{username}:{password}@{host}:{port}/{catalog}.{database}"
        ),
        "default_port": 9030,
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "host": "StarRocks FE host",
            "port": "Query port (default 9030)",
            "catalog": "Catalog name",
            "database": "Database name",
        },
        "drivers": [
            {
                "name": "starrocks",
                "pypi_package": "starrocks",
                "connection_string": (
                    "starrocks://{username}:{password}@{host}:{port}/{catalog}.{database}"
                ),
                "is_recommended": True,
            },
            {
                "name": "mysqlclient",
                "pypi_package": "mysqlclient",
                "connection_string": (
                    "mysql://{username}:{password}@{host}:{port}/{database}"
                ),
                "is_recommended": False,
                "notes": "MySQL-compatible driver for StarRocks.",
            },
            {
                "name": "PyMySQL",
                "pypi_package": "pymysql",
                "connection_string": (
                    "mysql+pymysql://{username}:{password}@{host}:{port}/{database}"
                ),
                "is_recommended": False,
                "notes": "Pure Python MySQL driver, no compilation required.",
            },
        ],
        "compatible_databases": [
            {
                "name": "CelerData",
                "description": (
                    "CelerData is a fully-managed cloud analytics service built on "
                    "StarRocks. It provides instant elasticity, automatic scaling, "
                    "and enterprise features."
                ),
                "logo": "celerdata.png",
                "homepage_url": "https://celerdata.com/",
                "categories": [
                    DatabaseCategory.ANALYTICAL_DATABASES,
                    DatabaseCategory.CLOUD_DATA_WAREHOUSES,
                    DatabaseCategory.HOSTED_OPEN_SOURCE,
                ],
                "pypi_packages": ["starrocks"],
                "connection_string": (
                    "starrocks://{username}:{password}@{host}:{port}/{catalog}.{database}"
                ),
                "parameters": {
                    "username": "CelerData username",
                    "password": "CelerData password",
                    "host": "CelerData cluster endpoint",
                    "port": "Query port (default 9030)",
                    "catalog": "Catalog name",
                    "database": "Database name",
                },
                "docs_url": "https://docs.celerdata.com/",
            },
        ],
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
            re.compile(r"^json", re.IGNORECASE),
            types.JSON(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^binary.*", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^percentile", re.IGNORECASE),
            PERCENTILE(),
            GenericDataType.STRING,
        ),
        (re.compile(r"^hll", re.IGNORECASE), HLL(), GenericDataType.STRING),
        (re.compile(r"^bitmap", re.IGNORECASE), BITMAP(), GenericDataType.STRING),
        (re.compile(r"^array.*", re.IGNORECASE), ARRAY(), GenericDataType.STRING),
        (re.compile(r"^map.*", re.IGNORECASE), MAP(), GenericDataType.STRING),
        (re.compile(r"^struct.*", re.IGNORECASE), STRUCT(), GenericDataType.STRING),
    )

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
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
        connect_args: dict[str, Any],
        catalog: str | None = None,
        schema: str | None = None,
    ) -> tuple[URL, dict[str, Any]]:
        """
        Adjust engine parameters for StarRocks catalog and schema support.

        StarRocks uses a "catalog.schema" format in the database field:
        - "catalog.schema" - both specified
        - "catalog." - catalog only (for browsing schemas)
        - None - neither specified
        """
        if uri.database and "." in uri.database:
            current_catalog, current_schema = uri.database.split(".", 1)
        elif uri.database:
            current_catalog, current_schema = uri.database, None
        else:
            current_catalog, current_schema = None, None

        if schema:
            schema = parse.quote(schema, safe="")

        effective_catalog = catalog or current_catalog or DEFAULT_CATALOG
        # only use the schema/db from uri if we're not overriding catalog
        effective_schema = schema
        if not effective_schema and (not catalog or catalog == current_catalog):
            effective_schema = current_schema

        if effective_schema:
            adjusted_database = f"{effective_catalog}.{effective_schema}"
        else:
            adjusted_database = f"{effective_catalog}."

        uri = uri.set(database=adjusted_database)

        return uri, connect_args

    @classmethod
    def get_schema_from_engine_params(
        cls,
        sqlalchemy_uri: URL,
        connect_args: dict[str, Any],
    ) -> str | None:
        """
        Extract schema from engine parameters.

        Returns the schema portion from formats like:
        - "catalog.schema" -> "schema"
        - "schema" -> None (ambiguous - could be catalog or schema)
        - "" or None -> None
        """
        if not sqlalchemy_uri.database:
            return None

        database = sqlalchemy_uri.database.strip("/")
        if not database or "." not in database:
            return None

        schema = database.split(".")[-1]
        return parse.unquote(schema)

    @classmethod
    def get_default_catalog(cls, database: Database) -> str:
        """
        Return the default catalog.

        Extracts catalog from URI (e.g., "iceberg" from "iceberg.schema"),
        otherwise returns DEFAULT_CATALOG.
        """
        if database.url_object.database and "." in database.url_object.database:
            return database.url_object.database.split(".")[0]

        return DEFAULT_CATALOG

    @classmethod
    def get_catalog_names(
        cls,
        database: Database,
        inspector: Inspector,
    ) -> set[str]:
        """
        Get all available catalogs.

        Executes SHOW CATALOGS and extracts catalog names from the result.
        The command returns columns: Catalog, Type, Comment
        """
        try:
            result = inspector.bind.execute("SHOW CATALOGS")
            catalogs = set()

            for row in result:
                try:
                    if hasattr(row, "keys") and "Catalog" in row.keys():
                        catalogs.add(row["Catalog"])
                    elif hasattr(row, "Catalog"):
                        catalogs.add(row.Catalog)
                    else:
                        catalogs.add(row[0])
                except (AttributeError, TypeError, IndexError, KeyError) as ex:
                    logger.warning(
                        "Unable to extract catalog name from row: %s (%s)", row, ex
                    )
                    continue

            return catalogs
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("Error fetching catalog names from SHOW CATALOGS: %s", ex)
            return set()

    @classmethod
    def get_schema_names(cls, inspector: Inspector) -> set[str]:
        """
        Get all schemas/databases using SHOW DATABASES.

        The catalog context is set via the database field in the connection URL
        (e.g., "catalog." sets the context to that catalog).
        """
        try:
            result = inspector.bind.execute("SHOW DATABASES")
            return {row[0] for row in result}
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("Error fetching schema names from SHOW DATABASES: %s", ex)
            return set()

    @classmethod
    def impersonate_user(
        cls,
        database: Database,
        username: str | None,
        user_token: str | None,
        url: URL,
        engine_kwargs: dict[str, Any],
    ) -> tuple[URL, dict[str, Any]]:
        """
        Impersonate the given user.

        User impersonation is actually achieved via `get_prequeries`, so this method
        needs to ensure that the username is not added to the URL when user
        impersonation is enabled (the behavior of the base class).
        """
        return url, engine_kwargs

    @classmethod
    def get_prequeries(
        cls,
        database: Database,
        catalog: str | None = None,
        schema: str | None = None,
    ) -> list[str]:
        """
        Get pre-session queries.

        For StarRocks with user impersonation enabled, returns an EXECUTE AS statement.
        """
        if database.impersonate_user:
            username = database.get_effective_user(database.url_object)

            if username:
                return [f'EXECUTE AS "{username}" WITH NO REVERT;']

        return []
