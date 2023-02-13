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
from typing import Any, Dict, Optional

from sqlalchemy import types

from superset.db_engine_specs.base import BaseEngineSpec


class DremioEngineSpec(BaseEngineSpec):

    engine = "dremio"
    engine_name = "Dremio"

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
        return "TO_DATE({col})"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"TO_DATE('{dttm.date().isoformat()}', 'YYYY-MM-DD')"
        if isinstance(sqla_type, types.TIMESTAMP):
            dttm_formatted = dttm.isoformat(sep=" ", timespec="milliseconds")
            return f"""TO_TIMESTAMP('{dttm_formatted}', 'YYYY-MM-DD HH24:MI:SS.FFF')"""
        return None
