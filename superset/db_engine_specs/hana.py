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
from typing import Any, Optional

from sqlalchemy import types

from superset.constants import TimeGrain
from superset.db_engine_specs.base import LimitMethod
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec


class HanaEngineSpec(PostgresBaseEngineSpec):
    engine = "hana"
    engine_name = "SAP HANA"
    limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "TO_TIMESTAMP(SUBSTRING(TO_TIMESTAMP({col}),0,20))",
        TimeGrain.MINUTE: "TO_TIMESTAMP(SUBSTRING(TO_TIMESTAMP({col}),0,17) || '00')",
        TimeGrain.HOUR: "TO_TIMESTAMP(SUBSTRING(TO_TIMESTAMP({col}),0,14) || '00:00')",
        TimeGrain.DAY: "TO_DATE({col})",
        TimeGrain.MONTH: "TO_DATE(SUBSTRING(TO_DATE({col}),0,7)||'-01')",
        TimeGrain.QUARTER: "TO_DATE(SUBSTRING( \
                   TO_DATE({col}), 0, 5)|| LPAD(CAST((CAST(SUBSTRING(QUARTER( \
                   TO_DATE({col}), 1), 7, 1) as int)-1)*3 +1 as text),2,'0') ||'-01')",
        TimeGrain.YEAR: "TO_DATE(YEAR({col})||'-01-01')",
    }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"TO_DATE('{dttm.date().isoformat()}', 'YYYY-MM-DD')"
        if isinstance(sqla_type, types.TIMESTAMP):
            return f"""TO_TIMESTAMP('{dttm
                .isoformat(timespec="microseconds")}', 'YYYY-MM-DD"T"HH24:MI:SS.ff6')"""
        return None
