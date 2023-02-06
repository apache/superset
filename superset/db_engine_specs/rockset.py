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

from sqlalchemy import types

from superset.db_engine_specs.base import BaseEngineSpec

if TYPE_CHECKING:
    from superset.connectors.sqla.models import TableColumn


class RocksetEngineSpec(BaseEngineSpec):

    engine = "rockset"
    engine_name = "Rockset"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "DATE_TRUNC('second', {col})",
        "PT1M": "DATE_TRUNC('minute', {col})",
        "PT1H": "DATE_TRUNC('hour', {col})",
        "P1D": "DATE_TRUNC('day', {col})",
        "P1W": "DATE_TRUNC('week', {col})",
        "P1M": "DATE_TRUNC('month', {col})",
        "P3M": "DATE_TRUNC('quarter', {col})",
        "P1Y": "DATE_TRUNC('year', {col})",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "{col} * 1000"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "{col}"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"DATE '{dttm.date().isoformat()}'"
        if isinstance(sqla_type, types.TIMESTAMP):
            dttm_formatted = dttm.isoformat(timespec="microseconds")
            return f"""TIMESTAMP '{dttm_formatted}'"""
        if isinstance(sqla_type, types.DateTime):
            dttm_formatted = dttm.isoformat(sep=" ", timespec="microseconds")
            return f"""DATETIME '{dttm_formatted}'"""
        return None

    @classmethod
    def alter_new_orm_column(cls, orm_col: "TableColumn") -> None:
        if orm_col.type == "TIMESTAMP":
            orm_col.python_date_format = "epoch_ms"
