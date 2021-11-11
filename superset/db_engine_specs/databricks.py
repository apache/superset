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
# under the License.o

from datetime import datetime
from typing import Any, Dict, Optional

from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.hive import HiveEngineSpec


class DatabricksHiveEngineSpec(HiveEngineSpec):
    engine = "databricks"
    engine_name = "Databricks Interactive Cluster"
    driver = "pyhive"
    _show_functions_column = "function"


class DatabricksODBCEngineSpec(BaseEngineSpec):
    engine = "databricks"
    engine_name = "Databricks SQL Endpoint"
    driver = "pyodbc"

    # the syntax for the ODBC engine is identical to the Hive one, so
    # we can reuse the expressions from `HiveEngineSpec`
    # pylint: disable=protected-access
    _time_grain_expressions = HiveEngineSpec._time_grain_expressions

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        return HiveEngineSpec.convert_dttm(target_type, dttm, db_extra=db_extra)

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return HiveEngineSpec.epoch_to_dttm()
