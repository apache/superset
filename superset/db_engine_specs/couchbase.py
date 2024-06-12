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
from superset.db_engine_specs.base import BaseEngineSpec
from superset.constants import TimeGrain
from datetime import datetime
import sqlparse
from superset.db_engine_specs.base import BaseEngineSpec
from superset.superset_typing import ResultSetColumnType, SQLAColumnType
from flask_babel import gettext as __
from superset.db_engine_specs.base import BaseEngineSpec
from typing import (
    Any
)

class CouchbaseEngineSpec(BaseEngineSpec):
    engine = 'couchbase'
    engine_name = 'couchbase'
    allows_subqueries = False
    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_TRUNC_STR(TOSTRING({col}),'second')",
        TimeGrain.MINUTE: "DATE_TRUNC_STR(TOSTRING({col}),'minute')",
        TimeGrain.HOUR: "DATE_TRUNC_STR(TOSTRING({col}),'hour')",
        TimeGrain.DAY: "DATE_TRUNC_STR(TOSTRING({col}),'day')",
        TimeGrain.MONTH: "DATE_TRUNC_STR(TOSTRING({col}),'month')",
        TimeGrain.YEAR: "DATE_TRUNC_STR(TOSTRING({col}),'year')",
        TimeGrain.QUARTER:  "DATE_TRUNC_STR(TOSTRING({col}),'quarter')"
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "{col} * 1000"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "{col}"
    
    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)
        return f"DATETIME(DATE_FORMAT_STR(STR_TO_UTC('{dttm.date().isoformat()}'), 'iso8601'))"
    
    @classmethod
    def parse_sql(cls, sql: str) -> list[str]:
        sql.replace("`COUNT(*)`","COUNT(*)")
        return [str(s).strip(" ;") for s in sqlparse.parse(sql)]