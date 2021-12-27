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
from typing import Any, Dict, Optional, TYPE_CHECKING

from superset.db_engine_specs.base import BaseEngineSpec
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.connectors.sqla.models import TableColumn


class SybaseEngineSpec(BaseEngineSpec):
    engine = "sybase"
    engine_name = "Sybase"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "DATEPART(SECOND, {col})",
        "PT1M": "DATEPART(MINUTE, {col})",
        "PT1H": "DATEPART(HOUR, {col})",
        "P1D": "DATEPART(DAY, {col})",
        "P1W": "DATEPART(WEEK, {col})",
        "P1M": "DATEPART(MONTH, {col})",
        "P3M": "DATEPART(QUARTER, {col})",
        "P1Y": "DATEPART(YEAR, {col})",
    }

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "{col}"

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        print(cls)
        tt = target_type.upper()
        if tt == utils.TemporalType.DATE:
            return f"DATE '{dttm.date().isoformat()}'"
        if tt == utils.TemporalType.DATETIME:
            dttm_formatted = dttm.isoformat(sep=" ", timespec="microseconds")
            return f"""DATETIME '{dttm_formatted}'"""
        if tt == utils.TemporalType.TIMESTAMP:
            dttm_formatted = dttm.isoformat(timespec="microseconds")
            return f"""TIMESTAMP '{dttm_formatted}'"""
        return None

    @classmethod
    def alter_new_orm_column(cls, orm_col: "TableColumn") -> None:
        if orm_col.type == "TIMESTAMP":
            orm_col.python_date_format = "epoch_ms"
