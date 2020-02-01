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
from superset.db_engine_specs.base import BaseEngineSpec, LimitMethod


class Db2EngineSpec(BaseEngineSpec):
    engine = "ibm_db_sa"
    limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30

    _time_grain_functions = {
        None: "{col}",
        "PT1S": "CAST({col} as TIMESTAMP)" " - MICROSECOND({col}) MICROSECONDS",
        "PT1M": "CAST({col} as TIMESTAMP)"
        " - SECOND({col}) SECONDS"
        " - MICROSECOND({col}) MICROSECONDS",
        "PT1H": "CAST({col} as TIMESTAMP)"
        " - MINUTE({col}) MINUTES"
        " - SECOND({col}) SECONDS"
        " - MICROSECOND({col}) MICROSECONDS ",
        "P1D": "CAST({col} as TIMESTAMP)"
        " - HOUR({col}) HOURS"
        " - MINUTE({col}) MINUTES"
        " - SECOND({col}) SECONDS"
        " - MICROSECOND({col}) MICROSECONDS",
        "P1W": "{col} - (DAYOFWEEK({col})) DAYS",
        "P1M": "{col} - (DAY({col})-1) DAYS",
        "P0.25Y": "{col} - (DAY({col})-1) DAYS"
        " - (MONTH({col})-1) MONTHS"
        " + ((QUARTER({col})-1) * 3) MONTHS",
        "P1Y": "{col} - (DAY({col})-1) DAYS" " - (MONTH({col})-1) MONTHS",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "(TIMESTAMP('1970-01-01', '00:00:00') + {col} SECONDS)"
