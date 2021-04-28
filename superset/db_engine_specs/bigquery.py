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
from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING

import pandas as pd
from flask_babel import gettext as __
from sqlalchemy import literal_column
from sqlalchemy.sql.expression import ColumnClause

from superset.db_engine_specs.base import BaseEngineSpec
from superset.errors import SupersetErrorType
from superset.sql_parse import Table
from superset.utils import core as utils
from superset.utils.hashing import md5_sha_from_str

if TYPE_CHECKING:
    from superset.models.core import Database  # pragma: no cover


CONNECTION_DATABASE_PERMISSIONS_REGEX = re.compile(
    "Access Denied: Project User does not have bigquery.jobs.create "
    + "permission in project (?P<project>.+?)"
)


class BigQueryEngineSpec(BaseEngineSpec):
    """Engine spec for Google's BigQuery

    As contributed by @mxmzdlv on issue #945"""

    engine = "bigquery"
    engine_name = "Google BigQuery"
    max_column_name_length = 128

    # BigQuery doesn't maintain context when running multiple statements in the
    # same cursor, so we need to run all statements at once
    run_multiple_statements_as_one = True

    """
    https://www.python.org/dev/peps/pep-0249/#arraysize
    raw_connections bypass the pybigquery query execution context and deal with
    raw dbapi connection directly.
    If this value is not set, the default value is set to 1, as described here,
    https://googlecloudplatform.github.io/google-cloud-python/latest/_modules/google/cloud/bigquery/dbapi/cursor.html#Cursor

    The default value of 5000 is derived from the pybigquery.
    https://github.com/mxmzdlv/pybigquery/blob/d214bb089ca0807ca9aaa6ce4d5a01172d40264e/pybigquery/sqlalchemy_bigquery.py#L102
    """
    arraysize = 5000

    _date_trunc_functions = {
        "DATE": "DATE_TRUNC",
        "DATETIME": "DATETIME_TRUNC",
        "TIME": "TIME_TRUNC",
        "TIMESTAMP": "TIMESTAMP_TRUNC",
    }

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "{func}({col}, SECOND)",
        "PT1M": "{func}({col}, MINUTE)",
        "PT5M": "CAST(TIMESTAMP_SECONDS("
        "5*60 * DIV(UNIX_SECONDS(CAST({col} AS TIMESTAMP)), 5*60)"
        ") AS {type})",
        "PT10M": "CAST(TIMESTAMP_SECONDS("
        "10*60 * DIV(UNIX_SECONDS(CAST({col} AS TIMESTAMP)), 10*60)"
        ") AS {type})",
        "PT15M": "CAST(TIMESTAMP_SECONDS("
        "15*60 * DIV(UNIX_SECONDS(CAST({col} AS TIMESTAMP)), 15*60)"
        ") AS {type})",
        "PT0.5H": "CAST(TIMESTAMP_SECONDS("
        "30*60 * DIV(UNIX_SECONDS(CAST({col} AS TIMESTAMP)), 30*60)"
        ") AS {type})",
        "PT1H": "{func}({col}, HOUR)",
        "P1D": "{func}({col}, DAY)",
        "P1W": "{func}({col}, WEEK)",
        "P1M": "{func}({col}, MONTH)",
        "P0.25Y": "{func}({col}, QUARTER)",
        "P1Y": "{func}({col}, YEAR)",
    }

    custom_errors = {
        CONNECTION_DATABASE_PERMISSIONS_REGEX: (
            __(
                "We were unable to connect to your database. Please "
                "confirm that your service account has the Viewer "
                "and Job User roles on the project."
            ),
            SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
        ),
    }

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        tt = target_type.upper()
        if tt == utils.TemporalType.DATE:
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if tt == utils.TemporalType.DATETIME:
            return f"""CAST('{dttm.isoformat(timespec="microseconds")}' AS DATETIME)"""
        if tt == utils.TemporalType.TIME:
            return f"""CAST('{dttm.strftime("%H:%M:%S.%f")}' AS TIME)"""
        if tt == utils.TemporalType.TIMESTAMP:
            return f"""CAST('{dttm.isoformat(timespec="microseconds")}' AS TIMESTAMP)"""
        return None

    @classmethod
    def fetch_data(
        cls, cursor: Any, limit: Optional[int] = None
    ) -> List[Tuple[Any, ...]]:
        data = super().fetch_data(cursor, limit)
        # Support type BigQuery Row, introduced here PR #4071
        # google.cloud.bigquery.table.Row
        if data and type(data[0]).__name__ == "Row":
            data = [r.values() for r in data]  # type: ignore
        return data

    @staticmethod
    def _mutate_label(label: str) -> str:
        """
        BigQuery field_name should start with a letter or underscore and contain only
        alphanumeric characters. Labels that start with a number are prefixed with an
        underscore. Any unsupported characters are replaced with underscores and an
        md5 hash is added to the end of the label to avoid possible collisions.

        :param label: Expected expression label
        :return: Conditionally mutated label
        """
        label_hashed = "_" + md5_sha_from_str(label)

        # if label starts with number, add underscore as first character
        label_mutated = "_" + label if re.match(r"^\d", label) else label

        # replace non-alphanumeric characters with underscores
        label_mutated = re.sub(r"[^\w]+", "_", label_mutated)
        if label_mutated != label:
            # add first 5 chars from md5 hash to label to avoid possible collisions
            label_mutated += label_hashed[:6]

        return label_mutated

    @classmethod
    def _truncate_label(cls, label: str) -> str:
        """BigQuery requires column names start with either a letter or
        underscore. To make sure this is always the case, an underscore is prefixed
        to the md5 hash of the original label.

        :param label: expected expression label
        :return: truncated label
        """
        return "_" + md5_sha_from_str(label)

    @classmethod
    def normalize_indexes(cls, indexes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Normalizes indexes for more consistency across db engines

        :param indexes: Raw indexes as returned by SQLAlchemy
        :return: cleaner, more aligned index definition
        """
        normalized_idxs = []
        # Fixing a bug/behavior observed in pybigquery==0.4.15 where
        # the index's `column_names` == [None]
        # Here we're returning only non-None indexes
        for ix in indexes:
            column_names = ix.get("column_names") or []
            ix["column_names"] = [col for col in column_names if col is not None]
            if ix["column_names"]:
                normalized_idxs.append(ix)
        return normalized_idxs

    @classmethod
    def extra_table_metadata(
        cls, database: "Database", table_name: str, schema_name: str
    ) -> Dict[str, Any]:
        indexes = database.get_indexes(table_name, schema_name)
        if not indexes:
            return {}
        partitions_columns = [
            index.get("column_names", [])
            for index in indexes
            if index.get("name") == "partition"
        ]
        cluster_columns = [
            index.get("column_names", [])
            for index in indexes
            if index.get("name") == "clustering"
        ]
        return {
            "partitions": {"cols": partitions_columns},
            "clustering": {"cols": cluster_columns},
        }

    @classmethod
    def _get_fields(cls, cols: List[Dict[str, Any]]) -> List[ColumnClause]:
        """
        BigQuery dialect requires us to not use backtick in the fieldname which are
        nested.
        Using literal_column handles that issue.
        https://docs.sqlalchemy.org/en/latest/core/tutorial.html#using-more-specific-text-with-table-literal-column-and-column
        Also explicility specifying column names so we don't encounter duplicate
        column names in the result.
        """
        return [
            literal_column(c["name"]).label(c["name"].replace(".", "__")) for c in cols
        ]

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "TIMESTAMP_SECONDS({col})"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "TIMESTAMP_MILLIS({col})"

    @classmethod
    def df_to_sql(
        cls,
        database: "Database",
        table: Table,
        df: pd.DataFrame,
        to_sql_kwargs: Dict[str, Any],
    ) -> None:
        """
        Upload data from a Pandas DataFrame to a database.

        Calls `pandas_gbq.DataFrame.to_gbq` which requires `pandas_gbq` to be installed.

        Note this method does not create metadata for the table.

        :param database: The database to upload the data to
        :param table: The table to upload the data to
        :param df: The dataframe with data to be uploaded
        :param to_sql_kwargs: The kwargs to be passed to pandas.DataFrame.to_sql` method
        """

        try:
            import pandas_gbq
            from google.oauth2 import service_account
        except ImportError:
            raise Exception(
                "Could not import libraries `pandas_gbq` or `google.oauth2`, which are "
                "required to be installed in your environment in order "
                "to upload data to BigQuery"
            )

        if not table.schema:
            raise Exception("The table schema must be defined")

        engine = cls.get_engine(database)
        to_gbq_kwargs = {"destination_table": str(table), "project_id": engine.url.host}

        # Add credentials if they are set on the SQLAlchemy dialect.
        creds = engine.dialect.credentials_info

        if creds:
            to_gbq_kwargs[
                "credentials"
            ] = service_account.Credentials.from_service_account_info(creds)

        # Only pass through supported kwargs.
        supported_kwarg_keys = {"if_exists"}

        for key in supported_kwarg_keys:
            if key in to_sql_kwargs:
                to_gbq_kwargs[key] = to_sql_kwargs[key]

        pandas_gbq.to_gbq(df, **to_gbq_kwargs)
