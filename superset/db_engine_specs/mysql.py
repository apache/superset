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
import contextlib
import logging
import re
from datetime import datetime
from decimal import Decimal
from re import Pattern
from typing import Any, Callable, Optional
from urllib import parse

import pandas as pd
from flask_babel import gettext as __
from sqlalchemy import Integer, types
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
from sqlalchemy.engine.url import URL

from superset.constants import TimeGrain
from superset.db_engine_specs.base import (
    BaseEngineSpec,
    BasicParametersMixin,
    DatabaseCategory,
)
from superset.errors import SupersetErrorType
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

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


class MySQLEngineSpec(BasicParametersMixin, BaseEngineSpec):
    engine = "mysql"
    engine_name = "MySQL"
    max_column_name_length = 64

    default_driver = "mysqldb"
    sqlalchemy_uri_placeholder = (
        "mysql://user:password@host:port/dbname[?key=value&key=value...]"
    )
    encryption_parameters = {"ssl": "1"}

    supports_dynamic_schema = True
    supports_multivalues_insert = True

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
    )
    column_type_mutators: dict[types.TypeEngine, Callable[[Any], Any]] = {
        DECIMAL: lambda val: Decimal(val) if isinstance(val, str) else val
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_ADD(DATE({col}), "
        "INTERVAL (HOUR({col})*60*60 + MINUTE({col})*60"
        " + SECOND({col})) SECOND)",
        TimeGrain.MINUTE: "DATE_ADD(DATE({col}), "
        "INTERVAL (HOUR({col})*60 + MINUTE({col})) MINUTE)",
        TimeGrain.HOUR: "DATE_ADD(DATE({col}), INTERVAL HOUR({col}) HOUR)",
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
        if not cls.type_code_map:
            # only import and store if needed at least once
            # pylint: disable=import-outside-toplevel
            import MySQLdb

            ft = MySQLdb.constants.FIELD_TYPE
            cls.type_code_map = {
                getattr(ft, k): k for k in dir(ft) if not k.startswith("_")
            }
        datatype = type_code
        if isinstance(type_code, int):
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
        try:
            cursor.execute(f"KILL CONNECTION {cancel_query_id}")
        except Exception:  # pylint: disable=broad-except
            return False

        return True

    @classmethod
    def _requires_primary_key(cls, engine: Any) -> bool:
        """
        Check if the MySQL database requires a primary key for table creation.

        :param engine: SQLAlchemy engine
        :return: True if primary key is required
        """
        try:
            with engine.connect() as conn:
                result = conn.execute(
                    "SELECT @@session.sql_require_primary_key"
                ).scalar()
                return bool(result)
        except Exception:  # pylint: disable=broad-except
            # If we can't determine the setting, assume it's not required
            # to maintain backward compatibility
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
        Upload data from a Pandas DataFrame to a MySQL database.

        Automatically adds a primary key column when the database requires it
        (e.g., sql_require_primary_key = ON) and the table is being created.

        :param database: The database to upload the data to
        :param table: The table to upload the data to
        :param df: The dataframe with data to be uploaded
        :param to_sql_kwargs: The kwargs to be passed to pandas.DataFrame.to_sql
        """
        with cls.get_engine(
            database,
            catalog=table.catalog,
            schema=table.schema,
        ) as engine:
            # Check if we need to add a primary key
            if_exists = to_sql_kwargs.get("if_exists", "fail")
            needs_primary_key = (
                if_exists == "fail"  # Only for new table creation
                and not to_sql_kwargs.get("index", False)  # No index column exists
            if needs_primary_key:
                # Add an auto-incrementing primary key column
                pk_column_name = "__superset_upload_id__"
                # Ensure the column name doesn't conflict with existing columns
                while pk_column_name in df.columns:
                    pk_column_name = f"_{pk_column_name}"

                # Create a copy of the dataframe with the primary key column
                df_with_pk = df.copy()
                df_with_pk.insert(0, pk_column_name, range(1, len(df) + 1))

                # Use pandas to create table, then alter it to add PRIMARY KEY
                # This is a two-step process because pandas doesn't support
                # PRIMARY KEY or AUTO_INCREMENT in dtype specifications

                to_sql_kwargs_temp = {**to_sql_kwargs}
                to_sql_kwargs_temp["name"] = table.table
                if table.schema:
                    to_sql_kwargs_temp["schema"] = table.schema

                if (
                    engine.dialect.supports_multivalues_insert
                    or cls.supports_multivalues_insert
                ):
                    to_sql_kwargs_temp["method"] = "multi"

                logger.info(
                    "Adding primary key column '%s' for CSV upload to %s.%s "
                    "(sql_require_primary_key enabled)",
                    pk_column_name,
                    table.schema or "default",
                    table.table,
                )

                # Write data with pandas
                df_with_pk.to_sql(con=engine, **to_sql_kwargs_temp)

                # Now alter the table to add PRIMARY KEY and AUTO_INCREMENT
                full_table_name = (
                    f"`{table.schema}`.`{table.table}`"
                    if table.schema
                    else f"`{table.table}`"
                )

                try:
                    with engine.begin() as conn:  # Use transaction
                        # Add AUTO_INCREMENT and PRIMARY KEY
                        alter_sql = (
                            f"ALTER TABLE {full_table_name} "
                            f"MODIFY COLUMN `{pk_column_name}` INTEGER AUTO_INCREMENT, "
                            f"ADD PRIMARY KEY (`{pk_column_name}`)"
                        )
                        conn.execute(alter_sql)
                except Exception as ex:
                    logger.error(
                        "Failed to add PRIMARY KEY constraint to %s: %s",
                        full_table_name,
                        str(ex),
                    )
                    # Clean up the table if ALTER failed
                    try:
                        with engine.begin() as conn:
                            conn.execute(f"DROP TABLE IF EXISTS {full_table_name}")

                return

        # Call parent implementation for normal case
        super(MySQLEngineSpec, cls).df_to_sql(
            database, table, df, to_sql_kwargs
        )
