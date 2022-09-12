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
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from sqlalchemy.engine.reflection import Inspector

from superset.constants import USER_AGENT
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.hive import HiveEngineSpec

if TYPE_CHECKING:
    from superset.models.core import Database

time_grain_expressions = {
    None: "{col}",
    "PT1S": "date_trunc('second', {col})",
    "PT1M": "date_trunc('minute', {col})",
    "PT1H": "date_trunc('hour', {col})",
    "P1D": "date_trunc('day', {col})",
    "P1W": "date_trunc('week', {col})",
    "P1M": "date_trunc('month', {col})",
    "P3M": "date_trunc('quarter', {col})",
    "P1Y": "date_trunc('year', {col})",
    "P1W/1970-01-03T00:00:00Z": (
        "date_trunc('week', {col} + interval '1 day') + interval '5 days'"
    ),
    "1969-12-28T00:00:00Z/P1W": (
        "date_trunc('week', {col} + interval '1 day') - interval '1 day'"
    ),
}


class DatabricksHiveEngineSpec(HiveEngineSpec):
    engine_name = "Databricks Interactive Cluster"

    engine = "databricks"
    drivers = {"pyhive": "Hive driver for Interactive Cluster"}
    default_driver = "pyhive"

    _show_functions_column = "function"

    _time_grain_expressions = time_grain_expressions


class DatabricksODBCEngineSpec(BaseEngineSpec):
    engine_name = "Databricks SQL Endpoint"

    engine = "databricks"
    drivers = {"pyodbc": "ODBC driver for SQL endpoint"}
    default_driver = "pyodbc"

    _time_grain_expressions = time_grain_expressions

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        return HiveEngineSpec.convert_dttm(target_type, dttm, db_extra=db_extra)

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return HiveEngineSpec.epoch_to_dttm()


class DatabricksNativeEngineSpec(DatabricksODBCEngineSpec):
    engine_name = "Databricks Native Connector"

    engine = "databricks"
    drivers = {"connector": "Native all-purpose driver"}
    default_driver = "connector"

    @staticmethod
    def get_extra_params(database: "Database") -> Dict[str, Any]:
        """
        Add a user agent to be used in the requests.
        """
        extra = {
            "http_headers": [("User-Agent", USER_AGENT)],
            "_user_agent_entry": USER_AGENT,
        }
        extra.update(BaseEngineSpec.get_extra_params(database))
        return extra

    @classmethod
    def get_table_names(
        cls,
        database: "Database",
        inspector: Inspector,
        schema: Optional[str],
    ) -> List[str]:
        tables = set(super().get_table_names(database, inspector, schema))
        views = set(cls.get_view_names(database, inspector, schema))
        actual_tables = tables - views

        return list(actual_tables)
