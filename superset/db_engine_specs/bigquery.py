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
import hashlib
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING

import pandas as pd
from sqlalchemy import literal_column
from sqlalchemy.sql.expression import ColumnClause

from superset.db_engine_specs.base import BaseEngineSpec
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.models.core import Database  # pragma: no cover


class BigQueryEngineSpec(BaseEngineSpec):
    """Engine spec for Google's BigQuery

    As contributed by @mxmzdlv on issue #945"""

    engine = "bigquery"
    engine_name = "Google BigQuery"
    max_column_name_length = 128

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
        "PT1H": "{func}({col}, HOUR)",
        "P1D": "{func}({col}, DAY)",
        "P1W": "{func}({col}, WEEK)",
        "P1M": "{func}({col}, MONTH)",
        "P0.25Y": "{func}({col}, QUARTER)",
        "P1Y": "{func}({col}, YEAR)",
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
        label_hashed = "_" + hashlib.md5(label.encode("utf-8")).hexdigest()

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
        return "_" + hashlib.md5(label.encode("utf-8")).hexdigest()

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
    def df_to_sql(cls, df: pd.DataFrame, **kwargs: Any) -> None:
        """
        Upload data from a Pandas DataFrame to BigQuery. Calls
        `DataFrame.to_gbq()` which requires `pandas_gbq` to be installed.

        :param df: Dataframe with data to be uploaded
        :param kwargs: kwargs to be passed to to_gbq() method. Requires that `schema`,
        `name` and `con` are present in kwargs. `name` and `schema` are combined
         and passed to `to_gbq()` as `destination_table`.
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

        if not ("name" in kwargs and "schema" in kwargs and "con" in kwargs):
            raise Exception("name, schema and con need to be defined in kwargs")

        gbq_kwargs = {}
        gbq_kwargs["project_id"] = kwargs["con"].engine.url.host
        gbq_kwargs["destination_table"] = f"{kwargs.pop('schema')}.{kwargs.pop('name')}"

        # add credentials if they are set on the SQLAlchemy Dialect:
        creds = kwargs["con"].dialect.credentials_info
        if creds:
            credentials = service_account.Credentials.from_service_account_info(creds)
            gbq_kwargs["credentials"] = credentials

        # Only pass through supported kwargs
        supported_kwarg_keys = {"if_exists"}
        for key in supported_kwarg_keys:
            if key in kwargs:
                gbq_kwargs[key] = kwargs[key]
        pandas_gbq.to_gbq(df, **gbq_kwargs)
