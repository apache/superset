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
import re
from typing import List, Optional, Tuple

from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import String, TypeEngine, UnicodeText

from superset.db_engine_specs.base import BaseEngineSpec, LimitMethod


class MssqlEngineSpec(BaseEngineSpec):
    engine = "mssql"
    epoch_to_dttm = "dateadd(S, {col}, '1970-01-01')"
    limit_method = LimitMethod.WRAP_SQL
    max_column_name_length = 128

    _time_grain_functions = {
        None: "{col}",
        "PT1S": "DATEADD(second, DATEDIFF(second, '2000-01-01', {col}), '2000-01-01')",
        "PT1M": "DATEADD(minute, DATEDIFF(minute, 0, {col}), 0)",
        "PT5M": "DATEADD(minute, DATEDIFF(minute, 0, {col}) / 5 * 5, 0)",
        "PT10M": "DATEADD(minute, DATEDIFF(minute, 0, {col}) / 10 * 10, 0)",
        "PT15M": "DATEADD(minute, DATEDIFF(minute, 0, {col}) / 15 * 15, 0)",
        "PT0.5H": "DATEADD(minute, DATEDIFF(minute, 0, {col}) / 30 * 30, 0)",
        "PT1H": "DATEADD(hour, DATEDIFF(hour, 0, {col}), 0)",
        "P1D": "DATEADD(day, DATEDIFF(day, 0, {col}), 0)",
        "P1W": "DATEADD(week, DATEDIFF(week, 0, {col}), 0)",
        "P1M": "DATEADD(month, DATEDIFF(month, 0, {col}), 0)",
        "P0.25Y": "DATEADD(quarter, DATEDIFF(quarter, 0, {col}), 0)",
        "P1Y": "DATEADD(year, DATEDIFF(year, 0, {col}), 0)",
    }

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> str:
        return "CONVERT(DATETIME, '{}', 126)".format(dttm.isoformat())

    @classmethod
    def fetch_data(cls, cursor, limit: int) -> List[Tuple]:
        data = super().fetch_data(cursor, limit)
        if data and type(data[0]).__name__ == "Row":
            data = [[elem for elem in r] for r in data]
        return data

    column_types = [
        (String(), re.compile(r"^(?<!N)((VAR){0,1}CHAR|TEXT|STRING)", re.IGNORECASE)),
        (UnicodeText(), re.compile(r"^N((VAR){0,1}CHAR|TEXT)", re.IGNORECASE)),
    ]

    @classmethod
    def get_sqla_column_type(cls, type_: str) -> Optional[TypeEngine]:
        for sqla_type, regex in cls.column_types:
            if regex.match(type_):
                return sqla_type
        return None

    @classmethod
    def column_datatype_to_string(
        cls, sqla_column_type: TypeEngine, dialect: Dialect
    ) -> str:
        datatype = super().column_datatype_to_string(sqla_column_type, dialect)
        # MSSQL returns long overflowing datatype
        # as in 'VARCHAR(255) COLLATE SQL_LATIN1_GENERAL_CP1_CI_AS'
        # and we don't need the verbose collation type
        str_cutoff = " COLLATE "
        if str_cutoff in datatype:
            datatype = datatype.split(str_cutoff)[0]
        return datatype
