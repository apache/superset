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

from superset.db_engine_specs.hive import HiveEngineSpec
from superset.db_engine_specs.mssql import MssqlEngineSpec
from datetime import datetime
from typing import Optional

class DatabricksHiveEngineSpec(MssqlEngineSpec):
    engine = "databricks"
    engine_name = "Databricks Hive"
    driver = "pyodbc"
    _show_functions_column = "function"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "from_unixtime(unix_timestamp({col}), 'yyyy-MM-dd HH:mm:ss')",
        "PT1M": "from_unixtime(unix_timestamp({col}), 'yyyy-MM-dd HH:mm:00')",
        "PT1H": "from_unixtime(unix_timestamp({col}), 'yyyy-MM-dd HH:00:00')",
        "P1D": "from_unixtime(unix_timestamp({col}), 'yyyy-MM-dd 00:00:00')",
        'P1W': "date_sub(from_unixtime(unix_timestamp({col}, 'yyyy-MM-dd 00:00:00')), 7)",
        "P1M": "from_unixtime(unix_timestamp({col}), 'yyyy-MM-01 00:00:00')",
        "P0.25Y": "date_format(add_months(trunc({col}, 'MM'), -(month({col})-1)%3), 'yyyy-MM-dd 00:00:00')",
        "P1Y": "from_unixtime(unix_timestamp({col}), 'yyyy-01-01 00:00:00')"
        }

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        """
        Convert Python datetime object to a SQL expression
        :param target_type: The target type of expression
        :param dttm: The datetime object
        :return: The SQL expression
        """
        return None
