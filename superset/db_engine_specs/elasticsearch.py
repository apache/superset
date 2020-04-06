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
from typing import Dict, Optional

from superset.db_engine_specs.base import BaseEngineSpec


class ElasticSearchEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    engine = "elasticsearch"
    time_groupby_inline = True
    time_secondary_columns = True
    allows_joins = False
    allows_subqueries = True

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "HISTOGRAM({col}, INTERVAL 1 SECOND)",
        "PT1M": "HISTOGRAM({col}, INTERVAL 1 MINUTE)",
        "PT1H": "HISTOGRAM({col}, INTERVAL 1 HOUR)",
        "P1D": "HISTOGRAM({col}, INTERVAL 1 DAY)",
        "P1M": "HISTOGRAM({col}, INTERVAL 1 MONTH)",
        "P1Y": "HISTOGRAM({col}, INTERVAL 1 YEAR)",
    }

    type_code_map: Dict[int, str] = {}  # loaded from get_datatype only if needed

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        if target_type.upper() == "DATETIME":
            return f"""CAST('{dttm.isoformat(timespec="seconds")}' AS DATETIME)"""
        return None
