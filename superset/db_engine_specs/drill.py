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
from typing import Optional
from urllib import parse

from sqlalchemy.engine.url import URL

from superset.db_engine_specs.base import BaseEngineSpec


class DrillEngineSpec(BaseEngineSpec):
    """Engine spec for Apache Drill"""

    engine = "drill"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "NEARESTDATE({col}, 'SECOND')",
        "PT1M": "NEARESTDATE({col}, 'MINUTE')",
        "PT15M": "NEARESTDATE({col}, 'QUARTER_HOUR')",
        "PT0.5H": "NEARESTDATE({col}, 'HALF_HOUR')",
        "PT1H": "NEARESTDATE({col}, 'HOUR')",
        "P1D": "NEARESTDATE({col}, 'DAY')",
        "P1W": "NEARESTDATE({col}, 'WEEK_SUNDAY')",
        "P1M": "NEARESTDATE({col}, 'MONTH')",
        "P0.25Y": "NEARESTDATE({col}, 'QUARTER')",
        "P1Y": "NEARESTDATE({col}, 'YEAR')",
    }

    # Returns a function to convert a Unix timestamp in milliseconds to a date
    @classmethod
    def epoch_to_dttm(cls) -> str:
        return cls.epoch_ms_to_dttm().replace("{col}", "({col}*1000)")

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "TO_DATE({col})"

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        tt = target_type.upper()
        if tt == "DATE":
            return f"TO_DATE('{dttm.date().isoformat()}', 'yyyy-MM-dd')"
        if tt == "TIMESTAMP":
            return f"""TO_TIMESTAMP('{dttm.isoformat(sep=" ", timespec="seconds")}', 'yyyy-MM-dd HH:mm:ss')"""  # pylint: disable=line-too-long
        return None

    @classmethod
    def adjust_database_uri(cls, uri: URL, selected_schema: Optional[str]) -> None:
        if selected_schema:
            uri.database = parse.quote(selected_schema, safe="")
