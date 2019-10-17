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

from superset.db_engine_specs.base import LimitMethod
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec


class HanaEngineSpec(PostgresBaseEngineSpec):
    engine = "hana"
    limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30

    _time_grain_functions = {
        None: '{col}',
        'P1D': "TO_DATE({col})",
        'P1M': "TO_DATE(SUBSTRING(to_date({col}),0,7)||'-01')",
        'P0.25Y': "TO_DATE(SUBSTRING(to_date({col}),0,5)||'0'||SUBSTRING(QUARTER(TO_DATE({col}), 1),7,1)||'-01')",
        'P1Y': "TO_DATE(YEAR({col})||'-01-01')",
    }

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> str:
        return ("""to_char(to_date('{}'),'YYYYMMDD')""").format(
            dttm.isoformat()
        )
