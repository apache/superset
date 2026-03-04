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

import logging
import re
from re import Pattern
from typing import Any

import pandas as pd
from flask_babel import gettext as __
from sqlalchemy.types import NVARCHAR

from superset.db_engine_specs.base import BasicParametersMixin, DatabaseCategory
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec
from superset.errors import SupersetErrorType
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.parse import Table
from superset.utils import json

logger = logging.getLogger()

# Regular expressions to catch custom errors
CONNECTION_ACCESS_DENIED_REGEX = re.compile(
    'password authentication failed for user "(?P<username>.*?)"'
)
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


class RedshiftEngineSpec(BasicParametersMixin, PostgresBaseEngineSpec):
    engine = "redshift"
    engine_name = "Amazon Redshift"
    max_column_name_length = 127
    default_driver = "psycopg2"

    sqlalchemy_uri_placeholder = (
        "redshift+psycopg2://user:password@host:port/dbname[?key=value&key=value...]"
    )

    encryption_parameters = {"sslmode": "verify-ca"}

    metadata = {
        "description": "Amazon Redshift is a fully managed data warehouse service.",
        "logo": "redshift.png",
        "homepage_url": "https://aws.amazon.com/redshift/",
        "categories": [
            DatabaseCategory.CLOUD_AWS,
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.PROPRIETARY,
        ],
        "pypi_packages": ["sqlalchemy-redshift"],
        "connection_string": "redshift+psycopg2://{username}:{password}@{host}:5439/{database}",
        "default_port": 5439,
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "host": "AWS Endpoint",
            "port": "Default 5439",
            "database": "Database name",
        },
        "drivers": [
            {
                "name": "psycopg2",
                "pypi_package": "psycopg2",
                "connection_string": (
                    "redshift+psycopg2://{username}:{password}@{host}:5439/{database}"
                ),
                "is_recommended": True,
            },
            {
                "name": "redshift_connector",
                "pypi_package": "redshift_connector",
                "connection_string": (
                    "redshift+redshift_connector://{username}:{password}"
                    "@{host}:5439/{database}"
                ),
                "is_recommended": False,
                "notes": "Supports IAM-based credentials for clusters and serverless.",
            },
        ],
        "authentication_methods": [
            {
                "name": "IAM Credentials (Cluster)",
                "description": (
                    "Use IAM-based temporary database credentials for Redshift clusters"
                ),
                "requirements": (
                    "IAM role must have redshift:GetClusterCredentials permission"
                ),
                "connection_string": "redshift+redshift_connector://",
                "engine_parameters": {
                    "connect_args": {
                        "iam": True,
                        "database": "<database>",
                        "cluster_identifier": "<cluster_identifier>",
                        "db_user": "<db_user>",
                    }
                },
            },
            {
                "name": "IAM Credentials (Serverless)",
                "description": "Use IAM-based credentials for Redshift Serverless",
                "requirements": (
                    "IAM role must have redshift-serverless:GetCredentials "
                    "and redshift-serverless:GetWorkgroup permissions"
                ),
                "connection_string": "redshift+redshift_connector://",
                "engine_parameters": {
                    "connect_args": {
                        "iam": True,
                        "is_serverless": True,
                        "serverless_acct_id": "<aws account number>",
                        "serverless_work_group": "<redshift work group>",
                        "database": "<database>",
                        "user": "IAMR:<superset iam role name>",
                    }
                },
            },
        ],
    }

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        CONNECTION_ACCESS_DENIED_REGEX: (
            __('Either the username "%(username)s" or the password is incorrect.'),
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            {"invalid": ["username", "password"]},
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
            __(
                'We were unable to connect to your database named "%(database)s".'
                " Please verify your database name and try again."
            ),
            SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
            {"invalid": ["database"]},
        ),
    }

    @classmethod
    def normalize_table_name_for_upload(
        cls,
        table_name: str,
        schema_name: str | None = None,
    ) -> tuple[str, str | None]:
        """
        Redshift folds unquoted identifiers to lowercase.

        :param table_name: The table name to normalize
        :param schema_name: The schema name to normalize (optional)
        :return: Tuple of (normalized_table_name, normalized_schema_name)
        """
        return (
            table_name.lower(),
            schema_name.lower() if schema_name else None,
        )

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

        Handles AWS IAM authentication for Redshift Serverless if configured,
        then merges any remaining encrypted_extra keys into params.
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

            AWSIAMAuthMixin._apply_redshift_iam_authentication(
                database, params, iam_config
            )

        # Standard behavior: merge remaining keys into params
        if encrypted_extra:
            params.update(encrypted_extra)

    @classmethod
    def df_to_sql(
        cls,
        database: Database,
        table: Table,
        df: pd.DataFrame,
        to_sql_kwargs: dict[str, Any],
    ) -> None:
        """
        Upload data from a Pandas DataFrame to a database.

        For regular engines this calls the `pandas.DataFrame.to_sql` method.
        Overrides the base class to allow for pandas string types to be
        used as nvarchar(max) columns, as redshift does not support
        text data types.

        Note this method does not create metadata for the table.

        :param database: The database to upload the data to
        :param table: The table to upload the data to
        :param df: The dataframe with data to be uploaded
        :param to_sql_kwargs: The kwargs to be passed to pandas.DataFrame.to_sql` method
        """
        to_sql_kwargs = to_sql_kwargs or {}
        to_sql_kwargs["dtype"] = {
            # uses the max size for redshift nvarchar(65335)
            # the default object and string types create a varchar(256)
            col_name: NVARCHAR(length=65535)
            for col_name, type in zip(df.columns, df.dtypes, strict=False)
            if isinstance(type, pd.StringDtype)
        }

        super().df_to_sql(
            df=df, database=database, table=table, to_sql_kwargs=to_sql_kwargs
        )

    @staticmethod
    def _mutate_label(label: str) -> str:
        """
        Redshift only supports lowercase column names and aliases.

        :param label: Expected expression label
        :return: Conditionally mutated label
        """
        return label.lower()

    @classmethod
    def get_cancel_query_id(cls, cursor: Any, query: Query) -> str | None:
        """
        Get Redshift PID that will be used to cancel all other running
        queries in the same session.

        :param cursor: Cursor instance in which the query will be executed
        :param query: Query instance
        :return: Redshift PID
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
        :param cancel_query_id: Redshift PID
        :return: True if query cancelled successfully, False otherwise
        """
        try:
            logger.info("Killing Redshift PID:%s", str(cancel_query_id))
            cursor.execute(
                "SELECT pg_cancel_backend(procpid) "  # noqa: S608
                "FROM pg_stat_activity "
                f"WHERE procpid='{cancel_query_id}'"
            )
            cursor.close()
        except Exception:  # pylint: disable=broad-except
            return False
        return True
