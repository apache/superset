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
from datetime import datetime
from typing import (
    Any,
    Dict,
    Optional,
    TYPE_CHECKING
)

from superset.db_engine_specs.base import BaseEngineSpec
from superset.utils import core as utils
from superset.sql_parse import Table

if TYPE_CHECKING:
    # prevent circular imports
    from superset.models.core import Database

class AthenaEngineSpec(BaseEngineSpec):
    engine = "awsathena"
    engine_name = "Amazon Athena"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "date_trunc('second', CAST({col} AS TIMESTAMP))",
        "PT1M": "date_trunc('minute', CAST({col} AS TIMESTAMP))",
        "PT1H": "date_trunc('hour', CAST({col} AS TIMESTAMP))",
        "P1D": "date_trunc('day', CAST({col} AS TIMESTAMP))",
        "P1W": "date_trunc('week', CAST({col} AS TIMESTAMP))",
        "P1M": "date_trunc('month', CAST({col} AS TIMESTAMP))",
        "P0.25Y": "date_trunc('quarter', CAST({col} AS TIMESTAMP))",
        "P1Y": "date_trunc('year', CAST({col} AS TIMESTAMP))",
        "P1W/1970-01-03T00:00:00Z": "date_add('day', 5, date_trunc('week', \
                                    date_add('day', 1, CAST({col} AS TIMESTAMP))))",
        "1969-12-28T00:00:00Z/P1W": "date_add('day', -1, date_trunc('week', \
                                    date_add('day', 1, CAST({col} AS TIMESTAMP))))",
    }

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        tt = target_type.upper()
        if tt == utils.TemporalType.DATE:
            return f"from_iso8601_date('{dttm.date().isoformat()}')"
        if tt == utils.TemporalType.TIMESTAMP:
            datetime_formatted = dttm.isoformat(timespec="microseconds")
            return f"""from_iso8601_timestamp('{datetime_formatted}')"""
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
    def create_table_from_csv(  # pylint: disable=too-many-arguments
        cls,
        filename: str,
        table: Table,
        database: "Database",
        csv_to_df_kwargs: Dict[str, Any],
        df_to_sql_kwargs: Dict[str, Any],
    ) -> None:
        """
        Create table from contents of a csv. Note: this method does not create
        metadata for the table.
        """
        df = cls.csv_to_df(filepath_or_buffer=filename, **csv_to_df_kwargs)
        engine = cls.get_engine(database)
        if table.schema:
            # only add schema when it is preset and non empty
            df_to_sql_kwargs["schema"] = table.schema
        if engine.dialect.dbapi.__name__ == "pyathena":
            from pyathena.pandas.util import to_sql

            with engine.connect() as conn:
                pyathena_conn = conn.connection.connection
                to_sql(
                    df,
                    conn=pyathena_conn,
                    location=pyathena_conn.s3_staging_dir.rstrip("/")
                    + "/{}/{}/".format(table.schema, table.table),
                    **df_to_sql_kwargs,
                )
        else:
            if engine.dialect.supports_multivalues_insert:
                df_to_sql_kwargs["method"] = "multi"
            cls.df_to_sql(df=df, con=engine, **df_to_sql_kwargs)
