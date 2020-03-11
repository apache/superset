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
import hashlib
import re
from datetime import datetime
from typing import Optional, Union

from sqlalchemy.sql import quoted_name

from superset.db_engine_specs.base import BaseEngineSpec


class KylinEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    """Dialect for Apache Kylin"""

    engine = "kylin"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "CAST(FLOOR(CAST({col} AS TIMESTAMP) TO SECOND) AS TIMESTAMP)",
        "PT1M": "CAST(FLOOR(CAST({col} AS TIMESTAMP) TO MINUTE) AS TIMESTAMP)",
        "PT1H": "CAST(FLOOR(CAST({col} AS TIMESTAMP) TO HOUR) AS TIMESTAMP)",
        "P1D": "CAST(FLOOR(CAST({col} AS TIMESTAMP) TO DAY) AS DATE)",
        "P1W": "CAST(TIMESTAMPADD(WEEK, WEEK(CAST({col} AS DATE)) - 1, \
               FLOOR(CAST({col} AS TIMESTAMP) TO YEAR)) AS DATE)",
        "P1M": "CAST(FLOOR(CAST({col} AS TIMESTAMP) TO MONTH) AS DATE)",
        "P0.25Y": "CAST(TIMESTAMPADD(QUARTER, QUARTER(CAST({col} AS DATE)) - 1, \
                  FLOOR(CAST({col} AS TIMESTAMP) TO YEAR)) AS DATE)",
        "P1Y": "CAST(FLOOR(CAST({col} AS TIMESTAMP) TO YEAR) AS DATE)",
    }

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        tt = target_type.upper()
        if tt == "DATE":
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if tt == "TIMESTAMP":
            return f"""CAST('{dttm.isoformat(sep=" ", timespec="seconds")}' AS TIMESTAMP)"""  # pylint: disable=line-too-long
        return None

    @classmethod
    def make_label_compatible(cls, label: str) -> Union[str, quoted_name]:
        label_mutated = cls._mutate_label(label)
        # explicitly disable quotes
        label_mutated = quoted_name(label_mutated, False)
        return label_mutated

    @staticmethod
    def _mutate_label(label: str) -> str:
        label_hashed = "_" + hashlib.md5(label.encode("utf-8")).hexdigest()
        label_mutated = label.lower()

        # replace non-alphanumeric characters with underscores
        label_mutated = re.sub(r"[^\w]+", "_", label_mutated)
        if label_mutated != label:
            # add first 5 chars from md5 hash to label to avoid possible collisions
            label_mutated += label_hashed[:6]

        return label_mutated
