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


class ByteHouseEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    """Dialect for ByteHouse"""

    engine = "bytehouse"
    engine_name = "ByteHouse"

    time_secondary_columns = True
    time_groupby_inline = True

    _time_grain_expressions = {
        None: "{col}",
        "PT1M": "toStartOfMinute(toDateTime({col}))",
        "PT5M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 300)*300)",
        "PT10M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 600)*600)",
        "PT15M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 900)*900)",
        "PT30M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 1800)*1800)",
        "PT1H": "toStartOfHour(toDateTime({col}))",
        "P1D": "toStartOfDay(toDateTime({col}))",
        "P1W": "toMonday(toDateTime({col}))",
        "P1M": "toStartOfMonth(toDateTime({col}))",
        "P3M": "toStartOfQuarter(toDateTime({col}))",
        "P1Y": "toStartOfYear(toDateTime({col}))",
    }

    _show_functions_column = "name"

    supports_file_upload = False

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"toDate('{dttm.date().isoformat()}')"
        if isinstance(sqla_type, types.DateTime):
            return f"""toDateTime('{dttm.isoformat(sep=" ", timespec="seconds")}')"""
        return None
