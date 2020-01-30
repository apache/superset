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
from typing import List, Optional, TYPE_CHECKING
from urllib import parse

import pandas as pd

from superset.db_engine_specs.postgres import PostgresBaseEngineSpec
from superset.utils.cache import function_cache_key, memoized_func

if TYPE_CHECKING:
    from superset.models.core import Database  # pylint: disable=unused-import

# "SHOW FUNCTIONS" returns many operators and internal functions that are not
# relevant for Sql Lab. This regex is used to remove those in `get_function_names`.
FUNC_REGEX = re.compile(r"^((?<!SYSTEM$)(\w))+$")


class SnowflakeEngineSpec(PostgresBaseEngineSpec):
    engine = "snowflake"
    force_column_alias_quotes = True
    max_column_name_length = 256

    _time_grain_functions = {
        None: "{col}",
        "PT1S": "DATE_TRUNC('SECOND', {col})",
        "PT1M": "DATE_TRUNC('MINUTE', {col})",
        "PT5M": "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 5) * 5, \
                DATE_TRUNC('HOUR', {col}))",
        "PT10M": "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 10) * 10, \
                 DATE_TRUNC('HOUR', {col}))",
        "PT15M": "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 15) * 15, \
                 DATE_TRUNC('HOUR', {col}))",
        "PT0.5H": "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 30) * 30, \
                  DATE_TRUNC('HOUR', {col}))",
        "PT1H": "DATE_TRUNC('HOUR', {col})",
        "P1D": "DATE_TRUNC('DAY', {col})",
        "P1W": "DATE_TRUNC('WEEK', {col})",
        "P1M": "DATE_TRUNC('MONTH', {col})",
        "P0.25Y": "DATE_TRUNC('QUARTER', {col})",
        "P1Y": "DATE_TRUNC('YEAR', {col})",
    }

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema=None):
        database = uri.database
        if "/" in uri.database:
            database = uri.database.split("/")[0]
        if selected_schema:
            selected_schema = parse.quote(selected_schema, safe="")
            uri.database = database + "/" + selected_schema
        return uri

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "DATEADD(S, {col}, '1970-01-01')"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "DATEADD(MS, {col}, '1970-01-01')"

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        tt = target_type.upper()
        if tt == "DATE":
            return f"TO_DATE('{dttm.date().isoformat()}')"
        if tt == "DATETIME":
            return f"""CAST('{dttm.isoformat(timespec="microseconds")}' AS DATETIME)"""
        if tt == "TIMESTAMP":
            return f"""TO_TIMESTAMP('{dttm.isoformat(timespec="microseconds")}')"""
        return None

    @classmethod
    @memoized_func(key=function_cache_key)
    def get_function_names(
        cls, database: "Database", schema: Optional[str]
    ) -> List[str]:
        """
        Get a list of function names that are able to be called on the database.
        Used for SQL Lab autocomplete. Returns global functions, excluding system
        functions (starting with "SYSTEM$") and UDFs that are available in the chosen
        schema.

        :param database: The database to get functions for
        :param schema: The schema to get functions for
        :return: A list of function names useable in the database
        """

        def _is_valid_function(func_row: pd.Series) -> bool:
            func_schema, func_name = func_row["schema_name"], func_row["name"]
            if FUNC_REGEX.match(func_name) and (
                not func_schema or not schema or schema.lower() == func_schema.lower()
            ):
                return True
            return False

        func_df = database.get_df("SHOW FUNCTIONS")
        return [row["name"] for _, row in func_df.iterrows() if _is_valid_function(row)]
