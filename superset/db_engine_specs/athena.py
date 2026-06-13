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
import re
from datetime import datetime
from re import Pattern
from typing import Any, Optional

from flask_babel import gettext as __
from sqlalchemy import types
from sqlalchemy.engine.url import URL

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory
from superset.errors import SupersetErrorType

SYNTAX_ERROR_REGEX = re.compile(
    ": mismatched input '(?P<syntax_error>.*?)'. Expecting: "
)


class AthenaEngineSpec(BaseEngineSpec):
    engine = "awsathena"
    engine_name = "Amazon Athena"
    allows_escaped_colons = False
    disable_ssh_tunneling = True
    # Athena doesn't support IS true/false syntax, use = true/false instead
    use_equality_for_boolean_filters = True
    supports_dynamic_schema = True

    metadata = {
        "description": (
            "Amazon Athena is an interactive query service for "
            "analyzing data in S3 using SQL."
        ),
        "logo": "amazon-athena.jpg",
        "homepage_url": "https://aws.amazon.com/athena/",
        "categories": [
            DatabaseCategory.CLOUD_AWS,
            DatabaseCategory.QUERY_ENGINES,
            DatabaseCategory.PROPRIETARY,
        ],
        "pypi_packages": ["pyathena[pandas]"],
        "connection_string": (
            "awsathena+rest://{aws_access_key_id}:{aws_secret_access_key}"
            "@athena.{region_name}.amazonaws.com/{schema_name}"
            "?s3_staging_dir={s3_staging_dir}"
        ),
        "drivers": [
            {
                "name": "PyAthena (REST)",
                "pypi_package": "pyathena[pandas]",
                "connection_string": (
                    "awsathena+rest://{aws_access_key_id}:{aws_secret_access_key}"
                    "@athena.{region_name}.amazonaws.com/{schema_name}"
                    "?s3_staging_dir={s3_staging_dir}"
                ),
                "is_recommended": True,
                "notes": (
                    "No Java required. URL-encode special characters "
                    "(e.g., s3:// -> s3%3A//)."
                ),
            },
            {
                "name": "PyAthenaJDBC",
                "pypi_package": "PyAthenaJDBC",
                "connection_string": (
                    "awsathena+jdbc://{aws_access_key_id}:{aws_secret_access_key}"
                    "@athena.{region_name}.amazonaws.com/{schema_name}"
                    "?s3_staging_dir={s3_staging_dir}"
                ),
                "is_recommended": False,
                "notes": "Requires Amazon Athena JDBC driver.",
            },
        ],
        "engine_parameters": [
            {
                "name": "IAM Role Assumption",
                "description": "Assume a specific IAM role for queries",
                "json": {"connect_args": {"role_arn": "<role arn>"}},
            },
        ],
        "notes": (
            "URL-encode special characters in s3_staging_dir "
            "(e.g., s3:// becomes s3%3A//)."
        ),
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "date_trunc('second', CAST({col} AS TIMESTAMP))",
        TimeGrain.MINUTE: "date_trunc('minute', CAST({col} AS TIMESTAMP))",
        TimeGrain.HOUR: "date_trunc('hour', CAST({col} AS TIMESTAMP))",
        TimeGrain.DAY: "date_trunc('day', CAST({col} AS TIMESTAMP))",
        TimeGrain.WEEK: "date_trunc('week', CAST({col} AS TIMESTAMP))",
        TimeGrain.MONTH: "date_trunc('month', CAST({col} AS TIMESTAMP))",
        TimeGrain.QUARTER: "date_trunc('quarter', CAST({col} AS TIMESTAMP))",
        TimeGrain.YEAR: "date_trunc('year', CAST({col} AS TIMESTAMP))",
        TimeGrain.WEEK_ENDING_SATURDAY: "date_add('day', 5, date_trunc('week', \
                                    date_add('day', 1, CAST({col} AS TIMESTAMP))))",
        TimeGrain.WEEK_STARTING_SUNDAY: "date_add('day', -1, date_trunc('week', \
                                    date_add('day', 1, CAST({col} AS TIMESTAMP))))",
    }

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
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
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"DATE '{dttm.date().isoformat()}'"
        if isinstance(sqla_type, types.TIMESTAMP):
            datetime_formatted = dttm.isoformat(sep=" ", timespec="milliseconds")
            return f"""TIMESTAMP '{datetime_formatted}'"""
        return None

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @staticmethod
    def _mutate_label(label: str) -> str:
        """
        Athena only supports lowercase column names and aliases.

        :param label: Expected expression label
        :return: Conditionally mutated label
        """
        return label.lower()

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: str | None = None,
        schema: str | None = None,
    ) -> tuple[URL, dict[str, Any]]:
        """
        Adjust the SQLAlchemy URI for Athena with a provided catalog and schema.

        For AWS Athena the SQLAlchemy URI looks like this:

            awsathena+rest://athena.{region_name}.amazonaws.com:443/{schema_name}?catalog_name={catalog_name}&s3_staging_dir={s3_staging_dir}
        """
        if catalog:
            uri = uri.update_query_dict({"catalog_name": catalog})

        if schema:
            uri = uri.set(database=schema)

        return uri, connect_args

    @classmethod
    def get_schema_from_engine_params(
        cls,
        sqlalchemy_uri: URL,
        connect_args: dict[str, Any],
    ) -> str | None:
        """
        Return the configured schema.

        For AWS Athena the SQLAlchemy URI looks like this:

            awsathena+rest://athena.{region_name}.amazonaws.com:443/{schema_name}?catalog_name={catalog_name}&s3_staging_dir={s3_staging_dir}
        """
        return sqlalchemy_uri.database
