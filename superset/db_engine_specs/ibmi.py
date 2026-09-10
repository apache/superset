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
from superset.constants import TimeGrain

from .db2 import Db2EngineSpec


class IBMiEngineSpec(Db2EngineSpec):
    """IBM Db2 for i (AS/400) engine spec.

    Note: Documentation is in Db2EngineSpec's compatible_databases section.
    This spec exists for runtime support of the ibmi driver.
    """

    engine = "ibmi"
    engine_name = "IBM Db2 for i"
    max_column_name_length = 128

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "CAST({col} as TIMESTAMP) - MICROSECOND({col}) MICROSECONDS",
        TimeGrain.MINUTE: "CAST({col} as TIMESTAMP)"
        " - SECOND({col}) SECONDS"
        " - MICROSECOND({col}) MICROSECONDS",
        TimeGrain.HOUR: "CAST({col} as TIMESTAMP)"
        " - MINUTE({col}) MINUTES"
        " - SECOND({col}) SECONDS"
        " - MICROSECOND({col}) MICROSECONDS ",
        TimeGrain.DAY: "DATE({col})",
        TimeGrain.WEEK: "{col} - (DAYOFWEEK({col})) DAYS",
        TimeGrain.MONTH: "{col} - (DAY({col})-1) DAYS",
        TimeGrain.QUARTER: "{col} - (DAY({col})-1) DAYS"
        " - (MONTH({col})-1) MONTHS"
        " + ((QUARTER({col})-1) * 3) MONTHS",
        TimeGrain.YEAR: "{col} - (DAY({col})-1) DAYS - (MONTH({col})-1) MONTHS",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "(DAYS({col}) - DAYS('1970-01-01')) * 86400 + MIDNIGHT_SECONDS({col})"
