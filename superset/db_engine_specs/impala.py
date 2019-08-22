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
# pylint: disable=C,R,W
from datetime import datetime
from typing import List

from sqlalchemy.engine.reflection import Inspector

from superset.db_engine_specs.base import BaseEngineSpec


class ImpalaEngineSpec(BaseEngineSpec):
    """Engine spec for Cloudera's Impala"""

    engine = "impala"

    time_grain_functions = {
        None: "{col}",
        "PT1M": "TRUNC({col}, 'MI')",
        "PT1H": "TRUNC({col}, 'HH')",
        "P1D": "TRUNC({col}, 'DD')",
        "P1W": "TRUNC({col}, 'WW')",
        "P1M": "TRUNC({col}, 'MONTH')",
        "P0.25Y": "TRUNC({col}, 'Q')",
        "P1Y": "TRUNC({col}, 'YYYY')",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> str:
        tt = target_type.upper()
        if tt == "DATE":
            return "'{}'".format(dttm.strftime("%Y-%m-%d"))
        return "'{}'".format(dttm.strftime("%Y-%m-%d %H:%M:%S"))

    @classmethod
    def get_schema_names(cls, inspector: Inspector) -> List[str]:
        schemas = [
            row[0]
            for row in inspector.engine.execute("SHOW SCHEMAS")
            if not row[0].startswith("_")
        ]
        return schemas
